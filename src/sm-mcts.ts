import * as moment from 'moment';

/**
 * generate a random integer between min and max
 * @param  min 
 * @param  max
 * @return  random generated integer 
 */
function randomInt(min: number, max: number): number {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

export type Player = 'min' | 'max';

export interface Action {
    readonly name: string;
    readonly hash: string;
    toString(): string;
    toJSON(): object;
}

export interface SimultaneousAction {
    toString(): string;
    readonly actions: Map<Player, Action>;
    readonly isChance: boolean;
    /**
     * this has will be used to index the simultaneous actions, so be sure
     * to make sure that chance actions from the same state have a different hash
     */
    readonly hash: string;
}

export interface State {
    readonly hash: string;
    readonly possibleSimultaneousActions: Set<SimultaneousAction>;
    getPlayerActions(player: Player): Set<Action>;
    isFinal(): boolean;
    toString(): string;
    toJSON(): object;
    awaitsChance(): boolean;
}

export interface Simulator {
    readonly state: State;
    getPreviousSimultaneousAction(): SimultaneousAction;
    isOver(): boolean;
    choose(simultAction: SimultaneousAction): void;
    runSimultaneousAction(): State;
    getReward(): number;
    restart(): void;
}

class MonteCarloNode {
    private _state: State;
    private _childNodes: Map<string, MonteCarloNode>;
    private _parent: MonteCarloNode;
    private _numberOfVisits: number;
    private _payoff: number;

    constructor(state: State, simultAction?: SimultaneousAction, parent?: MonteCarloNode) {
        this._state = state;
        this._childNodes = new Map<string, MonteCarloNode>();
        this._parent = parent;
        if (!this.isRoot) {
            this._parent.addChild(this, simultAction);
        }
        this._numberOfVisits = 0;
        this._payoff = 0;
    }

    get numberOfVisits(): number {
        return this._numberOfVisits;
    }

    get payoff(): number {
        return this._payoff;
    }

    get isChanceNode(): boolean { return this._state.awaitsChance(); }

    get unplayedSimultActions(): Set<SimultaneousAction> {
        return new Set([...this._state.possibleSimultaneousActions].filter((sa: SimultaneousAction) => {
            return !this.hasChild(sa);
        }));
    }

    get possibleSimultActions(): Set<SimultaneousAction> {
        return this._state.possibleSimultaneousActions;
    }

    addVisit(vs: number) {
        this._numberOfVisits++;
        this._payoff += vs;
        if (!this.isRoot) {
            this._parent.addVisit(vs);
        }
    }

    getNumberOfVisits(player: Player, action: Action): number {
        return this.getChilds(player, action).reduce((total, node) => {
            return total + node.numberOfVisits;
        }, 0);
    }
    getChilds(player: Player, action: Action): MonteCarloNode[] {
        return [...this.possibleSimultActions].filter((simultAction) => {
            return simultAction.actions.get(player).hash === action.hash;
        }).map((simultAction) => {
            return this._childNodes.get(simultAction.hash);
        });
    }

    getCumulativePayoff(player: Player, action: Action): number {
        return this.getChilds(player, action).reduce((total, node) => {
            return total + node.payoff;
        }, 0);
    }

    getActions(player: Player): Set<Action> {
        return this._state.getPlayerActions(player);
    }

    addChild(child: MonteCarloNode, simultAction: SimultaneousAction): MonteCarloNode {
        this._childNodes.set(simultAction.hash, child);
        return child;
    }

    getChild(simultActions: SimultaneousAction): MonteCarloNode {
        return this._childNodes.get(simultActions.hash);
    }

    getSimultaneousAction(actions: Map<Player, Action>): SimultaneousAction | undefined {
        return [...this.possibleSimultActions].find(simulAction => {
            let match = true;
            for (const player of actions.keys()) {
                match = match && (actions.get(player).hash === simulAction.actions.get(player).hash);
            }
            return match && simulAction.actions.size === actions.size;
        });
    }

    hasChild(simultActions: SimultaneousAction): boolean {
        return this._childNodes.has(simultActions.hash);
    }

    get hash(): string {
        return this._state.hash;
    }

    get isRoot(): boolean {
        return this._state.hash === this._parent.hash;
    }

    get isFinalState(): boolean {
        return this._state.isFinal();
    }
}

class MonteCarloTree {
    private _nodes: Map<string, MonteCarloNode>;
    private _currentNode: MonteCarloNode;
    private _rootHash: string;

    constructor(state: State) {
        this._currentNode = new MonteCarloNode(state);
        this._rootHash = this._currentNode.hash;
        this._nodes = new Map<string, MonteCarloNode>([[this._rootHash, this._currentNode]]);
    }

    get currentNode() { return this._currentNode; }

    backToRoot() {
        this._currentNode = this._nodes.get(this._rootHash);
    }

    getMostSimulatedFirstChildSimultaneousAction(): SimultaneousAction {
        const root = this._nodes.get(this._rootHash);
        let maxSimulations: number = -1;
        let maxSimulationActions: SimultaneousAction[];
        for (const simulAction of root.possibleSimultActions) {
            const simulations = root.getChild(simulAction).numberOfVisits;
            if (simulations == maxSimulations) {
                maxSimulationActions.push(simulAction);
            } else if (simulations > maxSimulations) {
                maxSimulationActions = [simulAction];
                maxSimulations = simulations;
            }
        }

        return maxSimulationActions[0];
    }

    /**
     * Creates state in the tree if it doesn't exist and always moves to the given state.
     * 
     * @param simultActions the simultaneous action used in the transition to the target state
     * @param state the state we want to move to. Will be created if it doesnt exist.
     */
    goToChildState(simultActions: SimultaneousAction, state: State): void {
        this._currentNode = this.currentNode.hasChild(simultActions) ?
            this.currentNode.getChild(simultActions) :
            new MonteCarloNode(state, simultActions);

        if (!this._nodes.has(this.currentNode.hash)) {
            this._nodes.set(this.currentNode.hash, this.currentNode)
        }
    }

    hasState(state: State): boolean {
        return this._nodes.has(state.hash);
    }

    update(stateHash: string, vs: number) {
        this._nodes.get(stateHash).addVisit(vs);
    }
}

const DEFAULT_EXPLORATION_COEFFICIENT = Math.SQRT2;
const DEFAULT_SIMULATION_TIMEOUT_SECONDS = 60 * 60; //1 hour

export class SmMCTS {
    private _sim: Simulator;
    private _tree: MonteCarloTree;
    private _players: Set<Player>;
    private _explorationCoefficient: number;
    private _simulationsRan: number;

    constructor(sim: Simulator, explorationCoefficient?: number) {
        this._sim = sim;
        this._tree = new MonteCarloTree(sim.state);
        this._players = new Set(['min', 'max']);
        this._explorationCoefficient = explorationCoefficient === undefined ? DEFAULT_EXPLORATION_COEFFICIENT : explorationCoefficient;
        this._simulationsRan = 0;
    }

    runSimulations(numberOfSimulations: number, timeBudgetSeconds?: number): SimultaneousAction {
        const targetSimulations: number = this._simulationsRan + numberOfSimulations;
        const targetTime: moment.Moment =
            moment().add(timeBudgetSeconds ? timeBudgetSeconds : DEFAULT_SIMULATION_TIMEOUT_SECONDS, 'seconds');

        do {
            this._simulate();
            this._sim.restart();
            this._tree.backToRoot();
        } while (this._simulationsRan < targetSimulations || moment().isAfter(targetTime));

        return this._tree.getMostSimulatedFirstChildSimultaneousAction();
    };

    private _simulate(): number {
        if (this.currentNode.isChanceNode) {
            const state: State = this._sim.runSimultaneousAction()
            this._tree.goToChildState(this._sim.getPreviousSimultaneousAction(), state);
            return this._simulate();
        }

        if (this._sim.isOver()) {
            this._simulationsRan++;
            return this._sim.getReward();
        }

        if (this._tree.hasState(this._sim.state)) {
            //select simultAction
            const simultAction: SimultaneousAction = this._select();
            //move to next state for selected simultAction (via sim)
            this._sim.choose(simultAction);
            this._sim.runSimultaneousAction();
            if (this._sim.state.awaitsChance()) {
                //we need to be on the chance node on the next simulation() call
                this._tree.goToChildState(this._sim.getPreviousSimultaneousAction(), this._sim.state);
            }
            // save state hash for updating
            const stateHash: string = this._sim.state.hash;
            //store expected utility from MCTS
            const vs: number = this._simulate();
            //run update
            this._update(stateHash, vs);
            //return expected utility
            return vs;
        } else {
            this._tree.goToChildState(this._sim.getPreviousSimultaneousAction(), this._sim.state);
            //do rollout and return result
            return this._rollout();
        }

    }

    private get currentNode() {
        return this._tree.currentNode;
    }

    private _select(): SimultaneousAction {
        if (this.currentNode.unplayedSimultActions.size > 0) {
            return this.currentNode.unplayedSimultActions.values().next().value;
        }

        const bestActions: Map<Player, Action> = new Map<Player, Action>();

        //UCT - Upper confidence bound applied to trees        
        for (const player of this._players) {
            let maxUtc: number = Number.NEGATIVE_INFINITY;
            let bestPlayerActions: Action[] = [];
            for (const action of this.currentNode.getActions(player)) {
                let payoff = this.currentNode.getCumulativePayoff(player, action);
                let actionVisits = this.currentNode.getNumberOfVisits(player, action);

                let utc = SmMCTS.UCT(player, payoff, actionVisits, this.currentNode.numberOfVisits, this._explorationCoefficient);

                if (utc == maxUtc) {
                    bestPlayerActions.push(action);
                } else if (utc > maxUtc) {
                    bestPlayerActions = [action];
                    maxUtc = utc;
                }
            }

            //tie break max utcs with random action
            const bestPlayerAction = bestPlayerActions[
                bestPlayerActions.length > 1 ? randomInt(0, bestPlayerActions.length - 1) : 0
            ];

            bestActions.set(player, bestPlayerAction);
        }

        return this.currentNode.getSimultaneousAction(bestActions);
    }

    static UCT(player: Player, payoff: number, actionVisits: number, numberOfVisits: number, explorationCoefficient: number): number {
        const payoffAvg = payoff / actionVisits;
        const exploration = Math.sqrt(Math.log10(numberOfVisits) / actionVisits);
        return (player === 'min' ? -1 : 1) * (payoffAvg + explorationCoefficient * exploration);
    }

    private _update(stateHash: string, vs: number) {
        this._tree.update(stateHash, vs);
    }

    private _rollout(): number {
        while (!this._sim.isOver()) {
            const moves = [...this._sim.state.possibleSimultaneousActions];
            this._sim.choose(moves[randomInt(0, moves.length - 1)]);
            this._sim.runSimultaneousAction();
        }
        return this._sim.getReward();
    }
}
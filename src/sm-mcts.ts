import * as moment from 'moment';
import * as _ from 'lodash';


class MctsTreeNodeObject {
    visits: number;
    rollouts: number;
    cumulativePayoff: number;
    isChanceNode: boolean;
    isFinal: boolean;
    childs: { [key: string]: MctsTreeNodeObject; };
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

export interface SimulationResult {
    readonly bestAction: string;
    readonly bestActionPath: string[];
    readonly payoff: PayoffStatistics;
}

export interface PayoffStatistics {
    min: number;
    max: number;
    avg: number;
    std: number;
    mode: number;
    modePath: string[]; 
}

class MonteCarloNode {
    private _state: State;
    private _childNodes: Map<string, MonteCarloNode>;
    private _parent: MonteCarloNode;
    private _numberOfVisits: number;
    private _payoff: number;
    private _rollouts: number;
    
    constructor(state: State, simultAction?: SimultaneousAction, parent?: MonteCarloNode) {
        this._state = state;
        this._childNodes = new Map<string, MonteCarloNode>();
        this._parent = parent;
        if (!this.isRoot) {
            parent.addChild(this, simultAction);
        }
        this._numberOfVisits = 0;
        this._payoff = 0;
        this._rollouts = 0;
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
            return !this.hasChild(sa) || this.getChild(sa)._numberOfVisits === 0;
        }));
    }

    get possibleSimultActions(): Set<SimultaneousAction> {
        return this._state.possibleSimultaneousActions;
    }

    get childActions(): string[] {
        return [...this._childNodes.keys()];
    }

    hasChilds(): boolean {
        return this._childNodes.size > 0;
    }

    /**
     *  
     * @param existingPath for recursive calls to parent
     * @returns an array of action hashes to be taked to reach this node
     */
    actionPath(existingPath?: string[]): string[] {
        if (this.isRoot) {
            return existingPath;
        }

        if (!existingPath) {
            existingPath = [];
        }

        existingPath.unshift(this._parent.getActionHashForChild(this).toString());
        
        return this._parent.actionPath(existingPath);
    }

    getActionHashForChild(child: MonteCarloNode): string {
        return [...this._childNodes.entries()].find((node) => node[1].hash === child.hash)[0];
    }

    getNodeObject(tree: MonteCarloTree): MctsTreeNodeObject {
        const childs: Map<string, MctsTreeNodeObject> = new Map<string, MctsTreeNodeObject>();
        
        for (const actionHash of this._childNodes.keys()) {
            childs.set(tree.actionDescription(actionHash), this._childNodes.get(actionHash).getNodeObject(tree));
        }

        return {
            visits: this._numberOfVisits,
            rollouts: this._rollouts,
            isChanceNode: this.isChanceNode,
            isFinal: this.isFinalState,
            cumulativePayoff: this._payoff,
            childs: Object.fromEntries(childs)
        };
    }

    addRollout() {
        this._rollouts++;
        if (!this.isRoot) {
            this._parent.addRollout();
        }
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
        const act = this.possibleSimultActions;
        /* istanbul ignore if */
        if (act.size == 0) {
            throw new Error(`no possible actions for node ${this.hash}`)
        }
        return [...act].find(simulAction => {
            /* istanbul ignore if */
            if (simulAction.actions.size !== actions.size) {
                return false;
            }
            let match = true;
            for (const player of actions.keys()) {
                match = match && (actions.get(player).hash === simulAction.actions.get(player).hash);
            }
            return match;
        });
    }

    hasChild(simultActions: SimultaneousAction): boolean {
        return this._childNodes.has(simultActions.hash);
    }

    get hash(): string {
        return this._state.hash;
    }

    get isRoot(): boolean {
        return !this._parent;
    }

    get isFinalState(): boolean {
        return this._state.isFinal();
    } 
}

class MonteCarloTreeFrequencyTable {
    private _leafNodes: MonteCarloNode[];
    private _min: number;
    private _max: number;
    private _visits: number;
    private _rewardSum: number;
    private _avg: number;
    private _var: number;
    private _modeNode: MonteCarloNode;
    private _tree: MonteCarloTree;

    constructor(tree: MonteCarloTree) {
        this._leafNodes = _.cloneDeep(tree.leaves);
        this._tree = tree;

        [this._min, this._max, this._rewardSum, this._visits, this._modeNode] = this._leafNodes.reduce((accumulator, value) => {
            const singlePayoff = value.payoff / value.numberOfVisits;
            accumulator[0] = singlePayoff < accumulator[0] ? singlePayoff : accumulator[0]; //min
            accumulator[1] = singlePayoff > accumulator[1] ? singlePayoff : accumulator[1]; //max
            accumulator[2] += value.payoff; //reward sum
            accumulator[3] += value.numberOfVisits; //reward sum
            // TODO BUG
            // we can have various paths leading to the same result!!!!!
            // therefore we can have multiple mode nodes!!!!
            if (value.numberOfVisits > accumulator[4].numberOfVisits) {
                accumulator[4] = value;
            }
            return accumulator;
        }, [Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY, 0, 0, this._leafNodes[0]]); 

        this._avg = this._rewardSum / this._visits;

    }

    get frequencyTable(): {[key: string]: {frequency: number, value: number}} {
        throw Object.fromEntries(
            this._leafNodes.map(n => [n.hash, {frequency: n.numberOfVisits, value: n.payoff / n.numberOfVisits}])
        );
    }

    get avg(): number {
        return this._avg;
    }

    get max(): number {
        return this._max;
    }

    get min(): number {
        return this._min;
    }

    get var(): number {
        if (!this._var) {
            this._var = this._leafNodes.reduce(
                (sum, node) => sum + Math.pow(node.payoff / node.numberOfVisits - this._avg, 2) * node.numberOfVisits
            , 0) / this._visits;
        }
        return this._var;
    } 

    get std(): number {
        return Math.sqrt(this.var);
    }

    get mode(): number {
        return this._modeNode ? this._modeNode.payoff / this._modeNode.numberOfVisits : NaN;
    }

    get modePath(): string[] {
        return this._modeNode ? this._modeNode.actionPath().map(hash => this._tree.actionDescription(hash)) : [];
    }
}

class MonteCarloTree {
    private _nodes: Map<string, MonteCarloNode>;
    private _currentNode: MonteCarloNode;
    private _rootHash: string;
    //maps hash to a string to an action
    private _actions: Map<string, SimultaneousAction>;
    
    constructor(state: State) {
        this._currentNode = new MonteCarloNode(state);
        this._rootHash = this._currentNode.hash;
        this._nodes = new Map<string, MonteCarloNode>([[this._rootHash, this._currentNode]]);
        this._actions = new Map<string, SimultaneousAction>();
    }
    
    get currentNode(): MonteCarloNode { return this._currentNode; }
    
    get root(): MonteCarloNode { return this._nodes.get(this._rootHash); }

    get leaves(): MonteCarloNode[] { 
        return [...this._nodes.values()].filter(node => node.isFinalState);
    }
    
    getFrequencyTable(): MonteCarloTreeFrequencyTable {
        return new MonteCarloTreeFrequencyTable(this);
    }

    actionDescription(hash: string): string {
        return this._actions.has(hash) ? this._actions.get(hash).toString() : 'N/A' ;
    }
    
    /**
     * adds the action to the internal translation list
     * @param action te action to add
     * @returns true if the action wa added, false if it already existed
     */
    addAction(action: SimultaneousAction): boolean {
        const exists: boolean = this._actions.has(action.hash);
        if (!exists) {
            this._actions.set(action.hash, action);
        }
        return exists;
    }

    backToRoot() {
        this._currentNode = this._nodes.get(this._rootHash);
    }

    getMostSimulatedFirstChildSimultaneousAction(): SimultaneousAction {
        return this.getMostSimulatedSimultaneousAction();
    }
    
    getMostSimulatedSimultaneousAction(node?: MonteCarloNode): SimultaneousAction {
        node = node ? node : this._nodes.get(this._rootHash);
        let maxSimulations: number = -1;
        let maxSimulationActions: SimultaneousAction[];
        for (const simulAction of node.childActions.map(hash => this._actions.get(hash))) {
            const simulations = node.getChild(simulAction).numberOfVisits;
            if (simulations == maxSimulations) {
                maxSimulationActions.push(simulAction);
            } else if (simulations > maxSimulations) {
                maxSimulationActions = [simulAction];
                maxSimulations = simulations;
            }
        }
    
        return maxSimulationActions[0];        
    }

    getMostSimulatedPath(firstAction?: SimultaneousAction): string[] {
        let nextAction = firstAction ? firstAction : this.getMostSimulatedFirstChildSimultaneousAction();
        let node = this._nodes.get(this._rootHash);
        const actions = [];
        
        while (node.hasChilds()) {
            nextAction = this.getMostSimulatedSimultaneousAction(node);
            actions.push(nextAction.toString());
            node = node.getChild(nextAction);
        }

        return actions;
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
            new MonteCarloNode(state, simultActions, this.currentNode);
        
        this.addAction(simultActions);

        if (!this._nodes.has(this.currentNode.hash)) {
            this._nodes.set(this.currentNode.hash, this.currentNode);
        }
    }

    hasState(state: State): boolean {
        return this._nodes.has(state.hash);
    }

    update(vs: number) {
        this.currentNode.addVisit(vs);
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

    get tree(): {root: MctsTreeNodeObject} {
        return {
            root: this._tree.root.getNodeObject(this._tree)
        }
    }

    get simulationsRan(): number {
        return this._simulationsRan;
    };

    runSimulations(numberOfSimulations: number, timeBudgetSeconds?: number): SimulationResult {
        const targetSimulations: number = this._simulationsRan + numberOfSimulations;
        const targetTime: moment.Moment =
            moment().add(timeBudgetSeconds ? timeBudgetSeconds : DEFAULT_SIMULATION_TIMEOUT_SECONDS, 'seconds');

        do {
            this._simulate();
            this._sim.restart();
            this._tree.backToRoot();
        } while (this._simulationsRan < targetSimulations || moment().isAfter(targetTime));

        const best: SimultaneousAction = this._tree.getMostSimulatedFirstChildSimultaneousAction();

        const freqTable: MonteCarloTreeFrequencyTable = this._tree.getFrequencyTable();

        return {
            bestAction: best.toString(),
            bestActionPath: this._tree.getMostSimulatedPath(best),
            payoff: {
                min: freqTable.min,
                max: freqTable.max,
                avg: freqTable.avg,
                std: freqTable.std,
                mode: freqTable.mode,
                modePath: freqTable.modePath,
            }
        };
    };

    private _simulate(didRollout?: boolean): void {
        if (this._sim.isOver()) {
            if (!didRollout){
                this._tree.goToChildState(this._sim.getPreviousSimultaneousAction(), this._sim.state);
            }
            this._simulationsRan++;
            return this._update(this._sim.getReward());
        }
        
        if (this._sim.state.awaitsChance()) {
            this._tree.goToChildState(this._sim.getPreviousSimultaneousAction(), this._sim.state);
            const state: State = this._sim.runSimultaneousAction();
            return this._simulate();
        }

        if (this._tree.hasState(this._sim.state)) {
            //select simultAction
            if (this._tree.currentNode.hash !== this._sim.state.hash) {
                this._tree.goToChildState(this._sim.getPreviousSimultaneousAction(), this._sim.state)
            }
            const simultAction: SimultaneousAction = this._select();
            //move to next state for selected simultAction (via sim)
            this._sim.choose(simultAction);
            if (!this._sim.state.awaitsChance()) {
                this._sim.runSimultaneousAction();
            }
            return this._simulate();
        } else {
            this._tree.goToChildState(this._sim.getPreviousSimultaneousAction(), this._sim.state);
            //do rollout and return result
            this._rollout();
            return this._simulate(true);
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
                bestPlayerActions.length > 1 ? _.random(0, bestPlayerActions.length - 1) : 0
            ];

            bestActions.set(player, bestPlayerAction);
        }

        return this.currentNode.getSimultaneousAction(bestActions);
    }

    static UCT(player: Player, payoff: number, actionVisits: number, numberOfVisits: number, explorationCoefficient: number): number {
        /* istanbul ignore if */
        if (!actionVisits || !numberOfVisits) {
            throw new Error(`Can't use UCT if there are no visits on the action or on the node.`)
        }
        const payoffAvg = payoff / actionVisits;
        const exploration = Math.sqrt(Math.log10(numberOfVisits) / actionVisits);
        return (player === 'min' ? -1 : 1) * (payoffAvg + explorationCoefficient * exploration);
    }

    private _update(vs: number) {
        this._tree.update(vs);
    }

    private _rollout(): void {
        while (!this._sim.isOver()) {
            const moves = [...this._sim.state.possibleSimultaneousActions];
            this._sim.choose(moves[_.random(0, moves.length - 1)]);
            this._sim.runSimultaneousAction();
        }
        this.currentNode.addRollout();
    }
}
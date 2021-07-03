import { Simulator, Player, State, Action, SimultaneousAction } from '../src/sm-mcts'
import * as hasha from 'hasha'
import * as _ from 'lodash'

export class DrawHighCardAction implements Action {
    private _value: number;
    
    constructor(value: number) {
        this._value = value;
    }


    get name(): string {
        return this._value.toString();
    }

    get hash(): string {
        return hasha(this.name);
    }

    get value(): number {
        return this._value;
    }

    toString(): string {
        return `draws ${this._value}`;
    }

    toJSON(): object {
        return {
            name: this.name,
            hash: this.hash,
            value: this.value
        };
    }
    
}

export class DrawHighCardFullAction implements SimultaneousAction {
    private _actions: Map<Player, DrawHighCardAction>;

    constructor(actions: Map<Player, DrawHighCardAction>) {
        this._actions = actions;
    }
    
    get actions(): Map<Player, DrawHighCardAction> {
        return this._actions;
    } 

    get isChance(): boolean { return false; }

    get hash(): string {
        return hasha(this.toString());
    }

    
    toString(): string {
        const allStr: string[] = [];
        for (const play of this.actions) {
            allStr.push(`${play[0]} ${play[1].toString()}`);
        }
        return allStr.join('\n');
    }
    
}

class DrawHighCardRngFullAction extends DrawHighCardFullAction {
    private doubled: Player[];
    constructor(actions: DrawHighCardFullAction, doubled: Player[]) {
        super(actions.actions);
        this.doubled = _.cloneDeep(doubled);
    }

    toString(): string {
        return super.toString() + `\ndoubled: ${this.doubled.length ? this.doubled.join(',') : 'none' }`
    }
}

class DrawHighCardState implements State {
    private _isFinal: boolean;
    private _hands: Map<Player, number[]>;
    private _turn: number;
    private _score: number;
    private _selectedSimulAction?: DrawHighCardFullAction;
    private _canDouble: boolean;

    constructor(isFinal: boolean, hands: Map<Player, number[]>, turn: number, 
        score: number, chanceToDouble: number, selectedFullAction?: DrawHighCardFullAction) {
        this._isFinal = isFinal;
        this._hands = _.cloneDeep(hands);
        this._turn = turn;
        this._score = score;
        this._selectedSimulAction = selectedFullAction;
        this._canDouble = chanceToDouble > 0;
    }

    get hash(): string {
        return hasha(this.toString());
    }

    get possibleSimultaneousActions(): Set<DrawHighCardFullAction> {
        const res: Set<DrawHighCardFullAction> = new Set<DrawHighCardFullAction>();

        //todo generalize for >2 players
        for (const maxAction of this.getPlayerActions('max')) {
            for (const minAction of this.getPlayerActions('min')) {
                const actions = new Map<Player, DrawHighCardAction>([
                    ['max', maxAction], ['min', minAction]
                ]);
                res.add(new DrawHighCardFullAction(actions));
            }
        }

        return res;
    }

    getPlayerActions(player: Player): Set<DrawHighCardAction> {
        return new Set(this._hands.get(player).map(val => new DrawHighCardAction(val)));
    }
    isFinal(): boolean {
        return this._isFinal;
    }
    toString(): string {
        //TODO add chance event when we implement it
        return `Turn ${this._turn}, score: ${this._score},` + 
            `\nmin hand: ${this._hands.get('min').join(',')},` +
            `\nmax hand: ${this._hands.get('max').join(',')},` +
            `\naction: ${ this._selectedSimulAction ? this._selectedSimulAction.toString() : 'not selected' },` +
            `\n${this._isFinal ? ' DONE!!': ''}`; 
    }
    toJSON(): {hands: Map<Player, number[]>, turn: number, score: number, isFinal: boolean, awaitsChance: boolean} {
        return {
            turn: this._turn,
            score: this._score,
            hands: this._hands,
            isFinal: this.isFinal(),
            awaitsChance: this.awaitsChance()
        }
    }
    awaitsChance(): boolean {
        return this._canDouble && 
            !!this._selectedSimulAction && 
            !(this._selectedSimulAction instanceof DrawHighCardRngFullAction);
    }
}

/**
 * A very simple 2 player simultaneous action game used for testing sm-mtcs.
 * Two players (min and max) have a set of numbers. They choose a number each turn at 
 * the same time. We subtract the numbers (max - min) and remove them from their hand
 * every turn. We then sum the differences once one of the players runs out of numbers
 * or the max number of turns has passed. 
 * 
 * There's a probability for a player's number to be doubled each turn.
 * 
 * If the difference is positive, max wins. If negative, min wins. If zero it's a draw.
 */
export class DrawHighCard implements Simulator {
    private _hands: Map<Player, number[]>;    
    private _maxTurns: number;
    private _chanceToDouble: number;
    private _score: number;
    private _playLog:  DrawHighCardFullAction[];
    private _currentTurn: number;
    private _rngSeed: number;
    private _initialHands: Map<Player, number[]>;


    /**
     * 
     * @param maxTurns the maximum number of turns allowed
     * @param chanceToDouble the odds to double one of the players number on each turn
     * @param rngSeed the seed to consider on the pseudo-random number generator 
     * (for consistent) testing
     */
    constructor(maxTurns: number, chanceToDouble?: number, rngSeed?:number) {
        this._maxTurns = maxTurns;
        this._chanceToDouble = chanceToDouble ? chanceToDouble : 0;
        this._playLog = [];
        this._score = 0;
        this._currentTurn = 0;
    }

    restart(): void {
        this._playLog = [];
        this._score = 0;
        this.setHands(this.deepCopyHands(false));
    }

    get state(): DrawHighCardState {
        return new DrawHighCardState(this.isOver(), this._hands, this._currentTurn, 
            this._score, this._chanceToDouble, this._playLog[this._currentTurn]);
    }
    
    getPreviousSimultaneousAction(): DrawHighCardFullAction {
        return this._playLog[ this._currentTurn - (this.state.awaitsChance() ? 0 : 1)];
    }

    isOver(): boolean {
        if (this._currentTurn > this._maxTurns) { return true; }

        for (const hand of this._hands.values()) {
            if (hand.length === 0) {
                return true;
            }
        }

        return false;
    }

    choose(simultAction: DrawHighCardFullAction): void {
        /* istanbul ignore if */
        if (this._playLog[this._currentTurn]) {
            throw new Error('play has already been chosen');
        }
        this._playLog[this._currentTurn] = simultAction;
    }

    simpleChoose(minPlay: number, maxPlay: number): void {
        for (const simultAction of this.state.possibleSimultaneousActions) {
            if (simultAction.actions.get('min').value === minPlay &&
              simultAction.actions.get('max').value === maxPlay) {
                this.choose(simultAction);
                return;
            }
        }
        throw new Error('Play is not available.')
    }

    runSimultaneousAction(): DrawHighCardState {
        //add to log
        const play: DrawHighCardFullAction = this._playLog[this._currentTurn];
        //remove numbers from players' hands
        for (const player of play.actions.keys()) {
            this._removeFromHand(player, play.actions.get(player));
        }

        const values = [play.actions.get('max').value, play.actions.get('min').value];
        if (this._chanceToDouble > 0) {
            const rng: Player[] = [];
            // double pseudo-randomly
            for (let i = 0; i < values.length; i++) {
                if (_.random(0, 1, true) < this._chanceToDouble) {
                    values[i] *= 2;
                    rng.push(i == 0 ? 'max' : 'min');
                }
            }
            
            //update play with rng info, if applicable
            this._playLog[this._currentTurn] = new DrawHighCardRngFullAction(play, rng);
        }

        //adjust the score
        this._score += values[0] - values[1];

        //increase turn count
        this._currentTurn++

        return this.state;
    }
    private _removeFromHand(player, action: DrawHighCardAction) {
        const i = this._hands.get(player).indexOf(action.value);
        this._hands.get(player).splice(i,1);
    }

    getReward(): number {
        return this._score;
    }

    /**
     * make sa deep copy of the hand. usefull to setup initial hand object and
     * to restart the simulator
     * @param current if true will copy the current hand, if false
     * will copy the initial hand
     * @returns a deep copy of the hand object
     */
    private deepCopyHands(current:boolean): Map<Player, number[]> {
        const hands = current ? this._hands : this._initialHands;
        const res = new Map<Player, number[]>();
        for (const player of hands.keys()) {
            res.set(player, []);
            for (const nbr of hands.get(player)) {
                res.get(player).push(nbr);
            }
        }
        return res;
    }

    /**
     * Setting the players' hands. Very usefull for testing.
     * @param hands the hands to set
     */
    setHands(hands: Map<Player, number[]>): void {
        this._hands = hands;
        if (this._currentTurn < 1) { 
            this._initialHands = this.deepCopyHands(true); 
        }
        this._currentTurn = 1;        
    }

    /**
     * pseudo-randomly draws the cards to each player
     * @param numberOfCards cards to be dealt to each player
     */
    drawHands(numberOfCards: number) {
        throw new Error('Method not implemented.');
    }
}
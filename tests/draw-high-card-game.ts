import { Simulator, Player, State, Action, SimultaneousAction } from '../src/sm-mcts'
import * as hasha from 'hasha'

class DrawHighCardAction implements Action {
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

class DrawHighCardFullAction implements SimultaneousAction {
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

class DrawHighCardState implements State {
    private _isFinal: boolean;
    private _hands: Map<Player, number[]>;
    private _turn: number;
    private _score: number;

    constructor(isFinal: boolean, hands: Map<Player, number[]>, turn: number, score: number) {
        this._isFinal = isFinal;
        this._hands = hands;
        this._turn = turn;
        this._score = score;
    }

    get hash(): string {
        return hasha(this.toString());
    }

    get possibleSimultaneousActions(): Set<SimultaneousAction> {
        const res: Set<SimultaneousAction> = new Set<SimultaneousAction>();

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
        return `Turn ${this._turn}, score: ${this._score}, hands: ${this._hands}${this._isFinal ? ' DONE!!': ''}`;
    }
    toJSON(): object {
        //TODO add chance event when we implement it
        return {
            turn: this._turn,
            score: this._score,
            hands: this._hands,
            isFinal: this.isFinal()
        }
    }
    awaitsChance(): boolean {
        //TODO chance once the chance roll is implemented
        return false;
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
    private _playLog: DrawHighCardFullAction[];
    private _currentTurn: number;
    private _rngSeed: number;

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

    get state(): DrawHighCardState {
        return new DrawHighCardState(this.isOver(), this._hands, this._currentTurn, this._score);
    }
    
    getPreviousSimultaneousAction(): DrawHighCardFullAction {
        return this._playLog[this._currentTurn - 1];
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
        this._playLog[this._currentTurn] = simultAction;
    }

    runSimultaneousAction(): DrawHighCardState {
        const play: DrawHighCardFullAction = this._playLog[this._currentTurn];
        this._currentTurn++;
        //TODO insert the chance thing
        this._score += play.actions.get('max').value - play.actions.get('min').value;
        return this.state;
    }

    getReward(): number {
        return this._score;
    }

    /**
     * Setting the players' hands. Very usefull for testing.
     * @param hands the hands to set
     */
    setHands(hands: Map<Player, number[]>): void {
        this._hands = hands;
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
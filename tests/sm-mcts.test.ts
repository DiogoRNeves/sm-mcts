import { expect } from 'chai';
import { SmMCTS, Player } from '../src/sm-mcts';
import { DrawHighCard } from './draw-high-card-game'

describe('basic MTCS with chance', function() {
    it('runs 10 simulations', function() {
        const game: DrawHighCard = new DrawHighCard(3, 0.1);
        const minHand = [3,5,2,6,1,8,9],
            maxHand = [4,6,3,2,1];
        game.setHands(new Map<Player, number[]>([
          ['min', minHand],
          ['max', maxHand]
        ]));

        const mcts = new SmMCTS(game);

        mcts.runSimulations(10);
        expect(mcts.simulationsRan).to.equal(10);
    });

    
    it('runs a lot of simulations', function() {
        const game: DrawHighCard = new DrawHighCard(2, 0);
        const minHand = [3,5,2,6,1,4,9],
            maxHand = [4,6,3,2,1];
        game.setHands(new Map<Player, number[]>([
          ['min', minHand],
          ['max', maxHand]
        ]));

        const mcts = new SmMCTS(game);

        const NUM_SIMS = 5000;
        this.timeout(NUM_SIMS * 100);

        const result = mcts.runSimulations(NUM_SIMS);
        expect(mcts.simulationsRan).to.equal(NUM_SIMS);

        expect(result.bestAction.toString(), 'chooses the best play')
            .equal('max draws 6\nmin draws 9');
    });
});

describe('basic MTCS - no chance', function() {
    it('runs one simulation', function() {
        const game: DrawHighCard = new DrawHighCard(3, 0);
        const minHand = [3,5,2,6,1,8,9],
            maxHand = [4,6,3,2,1];
        game.setHands(new Map<Player, number[]>([
          ['min', minHand],
          ['max', maxHand]
        ]));

        const mcts = new SmMCTS(game);

        mcts.runSimulations(1);
        expect(mcts.simulationsRan).to.equal(1);
    });

    it('runs ten simulations', function() {
        const game: DrawHighCard = new DrawHighCard(3, 0);
        const minHand = [3,5,2,6,1,8,9],
            maxHand = [4,6,3,2,1];
        game.setHands(new Map<Player, number[]>([
          ['min', minHand],
          ['max', maxHand]
        ]));

        const mcts = new SmMCTS(game);

        mcts.runSimulations(10);
        expect(mcts.simulationsRan).to.equal(10);
    });

    it('runs a lot of simulations', function() {
        const game: DrawHighCard = new DrawHighCard(2, 0);
        const minHand = [3,5,2,6,1,4,9],
            maxHand = [4,6,3,2,1];
        game.setHands(new Map<Player, number[]>([
          ['min', minHand],
          ['max', maxHand]
        ]));

        const mcts = new SmMCTS(game);

        const NUM_SIMS = 5000;
        this.timeout(NUM_SIMS * 100);

        const result = mcts.runSimulations(NUM_SIMS);
        expect(mcts.simulationsRan).to.equal(NUM_SIMS);

        expect(result.bestAction.toString(), 'chooses the best play')
            .equal('max draws 6\nmin draws 9');
    });

});


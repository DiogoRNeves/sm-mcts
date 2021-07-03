import { expect } from 'chai';
import { SmMCTS, Player } from '../src/sm-mcts';
import { DrawHighCard } from './draw-high-card-game';
import { writeFile } from 'fs';
import * as moment from 'moment';

/*
    TODO:
    everyone has exactly one rollout per child (leaves have no childs)
*/

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
        const game: DrawHighCard = new DrawHighCard(3, 0.1);
        const minHand = [3,5,2,6,1,8,9],
            maxHand = [4,6,3,2,1];
        game.setHands(new Map<Player, number[]>([
          ['min', minHand],
          ['max', maxHand]
        ]));

        const mcts = new SmMCTS(game, Math.SQRT2 * 100);

        const NUM_SIMS = 10000;
        this.timeout(NUM_SIMS * 100);

        const result = mcts.runSimulations(NUM_SIMS);

        writeFile(`tests/json_outputs/${moment().format('YYYYMMDDHHmmssSSS')}_withChance.json`, JSON.stringify(mcts.tree), e => {
            /* istanbul ignore next */
            if (e) console.log(e.message);
        });

        expect(mcts.simulationsRan).to.equal(NUM_SIMS);
        expect(mcts.tree.root.visits).to.equal(NUM_SIMS);


        //expect(result.bestAction.toString(), 'chooses the best play')
        //    .equal('max draws 4\nmin draws 9');
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

        let visits: number = 0, rollouts: number = 0; 

        for (const [action, data] of Object.entries(mcts.tree.root.childs)) {
            visits += data.visits;
            rollouts += data.rollouts;
        }

        expect(visits).equal(1);
        expect(rollouts).equal(1);
    });

    it('runs ten simulations', function() {
        const game: DrawHighCard = new DrawHighCard(2, 0);
        const minHand = [3,5,2,6,1,8,9],
            maxHand = [4,6,3,2,1];
        game.setHands(new Map<Player, number[]>([
          ['min', minHand],
          ['max', maxHand]
        ]));

        const mcts = new SmMCTS(game);

        mcts.runSimulations(10);
        expect(mcts.simulationsRan).to.equal(10);

        
        let visits: number = 0, rollouts: number = 0; 

        for (const [action, data] of Object.entries(mcts.tree.root.childs)) {
            visits += data.visits;
            rollouts += data.rollouts;
        }

        expect(visits).equal(10);
        expect(rollouts).equal(10);
    });

    it('runs a lot of simulations', function() {
        const game: DrawHighCard = new DrawHighCard(2, 0);
        const minHand = [3,5,2],
            maxHand = [4,6,3];
        game.setHands(new Map<Player, number[]>([
          ['min', minHand],
          ['max', maxHand]
        ]));

        const mcts = new SmMCTS(game, Math.SQRT2 * 100);

        const NUM_SIMS = 5000;
        this.timeout(NUM_SIMS * 100);

        const result = mcts.runSimulations(NUM_SIMS);        
        let visits: number = 0, rollouts: number = 0; 

        for (const [action, data] of Object.entries(mcts.tree.root.childs)) {
            visits += data.visits;
            rollouts += data.rollouts;
        }

        
        writeFile(`tests/json_outputs/${moment().format('YYYYMMDDHHmmssSSS')}_withoutChance.json`, JSON.stringify(mcts.tree), e => {
            /* istanbul ignore if */
            if (e) console.log(e.message);
        });
        
        expect(mcts.simulationsRan, 'simulation ran').to.equal(NUM_SIMS);
        expect(mcts.tree.root.visits, 'root visits').equal(NUM_SIMS);
        expect(visits, 'sum of childs visits').equal(NUM_SIMS);


        //expect(rollouts).equal(1);

        //expect(result.bestAction.toString(), 'chooses the best play')
        //    .equal('max draws 6\nmin draws 5');
    });

});


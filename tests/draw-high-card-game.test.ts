import { expect } from 'chai';
import { DrawHighCard } from './draw-high-card-game';
import { Player } from '../src/sm-mcts'

describe('initial tests', function() {
    it('plays a game (no chance)', function() {
        let game: DrawHighCard = new DrawHighCard(4, 0);
        const minHand = [3,5,2,6,1,8,9],
            maxHand = [4,6,3,2,1],
            minHandLength = minHand.length,
            maxHandLength = maxHand.length;
        game.setHands(new Map<Player, number[]>([
          ['min', minHand],
          ['max', maxHand]
        ]));
        expect(game.getReward()).equal(0);
        expect(game.isOver()).equal(false);
        game.simpleChoose(9,4);
        game.runSimultaneousAction();
        expect(game.isOver()).equal(false);
        expect(game.getReward()).equal(-5);
        expect(game.state.toJSON().hands.get('min').length).equal(minHandLength - 1);
        expect(game.state.toJSON().hands.get('max').length).equal(maxHandLength - 1);
        game.simpleChoose(1,6);
        game.runSimultaneousAction();
        expect(game.isOver()).equal(false);
        expect(game.getReward()).equal(0);
        expect(game.state.toJSON().hands.get('min').length).equal(minHandLength - 2);
        expect(game.state.toJSON().hands.get('max').length).equal(maxHandLength - 2);
        game.simpleChoose(2,3);
        game.runSimultaneousAction();
        expect(game.isOver()).equal(false);
        expect(game.getReward()).equal(1);
        expect(game.state.toJSON().hands.get('min').length).equal(minHandLength - 3);
        expect(game.state.toJSON().hands.get('max').length).equal(maxHandLength - 3);
        game.simpleChoose(8,2);
        game.runSimultaneousAction();
        expect(game.isOver()).equal(true);
        expect(game.getReward()).equal(-5);
        expect(game.state.toJSON().hands.get('min').length).equal(minHandLength - 4);
        expect(game.state.toJSON().hands.get('max').length).equal(maxHandLength - 4);
    }); 
  });
 
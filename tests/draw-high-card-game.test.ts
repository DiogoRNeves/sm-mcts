import { expect } from 'chai';
import { DrawHighCard } from './draw-high-card-game';
import { Player } from '../src/sm-mcts'


describe('draw high card game initial tests', function() {
    it('plays a game twice (no chance)', function() {
        const game: DrawHighCard = new DrawHighCard(4, 0);
        const minHand = [3,5,2,6,1,8,9],
            maxHand = [4,6,3,2,1],
            minHandLength = minHand.length,
            maxHandLength = maxHand.length;
        game.setHands(new Map<Player, number[]>([
          ['min', minHand],
          ['max', maxHand]
        ]));
        let plays = [[9,4],[1,6],[2,3],[8,2]];
        let isOver = [false,false,false,true];
        let scores = [-5,0,1,-5];
        const stateHashes = [],
          initialStateHash = game.state.hash,
          initialState = game.state;
        expect(game.getReward()).equal(0);
        expect(game.isOver()).equal(false);

        for (let i = 0; i < plays.length; i++) {
          const play = plays[i], done = isOver[i], score = scores[i];
          expect(game.state.possibleSimultaneousActions.size, 'correct simultaneous actions')
            .to.equal((minHandLength - i) * (maxHandLength - i));
          
          game.simpleChoose(play[0],play[1]);
          game.runSimultaneousAction();
          stateHashes.push(game.state.hash);
          expect(game.getReward()).equal(score);
          expect(game.isOver()).equal(done);
          expect(game.state.awaitsChance()).equal(false);
          expect(game.state.toJSON().hands.get('min').length).equal(minHandLength - 1 - i);
          expect(game.state.toJSON().hands.get('max').length).equal(maxHandLength - 1 - i);

          expect(initialState.hash, 'initial state doesn\'t change').equal(initialStateHash);

          expect(initialState.toJSON().hands.get('min').length, 'initial min hand doesn\'t change').equal(minHandLength);
          expect(initialState.toJSON().hands.get('max').length, 'initial max hand doesn\'t change').equal(maxHandLength);
        }

        game.restart();

        plays = [[9,6],[1,3],[8,4],[2,1]];
        isOver = [false,false,false,true];
        scores = [-3,-1,-5,-6];

        expect(game.getReward()).equal(0);
        expect(game.isOver()).equal(false);
        expect(game.state.toString().slice(-6)).not.equal('DONE!!');

        for (let i = 0; i < plays.length; i++) {
          const play = plays[i], done = isOver[i], score = scores[i];
          expect(game.state.possibleSimultaneousActions.size, 'correct simultaneous actions')
            .to.equal((minHandLength - i) * (maxHandLength - i))
          
          game.simpleChoose(play[0],play[1]);
          game.runSimultaneousAction();
          stateHashes.push(game.state.hash);
          expect(game.getReward()).equal(score);
          expect(game.isOver()).equal(done);
          expect(game.state.awaitsChance()).equal(false);
          expect(game.state.toJSON().hands.get('min').length).equal(minHandLength - 1 - i);
          expect(game.state.toJSON().hands.get('max').length).equal(maxHandLength - 1 - i);
        }

        expect(game.getPreviousSimultaneousAction().toString()).equal('max draws 1\nmin draws 2');
        expect(game.getPreviousSimultaneousAction().isChance).equal(false);
        expect(game.getPreviousSimultaneousAction().actions.get('min').name).equal('2');
        expect(game.state.toString().slice(-6)).equal('DONE!!');

        expect(stateHashes.length, 'all hashes must be different').equal((new Set(stateHashes)).size);
  }); 

  it('ends a game due to cards ending', function() {
    const game: DrawHighCard = new DrawHighCard(10, 0);
    const minHand = [3,5,2,6,1,8,9],
      maxHand = [4,6,3,2,1],
      minHandLength = minHand.length,
      maxHandLength = maxHand.length;
    game.setHands(new Map<Player, number[]>([
      ['min', minHand],
      ['max', maxHand]
    ]));
    let plays = [[9,4],[1,6],[2,3],[8,2],[3,1]];
    let isOver = [false,false,false,false,true]
    let scores = [-5,0,1,-5,-7];
    const stateHashes = [];

    expect(game.getReward()).equal(0);
    expect(game.isOver()).equal(false);

    for (let i = 0; i < plays.length; i++) {
      const play = plays[i], done = isOver[i], score = scores[i];
      
      game.simpleChoose(play[0],play[1]);
      game.runSimultaneousAction();
      stateHashes.push(game.state.hash);
      expect(game.getReward()).equal(score);
      expect(game.isOver()).equal(done);
      expect(game.state.awaitsChance()).equal(false);
      expect(game.state.toJSON().hands.get('min').length).equal(minHandLength - 1 - i);
      expect(game.state.toJSON().hands.get('max').length).equal(maxHandLength - 1 - i);
    }

    expect(stateHashes.length, 'all hashes must be different').equal((new Set(stateHashes)).size);
  });

  it('throws an error when play isn\'t available', function() {
    const game: DrawHighCard = new DrawHighCard(10, 0);
    const minHand = [3,5,2,6,1,8,9],
      maxHand = [4,6,3,2,1],
      minHandLength = minHand.length,
      maxHandLength = maxHand.length;
    game.setHands(new Map<Player, number[]>([
      ['min', minHand],
      ['max', maxHand]
    ]));
    expect(function() { game.simpleChoose(10,11) }, 'neither play exists').to.throw('Play is not available.');
    expect(function() { game.simpleChoose(10,3) }, 'min play does not exist').to.throw('Play is not available.');
    expect(function() { game.simpleChoose(2,113) }, 'max play does not exist').to.throw('Play is not available.');
  })
});
 
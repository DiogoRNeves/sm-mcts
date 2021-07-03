# sm-mcts
Typescript implementation of simultaneous move Monte Carlo Tree Search with chance events using a forward only simulator.

This is a work in progress still in very very very very early stages.

Motivation for this work is to use MCTS to choose the best action in a Pokémon Battle using showdown simulator library without saving/loading states.

The approach for this library is to force an implementation of a simulation (which will be a simulator wrapper for showdown) to be passed into the MTCS. This will allow for a multitude of possibilities on the motivation case, such as:
- simulation for multiple generations
- battle state manipulation before start (such as setting weather)
- include battle team selection (i.e. for hardcore nuzlocke use)
- include gaunlets with or without healing between battles (i.e. for hardcore nuzlocke use)
- filtering opponent's moves (i.e. mimic the game's AI)

This will initially be done without paralelization, but if I manage to make it work properly I may try using multiple concurrent simulators.
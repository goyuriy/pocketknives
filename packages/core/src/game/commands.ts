import type { PlayerId, RuleSet } from '../types.js';
import type { ThrowIntent } from '../throw/swing.js';
import type { GameSettings } from './state.js';
import type { Stance } from './stance.js';

/**
 * Everything a player — or a host, or a bot — can ask the game to do.
 *
 * Plain data, so it can cross a network, be written to a replay, or be made up
 * by a bot. A command is a request: the authority checks it against the state
 * (`applyCommand`) and may turn it down.
 */
export type Command =
  /**
   * Throw, from where the thrower stands, with the hand they moved. Nothing
   * about where the knife lands is sent: that is worked out from this and a
   * seed only the authority chooses.
   */
  | { readonly type: 'throw'; readonly playerId: PlayerId; readonly stance: Stance; readonly intent: ThrowIntent }
  | { readonly type: 'chooseKnife'; readonly playerId: PlayerId; readonly knifeId: string }
  /** A fresh match, same table. */
  | { readonly type: 'newMatch'; readonly players: readonly PlayerId[]; readonly rules?: RuleSet }
  // The sandbox only: working on the game rather than playing it.
  | { readonly type: 'configure'; readonly settings: Partial<Omit<GameSettings, 'sandbox'>> }
  | { readonly type: 'giveTurn'; readonly playerId: PlayerId };

/**
 * What the authority adds to a command when it accepts it: the randomness.
 *
 * Kept out of the command so that no player chooses their own luck. A server
 * draws it; a hotseat game draws it in the browser; a replay reads it back.
 */
export type Stamp = { readonly seed: number };

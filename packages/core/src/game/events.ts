import type { Board, PlayerId } from '../types.js';
import type { SkillId, ThrowRecord } from './state.js';

/**
 * What happened, as a result of a command — for everyone watching.
 *
 * The state after a command says where things stand; events say what changed
 * and carry what it takes to *show* it. A thrown knife is the main one: it
 * holds the board as it was before, so the cut can be drawn arriving on the
 * ground it changed, even by a client that only ever saw the state after.
 */
export type GameEvent =
  | { readonly type: 'thrown'; readonly record: ThrowRecord; readonly boardBefore: Board }
  | { readonly type: 'turn'; readonly playerId: PlayerId }
  | { readonly type: 'eliminated'; readonly playerId: PlayerId }
  | { readonly type: 'won'; readonly playerId: PlayerId }
  | { readonly type: 'knifeChosen'; readonly playerId: PlayerId; readonly knifeId: string }
  | { readonly type: 'matchStarted' }
  | { readonly type: 'configured' }
  | { readonly type: 'skillSet'; readonly playerId: PlayerId; readonly skill: SkillId; readonly level: number };

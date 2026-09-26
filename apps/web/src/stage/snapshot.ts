import type {
  Board,
  FieldOutline,
  Flight,
  KnifeSpec,
  PlayerId,
  ThrowConfig,
  Vec2,
} from '@pocketknives/core';
import type { Attempt, Phase } from '../state/useSandbox.js';

/**
 * Everything the stage needs to know about the game, and nothing else.
 *
 * The seam between the React side, which owns the state, and the engine side,
 * which draws it. The stage reads one of these every frame and never reaches
 * back into React — so the game state can change shape without the scene
 * noticing, and the scene can be rebuilt on another engine without the game
 * noticing either.
 */
export type StageSnapshot = {
  readonly board: Board;
  readonly fields: readonly FieldOutline[];
  readonly alive: readonly PlayerId[];
  readonly phase: Phase;
  readonly lastAttempt: Attempt | null;
  /** True while the finger is down and the hand is moving. */
  readonly swinging: boolean;
  readonly previewFlight: Flight | null;
  readonly stand: Vec2;
  readonly restHeading: number;
  readonly config: ThrowConfig;
  readonly knife: KnifeSpec;
  readonly hands: 1 | 2;
  readonly playerColor: string;
  readonly playbackScale: number;
  readonly arenaRadius: number;
};

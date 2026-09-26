import type {
  Board,
  FieldOutline,
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
  readonly stand: Vec2;
  readonly restHeading: number;
  readonly config: ThrowConfig;
  readonly knife: KnifeSpec;
  readonly hands: 1 | 2;
  readonly playerColor: string;
  readonly playbackScale: number;
  readonly arenaRadius: number;
};

/**
 * The player's hand as the pointer has it right now — read every frame, and
 * changed far more often than React renders, so it travels by ref instead.
 */
export type HandInput = {
  /** Where the hand points, radians from straight ahead, positive right. */
  readonly aim: number;
  /** How steeply it is set to throw, radians above level. */
  readonly pitch: number;
  /** How far the arm is drawn, as a fraction of a full draw; null when not gripping. */
  readonly draw: number | null;
};

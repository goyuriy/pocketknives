import type {
  Board,
  FieldOutline,
  KnifeSpec,
  PlayerId,
  ThrowConfig,
} from '@pocketknives/core';
import type { Attempt } from '../state/useGame.js';
import type { Playing } from '../playback/throwPlayback.js';
import type { CameraView } from './math/cameraPose.js';

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
  /**
   * The throw being played back, if any. The stage works out from this and the
   * clock, every frame, where in the playback it is.
   */
  readonly playing: Playing | null;
  readonly lastAttempt: Attempt | null;
  /** True while the finger is down and the hand is moving. */
  readonly swinging: boolean;
  /** Whose turn it is — whose ground the thrower may walk. */
  readonly playerId: PlayerId;
  /** How far past their own ground the thrower can reach to draw a line. */
  readonly reach: number;
  /** Whether that reach is chalked on the ground. */
  readonly showReach: boolean;
  /** Where the camera is: the thrower's eyes, or a debug view. */
  readonly cameraView: CameraView;
  /** Every knife thrown this match that is still lying out, oldest first. */
  readonly thrown: readonly Attempt[];
  readonly config: ThrowConfig;
  readonly knife: KnifeSpec;
  readonly hands: 1 | 2;
  readonly playerColor: string;
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

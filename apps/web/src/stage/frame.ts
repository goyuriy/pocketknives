import { attemptOf, type Attempt } from '../state/attempts.js';
import { IMPACT_BEAT, playbackPhase } from '../playback/throwPlayback.js';
import { RELEASE_SLOW_MOTION } from '../playback/releaseTimeline.js';
import type { CameraView } from './math/cameraPose.js';
import type { WorldTime } from './math/worldClock.js';
import type { StageSnapshot } from './snapshot.js';

/** What the screen is doing with the last throw. */
export type FramePhase =
  | { readonly kind: 'ready' }
  | { readonly kind: 'flying' | 'cutting' | 'resting'; readonly attempt: Attempt };

/**
 * Everything the systems need to know about this frame, worked out once.
 *
 * Pure: the game's snapshot and the clock in, plain facts out. Each system
 * then reads what it needs from here instead of working it out again — so no
 * two of them can disagree about, say, whether the knife has left the hand.
 */
export type Frame = {
  readonly state: StageSnapshot;
  /** The clock, milliseconds (`performance.now`). */
  readonly now: number;
  /** Seconds since the last frame, capped. */
  readonly seconds: number;
  /** The world's clock this frame: real time, held still through a hitstop (`worldClock.ts`). */
  readonly world: WorldTime;
  readonly phase: FramePhase;
  /** Seconds into the current part of the playback. */
  readonly into: number;
  /** How fast the flight is played once past its slow start. */
  readonly playbackScale: number;
  /** The throw has been let go of (the playback is on). */
  readonly released: boolean;
  /** Still in the fist: the arm swinging through to let go. */
  readonly handingOff: boolean;
  /** Seconds of flight shown so far, past the hand-off. */
  readonly intoFlight: number;
  /** The knife is on the ground. */
  readonly landed: boolean;
  /** The game's own camera has lifted over the circle to show the cut. */
  readonly overhead: boolean;
  /** The camera actually lifted: the game's lift for its own camera, always for `arena`. */
  readonly lifted: boolean;
  /** Seen from outside the thrower — every view but their own eyes, or when lifted. */
  readonly outside: boolean;
  readonly view: CameraView;
  /**
   * The throw whose knife and cut stay on show: the one playing, or the last
   * one while nobody is drawing the next.
   */
  readonly settled: Attempt | null;
};

/** The longest step a frame may take. A tab left in the background must not wake up to a leap. */
export const LONGEST_FRAME = 0.1;

/** How long a frame counts for: never backwards, and never a leap. */
export const frameSeconds = (seconds: number): number => Math.min(Math.max(0, seconds), LONGEST_FRAME);

/** `world` defaults to real time, as if nothing had ever hit. */
export const frameOf = (state: StageSnapshot, now: number, seconds: number, world?: WorldTime): Frame => {
  const at = playbackPhase(state.playing, now);
  const phase: FramePhase =
    at.kind === 'done' || !state.playing ? { kind: 'ready' } : { kind: at.kind, attempt: attemptOf(state.playing.record) };
  const into = at.kind === 'done' ? 0 : at.into;
  const { handOff } = RELEASE_SLOW_MOTION;
  const landed = phase.kind === 'cutting' || phase.kind === 'resting';
  // Lift over the circle only once the impact has had its moment at eye level.
  const overhead = phase.kind === 'resting' || (phase.kind === 'cutting' && into >= IMPACT_BEAT);
  const view = state.cameraView;
  const lifted = view === 'eyes' ? overhead : view === 'arena';
  return {
    state,
    now,
    seconds: frameSeconds(seconds),
    world: world ?? { now, seconds: frameSeconds(seconds), holding: false },
    phase,
    into,
    playbackScale: state.playing?.scale ?? 1,
    released: phase.kind !== 'ready',
    handingOff: phase.kind === 'flying' && into < handOff,
    intoFlight: phase.kind === 'flying' ? Math.max(0, into - handOff) : 0,
    landed,
    overhead,
    lifted,
    outside: lifted || view !== 'eyes',
    view,
    // The knife and its cut stay put after the animation ends, so the throw can
    // be studied rather than glimpsed. Only aiming the next one clears them.
    settled:
      phase.kind === 'cutting' || phase.kind === 'resting'
        ? phase.attempt
        : phase.kind === 'ready' && !state.swinging
          ? state.lastAttempt
          : null,
  };
};

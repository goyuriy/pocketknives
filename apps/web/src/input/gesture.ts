import { isThrow, swingPower, type SwingReading, type ThrowConfig } from '@pocketknives/core';
import { READY_SWING } from '../stage/math/armPose.js';

export type Sample = {
  readonly x: number;
  readonly y: number;
  readonly t: number;
};

/** How much of the end of the stroke counts as "the release", in milliseconds. */
const RELEASE_WINDOW = 110;
/**
 * Fewest samples the release may be read from. When events arrive sparsely the
 * time window alone can hold just one, and a single point has no speed at all.
 */
const LEAST_SAMPLES = 3;
/** Screen-heights of pull that draw the arm all the way back. */
const WIND_SPAN = 0.22;

/**
 * Reads a throwing motion out of the last moments of a stroke.
 *
 * Only the end matters. How the hand got to where it was tells you nothing about
 * the throw — a player who wanders around the screen and then flicks has thrown
 * a flick, and averaging in the wandering would say otherwise.
 *
 * Normalised by viewport height, so the same motion of the same physical hand
 * reads the same on a phone and a monitor.
 */
export const readSwing = (samples: readonly Sample[], viewportHeight: number): SwingReading => {
  const idle: SwingReading = { speed: 0, aimOffset: 0 };
  if (samples.length < 2 || viewportHeight <= 0) return idle;

  const last = samples[samples.length - 1]!;
  const recent = samples.filter((s) => last.t - s.t <= RELEASE_WINDOW);
  const window =
    recent.length >= LEAST_SAMPLES ? recent : samples.slice(-Math.max(LEAST_SAMPLES, recent.length));
  const first = window[0]!;
  const elapsed = (last.t - first.t) / 1000;
  if (elapsed <= 0) return idle;

  const dx = last.x - first.x;
  const dy = last.y - first.y;

  return {
    speed: Math.hypot(dx, dy) / viewportHeight / elapsed,
    // Zero when travelling straight up the screen, positive to the right. The
    // camera sits behind the thrower, so "up the screen" is away from them.
    aimOffset: Math.atan2(dx, -dy),
  };
};

/**
 * How far through its swing the arm is, from where the finger is now.
 *
 * `-1` is drawn fully back, `0` the moment of release. Pulling the finger down
 * the screen draws the arm back; bringing it up again, or flicking it up fast,
 * brings the arm forward to let go. The arm is the player's hand on screen, so it
 * has to answer the finger at once — including before the flick is fast enough
 * to count as a throw.
 */
export const armSwing = (
  anchor: Sample,
  latest: Sample,
  reading: SwingReading,
  viewportHeight: number,
  config: ThrowConfig,
): number => {
  const drawnBack = (latest.y - anchor.y) / Math.max(1, viewportHeight);
  const thrust = isThrow(reading, config) ? swingPower(reading, config) : 0;
  return Math.min(0, Math.max(-1, READY_SWING - drawnBack / WIND_SPAN + thrust));
};

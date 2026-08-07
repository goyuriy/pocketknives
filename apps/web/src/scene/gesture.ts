import type { SwingReading } from '@pocketknives/core';

export type Sample = {
  readonly x: number;
  readonly y: number;
  readonly t: number;
};

/** How much of the end of the stroke counts as "the release", in milliseconds. */
const RELEASE_WINDOW = 110;
/**
 * Fewest samples the release may be read from.
 *
 * A turn cannot be measured from two points — two points are a straight line.
 * When events arrive sparsely, whether from a slow device or from a browser
 * coalescing them, the time window alone can hold too few, and the stroke then
 * reads as having no curl at all: every throw lands handle-first and nothing the
 * player does changes it. Reaching further back is far better than reporting a
 * flick as a push.
 */
const LEAST_SAMPLES = 4;

const wrap = (radians: number): number => {
  const wrapped = ((radians + Math.PI) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI);
  return wrapped - Math.PI;
};

/**
 * Reads a throwing motion out of the last moments of a stroke.
 *
 * Only the end matters. How the hand got to where it was tells you nothing about
 * the throw — a player who wanders around the screen and then flicks has thrown
 * a flick, and averaging in the wandering would say otherwise.
 *
 * Two numbers come out of it, and they are independent because the hand really
 * does control them separately:
 *
 * - **speed**, the pace of travel at release, which becomes distance
 * - **curl**, how fast the direction of travel was *turning*, which becomes
 *   tumble. A straight push has none; a hooked flick has a great deal.
 *
 * Everything is normalised by viewport height, so the same motion of the same
 * physical hand reads the same on a phone and a monitor.
 */
export const readSwing = (samples: readonly Sample[], viewportHeight: number): SwingReading => {
  const idle: SwingReading = { speed: 0, curl: 0, aimOffset: 0 };
  if (samples.length < 2 || viewportHeight <= 0) return idle;

  const last = samples[samples.length - 1]!;
  const recent = samples.filter((s) => last.t - s.t <= RELEASE_WINDOW);
  const window =
    recent.length >= LEAST_SAMPLES ? recent : samples.slice(-Math.max(LEAST_SAMPLES, recent.length));
  if (window.length < 2) return idle;

  const first = window[0]!;
  const elapsed = (last.t - first.t) / 1000;
  if (elapsed <= 0) return idle;

  const dx = last.x - first.x;
  const dy = last.y - first.y;

  return {
    speed: Math.hypot(dx, dy) / viewportHeight / elapsed,
    curl: turnRate(window),
    // Zero when travelling straight up the screen, positive to the right. The
    // camera sits behind the thrower, so "up the screen" is away from them.
    aimOffset: Math.atan2(dx, -dy),
  };
};

/**
 * How fast the direction of travel was turning, in radians per second.
 *
 * Measured between successive segments of the stroke rather than from its
 * overall shape, so a late hook counts for as much as it should. Segments too
 * short to have a reliable direction are skipped — at the end of a flick the
 * samples bunch up, and noise there would read as enormous curl.
 */
const turnRate = (window: readonly Sample[]): number => {
  let turned = 0;
  let elapsed = 0;
  let previousDirection: number | null = null;

  for (let i = 1; i < window.length; i++) {
    const from = window[i - 1]!;
    const to = window[i]!;
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    if (Math.hypot(dx, dy) < 1.5) continue;

    const direction = Math.atan2(dy, dx);
    const dt = (to.t - from.t) / 1000;
    if (previousDirection !== null && dt > 0) {
      turned += wrap(direction - previousDirection);
      elapsed += dt;
    }
    previousDirection = direction;
  }

  return elapsed > 0 ? turned / elapsed : 0;
};

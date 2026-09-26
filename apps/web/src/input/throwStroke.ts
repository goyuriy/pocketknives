import { isThrow, type ThrowConfig, type ThrowIntent } from '@pocketknives/core';
import { handSway } from './handSway.js';

export type Sample = {
  readonly x: number;
  readonly y: number;
  /** Milliseconds, on the same clock as `performance.now()`. */
  readonly t: number;
};

/** The stretch of screen the hand's reach is spread across, in the pointer's own coordinates. */
export type Reach = {
  readonly left: number;
  readonly width: number;
};

/** A throw in progress: the button is down, the arm is working. */
export type Stroke = {
  /** Where the grip began. Drawing back is measured from here, and pushing through it throws. */
  readonly anchor: Sample;
  readonly reach: Reach;
  readonly samples: readonly Sample[];
};

export type StrokeReading = {
  /**
   * How far the arm is drawn right now, as a fraction of a full draw. Negative
   * once the pointer has come back up past the grip without throwing.
   */
  readonly draw: number;
  /** Where the hand points right now — it keeps following the pointer sideways while drawn. */
  readonly aim: number;
  /** The throw, if this step pushed through the grip hard enough to make one. */
  readonly thrown: ThrowIntent | null;
};

/** How long a stroke remembers. A draw held longer than this is still a draw; only its path is forgotten. */
const MEMORY = 3000;
/** How close to the bottom of the draw counts as "still at the bottom", in screen-heights. */
const BOTTOM_TOLERANCE = 0.01;

/**
 * Where the hand points, from where the pointer is across the screen.
 *
 * The pointer *is* the hand — there is no cursor and no crosshair, only the
 * knife, the way Bodycam gives you the gun and not a dot. Edge to edge of the
 * stage is the whole reach of the arm.
 */
export const aimFromPointer = (x: number, left: number, width: number, config: ThrowConfig): number => {
  const across = Math.min(1, Math.max(-1, ((x - left) / Math.max(1, width)) * 2 - 1));
  return across * config.gesture.maxAim;
};

const aimOf = (sample: Sample, reach: Reach, config: ThrowConfig): number =>
  aimFromPointer(sample.x, reach.left, reach.width, config);

export const gripStroke = (at: Sample, reach: Reach): Stroke => ({ anchor: at, reach, samples: [at] });

/**
 * Feeds new pointer samples into a stroke, and says whether they threw.
 *
 * The motion is a golf swing's, turned on its end: pull the pointer back
 * towards you to draw the arm, then push it forward through the point where you
 * gripped. Crossing that point is the release.
 *
 * - **Where** keeps following the pointer sideways all through the draw, so a
 *   player can hold the arm back and still settle the line. It freezes where
 *   the push begins: from there on, sideways motion is the push going crooked,
 *   not the player re-aiming.
 * - **How far** comes from the bottom of the draw — a position, not a speed. A
 *   mouse and a trackpad and a thumb all move at wildly different speeds, but
 *   "pulled back a quarter of the screen" means the same thing on each.
 * - **Whether** comes from the speed of the push. Drift back up slowly and the
 *   arm simply eases back to rest; that is how a throw is called off without
 *   letting go.
 * - **How cleanly** comes from the push's direction. Straight up is clean; a
 *   push that wanders sideways pulls the knife off line.
 *
 * Pure: the stroke goes in, a new stroke and a reading come out.
 */
export const advanceStroke = (
  stroke: Stroke,
  fresh: readonly Sample[],
  viewportHeight: number,
  config: ThrowConfig,
): { stroke: Stroke; reading: StrokeReading } => {
  const height = Math.max(1, viewportHeight);
  const { anchor } = stroke;
  const drawOf = (sample: Sample) => (sample.y - anchor.y) / height / config.gesture.fullDraw;

  const samples = [...stroke.samples];
  let thrown: ThrowIntent | null = null;

  for (const sample of fresh) {
    const previous = samples[samples.length - 1]!;
    samples.push(sample);
    const crossedUp = previous.y > anchor.y && sample.y <= anchor.y;
    if (crossedUp && !thrown) thrown = throwFrom(samples, stroke, sample, height, config, drawOf);
  }

  const latest = samples[samples.length - 1]!;
  return {
    stroke: { ...stroke, samples: samples.filter((s) => latest.t - s.t <= MEMORY) },
    reading: { draw: drawOf(latest), aim: aimOf(latest, stroke.reach, config), thrown },
  };
};

/** Reads the push that just went through the grip, or null if it was too soft to be a throw. */
const throwFrom = (
  samples: readonly Sample[],
  stroke: Stroke,
  release: Sample,
  height: number,
  config: ThrowConfig,
  drawOf: (sample: Sample) => number,
): ThrowIntent | null => {
  // Everything since the pointer last sat at or above the grip is this draw.
  let start = samples.length - 2;
  while (start > 0 && samples[start - 1]!.y > stroke.anchor.y) start--;
  const draw = samples.slice(start, -1);
  if (draw.length === 0) return null;

  // The push begins where the draw was deepest — the *last* moment there, so a
  // player who pauses at the bottom is not measured as pushing slowly.
  const deepest = Math.max(...draw.map((s) => s.y));
  const bottom = [...draw].reverse().find((s) => s.y >= deepest - BOTTOM_TOLERANCE * height)!;

  const seconds = (release.t - bottom.t) / 1000;
  const pushSpeed = seconds > 0 ? (bottom.y - release.y) / height / seconds : Infinity;
  if (pushSpeed < config.gesture.minPushSpeed) return null;

  const intent: ThrowIntent = {
    aim: aimOf(bottom, stroke.reach, config) + handSway(release.t / 1000),
    draw: Math.min(1, drawOf(bottom)),
    drift: Math.atan2(release.x - bottom.x, bottom.y - release.y),
  };
  return isThrow(intent, config) ? intent : null;
};

import { isThrow, type ThrowConfig, type ThrowIntent } from '@pocketknives/core';
import { handSway } from './handSway.js';

export type Sample = {
  readonly x: number;
  readonly y: number;
  /** Milliseconds, on the same clock as `performance.now()`. */
  readonly t: number;
};

/**
 * How sideways pointer movement becomes aim, relative to the facing the hand
 * started from: `(x − centre) × radiansPerPixel`, capped at `limit` if there is
 * one.
 *
 * Two kinds, one shape. On a touch screen the pointer's place across the stage
 * *is* the aim, capped at the arm's reach (`screenReach`). With the mouse
 * captured for mouse-look there is no place, only motion, and the aim turns as
 * far as the mouse travels (`lookReach`).
 */
export type Reach = {
  readonly centre: number;
  readonly radiansPerPixel: number;
  readonly limit: number | null;
};

/** Edge to edge of the stage is the arm's whole reach. */
export const screenReach = (left: number, width: number, config: ThrowConfig): Reach => ({
  centre: left + width / 2,
  radiansPerPixel: config.gesture.maxAim / Math.max(1, width / 2),
  limit: config.gesture.maxAim,
});

/**
 * A finger: aim turns with how far it drags sideways from where it came down,
 * half the stage's width being the arm's whole reach.
 *
 * Where on the glass the finger lands says nothing — a thumb on a phone lands
 * wherever it is comfortable, and reading its landing place as aim turned the
 * player a little further every time they tapped on the right.
 */
export const dragReach = (landedAt: number, width: number, config: ThrowConfig): Reach => ({
  centre: landedAt,
  radiansPerPixel: config.gesture.maxAim / Math.max(1, width / 2),
  limit: config.gesture.maxAim,
});

/** Mouse-look: aim turns with the mouse from where it gripped, as far as it goes. */
export const lookReach = (centre: number, radiansPerPixel: number): Reach => ({
  centre,
  radiansPerPixel,
  limit: null,
});

/**
 * How much of the stage, from the top, the hand's height is read across. The
 * HUD covers the rest, and the pointer never reaches the stage beneath it.
 */
const PITCH_BAND = 0.7;

/** A throw in progress: the button is down, the arm is working. */
export type Stroke = {
  /** Where the grip began. Drawing back is measured from here, and pushing through it throws. */
  readonly anchor: Sample;
  readonly reach: Reach;
  /**
   * How steeply to throw. Chosen by the hand's height before gripping and
   * locked by the grip — from then on, up and down is the draw.
   */
  readonly pitch: number;
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
/**
 * How much of the way back from the bottom of the draw towards the grip point a
 * push must come before letting go counts as throwing.
 */
const LIFT_RETURN = 0.3;
/** One display frame, in milliseconds — the most a push can have been under way before it was first seen. */
const FRAME = 1000 / 60;
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

/**
 * How steeply the hand is set to throw, from how high the pointer is.
 *
 * Raise the hand to lob, lower it to throw flat. Top of the stage is the
 * steepest throw, the bottom of the band above the HUD the flattest.
 */
export const pitchFromPointer = (y: number, top: number, height: number, config: ThrowConfig): number => {
  const { minPitch, maxPitch } = config.gesture;
  const down = Math.min(1, Math.max(0, (y - top) / Math.max(1, height * PITCH_BAND)));
  return maxPitch + (minPitch - maxPitch) * down;
};

const aimOf = (sample: Sample, { centre, radiansPerPixel, limit }: Reach): number => {
  const aim = (sample.x - centre) * radiansPerPixel;
  return limit === null ? aim : Math.min(limit, Math.max(-limit, aim));
};

export const gripStroke = (at: Sample, reach: Reach, pitch: number): Stroke => ({
  anchor: at,
  reach,
  pitch,
  samples: [at],
});

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
 * - **How hard it spins** comes from the push's speed — a gentle push turns it
 *   lazily, a sharp whip sends it whirling.
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
    reading: { draw: drawOf(latest), aim: aimOf(latest, stroke.reach), thrown },
  };
};

/**
 * Letting go mid-swing: a throw if the hand was pushing forward, fast, when it
 * let go — or null, and the throw is called off.
 *
 * On a phone the natural motion is to pull back and flick, and the thumb comes
 * off the glass during the flick, rarely after it has travelled all the way back
 * to where it first touched. So a push that is under way when the pointer lifts
 * throws, exactly as if it had carried on through the grip point: the same draw,
 * the same drift, the same speed test. Lifting while still, or while pulling
 * back, calls it off as before.
 */
export const liftStroke = (
  stroke: Stroke,
  lift: Sample,
  viewportHeight: number,
  config: ThrowConfig,
): ThrowIntent | null => {
  const height = Math.max(1, viewportHeight);
  const samples = [...stroke.samples, lift];
  if (lift.y <= stroke.anchor.y) return null; // already through the grip: `advanceStroke` threw or refused it
  const drawOf = (sample: Sample) => (sample.y - stroke.anchor.y) / height / config.gesture.fullDraw;
  return throwFrom(samples, stroke, lift, height, config, drawOf);
};

/**
 * How hard the push was whipped, 0 to 1: from the slowest push that throws at
 * all to a sharp flick. This is the spin — see `ThrowIntent.whip`.
 */
const whipOf = (pushSpeed: number, config: ThrowConfig): number => {
  const { minPushSpeed, fullWhip } = config.gesture;
  return Math.min(1, Math.max(0, (pushSpeed - minPushSpeed) / Math.max(1e-6, fullWhip - minPushSpeed)));
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
  if (start > 0 && samples[start]!.y <= stroke.anchor.y) start++;
  const draw = samples.slice(start, -1);
  if (draw.length === 0) return null;

  // The push begins where the draw was deepest — the *last* moment there, so a
  // player who pauses at the bottom is not measured as pushing slowly.
  const deepest = Math.max(...draw.map((s) => s.y));
  const bottomIndex = draw.map((s) => s.y >= deepest - BOTTOM_TOLERANCE * height).lastIndexOf(true);
  const bottom = draw[bottomIndex]!;
  /*
   * A pointer held still sends nothing at all, so the last sample at the bottom
   * can be long before the push began. The push cannot have started more than a
   * frame before the first sample that moved away, so it is timed from there.
   */
  const firstMove = draw[bottomIndex + 1] ?? release;
  const pushStart = Math.max(bottom.t, firstMove.t - FRAME);

  // Came back far enough to be a push at all, not a thumb rolling off the glass.
  if (bottom.y - release.y < LIFT_RETURN * (bottom.y - stroke.anchor.y)) return null;

  const seconds = (release.t - pushStart) / 1000;
  const pushSpeed = seconds > 0 ? (bottom.y - release.y) / height / seconds : Infinity;
  if (pushSpeed < config.gesture.minPushSpeed) return null;

  const intent: ThrowIntent = {
    aim: aimOf(bottom, stroke.reach) + handSway(release.t / 1000),
    pitch: stroke.pitch,
    draw: Math.min(1, drawOf(bottom)),
    drift: Math.atan2(release.x - bottom.x, bottom.y - release.y),
    whip: whipOf(pushSpeed, config),
  };
  return isThrow(intent, config) ? intent : null;
};

import type { Vec2, Vec3 } from '../types.js';
import type { Launch } from './types.js';
import { DEFAULT_CONFIG, momentOfInertia, type ThrowConfig } from './config.js';
import { scatterLaunch } from './launch.js';

/**
 * What the hand was doing at the moment it let go.
 *
 * Deliberately abstract — no pixels, no viewport. The surface that captured the
 * gesture normalises it to these three numbers, and everything downstream works
 * the same whether it came from a touchscreen, a mouse, or a replay.
 */
export type SwingReading = {
  /** How fast the hand was travelling, in screen-heights per second. */
  readonly speed: number;
  /**
   * How sharply the stroke was turning at release, radians per second, signed.
   *
   * This is the wrist. A straight push has none of it and throws a knife that
   * barely rotates; a tight flick has a great deal and spins it hard.
   */
  readonly curl: number;
  /** Where it was heading relative to straight ahead, radians, positive to the right. */
  readonly aimOffset: number;
};

const clamp01 = (value: number): number => Math.min(1, Math.max(0, value));

/**
 * Turns a throwing motion into a knife in the air.
 *
 * The whole point of reading the hand rather than a slider is that speed and
 * curl are *independent*. Under the old control, one number set both how far the
 * knife went and where in its tumble it arrived, which welded distance to
 * rotation and left only a couple of distances that could ever stick. Here the
 * hand supplies both separately, so any distance is reachable — provided the
 * wrist does the right thing to go with it.
 *
 * Curl is read as an angular impulse rather than a tumble rate, so the knife
 * still has its say: the same flick spins a light blade faster than a heavy one.
 */
export const swingLaunch = (
  from: Vec2,
  restHeading: number,
  reading: SwingReading,
  config: ThrowConfig = DEFAULT_CONFIG,
  seed?: number,
): Launch => {
  const { gesture, style } = config;
  const power = clamp01(
    (reading.speed - gesture.minSwipe) / Math.max(1e-6, gesture.fullPowerSwipe - gesture.minSwipe),
  );
  const impulse = (reading.curl / gesture.referenceCurl) * style.spinImpulse;

  const clean: Launch = {
    origin: [from[0], from[1], style.releaseHeight] as Vec3,
    // Follow-through: the knife goes where the hand was going. This is the
    // opposite of a drawn-bow gesture, and rightly so — a throw is not a pull.
    heading: restHeading - reading.aimOffset * gesture.aimGain,
    pitch: style.pitch,
    speed: style.minSpeed + (style.maxSpeed - style.minSpeed) * power,
    spin: impulse / momentOfInertia(config.knife),
    bladeAngle: style.startingBladeAngle,
  };

  return seed === undefined ? clean : scatterLaunch(clean, config, seed);
};

/** Did the hand move enough to have thrown anything at all? */
export const isThrow = (reading: SwingReading, config: ThrowConfig = DEFAULT_CONFIG): boolean =>
  reading.speed >= config.gesture.minSwipe;

/**
 * The tumble rates that would have stuck this throw, given how far it went.
 *
 * Flight time follows from the speed alone, and the knife arrives blade-first
 * whenever its total turn lands on the direction of travel — so the answer is a
 * ladder of rates, one per whole rotation, not a single number. Any of them
 * works, which is what makes every distance reachable.
 *
 * Purely for feedback. A player who is told only "it did not stick" learns
 * nothing; one who is told "you spun it 18, it needed 26" knows to flick harder.
 */
export const stickingSpins = (
  flightTime: number,
  travelAngle: number,
  config: ThrowConfig = DEFAULT_CONFIG,
  turns = 4,
): number[] => {
  if (flightTime <= 0) return [];
  const spins: number[] = [];
  for (let turn = 0; turn <= turns; turn++) {
    const spin = (travelAngle + 2 * Math.PI * turn - config.style.startingBladeAngle) / flightTime;
    if (spin > 0) spins.push(spin);
  }
  return spins;
};

/** Of those, the one this throw came closest to — the near miss worth reporting. */
export const nearestStickingSpin = (
  spin: number,
  flightTime: number,
  travelAngle: number,
  config: ThrowConfig = DEFAULT_CONFIG,
): number | null => {
  const candidates = stickingSpins(flightTime, travelAngle, config);
  if (candidates.length === 0) return null;
  return candidates.reduce((best, candidate) =>
    Math.abs(candidate - spin) < Math.abs(best - spin) ? candidate : best,
  );
};

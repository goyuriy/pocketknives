import type { Vec2, Vec3 } from '../types.js';
import type { Launch } from './types.js';
import { DEFAULT_CONFIG, launchSpeed, spinRate, stickWindow, type ThrowConfig } from './config.js';
import { simulateFlight } from './flight.js';
import { scatterLaunch } from './launch.js';

/**
 * What the hand was doing at the moment it let go.
 *
 * Deliberately abstract — no pixels, no viewport. The surface that captured the
 * gesture normalises it to these numbers, and everything downstream works the
 * same whether it came from a touchscreen, a mouse, or a replay.
 *
 * Two things only: which way, and how hard. The wrist is not the player's job —
 * see `wristSpin`.
 */
export type SwingReading = {
  /** How fast the hand was travelling, in screen-heights per second. */
  readonly speed: number;
  /** Where it was heading relative to straight ahead, radians, positive to the right. */
  readonly aimOffset: number;
};

const clamp01 = (value: number): number => Math.min(1, Math.max(0, value));

/** How hard the hand threw, 0 to 1, from how fast it was moving. */
export const swingPower = (reading: SwingReading, config: ThrowConfig = DEFAULT_CONFIG): number => {
  const { fullPowerSwipe, minSwipe } = config.gesture;
  return clamp01((reading.speed - minSwipe) / Math.max(1e-6, fullPowerSwipe - minSwipe));
};

/**
 * Did the hand throw anything at all?
 *
 * It has to have been moving, and moving *away* — up the screen, towards the
 * circle. Drawing the hand back to wind up is a stroke too, and letting go
 * mid-wind-up must not hurl the knife over the thrower's shoulder.
 */
export const isThrow = (reading: SwingReading, config: ThrowConfig = DEFAULT_CONFIG): boolean =>
  reading.speed >= config.gesture.minSwipe && Math.abs(reading.aimOffset) < Math.PI / 2;

/**
 * Turns a throwing motion into a knife in the air.
 *
 * The player chooses direction and pace; the hand does the rest. Pace sets the
 * distance, and the wrist then turns the knife by exactly as much as that
 * distance needs to bring it in point-first. So a clean throw always sticks,
 * wherever it was aimed — what decides the throw is *where* it lands, which is
 * the game the circle is actually about.
 *
 * What can still go wrong is the hand itself. `seed` applies the scatter in the
 * config after the wrist has made its choice: a wobble in the tumble, or in the
 * pace the wrist had planned for, and the knife arrives off its sweet spot. A
 * longer throw spends longer in the air for that error to grow in, which is
 * what makes reaching far a risk rather than a free choice.
 */
export const swingLaunch = (
  from: Vec2,
  restHeading: number,
  reading: SwingReading,
  config: ThrowConfig = DEFAULT_CONFIG,
  seed?: number,
): Launch => {
  const { gesture, style } = config;
  const aimed: Launch = {
    origin: [from[0], from[1], style.releaseHeight] as Vec3,
    // Follow-through: the knife goes where the hand was going. This is the
    // opposite of a drawn-bow gesture, and rightly so — a throw is not a pull.
    heading: restHeading - reading.aimOffset * gesture.aimGain,
    pitch: style.pitch,
    speed: launchSpeed(config, swingPower(reading, config)),
    spin: 0,
    bladeAngle: style.startingBladeAngle,
  };
  const thrown: Launch = { ...aimed, spin: wristSpin(aimed, config) };

  return seed === undefined ? thrown : scatterLaunch(thrown, config, seed);
};

/**
 * The tumble a practised wrist gives this throw.
 *
 * The knife sticks whenever its total turn lands it inside the sticking range,
 * and there is one such tumble rate per whole rotation. Of those, the wrist
 * picks the one nearest the knife's natural tumble — so a heavy knife still
 * turns lazily and a light one still whirls, and the knife keeps its character
 * even though nobody is choosing its spin.
 */
export const wristSpin = (launch: Launch, config: ThrowConfig = DEFAULT_CONFIG): number => {
  const natural = spinRate(config);
  // Spin does not bend the arc, so any value finds when and how steeply it lands.
  const { impact } = simulateFlight({ ...launch, spin: 0 }, config.flight);
  const target = sweetSpotAngle(impact.descentAngle, config);
  return nearestStickingSpin(natural, impact.time, target, launch.bladeAngle) ?? natural;
};

/**
 * Where in its turn the knife should arrive to stick most surely, radians.
 *
 * The middle of the range both gates accept: turned far enough that the point is
 * lower than the butt, not so far that it arrives across its own path. The two
 * limits are not symmetric about the line of flight — the entry gate usually
 * cuts the under-turned side short — so aiming at the line of flight itself
 * would leave the wrist with less margin one way than the other.
 */
export const sweetSpotAngle = (
  descentAngle: number,
  config: ThrowConfig = DEFAULT_CONFIG,
): number => {
  const travel = -descentAngle;
  const window = stickWindow(config);
  const { minEntryAngle } = config.stick;
  const leastTurned = Math.min(travel + window, -minEntryAngle);
  const mostTurned = Math.max(travel - window, -Math.PI + minEntryAngle);
  return (leastTurned + mostTurned) / 2;
};

/**
 * The forward tumble rate closest to `spin` that brings the knife in at
 * `arrivalAngle` after `flightTime`. Null if no forward tumble can.
 *
 * From `start − spin·t ≡ arrival (mod 2π)`: there is one such rate per whole
 * turn, so the answer is the rung of that ladder nearest the rate asked about.
 */
export const nearestStickingSpin = (
  spin: number,
  flightTime: number,
  arrivalAngle: number,
  startAngle: number = DEFAULT_CONFIG.style.startingBladeAngle,
): number | null => {
  if (flightTime <= 0) return null;
  const turnNeeded = startAngle - arrivalAngle;
  const rung = (turns: number) => (turnNeeded + 2 * Math.PI * turns) / flightTime;
  const nearest = Math.max(0, (spin * flightTime - turnNeeded) / (2 * Math.PI));
  const candidates = [Math.floor(nearest), Math.ceil(nearest), Math.ceil(nearest) + 1]
    .map(rung)
    .filter((candidate) => candidate > 0);
  if (candidates.length === 0) return null;
  return candidates.reduce((best, candidate) =>
    Math.abs(candidate - spin) < Math.abs(best - spin) ? candidate : best,
  );
};

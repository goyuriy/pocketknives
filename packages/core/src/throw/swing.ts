import type { Vec2, Vec3 } from '../types.js';
import type { Launch } from './types.js';
import { DEFAULT_CONFIG, launchSpeed, spinRate, stickWindow, type ThrowConfig } from './config.js';
import { simulateFlight } from './flight.js';
import { scatterLaunch } from './launch.js';

/**
 * What the player asked the hand to do.
 *
 * Deliberately abstract — no pixels, no viewport, no mouse. The surface that
 * captured the input normalises it to these three numbers, and everything
 * downstream works the same whether they came from a mouse, a finger, or a
 * replay.
 *
 * Four decisions, each of them the player's, none of them a reflex: where to
 * point, how high, how far back to draw, and how cleanly to push through.
 */
export type ThrowIntent = {
  /** Where the hand pointed, radians from straight ahead, positive to the right. */
  readonly aim: number;
  /**
   * How steeply it was thrown, radians above level — a flat throw or a lob.
   * Kept within the gesture's range; see `launchPitch`.
   */
  readonly pitch: number;
  /** How far the arm was drawn back, 0 to 1. This is the distance. */
  readonly draw: number;
  /**
   * How far the push strayed sideways, radians, positive to the right.
   *
   * A straight push is zero. A push that wanders pulls the knife off the aimed
   * line the way a golf swing that comes across the ball slices it — an error
   * the player made, can see, and can stop making, not a roll of the dice.
   */
  readonly drift: number;
};

const clamp01 = (value: number): number => Math.min(1, Math.max(0, value));

/** How hard the arm threw, 0 to 1, from how far it was drawn back. */
export const drawPower = (intent: ThrowIntent, config: ThrowConfig = DEFAULT_CONFIG): number => {
  const { minDraw } = config.gesture;
  return clamp01((intent.draw - minDraw) / Math.max(1e-6, 1 - minDraw));
};

/** Was the arm drawn back far enough to have thrown anything at all? */
export const isThrow = (intent: ThrowIntent, config: ThrowConfig = DEFAULT_CONFIG): boolean =>
  intent.draw >= config.gesture.minDraw;

/** The throw's launch angle, held within what an arm can do. */
export const launchPitch = (intent: ThrowIntent, config: ThrowConfig = DEFAULT_CONFIG): number =>
  Math.min(config.gesture.maxPitch, Math.max(config.gesture.minPitch, intent.pitch));

/** The line the knife actually leaves on: the aim, pulled by however the push drifted. */
export const thrownHeading = (
  restHeading: number,
  intent: ThrowIntent,
  config: ThrowConfig = DEFAULT_CONFIG,
): number => restHeading - (intent.aim + intent.drift * config.gesture.driftGain);

/**
 * Turns a throw into a knife in the air.
 *
 * The draw sets how hard, the pitch how steeply, and the wrist then turns the
 * knife by exactly as much as that flight needs to bring it in point-first. A
 * lob stays up longer and comes down steeper; a flat throw is quick and
 * skims in. So a clean throw
 * always sticks, wherever it was aimed — what decides the throw is *where* it
 * lands, which is the game the circle is actually about.
 *
 * What can still go wrong is the hand. A crooked push sends it off line (see
 * `drift`), and `seed` applies the scatter in the config after the wrist has
 * made its choice: a wobble in the tumble or the pace, and the knife arrives
 * off its sweet spot. A longer throw spends longer in the air for that wobble
 * to grow in, which makes reaching far a risk rather than a free choice.
 */
export const swingLaunch = (
  from: Vec2,
  restHeading: number,
  intent: ThrowIntent,
  config: ThrowConfig = DEFAULT_CONFIG,
  seed?: number,
): Launch => {
  const { style } = config;
  const aimed: Launch = {
    origin: [from[0], from[1], style.releaseHeight] as Vec3,
    heading: thrownHeading(restHeading, intent, config),
    pitch: launchPitch(intent, config),
    speed: launchSpeed(config, drawPower(intent, config)),
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

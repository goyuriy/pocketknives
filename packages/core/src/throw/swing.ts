import type { Vec2, Vec3 } from '../types.js';
import type { Launch } from './types.js';
import {
  DEFAULT_CONFIG,
  biteDepth,
  grabAngle,
  launchSpeed,
  spinRate,
  stickWindow,
  type ThrowConfig,
  releaseBladeAngle,
} from './config.js';
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
   * How steeply it was thrown, radians above level — negative down into the
   * ground in front, positive a lob. Kept within the gesture's range; see
   * `launchPitch`.
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
  /**
   * How hard the push forward was whipped, 0 to 1 — how intensely the knife
   * spins. A gentle push turns it lazily, a sharp one sends it whirling; the
   * wrist still picks a spin that sticks, the nearest one to what was asked
   * for. Absent means a middling push: the knife's own natural turn.
   */
  readonly whip?: number;
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
  const pitch = launchPitch(intent, config);
  const aimed: Launch = {
    origin: [from[0], from[1], config.style.releaseHeight] as Vec3,
    heading: thrownHeading(restHeading, intent, config),
    pitch,
    speed: launchSpeed(config, drawPower(intent, config)),
    spin: 0,
    bladeAngle: releaseBladeAngle(pitch, config),
  };
  const thrown: Launch = { ...aimed, spin: wristSpin(aimed, config, whippedSpin(intent, config)) };

  return seed === undefined ? thrown : scatterLaunch(thrown, config, seed);
};

/**
 * The tumble a practised wrist gives this throw.
 *
 * The knife sticks whenever its total turn lands it inside the sticking range,
 * and there is one such tumble rate per whole rotation. Of those, the wrist
 * picks the one nearest the tumble it was asked for — by default the knife's
 * natural tumble, so a heavy knife still turns lazily and a light one still
 * whirls; with a whip, as hard as the push asked (see `whippedSpin`).
 */
export const wristSpin = (
  launch: Launch,
  config: ThrowConfig = DEFAULT_CONFIG,
  wanted: number = spinRate(config),
): number => {
  // Spin does not bend the arc, so any value finds when and how steeply it lands.
  const { impact } = simulateFlight({ ...launch, spin: 0 }, config.flight);
  // Planned for the deepest the point can go, the one that leaves the handle lowest.
  const target = sweetSpotAngle(impact.descentAngle, config, biteDepth(config, impact.speed));
  return nearestStickingSpin(wanted, impact.time, target, launch.bladeAngle) ?? wanted;
};

/** The gentlest and wildest a whip can turn the knife, as multiples of its natural tumble. */
const LAZIEST_WHIP = 0.4;
const WILDEST_WHIP = 2.2;

/**
 * The tumble the push asked for: the knife's natural turn, scaled by how hard
 * the push was whipped. A middling push asks for the natural turn exactly.
 */
export const whippedSpin = (intent: ThrowIntent, config: ThrowConfig = DEFAULT_CONFIG): number => {
  const whip = Math.min(1, Math.max(0, intent.whip ?? MIDDLING_WHIP));
  return spinRate(config) * (LAZIEST_WHIP + (WILDEST_WHIP - LAZIEST_WHIP) * whip);
};

/** The whip that asks for exactly the knife's natural tumble. */
const MIDDLING_WHIP = (1 - LAZIEST_WHIP) / (WILDEST_WHIP - LAZIEST_WHIP);

/**
 * Where in its turn the knife should arrive to stick most surely, radians.
 *
 * The middle of the range every gate accepts: turned far enough that it stands
 * up steeply enough to be grabbed by the handle, not so far that it arrives
 * across its own path. The two limits are not symmetric about the line of
 * flight — the handle's clearance usually cuts the under-turned side short — so
 * aiming at the line of flight itself would leave the wrist with less margin
 * one way than the other.
 *
 * `depth` is how far the point is expected to sink: the deeper it goes, the
 * less knife is left to lift the handle, and the steeper it must stand.
 */
export const sweetSpotAngle = (
  descentAngle: number,
  config: ThrowConfig = DEFAULT_CONFIG,
  depth = 0,
): number => {
  const travel = -descentAngle;
  const window = stickWindow(config);
  const shallowest = Math.max(config.stick.minEntryAngle, grabAngle(config, depth));
  const leastTurned = Math.min(travel + window, -shallowest);
  const mostTurned = Math.max(travel - window, -Math.PI + shallowest);
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
  startAngle: number = releaseBladeAngle(DEFAULT_CONFIG.style.pitch, DEFAULT_CONFIG),
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

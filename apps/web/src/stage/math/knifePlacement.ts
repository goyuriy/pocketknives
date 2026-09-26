import type { Flight, FlightSample, Vec3 } from '@pocketknives/core';
import { axisAngle, bladeDirection, rotate } from './coords.js';

/** Where a knife is and which way it points, in game coordinates. */
export type Placement = {
  readonly position: Vec3;
  readonly heading: number;
  readonly bladeAngle: number;
  /** Sideways lean about the line of the throw, radians. Zero when upright in its plane. */
  readonly lean?: number;
};

/**
 * Reads the flight at a moment in time.
 *
 * Samples are dense, but the playback clock does not land on them, so this
 * interpolates. Blade angle is blended raw rather than wrapped: it climbs
 * without bound through the tumble, which is exactly what makes it safe to
 * blend between two samples.
 */
export const sampleFlight = (flight: Flight, time: number): FlightSample => {
  const { samples } = flight;
  const last = samples[samples.length - 1]!;
  if (time >= last.time || samples.length < 2) return last;

  const step = samples[1]!.time - samples[0]!.time;
  const index = Math.min(Math.max(0, Math.floor(time / step)), samples.length - 2);
  const from = samples[index]!;
  const to = samples[index + 1]!;
  const t = Math.min(1, Math.max(0, (time - from.time) / (to.time - from.time)));

  return {
    time,
    position: [
      from.position[0] + (to.position[0] - from.position[0]) * t,
      from.position[1] + (to.position[1] - from.position[1]) * t,
      from.position[2] + (to.position[2] - from.position[2]) * t,
    ],
    bladeAngle: from.bladeAngle + (to.bladeAngle - from.bladeAngle) * t,
  };
};

/** The knife in the air, `time` seconds into its flight. */
export const flyingPlacement = (flight: Flight, time: number): Placement => {
  const sample = sampleFlight(flight, time);
  return { position: sample.position, heading: flight.impact.heading, bladeAngle: sample.bladeAngle };
};

/**
 * A knife at rest in the ground, sunk along its own line.
 *
 * How deep is not decoration — it comes from the impact and the knife's own mass
 * and edge, so a heavy blade thrown hard is buried to the handle and a light one
 * stands proud. A scrappy stick goes in shallower still.
 */
export const stuckPlacement = (flight: Flight, quality: number, bite: number): Placement => {
  const { impact } = flight;
  const along = bladeDirection(impact.heading, impact.bladeAngle);
  const depth = bite * (0.5 + 0.5 * quality);
  return {
    position: [
      impact.point[0] - along[0] * depth,
      impact.point[1] - along[1] * depth,
      -along[2] * depth,
    ],
    heading: impact.heading,
    bladeAngle: impact.bladeAngle,
  };
};

/**
 * A knife that failed, lying flat past where it struck — which is where a blade
 * that landed on its side ends up. Seeing it lie there, rather than vanish, is
 * what tells the player the throw was wrong rather than the aim.
 */
export const fallenPlacement = (flight: Flight, skid = 0.9): Placement => {
  const { impact } = flight;
  return {
    position: [
      impact.point[0] + Math.cos(impact.heading) * skid,
      impact.point[1] + Math.sin(impact.heading) * skid,
      0.03,
    ],
    heading: impact.heading,
    bladeAngle: 0,
  };
};

/** How long a stuck knife quivers before it is still, in seconds. */
export const QUIVER_DURATION = 1.4;
/** How fast the handle waggles, in cycles per second — a stiff blade, a quick shiver. */
const QUIVER_RATE = 11;

/**
 * How far a stuck knife is leaning, `t` seconds after it went in.
 *
 * It rings like a struck ruler: a fast waggle that dies away. A hard hit rings
 * wider, and a scrappy stick — one that went in at an angle it only just
 * forgave — shudders more than a clean one, which goes in dead straight.
 */
export const quiverLean = (t: number, strength: number, clean: number): number => {
  if (t < 0 || t >= QUIVER_DURATION) return 0;
  const amplitude = 0.05 + 0.18 * strength * (1.4 - 0.8 * clean);
  const fade = Math.exp(-t / 0.3) * (1 - t / QUIVER_DURATION);
  return amplitude * fade * Math.sin(2 * Math.PI * QUIVER_RATE * t);
};

/**
 * A stuck knife, quivering: leaned about the point where it enters the ground,
 * so the buried tip stays put and the handle does the waggling.
 */
export const quiveringPlacement = (
  flight: Flight,
  quality: number,
  bite: number,
  lean: number,
): Placement => {
  const still = stuckPlacement(flight, quality, bite);
  if (lean === 0) return still;
  const pivot: Vec3 = [flight.impact.point[0], flight.impact.point[1], 0];
  const tilt = axisAngle([Math.cos(still.heading), Math.sin(still.heading), 0], lean);
  const offset = rotate(tilt, [
    still.position[0] - pivot[0],
    still.position[1] - pivot[1],
    still.position[2] - pivot[2],
  ]);
  return {
    ...still,
    position: [pivot[0] + offset[0], pivot[1] + offset[1], pivot[2] + offset[2]],
    lean,
  };
};

/** How long a knife that did not stick takes to bounce to a stop, in seconds. */
export const BOUNCE_DURATION = 0.55;

/**
 * A knife that did not stick, `t` seconds after it hit: bouncing and
 * cartwheeling along the line of the throw to where it comes to rest.
 *
 * Two hops, the second lower, carrying on the tumble it arrived with — a
 * knife does not stop turning because it touched the ground — and settling
 * exactly on `fallenPlacement`, so there is no jump when the bounce ends.
 */
export const bouncingPlacement = (flight: Flight, t: number, strength: number): Placement => {
  const rest = fallenPlacement(flight);
  if (t >= BOUNCE_DURATION) return rest;
  const { impact } = flight;
  const u = Math.max(0, t) / BOUNCE_DURATION;
  const along = 1 - Math.pow(1 - u, 2);
  const hops = Math.abs(Math.sin(2 * Math.PI * u)) * (1 - u) * (0.15 + 0.35 * strength);
  // Keep tumbling forward, at least a turn, to land flat.
  const settle = 2 * Math.PI * (Math.floor(impact.bladeAngle / (2 * Math.PI)) - 1);
  return {
    position: [
      impact.point[0] + (rest.position[0] - impact.point[0]) * along,
      impact.point[1] + (rest.position[1] - impact.point[1]) * along,
      rest.position[2] + hops,
    ],
    heading: impact.heading,
    bladeAngle: impact.bladeAngle + (settle - impact.bladeAngle) * along,
  };
};

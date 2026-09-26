import type { Flight, FlightSample, Vec3 } from '@pocketknives/core';
import { bladeDirection } from './coords.js';

/** Where a knife is and which way it points, in game coordinates. */
export type Placement = {
  readonly position: Vec3;
  readonly heading: number;
  readonly bladeAngle: number;
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

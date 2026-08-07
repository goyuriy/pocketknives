import type { Vec2, Vec3 } from '../types.js';
import type { Flight, FlightSample, FlightTuning, Impact, Launch } from './types.js';
import { DEFAULT_CONFIG } from './config.js';

/**
 * Brings an angle into [-π, π), so a tumble measures by the short way round.
 *
 * Without this a knife a hair past vertical would read as almost a full turn
 * from where it should be, rather than a hair.
 */
export const wrapAngle = (radians: number): number => {
  const wrapped = ((radians + Math.PI) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI);
  return wrapped - Math.PI;
};

/**
 * Throws the knife and follows it to the ground.
 *
 * A plain projectile arc with the knife tumbling at a constant rate — no drag,
 * no wobble, no physics engine. That is a deliberate choice rather than a corner
 * cut: the result must be identical on every machine, because a server and a
 * client have to agree on where the knife landed without replaying each other's
 * floating point. A physics engine cannot promise that; this closed-form arc
 * can.
 *
 * The skill lives in the coupling between the two. Flight time is set by how
 * hard it was thrown, and the tumble runs at a fixed rate throughout — so how
 * far you throw decides where in its rotation the knife arrives. Distance bands
 * exist where it comes in blade-first, and finding them is the game.
 */
export const simulateFlight = (
  launch: Launch,
  tuning: FlightTuning = DEFAULT_CONFIG.flight,
): Flight => {
  const horizontalSpeed = launch.speed * Math.cos(launch.pitch);
  const verticalSpeed = launch.speed * Math.sin(launch.pitch);
  const duration = timeToGround(launch.origin[2], verticalSpeed, tuning.gravity);

  const samples: FlightSample[] = [];
  for (let time = 0; time < duration; time += tuning.sampleInterval) {
    samples.push(sampleAt(launch, horizontalSpeed, verticalSpeed, tuning.gravity, time));
  }
  const landing = sampleAt(launch, horizontalSpeed, verticalSpeed, tuning.gravity, duration);
  samples.push(landing);

  return { samples, impact: impactOf(launch, horizontalSpeed, verticalSpeed, tuning, landing) };
};

/**
 * When the arc reaches z = 0, from `z0 + vz·t − ½g·t²= 0`.
 *
 * Only the later root is meaningful: the knife is thrown from above the ground,
 * so the earlier root sits in negative time, before it left the hand.
 */
const timeToGround = (height: number, verticalSpeed: number, gravity: number): number =>
  (verticalSpeed + Math.sqrt(verticalSpeed * verticalSpeed + 2 * gravity * height)) / gravity;

const sampleAt = (
  launch: Launch,
  horizontalSpeed: number,
  verticalSpeed: number,
  gravity: number,
  time: number,
): FlightSample => {
  const travelled = horizontalSpeed * time;
  const position: Vec3 = [
    launch.origin[0] + Math.cos(launch.heading) * travelled,
    launch.origin[1] + Math.sin(launch.heading) * travelled,
    launch.origin[2] + verticalSpeed * time - 0.5 * gravity * time * time,
  ];
  // Subtracted, not added: `bladeAngle` is the tip's angle above the line of
  // flight, and a thrown knife tumbles *forward* — tip over the top and down —
  // so that angle falls as it turns. Adding would spin it backwards, which is
  // not something a thrown knife does.
  return { time, position, bladeAngle: launch.bladeAngle - launch.spin * time };
};

const impactOf = (
  launch: Launch,
  horizontalSpeed: number,
  verticalSpeed: number,
  tuning: FlightTuning,
  landing: FlightSample,
): Impact => {
  const fallSpeed = verticalSpeed - tuning.gravity * landing.time;
  // Direction of travel in the flight plane, negative because it is descending.
  const travelAngle = Math.atan2(fallSpeed, horizontalSpeed);

  return {
    time: landing.time,
    point: [landing.position[0], landing.position[1]] as Vec2,
    speed: Math.hypot(horizontalSpeed, fallSpeed),
    bladeAngle: landing.bladeAngle,
    descentAngle: -travelAngle,
    // Which end is down, from the blade's own vertical component. Folded into
    // [-π/2, π/2] because only the up-or-down of it matters here; whether the
    // knife also points backwards is `misalignment`'s business.
    entryAngle: Math.asin(-Math.sin(landing.bladeAngle)),
    misalignment: Math.abs(wrapAngle(landing.bladeAngle - travelAngle)),
    heading: launch.heading,
  };
};

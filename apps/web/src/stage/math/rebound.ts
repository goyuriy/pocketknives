import type { Flight, Vec3 } from '@pocketknives/core';

/** How much of its arriving speed a knife keeps along the ground when it fails to bite. */
const SKID = 0.35;
/** How much of its arriving speed pops it back up off the ground. */
const POP = 0.18;
/** How much of its tumble it keeps turning with. */
const KEEP_SPIN = 0.6;

export type Rebound = {
  /** Game coordinates, units per second. */
  readonly linear: Vec3;
  /** Game coordinates, radians per second, as an axis scaled by rate. */
  readonly angular: Vec3;
};

/**
 * How a knife that did not stick comes off the ground: skidding on along its
 * line, popped up a little, still turning the way it was turning. This is only
 * the kick; from here the physics engine bounces and settles it, and none of
 * that decides anything — a knife that did not stick claimed nothing.
 */
export const rebound = (flight: Flight): Rebound => {
  const { impact, samples } = flight;
  const across = Math.cos(impact.descentAngle) * impact.speed;
  const forward: Vec3 = [Math.cos(impact.heading), Math.sin(impact.heading), 0];
  // The tumble, from how far the blade turned over the flight. Forward tumble
  // (blade angle falling) turns about the heading's left-hand horizontal.
  const turned = (samples[0]!.bladeAngle - impact.bladeAngle) / Math.max(impact.time, 1e-6);
  const left: Vec3 = [-Math.sin(impact.heading), Math.cos(impact.heading), 0];
  return {
    linear: [forward[0] * across * SKID, forward[1] * across * SKID, impact.speed * POP],
    angular: [left[0] * turned * KEEP_SPIN, left[1] * turned * KEEP_SPIN, 0],
  };
};

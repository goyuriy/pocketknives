import type { Vec3 } from '@pocketknives/core';

export type Limb = {
  /** Where the limb is fixed — a shoulder. */
  readonly root: Vec3;
  /** The middle joint — an elbow. */
  readonly joint: Vec3;
  /** Where the limb ends — a wrist. The target, if it could be reached. */
  readonly end: Vec3;
};

const sub = (a: Vec3, b: Vec3): Vec3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const add = (a: Vec3, b: Vec3, scale = 1): Vec3 => [a[0] + b[0] * scale, a[1] + b[1] * scale, a[2] + b[2] * scale];
const dot = (a: Vec3, b: Vec3): number => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const length = (a: Vec3): number => Math.hypot(a[0], a[1], a[2]);
const normalize = (a: Vec3): Vec3 => {
  const l = length(a) || 1;
  return [a[0] / l, a[1] / l, a[2] / l];
};

/**
 * Two-bone inverse kinematics: given where a hand should be, where does the
 * elbow go?
 *
 * The same problem every character rig solves for arms and legs (Babylon's
 * `BoneIKController` is this, applied to a skeleton's bones). Two bones of fixed
 * length from a fixed root to a target make a triangle whose sides are all
 * known, so the elbow's angle follows from the law of cosines. That fixes how
 * far the elbow is from the line root→target, but not which way round the line
 * it sits — `pole` settles that: the elbow bends towards it, the way a real
 * elbow bends down and out rather than up.
 *
 * A target out of reach is approached as far as the arm allows, straight;
 * one closer than the bones can fold is pushed out to where they can.
 */
export const twoBoneIk = (
  root: Vec3,
  target: Vec3,
  upper: number,
  lower: number,
  pole: Vec3,
): Limb => {
  const toTarget = sub(target, root);
  const along = normalize(toTarget);
  const reach = Math.min(upper + lower - 1e-6, Math.max(Math.abs(upper - lower) + 1e-6, length(toTarget)));
  const end = add(root, along, reach);

  const cosine = (upper * upper + reach * reach - lower * lower) / (2 * upper * reach);
  const angle = Math.acos(Math.min(1, Math.max(-1, cosine)));

  // The part of the pole direction square to the arm's line is where the elbow goes.
  const sideways = sub(pole, [along[0] * dot(pole, along), along[1] * dot(pole, along), along[2] * dot(pole, along)]);
  const bend = length(sideways) > 1e-9 ? normalize(sideways) : fallbackSquare(along);

  const joint = add(add(root, along, upper * Math.cos(angle)), bend, upper * Math.sin(angle));
  return { root, joint, end };
};

/** Any direction square to `v`, for when the pole happens to lie along the arm. */
const fallbackSquare = (v: Vec3): Vec3 =>
  normalize(Math.abs(v[2]) < 0.9 ? [-v[1], v[0], 0] : [0, -v[2], v[1]]);

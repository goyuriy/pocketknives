import type { KnifeSpec, Vec3 } from '@pocketknives/core';
import { bladeDirection } from '../coords.js';

/**
 * Where the arm rests while waiting to throw: a little drawn back, so the first
 * touch of the finger visibly moves something.
 */
export const READY_SWING = -0.35;

/** Arm angle above straight-ahead, radians, at the three landmarks of a swing. */
const DRAWN_BACK = 2.45; // behind the head
const RELEASE = 1.0; // up and forward — where the knife leaves
const FOLLOW_THROUGH = -0.75; // down past the hip

const ARM_LENGTH = 0.95;
/** Half the distance between the shoulders when both arms are on the grip. */
const SHOULDER_HALF_WIDTH = 0.26;
/** Where each fist sits either side of the grip's middle, as a fraction of the handle. */
const TWO_HANDED_SPREAD = 0.3;

export type ArmPose = {
  /** The knife's balance point, which is what the flight tracks. */
  readonly knifeAt: Vec3;
  readonly bladeAngle: number;
  readonly fists: readonly Vec3[];
  readonly shoulders: readonly Vec3[];
};

export type ArmSetup = {
  /** Where the knife leaves the hand — the flight's origin. */
  readonly release: Vec3;
  readonly heading: number;
  /** The blade angle the flight begins from. */
  readonly releaseBladeAngle: number;
  readonly spec: KnifeSpec;
  readonly hands: 1 | 2;
};

/** Arm angle at a point in the swing: -1 drawn back, 0 release, 1 followed through. */
export const armAngle = (swing: number): number =>
  swing <= 0
    ? RELEASE + (DRAWN_BACK - RELEASE) * Math.min(1, -swing)
    : RELEASE + (FOLLOW_THROUGH - RELEASE) * Math.min(1, swing);

/** Distance from the knife's balance point to the middle of its grip, signed along the blade. */
export const gripOffset = ({ bladeLength, handleLength, balance }: KnifeSpec): number => {
  const tip = (1 - balance) * (bladeLength + handleLength);
  return tip - bladeLength - handleLength / 2;
};

const add = (a: Vec3, b: Vec3, scale = 1): Vec3 => [
  a[0] + b[0] * scale,
  a[1] + b[1] * scale,
  a[2] + b[2] * scale,
];

/**
 * The arm, fists and knife at one moment of the swing.
 *
 * The arm turns about the shoulder in the vertical plane of the throw, and the
 * knife is carried rigidly in the fist, so the blade tilts with the arm. The
 * shoulder is placed backwards from the release — worked out so that at the
 * moment of letting go the knife is exactly where the flight begins and at
 * exactly the angle it begins at. That is what lets the knife leave the hand
 * without a visible jump: the arm hands the flight a knife already in motion.
 *
 * A two-handed grip is the same swing with the pivot midway between two
 * shoulders and a fist either side of the grip.
 */
export const armPose = (setup: ArmSetup, swing: number): ArmPose => {
  const { release, heading, releaseBladeAngle, spec, hands } = setup;
  const forward: Vec3 = [Math.cos(heading), Math.sin(heading), 0];
  const right: Vec3 = [Math.sin(heading), -Math.cos(heading), 0];
  const reachAt = (angle: number): Vec3 => [
    forward[0] * Math.cos(angle) * ARM_LENGTH,
    forward[1] * Math.cos(angle) * ARM_LENGTH,
    Math.sin(angle) * ARM_LENGTH,
  ];

  const grip = gripOffset(spec);
  const gripAtRelease = add(release, bladeDirection(heading, releaseBladeAngle), grip);
  const pivot = add(gripAtRelease, reachAt(RELEASE), -1);

  const angle = armAngle(swing);
  const bladeAngle = releaseBladeAngle + (angle - RELEASE);
  const along = bladeDirection(heading, bladeAngle);
  const gripAt = add(pivot, reachAt(angle));
  const knifeAt = add(gripAt, along, -grip);

  if (hands === 1) return { knifeAt, bladeAngle, fists: [gripAt], shoulders: [pivot] };

  const spread = spec.handleLength * TWO_HANDED_SPREAD;
  return {
    knifeAt,
    bladeAngle,
    // Leading fist nearer the guard, trailing one nearer the pommel.
    fists: [add(gripAt, along, spread), add(gripAt, along, -spread)],
    shoulders: [add(pivot, right, -SHOULDER_HALF_WIDTH), add(pivot, right, SHOULDER_HALF_WIDTH)],
  };
};

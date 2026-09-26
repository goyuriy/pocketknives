import { describe, expect, it } from 'vitest';
import { KNIVES, knifeById, type Vec3 } from '@pocketknives/core';
import { armAngle, armPose, gripOffset, type ArmSetup } from './armPose.js';
import { bladeDirection } from './coords.js';

const setup = (id: string, heading = Math.PI / 2): ArmSetup => {
  const knife = knifeById(id);
  return { release: [0, -12, 1.4], heading, releaseBladeAngle: 0.8, spec: knife.spec, hands: knife.hands };
};

const distance = (a: Vec3, b: Vec3) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);

describe('armPose', () => {
  it('hands the knife to the flight exactly where and how it begins', () => {
    // The whole reason the shoulder is worked out backwards from the release:
    // any gap here is a visible jump the instant the knife leaves the hand.
    for (const knife of KNIVES) {
      const pose = armPose(setup(knife.id), 0);
      expect(distance(pose.knifeAt, [0, -12, 1.4]), knife.id).toBeLessThan(1e-9);
      expect(pose.bladeAngle).toBeCloseTo(0.8, 9);
    }
  });

  it('holds the knife by its grip, not by its balance point', () => {
    const pose = armPose(setup('thrower'), -0.5);
    const grip = gripOffset(knifeById('thrower').spec);
    const gripAt = pose.fists[0]!;
    const along = bladeDirection(Math.PI / 2, pose.bladeAngle);
    const expected: Vec3 = [
      pose.knifeAt[0] + along[0] * grip,
      pose.knifeAt[1] + along[1] * grip,
      pose.knifeAt[2] + along[2] * grip,
    ];
    expect(distance(gripAt, expected)).toBeLessThan(1e-9);
  });

  it('swings the arm about a fixed shoulder', () => {
    const back = armPose(setup('thrower'), -1);
    const through = armPose(setup('thrower'), 1);
    expect(distance(back.shoulders[0]!, through.shoulders[0]!)).toBeLessThan(1e-9);
    expect(distance(back.fists[0]!, back.shoulders[0]!)).toBeCloseTo(
      distance(through.fists[0]!, through.shoulders[0]!),
      9,
    );
  });

  it('carries the knife behind the head when drawn back, and low in front after', () => {
    const back = armPose(setup('thrower'), -1);
    const through = armPose(setup('thrower'), 1);
    // Throwing north, so "behind" is south.
    expect(back.fists[0]![1]).toBeLessThan(back.shoulders[0]![1]);
    expect(through.fists[0]![1]).toBeGreaterThan(through.shoulders[0]![1]);
    expect(through.fists[0]![2]).toBeLessThan(through.shoulders[0]![2]);
  });

  it('tips the blade with the arm, so the tumble starts from the swing', () => {
    expect(armPose(setup('thrower'), -1).bladeAngle).toBeGreaterThan(0.8);
    expect(armPose(setup('thrower'), 1).bladeAngle).toBeLessThan(0.8);
  });

  it('puts two fists on a sword, from two shoulders either side of the throw', () => {
    const pose = armPose(setup('greatsword'), 0);
    expect(pose.fists).toHaveLength(2);
    expect(pose.shoulders).toHaveLength(2);
    // Throwing north, the shoulders sit east and west of each other.
    expect(Math.abs(pose.shoulders[0]![0] - pose.shoulders[1]![0])).toBeGreaterThan(0.3);
    expect(armPose(setup('thrower'), 0).fists).toHaveLength(1);
  });
});

describe('armAngle', () => {
  it('runs from drawn back, through release, to followed through', () => {
    expect(armAngle(-1)).toBeGreaterThan(armAngle(0));
    expect(armAngle(0)).toBeGreaterThan(armAngle(1));
    expect(armAngle(-5)).toBe(armAngle(-1));
  });
});

import { describe, expect, it } from 'vitest';
import { KNIVES, knifeById, type Vec3 } from '@pocketknives/core';
import { bodyPose, eyeAt, EYE_HEIGHT, gripOffset, READY_SWING, swingForDraw, type BodySetup } from './bodyPose.js';
import { bladeDirection } from './coords.js';

const setup = (id: string, heading = Math.PI / 2): BodySetup => {
  const knife = knifeById(id);
  return { release: [0, -12, 1.4], heading, releaseBladeAngle: 0.8, spec: knife.spec, hands: knife.hands };
};

const distance = (a: Vec3, b: Vec3) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);

describe('bodyPose', () => {
  it('hands the knife to the flight exactly where and how it begins', () => {
    // Any gap here is a visible jump the instant the knife leaves the hand.
    for (const knife of KNIVES) {
      const pose = bodyPose(setup(knife.id), 0);
      expect(distance(pose.knifeAt, [0, -12, 1.4]), knife.id).toBeLessThan(1e-9);
      expect(pose.bladeAngle).toBeCloseTo(0.8, 9);
    }
  });

  it('holds the knife by its grip, with the hand actually there', () => {
    for (const swing of [-1, READY_SWING, 0, 0.5, 1]) {
      const pose = bodyPose(setup('thrower'), swing);
      const along = bladeDirection(Math.PI / 2, pose.bladeAngle);
      const grip = gripOffset(knifeById('thrower').spec);
      const expected: Vec3 = [
        pose.knifeAt[0] + along[0] * grip,
        pose.knifeAt[1] + along[1] * grip,
        pose.knifeAt[2] + along[2] * grip,
      ];
      // The arm must reach every keyframe, or the fist floats off the knife.
      expect(distance(pose.throwingArm.end, expected), `swing ${swing}`).toBeLessThan(1e-6);
    }
  });

  it('draws the knife back up past the eye, and brings it down in front after', () => {
    const eye = eyeAt([0, -12, 1.4], Math.PI / 2);
    const back = bodyPose(setup('thrower'), -1);
    const through = bodyPose(setup('thrower'), 1);
    // Throwing north, so "behind" is south.
    expect(back.throwingArm.end[1]).toBeLessThan(eye[1] + 0.01);
    expect(back.throwingArm.end[2]).toBeGreaterThan(1.4);
    expect(through.throwingArm.end[1]).toBeGreaterThan(eye[1]);
    expect(through.throwingArm.end[2]).toBeLessThan(1);
  });

  it('points the other hand out along the throw, angled in towards its line', () => {
    const heading = Math.PI / 2 - 0.4;
    const aiming = bodyPose(setup('thrower', heading), READY_SWING);
    const reach = Math.atan2(
      aiming.otherArm.end[1] - aiming.otherArm.root[1],
      aiming.otherArm.end[0] - aiming.otherArm.root[0],
    );
    // The left arm points a little to the right of straight ahead — in, at the line.
    expect(reach).toBeLessThan(heading);
    expect(reach).toBeGreaterThan(heading - 0.2);
    expect(aiming.pointHeading).toBeCloseTo(reach, 6);
    expect(aiming.pointing).toBe(true);
  });

  it('tucks the pointing hand in once the throw follows through', () => {
    expect(bodyPose(setup('thrower'), 1).pointing).toBe(false);
  });

  it('bends the elbows down, not up', () => {
    const pose = bodyPose(setup('thrower'), READY_SWING);
    const midway = (pose.throwingArm.root[2] + pose.throwingArm.end[2]) / 2;
    expect(pose.throwingArm.joint[2]).toBeLessThan(midway);
  });

  it('puts both hands on a sword’s grip instead of pointing', () => {
    const pose = bodyPose(setup('greatsword'), 0);
    expect(pose.pointing).toBe(false);
    expect(distance(pose.throwingArm.end, pose.otherArm.end)).toBeGreaterThan(0.1);
    expect(distance(pose.throwingArm.end, pose.otherArm.end)).toBeLessThan(0.4);
  });

  it('puts the eye at eye height, behind the release', () => {
    const eye = eyeAt([0, -12, 1.4], Math.PI / 2);
    expect(eye[2]).toBe(EYE_HEIGHT);
    expect(eye[1]).toBeLessThan(-12);
  });
});

describe('swingForDraw', () => {
  it('rests when nothing is drawn, and is fully back at a full draw', () => {
    expect(swingForDraw(0)).toBe(READY_SWING);
    expect(swingForDraw(1)).toBe(-1);
    expect(swingForDraw(3)).toBe(-1);
  });

  it('lifts to the release pose as the hand comes up past the grip', () => {
    expect(swingForDraw(-1)).toBe(-0);
    expect(swingForDraw(-0.05)).toBeGreaterThan(READY_SWING);
  });
});

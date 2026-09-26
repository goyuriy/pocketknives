import { describe, expect, it } from 'vitest';
import { cameraPose, easeHeading } from './cameraPose.js';
import { eyeAt } from './bodyPose.js';

describe('cameraPose', () => {
  it('looks out from the thrower’s eyes, a little down, the way the hand points', () => {
    // Stood on the south rim, pointing a little right of north.
    const pose = cameraPose([0, -12, 1.4], false, 10, Math.PI / 2 - 0.4);
    expect(pose.eye[1]).toBeLessThan(-12);
    expect(pose.eye[2]).toBeCloseTo(eyeAt([0, -12, 1.4], Math.PI / 2 - 0.4)[2], 9);
    expect(pose.focus[0]).toBeGreaterThan(pose.eye[0]); // pointing right, looking right
    expect(pose.focus[2]).toBeLessThan(pose.eye[2]);
  });

  it('lifts over the circle once the knife has landed', () => {
    const pose = cameraPose([0, -12, 1.4], true, 10, Math.PI / 2);
    expect(pose.eye[2]).toBeGreaterThan(20);
    expect(pose.focus).toEqual([0, 0, 0]);
  });
});

describe('easeHeading', () => {
  it('goes the short way round', () => {
    const next = easeHeading(3.1, -3.1, 5, 0.1);
    expect(next).toBeGreaterThan(3.1);
  });

  it('arrives in the end', () => {
    expect(easeHeading(0, 1, 5, 10)).toBeCloseTo(1, 6);
  });
});

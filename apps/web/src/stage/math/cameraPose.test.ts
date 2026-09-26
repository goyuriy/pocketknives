import { describe, expect, it } from 'vitest';
import { cameraPose, easeHeading } from './cameraPose.js';
import { EYE_HEIGHT } from './bodyPose.js';

describe('cameraPose', () => {
  it('looks out from right above the feet, a little down, the way the hand points', () => {
    // Stood in the south, pointing a little right of north.
    const pose = cameraPose([0, -8], false, 10, Math.PI / 2 - 0.4);
    expect(pose.eye).toEqual([0, -8, EYE_HEIGHT]);
    expect(pose.focus[0]).toBeGreaterThan(pose.eye[0]); // pointing right, looking right
    expect(pose.focus[2]).toBeLessThan(pose.eye[2]);
  });

  it('lifts over the circle once the knife has landed', () => {
    const pose = cameraPose([0, -8], true, 10, Math.PI / 2);
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

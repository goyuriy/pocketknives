import { describe, expect, it } from 'vitest';
import { STANDING } from './bodyPose.js';
import { paceFor, strideFor } from './stride.js';

describe('strideFor', () => {
  it('falls into a walk along the way the feet went, in the body’s own terms', () => {
    // Facing north, stepping east: a sidestep to the right.
    let stride = STANDING;
    for (let i = 0; i < 30; i++) stride = strideFor(stride, [0, 0], [0.05, 0], Math.PI / 2, 1 / 60);
    expect(stride.amount).toBeGreaterThan(0.9);
    expect(stride.along[0]).toBeCloseTo(0, 6);
    expect(stride.along[1]).toBeGreaterThan(0);
  });

  it('eases out of the walk when the feet stop, keeping the way it was going', () => {
    const walking = { phase: 1, amount: 1, along: [1, 0] as const };
    const stopped = strideFor(walking, [0, 0], [0, 0], 0, 0.5);
    expect(stopped.amount).toBeLessThan(0.1);
    expect(stopped.along).toEqual([1, 0]);
    expect(stopped.phase).toBe(1);
  });
});

describe('paceFor', () => {
  it('eases towards how fast the feet are really going', () => {
    let pace = 0;
    for (let i = 0; i < 60; i++) pace = paceFor(pace, [0, 0], [0.05, 0], 1 / 60);
    expect(pace).toBeCloseTo(3, 1);
    expect(paceFor(3, [0, 0], [0, 0], 1)).toBeLessThan(0.01);
  });
});

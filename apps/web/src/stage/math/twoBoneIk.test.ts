import { describe, expect, it } from 'vitest';
import type { Vec3 } from '@pocketknives/core';
import { twoBoneIk } from './twoBoneIk.js';

const distance = (a: Vec3, b: Vec3) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);

describe('twoBoneIk', () => {
  it('puts the hand on a reachable target, with both bones at their own length', () => {
    const limb = twoBoneIk([0, 0, 0], [0.5, 0.2, -0.1], 0.4, 0.4, [0, 0, -1]);
    expect(distance(limb.end, [0.5, 0.2, -0.1])).toBeLessThan(1e-9);
    expect(distance(limb.root, limb.joint)).toBeCloseTo(0.4, 9);
    expect(distance(limb.joint, limb.end)).toBeCloseTo(0.4, 9);
  });

  it('bends the elbow towards the pole', () => {
    const down = twoBoneIk([0, 0, 0], [0.6, 0, 0], 0.4, 0.4, [0, 0, -1]);
    const up = twoBoneIk([0, 0, 0], [0.6, 0, 0], 0.4, 0.4, [0, 0, 1]);
    expect(down.joint[2]).toBeLessThan(0);
    expect(up.joint[2]).toBeGreaterThan(0);
  });

  it('reaches straight towards a target it cannot get to', () => {
    const limb = twoBoneIk([0, 0, 0], [2, 0, 0], 0.4, 0.4, [0, 0, -1]);
    expect(limb.end[0]).toBeCloseTo(0.8, 5);
    expect(Math.abs(limb.joint[2])).toBeLessThan(1e-2);
  });

  it('still finds an elbow when the pole lies along the arm', () => {
    const limb = twoBoneIk([0, 0, 0], [0.5, 0, 0], 0.4, 0.4, [1, 0, 0]);
    expect(distance(limb.root, limb.joint)).toBeCloseTo(0.4, 9);
  });
});

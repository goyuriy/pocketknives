import { describe, expect, it } from 'vitest';
import { cameraPose, easeHeading } from './cameraPose.js';

describe('cameraPose', () => {
  it('looks at the middle of the circle when the hand points straight in', () => {
    // Stood on the south rim, pointing north at the centre.
    const pose = cameraPose([0, -12], false, 10, Math.PI / 2);
    expect(pose.focus[0]).toBeCloseTo(0, 9);
    expect(pose.focus[1]).toBeCloseTo(0, 9);
  });

  it('sits behind the thrower and looks where the hand points', () => {
    const pose = cameraPose([0, -12], false, 10, Math.PI / 2 - 0.4);
    expect(pose.eye[1]).toBeLessThan(-12);
    expect(pose.focus[0]).toBeGreaterThan(0); // pointing right, looking right
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

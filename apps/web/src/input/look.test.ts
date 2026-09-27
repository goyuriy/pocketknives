import { describe, expect, it } from 'vitest';
import { DEFAULT_CONFIG } from '@pocketknives/core';
import { LOOK_DOWN_LIMIT, LOOK_UP_LIMIT } from '../stage/math/cameraPose.js';
import { throwPitchFor, tiltLook } from './look.js';

const degrees = (radians: number) => (radians * 180) / Math.PI;

describe('looking up and down', () => {
  it('looks all the way up, but only 70° down', () => {
    expect(tiltLook(0, -10)).toBe(LOOK_UP_LIMIT);
    expect(tiltLook(0, 10)).toBe(-LOOK_DOWN_LIMIT);
    expect(degrees(LOOK_UP_LIMIT)).toBeCloseTo(89, 9);
    expect(degrees(LOOK_DOWN_LIMIT)).toBeCloseTo(70, 9);
    expect(tiltLook(0.2, 0.1)).toBeCloseTo(0.1, 9);
  });

  it('throws where the eyes look, down to 45° and up to the lob', () => {
    const { maxPitch } = DEFAULT_CONFIG.gesture;
    expect(throwPitchFor(-0.5, DEFAULT_CONFIG)).toBe(-0.5);
    expect(throwPitchFor(-Math.PI / 4, DEFAULT_CONFIG)).toBeCloseTo(-Math.PI / 4, 9);
    expect(throwPitchFor(LOOK_UP_LIMIT, DEFAULT_CONFIG)).toBe(maxPitch);
  });

  it('throws straight down when the eyes look as far down as they go', () => {
    expect(throwPitchFor(-LOOK_DOWN_LIMIT, DEFAULT_CONFIG)).toBeCloseTo(DEFAULT_CONFIG.gesture.minPitch, 9);
    // Steeper all the way: looking further down never throws flatter.
    let last = Infinity;
    for (let look = -Math.PI / 4; look >= -LOOK_DOWN_LIMIT; look -= 0.01) {
      const pitch = throwPitchFor(look, DEFAULT_CONFIG);
      expect(pitch).toBeLessThanOrEqual(last);
      last = pitch;
    }
  });
});

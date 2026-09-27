import { describe, expect, it } from 'vitest';
import { DEFAULT_CONFIG } from '@pocketknives/core';
import { LOOK_LIMIT, throwPitchFor, tiltLook } from './look.js';

describe('looking up and down', () => {
  it('looks all the way up and all the way down, and no further', () => {
    expect(tiltLook(0, -10)).toBe(LOOK_LIMIT);
    expect(tiltLook(0, 10)).toBe(-LOOK_LIMIT);
    expect(LOOK_LIMIT).toBeGreaterThan((88 * Math.PI) / 180);
    expect(tiltLook(0.2, 0.1)).toBeCloseTo(0.1, 9);
  });

  it('throws where the eyes look, but never higher than a lob or lower than straight down', () => {
    const { minPitch, maxPitch } = DEFAULT_CONFIG.gesture;
    expect(throwPitchFor(-0.5, DEFAULT_CONFIG)).toBe(-0.5);
    expect(throwPitchFor(LOOK_LIMIT, DEFAULT_CONFIG)).toBe(maxPitch);
    expect(throwPitchFor(-LOOK_LIMIT, DEFAULT_CONFIG)).toBeGreaterThanOrEqual(minPitch);
  });
});

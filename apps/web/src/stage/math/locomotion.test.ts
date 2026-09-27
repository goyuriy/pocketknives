import { describe, expect, it } from 'vitest';
import { locomotion } from './locomotion.js';

const clips = { walk: 1.5, run: 3.4 };

describe('locomotion', () => {
  it('stands idle when still', () => {
    expect(locomotion(0, false, clips)).toMatchObject({ idle: 1, walk: 0, run: 0 });
  });

  it('walks at the walk’s own pace, with the feet at the pace of the ground', () => {
    const pace = locomotion(1.5, false, clips);
    expect(pace).toMatchObject({ idle: 0, walk: 1, run: 0 });
    expect(pace.rate).toBeCloseTo(1, 9);
  });

  it('hands the walk over to the run as the pace rises past it', () => {
    const between = locomotion(2.45, false, clips);
    expect(between.walk).toBeGreaterThan(0);
    expect(between.run).toBeGreaterThan(0);
    const flat = locomotion(3.4, false, clips);
    expect(flat).toMatchObject({ idle: 0, walk: 0, run: 1 });
    expect(flat.rate).toBeCloseTo(1, 9);
  });

  it('always weighs one clip’s worth in all', () => {
    for (const speed of [0, 0.3, 0.75, 1.2, 2, 3, 5]) {
      const { idle, walk, run } = locomotion(speed, false, clips);
      expect(idle + walk + run).toBeCloseTo(1, 9);
    }
  });

  it('plays the walk backwards for walking backwards', () => {
    expect(locomotion(1.5, true, clips).rate).toBeCloseTo(-1, 9);
  });

  it('never plays a walk so slowly it reads as slow motion', () => {
    expect(locomotion(0.2, false, clips).rate).toBeGreaterThanOrEqual(0.45);
  });
});

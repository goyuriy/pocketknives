import { describe, expect, it } from 'vitest';
import { RESTING_ARM, stepArm } from './armMotion.js';

const run = (frames: number, target: number, released: boolean, from = RESTING_ARM) =>
  Array.from({ length: frames }).reduce(
    (motion: typeof RESTING_ARM) => stepArm(motion, target, released, 1 / 60),
    from,
  );

describe('stepArm', () => {
  it('follows the finger quickly', () => {
    expect(run(15, -1, false).shown).toBeCloseTo(-1, 1);
  });

  it('swings through to the follow-through once released, wherever the finger was', () => {
    expect(run(30, -1, true).shown).toBeGreaterThan(0.9);
  });

  it('comes back from a follow-through more slowly than it tracks', () => {
    const through = run(60, 0, true);
    const quarterSecond = run(15, RESTING_ARM.shown, false, through);
    const tracked = run(15, 1, false);
    expect(quarterSecond.recovering).toBe(true);
    expect(Math.abs(quarterSecond.shown - RESTING_ARM.shown)).toBeGreaterThan(
      Math.abs(tracked.shown - 1),
    );
  });

  it('takes the same time at any frame rate', () => {
    const at60 = Array.from({ length: 60 }).reduce(
      (m: typeof RESTING_ARM) => stepArm(m, -1, false, 1 / 60),
      RESTING_ARM,
    );
    const at20 = Array.from({ length: 20 }).reduce(
      (m: typeof RESTING_ARM) => stepArm(m, -1, false, 1 / 20),
      RESTING_ARM,
    );
    expect(at60.shown).toBeCloseTo(at20.shown, 6);
  });
});

import { describe, expect, it } from 'vitest';
import { springAt, stepHeadingSpring, stepSpring } from './spring.js';

const hand = { frequency: 3.5, damping: 0.6 };

describe('stepSpring', () => {
  it('trails a sudden move, overshoots a touch, then settles on it', () => {
    let spring = springAt(0);
    const path: number[] = [];
    for (let frame = 0; frame < 120; frame++) {
      spring = stepSpring(spring, 1, 1 / 60, hand);
      path.push(spring.value);
    }
    expect(path[2]!).toBeLessThan(0.5); // trails at first
    expect(Math.max(...path)).toBeGreaterThan(1); // overshoots
    expect(Math.max(...path)).toBeLessThan(1.2); // but only a touch
    expect(path.at(-1)!).toBeCloseTo(1, 3); // and settles
  });

  it('behaves the same at 30 frames a second as at 120', () => {
    const after = (fps: number) => {
      let spring = springAt(0);
      for (let frame = 0; frame < fps / 2; frame++) spring = stepSpring(spring, 1, 1 / fps, hand);
      return spring.value;
    };
    expect(after(30)).toBeCloseTo(after(120), 2);
  });

  it('stays put when it is already there', () => {
    expect(stepSpring(springAt(2), 2, 0.5, hand)).toEqual({ value: 2, velocity: 0 });
  });
});

describe('stepHeadingSpring', () => {
  it('goes the short way round past due west', () => {
    let spring = springAt(Math.PI - 0.1);
    for (let frame = 0; frame < 120; frame++) spring = stepHeadingSpring(spring, -Math.PI + 0.1, 1 / 60, hand);
    expect(spring.value).toBeCloseTo(Math.PI + 0.1, 2);
  });
});

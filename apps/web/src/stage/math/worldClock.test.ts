import { describe, expect, it } from 'vitest';
import { holdWorld, tickWorld, WORLD_START } from './worldClock.js';

describe('the world clock', () => {
  it('runs on real time', () => {
    const { clock, time } = tickWorld(WORLD_START, 1000, 0.016);
    expect(time).toEqual({ now: 16, seconds: 0.016, holding: false });
    expect(tickWorld(clock, 1016, 0.016).time.now).toBeCloseTo(32, 9);
  });

  it('stands still through a hitstop, then carries on from where it stopped', () => {
    const held = holdWorld({ now: 500, holdUntil: -Infinity }, 1000, 0.05);
    const during = tickWorld(held, 1030, 0.016);
    expect(during.time).toEqual({ now: 500, seconds: 0, holding: true });
    const after = tickWorld(during.clock, 1060, 0.016);
    expect(after.time.holding).toBe(false);
    expect(after.time.now).toBeCloseTo(516, 9);
  });

  it('never shortens a hold already under way', () => {
    const long = holdWorld(WORLD_START, 1000, 0.09);
    expect(holdWorld(long, 1010, 0.035).holdUntil).toBe(1090);
  });
});

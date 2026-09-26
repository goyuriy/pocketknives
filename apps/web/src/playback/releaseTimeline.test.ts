import { describe, expect, it } from 'vitest';
import { flightTimeAt, playbackDuration, RELEASE_SLOW_MOTION, rateAt, realTimeFor } from './releaseTimeline.js';

const cruise = 0.55;

describe('release slow motion', () => {
  it('starts at a crawl and settles to the cruising pace', () => {
    expect(rateAt(0, cruise)).toBe(RELEASE_SLOW_MOTION.startRate);
    expect(rateAt(10, cruise)).toBe(cruise);
    expect(rateAt(RELEASE_SLOW_MOTION.hold + RELEASE_SLOW_MOTION.ramp / 2, cruise)).toBeCloseTo(
      (RELEASE_SLOW_MOTION.startRate + cruise) / 2,
      9,
    );
  });

  it('never runs the flight backwards or stalls it', () => {
    let previous = -1;
    for (let real = 0; real <= 3; real += 0.01) {
      const flight = flightTimeAt(real, cruise);
      expect(flight).toBeGreaterThan(previous);
      previous = flight;
    }
  });

  it('agrees with its own inverse everywhere, so the knife lands when the state says it does', () => {
    for (let real = 0; real <= 3; real += 0.013) {
      expect(realTimeFor(flightTimeAt(real, cruise), cruise)).toBeCloseTo(real, 9);
    }
  });

  it('takes longer to play than the flight at cruising pace alone', () => {
    const flight = 0.7;
    expect(playbackDuration(flight, cruise)).toBeGreaterThan(flight / cruise);
    expect(playbackDuration(flight, cruise)).toBeLessThan(flight / cruise + 1.2);
  });

  it('copes with a cruise as slow as the crawl', () => {
    const slow = { ...RELEASE_SLOW_MOTION, startRate: 0.3 };
    expect(realTimeFor(flightTimeAt(0.5, 0.3, slow), 0.3, slow)).toBeCloseTo(0.5, 9);
  });
});

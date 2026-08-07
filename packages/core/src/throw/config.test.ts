import { describe, expect, it } from 'vitest';
import {
  DEFAULT_CONFIG,
  biteDepth,
  knifeLength,
  minStickSpeed,
  momentOfInertia,
  spinRate,
  stickWindow,
  type ThrowConfig,
} from './config.js';
import { simulateFlight } from './flight.js';
import { aimedLaunch, standingPoint } from './launch.js';
import { stickVerdict } from './stick.js';
import { stickingBands } from './bands.js';

const withKnife = (changes: Partial<ThrowConfig['knife']>): ThrowConfig => ({
  ...DEFAULT_CONFIG,
  knife: { ...DEFAULT_CONFIG.knife, ...changes },
});

const withScatter = (changes: Partial<ThrowConfig['scatter']>): ThrowConfig => ({
  ...DEFAULT_CONFIG,
  scatter: { ...DEFAULT_CONFIG.scatter, ...changes },
});

const stand = standingPoint(-Math.PI / 2, 10);
const heading = Math.PI / 2;

describe('the knife is a physical object, not a set of labels', () => {
  it('resists spinning more the longer and heavier it is', () => {
    const light = momentOfInertia(withKnife({ mass: 0.1 }).knife);
    const heavy = momentOfInertia(withKnife({ mass: 0.4 }).knife);
    const long = momentOfInertia(withKnife({ bladeLength: 0.9 }).knife);

    expect(heavy).toBeGreaterThan(light);
    expect(long).toBeGreaterThan(momentOfInertia(DEFAULT_CONFIG.knife));
  });

  it('tumbles slower for the same flick of the wrist when it is heavier', () => {
    expect(spinRate(withKnife({ mass: 0.4 }))).toBeLessThan(spinRate(DEFAULT_CONFIG));
    expect(spinRate(withKnife({ mass: 0.1 }))).toBeGreaterThan(spinRate(DEFAULT_CONFIG));
  });

  it('costs more to spin when the balance is moved off centre', () => {
    expect(momentOfInertia(withKnife({ balance: 0.8 }).knife)).toBeGreaterThan(
      momentOfInertia(withKnife({ balance: 0.5 }).knife),
    );
  });

  it('forgives a wider range of angles with a longer blade', () => {
    expect(stickWindow(withKnife({ bladeLength: 0.84 }))).toBeCloseTo(
      stickWindow(DEFAULT_CONFIG) * 2,
      6,
    );
  });

  it('needs less speed to bury the point when it is heavier', () => {
    expect(minStickSpeed(withKnife({ mass: 0.4 }))).toBeLessThan(minStickSpeed(DEFAULT_CONFIG));
  });

  it('buries deeper with more mass and a finer edge, never past the blade', () => {
    expect(biteDepth(withKnife({ mass: 0.4 }), 14)).toBeGreaterThan(biteDepth(DEFAULT_CONFIG, 14));
    expect(biteDepth(withKnife({ edgeWidth: 0.01 }), 14)).toBeGreaterThan(
      biteDepth(DEFAULT_CONFIG, 14),
    );
    expect(biteDepth(DEFAULT_CONFIG, 500)).toBeLessThanOrEqual(DEFAULT_CONFIG.knife.bladeLength);
  });

  it('measures its own length from blade plus handle', () => {
    expect(knifeLength(DEFAULT_CONFIG.knife)).toBeCloseTo(0.9, 9);
  });

  it('moves the sticking bands when the knife changes', () => {
    const standard = JSON.stringify(stickingBands(stand, heading));
    const heavier = JSON.stringify(stickingBands(stand, heading, withKnife({ mass: 0.32 })));
    expect(heavier).not.toBe(standard);
  });
});

describe('scatter', () => {
  const scattered = withScatter({ heading: 0.05, power: 0.04, spin: 2, startingBladeAngle: 0.2 });

  it('changes nothing when no seed is given', () => {
    const a = aimedLaunch(stand, heading, 0.5, scattered);
    const b = aimedLaunch(stand, heading, 0.5, DEFAULT_CONFIG);
    expect(a).toEqual(b);
  });

  it('reproduces a throw exactly from the same seed', () => {
    const first = simulateFlight(aimedLaunch(stand, heading, 0.5, scattered, 12345));
    const second = simulateFlight(aimedLaunch(stand, heading, 0.5, scattered, 12345));
    expect(JSON.stringify(first.impact)).toBe(JSON.stringify(second.impact));
  });

  it('lands somewhere else on a different seed', () => {
    const first = simulateFlight(aimedLaunch(stand, heading, 0.5, scattered, 1));
    const second = simulateFlight(aimedLaunch(stand, heading, 0.5, scattered, 2));
    expect(first.impact.point).not.toEqual(second.impact.point);
  });

  it('stays obedient when every spread is zero, whatever the seed', () => {
    const clean = aimedLaunch(stand, heading, 0.5, DEFAULT_CONFIG);
    for (const seed of [1, 99, 1234567]) {
      expect(aimedLaunch(stand, heading, 0.5, DEFAULT_CONFIG, seed)).toEqual(clean);
    }
  });

  it('keeps most throws near the aim rather than spreading them evenly', () => {
    const offsets = Array.from({ length: 400 }, (_, seed) => {
      const launched = aimedLaunch(stand, heading, 0.5, scattered, seed);
      return Math.abs(launched.heading - heading);
    });
    const near = offsets.filter((o) => o < 0.025).length / offsets.length;
    // A flat spread would put half inside half the range; bunching beats that.
    expect(near).toBeGreaterThan(0.55);
  });

  it('turns a reliable throw into an unreliable one as the spread widens', () => {
    // Aim at the middle of a real band rather than a number written down here,
    // so retuning the throw cannot quietly turn this into a test of nothing.
    const band = stickingBands(stand, heading, DEFAULT_CONFIG)[0]!;
    const dependable = (band.from + band.to) / 2;
    const sticks = (config: ThrowConfig) =>
      Array.from({ length: 200 }, (_, seed) =>
        stickVerdict(
          simulateFlight(aimedLaunch(stand, heading, dependable, config, seed)).impact,
          config,
        ).stuck,
      ).filter(Boolean).length;

    expect(sticks(DEFAULT_CONFIG)).toBe(200);
    expect(sticks(withScatter({ power: 0.12 }))).toBeLessThan(200);
  });
});

import { describe, expect, it } from 'vitest';
import {
  DEFAULT_CONFIG,
  knifeById,
  simulateFlight,
  standingPoint,
  stickVerdict,
  swingLaunch,
  type Vec3,
} from '@pocketknives/core';
import { dustPuffs, MOST_PUFFS, puffAt, puffCount } from './dust.js';
import { impactFeel, knifeWeight } from './impactFeel.js';
import { shakeAmplitude, shakeDuration, shakeOffset } from './shake.js';
import {
  bouncingPlacement,
  BOUNCE_DURATION,
  fallenPlacement,
  QUIVER_DURATION,
  quiveringPlacement,
  quiverLean,
  stuckPlacement,
} from './knifePlacement.js';

const flight = simulateFlight(
  swingLaunch(standingPoint(-Math.PI / 2, 10), Math.PI / 2, { aim: 0, pitch: 0.35, draw: 0.5, drift: 0 }),
);
const verdict = stickVerdict(flight.impact);
const distance = (a: Vec3, b: Vec3) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);

describe('impactFeel', () => {
  it('lands harder with a heavier knife thrown the same way', () => {
    const light = impactFeel(verdict, flight.impact, { ...DEFAULT_CONFIG.knife, mass: 0.1 });
    const heavy = impactFeel(verdict, flight.impact, { ...DEFAULT_CONFIG.knife, mass: 0.6 });
    expect(heavy.strength).toBeGreaterThan(light.strength);
    expect(heavy.strength).toBeLessThanOrEqual(1);
  });

  it('tells a stick from a bounce from a drop', () => {
    expect(impactFeel(verdict, flight.impact, DEFAULT_CONFIG.knife).kind).toBe('stick');
    const flat = { ...verdict, stuck: false, planted: false, outcome: 'flat' as const, quality: 0, depth: 0 };
    expect(impactFeel(flat, flight.impact, DEFAULT_CONFIG.knife).kind).toBe('clatter');
    const slow = { ...flat, outcome: 'too_slow' as const };
    expect(impactFeel(slow, flight.impact, DEFAULT_CONFIG.knife).kind).toBe('tap');
    // In the ground but too low to count: it still went in, and sounds like it.
    const low = { ...verdict, stuck: false, outcome: 'handle_low' as const };
    expect(impactFeel(low, flight.impact, DEFAULT_CONFIG.knife).kind).toBe('stick');
  });
});

/** The rack, lightest to heaviest. */
const RACK = ['needle', 'kitchen', 'thrower', 'cleaver', 'greatsword'].map((id) => knifeById(id).spec.mass);

describe('weight', () => {
  it('places every knife in the rack in order, spread across the whole scale', () => {
    const weights = RACK.map(knifeWeight);
    weights.slice(1).forEach((w, i) => expect(w).toBeGreaterThan(weights[i]!));
    expect(weights[0]).toBeLessThan(0.25);
    expect(weights.at(-1)).toBeCloseTo(1, 1);
  });

  it('keeps the needle and the thrower clearly apart', () => {
    expect(knifeWeight(RACK[2]!) - knifeWeight(RACK[0]!)).toBeGreaterThan(0.15);
  });
});

describe('dust', () => {
  it('throws up more dirt the heavier the knife, at the same pace', () => {
    const counts = RACK.map((mass) => puffCount(knifeWeight(mass), 0.6));
    counts.slice(1).forEach((c, i) => expect(c).toBeGreaterThan(counts[i]!));
    expect(counts.at(-1)).toBeGreaterThanOrEqual(counts[0]! * 3);
  });

  it('lets weight matter more than pace', () => {
    // A heavy knife thrown gently still throws up more than a light one thrown hard.
    expect(puffCount(1, 0.2)).toBeGreaterThan(puffCount(0.2, 1));
    expect(puffCount(1, 1)).toBe(MOST_PUFFS);
  });

  it('throws bigger clods for a heavier knife, and the same dirt for the same throw', () => {
    const size = (weight: number) => dustPuffs(0, weight, 0.5, 7).reduce((sum, p) => sum + p.size, 0) / puffCount(weight, 0.5);
    expect(size(1)).toBeGreaterThan(size(0.2));
    expect(dustPuffs(0.4, 0.5, 0.5, 7)).toEqual(dustPuffs(0.4, 0.5, 0.5, 7));
  });

  it('sprays mostly forward along the throw', () => {
    const puffs = dustPuffs(0, 0.8, 0.8, 3);
    const forward = puffs.filter((p) => p.drift[0] > 0).length;
    expect(forward / puffs.length).toBeGreaterThan(0.75);
  });

  it('rises, swells, thins, and is gone', () => {
    const [puff] = dustPuffs(0, 0.5, 0.5, 1);
    const early = puffAt(puff!, [0, 0, 0], 0.05)!;
    const late = puffAt(puff!, [0, 0, 0], puff!.life * 0.9)!;
    expect(late.position[2]).toBeGreaterThan(early.position[2]);
    expect(late.radius).toBeGreaterThan(early.radius);
    expect(late.opacity).toBeLessThan(early.opacity);
    expect(puffAt(puff!, [0, 0, 0], puff!.life)).toBeNull();
  });
});

describe('quiver', () => {
  it('waggles and dies away to nothing', () => {
    const peak = Math.max(...Array.from({ length: 50 }, (_, i) => Math.abs(quiverLean(i / 500, 1, 0.5))));
    expect(peak).toBeGreaterThan(0.05);
    expect(quiverLean(QUIVER_DURATION, 1, 0.5)).toBe(0);
    expect(Math.abs(quiverLean(QUIVER_DURATION * 0.9, 1, 0.5))).toBeLessThan(0.01);
  });

  it('shudders more after a scrappy stick than a clean one', () => {
    const swing = (clean: number) => Math.abs(quiverLean(1 / 44, 1, clean));
    expect(swing(0.1)).toBeGreaterThan(swing(0.95));
  });

  it('pivots about the point in the ground, so the buried tip stays put', () => {
    const still = stuckPlacement(flight, verdict.depth);
    const leaning = quiveringPlacement(flight, verdict.depth, 0.2);
    const ground: Vec3 = [flight.impact.point[0], flight.impact.point[1], 0];
    expect(distance(leaning.position, ground)).toBeCloseTo(distance(still.position, ground), 9);
    expect(leaning.position).not.toEqual(still.position);
    expect(leaning.lean).toBe(0.2);
  });
});

describe('bounce', () => {
  it('starts where it hit and ends exactly where it comes to rest', () => {
    const start = bouncingPlacement(flight, 0, 0.5);
    expect(start.position[0]).toBeCloseTo(flight.impact.point[0], 9);
    expect(start.position[1]).toBeCloseTo(flight.impact.point[1], 9);
    expect(bouncingPlacement(flight, BOUNCE_DURATION, 0.5)).toEqual(fallenPlacement(flight));
  });

  it('comes off the ground in between, and keeps tumbling forward', () => {
    const mid = bouncingPlacement(flight, BOUNCE_DURATION * 0.25, 0.5);
    expect(mid.position[2]).toBeGreaterThan(fallenPlacement(flight).position[2]);
    expect(mid.bladeAngle).toBeLessThan(flight.impact.bladeAngle);
  });

  it('lands flat, a whole number of turns from where it started', () => {
    const settled = bouncingPlacement(flight, BOUNCE_DURATION * 0.9999, 0.5).bladeAngle;
    expect(Math.abs(Math.sin(settled))).toBeLessThan(0.01);
  });
});

describe('shake', () => {
  it('jolts, then stops', () => {
    const jolt = shakeOffset(0.02, 0.1, 0.3);
    expect(Math.hypot(...jolt)).toBeGreaterThan(0);
    expect(shakeOffset(0.3, 0.1, 0.3)).toEqual([0, 0, 0]);
  });

  it('shakes harder and longer the heavier the knife', () => {
    const amplitudes = RACK.map((mass) => shakeAmplitude('stick', knifeWeight(mass), 0.6));
    amplitudes.slice(1).forEach((a, i) => expect(a).toBeGreaterThan(amplitudes[i]!));
    expect(amplitudes.at(-1)).toBeGreaterThan(amplitudes[0]! * 4);
    expect(shakeDuration(1)).toBeGreaterThan(shakeDuration(0.2));
  });

  it('shakes hardest for a stick, less for a bounce, not at all for a drop', () => {
    expect(shakeAmplitude('stick', 0.7, 0.6)).toBeGreaterThan(shakeAmplitude('clatter', 0.7, 0.6));
    expect(shakeAmplitude('tap', 1, 1)).toBe(0);
  });
});

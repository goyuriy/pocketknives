import { describe, expect, it } from 'vitest';
import { DEFAULT_CONFIG, simulateFlight, stickVerdict, swingLaunch, standingPoint, type Vec3 } from '@pocketknives/core';
import { dustPuffs, puffAt } from './dust.js';
import { impactFeel } from './impactFeel.js';
import { shakeAmplitude, shakeOffset, SHAKE_DURATION } from './shake.js';
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
    const flat = { ...verdict, stuck: false, outcome: 'flat' as const, quality: 0, depth: 0 };
    expect(impactFeel(flat, flight.impact, DEFAULT_CONFIG.knife).kind).toBe('clatter');
    const slow = { ...flat, outcome: 'too_slow' as const };
    expect(impactFeel(slow, flight.impact, DEFAULT_CONFIG.knife).kind).toBe('tap');
  });
});

describe('dust', () => {
  it('kicks up more dirt the harder it hits, and the same dirt for the same throw', () => {
    expect(dustPuffs(0, 1, 7).length).toBeGreaterThan(dustPuffs(0, 0, 7).length);
    expect(dustPuffs(0.4, 0.5, 7)).toEqual(dustPuffs(0.4, 0.5, 7));
  });

  it('sprays mostly forward along the throw', () => {
    const puffs = dustPuffs(0, 0.8, 3);
    const forward = puffs.filter((p) => p.drift[0] > 0).length;
    expect(forward / puffs.length).toBeGreaterThan(0.75);
  });

  it('rises, swells, thins, and is gone', () => {
    const [puff] = dustPuffs(0, 0.5, 1);
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
    const still = stuckPlacement(flight, verdict.quality, verdict.depth);
    const leaning = quiveringPlacement(flight, verdict.quality, verdict.depth, 0.2);
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
    const jolt = shakeOffset(0.02, 0.1);
    expect(Math.hypot(...jolt)).toBeGreaterThan(0);
    expect(shakeOffset(SHAKE_DURATION, 0.1)).toEqual([0, 0, 0]);
  });

  it('shakes hardest for a stick and not at all for a drop', () => {
    expect(shakeAmplitude('stick', 1)).toBeGreaterThan(shakeAmplitude('clatter', 1));
    expect(shakeAmplitude('tap', 1)).toBe(0);
  });
});

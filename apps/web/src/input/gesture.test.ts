import { describe, expect, it } from 'vitest';
import { DEFAULT_CONFIG } from '@pocketknives/core';
import { armSwing, readSwing, type Sample } from './gesture.js';
import { READY_SWING } from '../stage/math/armPose.js';

/** A stroke that travels at `speed` px/s while turning at `curl` rad/s. */
const stroke = (speed: number, curl: number, count: number, step = 16): Sample[] => {
  const samples: Sample[] = [];
  let x = 0;
  let y = 0;
  let direction = -Math.PI / 2 - curl * ((count * step) / 1000);
  for (let i = 0; i < count; i++) {
    samples.push({ x, y, t: i * step });
    const dt = step / 1000;
    x += Math.cos(direction) * speed * dt;
    y += Math.sin(direction) * speed * dt;
    direction += curl * dt;
  }
  return samples;
};

describe('readSwing', () => {
  it('reads the pace of the hand', () => {
    const reading = readSwing(stroke(600, 0, 12), 600);
    expect(reading.speed).toBeCloseTo(1, 1); // 600 px/s over a 600px viewport
  });

  it('still reads the pace when events arrive sparsely', () => {
    // Four samples 60ms apart: only two fall inside the release window.
    const sparse = stroke(900, 0, 4, 60);
    expect(readSwing(sparse, 600).speed).toBeCloseTo(1.5, 1);
  });

  it('reports nothing for a hand that did not move', () => {
    expect(readSwing([{ x: 5, y: 5, t: 0 }], 600)).toEqual({ speed: 0, aimOffset: 0 });
    expect(readSwing([], 600).speed).toBe(0);
  });

  it('reads a stroke up the screen as straight ahead', () => {
    expect(Math.abs(readSwing(stroke(900, 0, 12), 600).aimOffset)).toBeLessThan(0.05);
  });

  it('reads a stroke to the right as aimed right', () => {
    const rightward: Sample[] = Array.from({ length: 8 }, (_, i) => ({
      x: i * 12,
      y: -i * 12,
      t: i * 16,
    }));
    expect(readSwing(rightward, 600).aimOffset).toBeGreaterThan(0.5);
  });
});

describe('armSwing', () => {
  const at = (y: number): Sample => ({ x: 0, y, t: 0 });
  const still = { speed: 0, aimOffset: 0 };

  it('rests a little drawn back before the finger moves', () => {
    expect(armSwing(at(300), at(300), still, 600, DEFAULT_CONFIG)).toBeCloseTo(READY_SWING, 9);
  });

  it('draws the arm back as the finger is pulled down, and no further than fully', () => {
    expect(armSwing(at(300), at(340), still, 600, DEFAULT_CONFIG)).toBeLessThan(READY_SWING);
    expect(armSwing(at(300), at(600), still, 600, DEFAULT_CONFIG)).toBe(-1);
  });

  it('brings the arm up to release on a hard flick, wherever the finger is', () => {
    const flick = { speed: DEFAULT_CONFIG.gesture.fullPowerSwipe, aimOffset: 0 };
    expect(armSwing(at(300), at(360), flick, 600, DEFAULT_CONFIG)).toBe(0);
  });

  it('does not count winding up as throwing', () => {
    const pulling = { speed: 2, aimOffset: Math.PI };
    expect(armSwing(at(300), at(320), pulling, 600, DEFAULT_CONFIG)).toBeLessThan(READY_SWING);
  });
});

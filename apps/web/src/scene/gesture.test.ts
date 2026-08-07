import { describe, expect, it } from 'vitest';
import { readSwing, type Sample } from './gesture.js';

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

  it('reads how sharply the stroke was turning', () => {
    expect(readSwing(stroke(900, 12, 12), 600).curl).toBeGreaterThan(9);
    expect(Math.abs(readSwing(stroke(900, 0, 12), 600).curl)).toBeLessThan(1);
  });

  it('still finds the turn when events arrive sparsely', () => {
    // Four samples 60ms apart: only two fall inside the release window, and two
    // points cannot describe a turn. Reaching further back must still find it.
    const sparse = stroke(900, 12, 4, 60);
    expect(readSwing(sparse, 600).curl).toBeGreaterThan(5);
  });

  it('reports nothing for a hand that did not move', () => {
    expect(readSwing([{ x: 5, y: 5, t: 0 }], 600)).toEqual({ speed: 0, curl: 0, aimOffset: 0 });
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

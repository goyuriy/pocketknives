import { describe, expect, it } from 'vitest';
import { DEFAULT_CONFIG } from '@pocketknives/core';
import { advanceStroke, aimFromPointer, gripStroke, type Sample } from './throwStroke.js';
import { handSway } from './handSway.js';

const HEIGHT = 800;
const fullDraw = DEFAULT_CONFIG.gesture.fullDraw * HEIGHT; // pixels

/** A straight line of samples from `from` to `to`, `ms` apart. */
const path = (from: Sample, to: { x: number; y: number }, steps: number, ms: number): Sample[] =>
  Array.from({ length: steps }, (_, i) => ({
    x: from.x + ((to.x - from.x) * (i + 1)) / steps,
    y: from.y + ((to.y - from.y) * (i + 1)) / steps,
    t: from.t + ms * (i + 1),
  }));

const grip: Sample = { x: 400, y: 400, t: 1000 };
/** An 800-wide stage, so the grip point at x=400 is straight ahead. */
const reach = { left: 0, width: 800 };

/** Grip, draw back by `drawn` of a full draw over `drawMs`, then push to `overshoot` above the grip. */
const swing = (drawn: number, pushMs: number, sideways = 0, drawMs = 300) => {
  const bottom = { x: 400, y: 400 + drawn * fullDraw };
  const back = path(grip, bottom, 10, drawMs / 10);
  const last = back[back.length - 1]!;
  const through = path(last, { x: 400 + sideways, y: 380 }, 6, pushMs / 6);
  return advanceStroke(gripStroke(grip, reach), [...back, ...through], HEIGHT, DEFAULT_CONFIG);
};

describe('advanceStroke', () => {
  it('throws when the push goes through the grip', () => {
    const { reading } = swing(0.6, 90);
    expect(reading.thrown).not.toBeNull();
  });

  it('measures distance by how far back the arm was drawn, not how fast it moved', () => {
    const quick = swing(0.6, 60).reading.thrown!;
    const slower = swing(0.6, 200).reading.thrown!;
    expect(quick.draw).toBeCloseTo(0.6, 2);
    expect(slower.draw).toBeCloseTo(quick.draw, 6);
    expect(swing(0.9, 90).reading.thrown!.draw).toBeCloseTo(0.9, 2);
  });

  it('calls a throw off when the arm eases back up instead of pushing', () => {
    expect(swing(0.6, 2000).reading.thrown).toBeNull();
  });

  it('does not count a pause at the bottom as a slow push', () => {
    const bottom: Sample = { x: 400, y: 400 + 0.6 * fullDraw, t: 1300 };
    const back = path(grip, bottom, 10, 30);
    const held = Array.from({ length: 10 }, (_, i) => ({ ...bottom, t: 1300 + (i + 1) * 100 }));
    const push = path(held[held.length - 1]!, { x: 400, y: 380 }, 6, 15);
    const { reading } = advanceStroke(gripStroke(grip, reach), [...back, ...held, ...push], HEIGHT, DEFAULT_CONFIG);
    expect(reading.thrown).not.toBeNull();
  });

  it('ignores a draw too shallow to be a throw', () => {
    expect(swing(0.02, 60).reading.thrown).toBeNull();
  });

  it('reads a push that wanders right as drift to the right', () => {
    const straight = swing(0.6, 90).reading.thrown!;
    const wandering = swing(0.6, 90, 80).reading.thrown!;
    expect(Math.abs(straight.drift)).toBeLessThan(1e-9);
    expect(wandering.drift).toBeGreaterThan(0.2);
  });

  it('aims where the hand was when the push began, plus its sway at the moment of release', () => {
    const { reading } = swing(0.6, 90);
    expect(reading.thrown!.aim).toBeCloseTo(0 + handSway((1000 + 300 + 90) / 1000), 6);
  });

  it('lets the player re-aim while the arm is drawn back, without counting it as drift', () => {
    // Draw straight back, then slide right while holding the draw, then push straight.
    const bottom: Sample = { x: 400, y: 400 + 0.6 * fullDraw, t: 1300 };
    const back = path(grip, bottom, 10, 30);
    const slide = path(bottom, { x: 600, y: bottom.y }, 10, 30);
    const push = path(slide.at(-1)!, { x: 600, y: 380 }, 6, 15);
    const thrown = advanceStroke(gripStroke(grip, reach), [...back, ...slide, ...push], HEIGHT, DEFAULT_CONFIG)
      .reading.thrown!;

    expect(thrown.aim - handSway(push.at(-1)!.t / 1000)).toBeCloseTo(
      aimFromPointer(600, 0, 800, DEFAULT_CONFIG),
      6,
    );
    expect(Math.abs(thrown.drift)).toBeLessThan(1e-9);
  });

  it('shows the hand following the pointer sideways while drawn', () => {
    const drawn = path(grip, { x: 700, y: 400 + 0.5 * fullDraw }, 5, 20);
    const { reading } = advanceStroke(gripStroke(grip, reach), drawn, HEIGHT, DEFAULT_CONFIG);
    expect(reading.aim).toBeCloseTo(aimFromPointer(700, 0, 800, DEFAULT_CONFIG), 9);
  });

  it('reports the draw as it happens, for the arm and the meter', () => {
    const halfway = path(grip, { x: 400, y: 400 + 0.5 * fullDraw }, 5, 20);
    const { reading } = advanceStroke(gripStroke(grip, reach), halfway, HEIGHT, DEFAULT_CONFIG);
    expect(reading.draw).toBeCloseTo(0.5, 6);
    expect(reading.thrown).toBeNull();
  });

  it('can be drawn again after easing off, and throws on the second push', () => {
    const first = swing(0.6, 2000);
    const again = path(first.stroke.samples.at(-1)!, { x: 400, y: 400 + 0.4 * fullDraw }, 5, 30);
    const push = path(again.at(-1)!, { x: 400, y: 380 }, 5, 15);
    const { reading } = advanceStroke(first.stroke, [...again, ...push], HEIGHT, DEFAULT_CONFIG);
    expect(reading.thrown?.draw).toBeCloseTo(0.4, 2);
  });
});

describe('aimFromPointer', () => {
  it('maps edge to edge of the stage onto the arm’s whole reach', () => {
    const { maxAim } = DEFAULT_CONFIG.gesture;
    expect(aimFromPointer(0, 0, 800, DEFAULT_CONFIG)).toBeCloseTo(-maxAim, 9);
    expect(aimFromPointer(400, 0, 800, DEFAULT_CONFIG)).toBeCloseTo(0, 9);
    expect(aimFromPointer(800, 0, 800, DEFAULT_CONFIG)).toBeCloseTo(maxAim, 9);
    expect(aimFromPointer(2000, 0, 800, DEFAULT_CONFIG)).toBeCloseTo(maxAim, 9);
  });
});

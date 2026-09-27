import { describe, expect, it } from 'vitest';
import { DEFAULT_CONFIG } from '@pocketknives/core';
import {
  advanceStroke,
  dragReach,
  liftStroke,
  aimFromPointer,
  gripStroke,
  lookReach,
  pitchFromPointer,
  screenReach,
  type Sample,
} from './throwStroke.js';
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
const reach = screenReach(0, 800, DEFAULT_CONFIG);

/** Grip, draw back by `drawn` of a full draw over `drawMs`, then push to `overshoot` above the grip. */
const swing = (drawn: number, pushMs: number, sideways = 0, drawMs = 300) => {
  const bottom = { x: 400, y: 400 + drawn * fullDraw };
  const back = path(grip, bottom, 10, drawMs / 10);
  const last = back[back.length - 1]!;
  const through = path(last, { x: 400 + sideways, y: 380 }, 6, pushMs / 6);
  return advanceStroke(gripStroke(grip, reach, 0.4), [...back, ...through], HEIGHT, DEFAULT_CONFIG);
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
    const { reading } = advanceStroke(gripStroke(grip, reach, 0.4), [...back, ...held, ...push], HEIGHT, DEFAULT_CONFIG);
    expect(reading.thrown).not.toBeNull();
  });

  it('still throws when the pointer held perfectly still at the bottom, sending nothing', () => {
    // A real mouse at rest emits no events: the draw ends, a second of silence,
    // then the push. The push must be timed from when it began, not from the
    // last sample before the silence.
    const bottom: Sample = { x: 400, y: 400 + 0.6 * fullDraw, t: 1300 };
    const back = path(grip, bottom, 10, 30);
    const push = path({ ...bottom, t: 2300 }, { x: 400, y: 380 }, 6, 12);
    const { reading } = advanceStroke(gripStroke(grip, reach, 0.4), [...back, ...push], HEIGHT, DEFAULT_CONFIG);
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
    const thrown = advanceStroke(gripStroke(grip, reach, 0.4), [...back, ...slide, ...push], HEIGHT, DEFAULT_CONFIG)
      .reading.thrown!;

    expect(thrown.aim - handSway(push.at(-1)!.t / 1000)).toBeCloseTo(
      aimFromPointer(600, 0, 800, DEFAULT_CONFIG),
      6,
    );
    expect(Math.abs(thrown.drift)).toBeLessThan(1e-9);
  });

  it('shows the hand following the pointer sideways while drawn', () => {
    const drawn = path(grip, { x: 700, y: 400 + 0.5 * fullDraw }, 5, 20);
    const { reading } = advanceStroke(gripStroke(grip, reach, 0.4), drawn, HEIGHT, DEFAULT_CONFIG);
    expect(reading.aim).toBeCloseTo(aimFromPointer(700, 0, 800, DEFAULT_CONFIG), 9);
  });

  it('throws at the angle set before gripping, whatever the draw does up and down', () => {
    expect(swing(0.6, 90).reading.thrown!.pitch).toBe(0.4);
  });

  it('reports the draw as it happens, for the arm and the meter', () => {
    const halfway = path(grip, { x: 400, y: 400 + 0.5 * fullDraw }, 5, 20);
    const { reading } = advanceStroke(gripStroke(grip, reach, 0.4), halfway, HEIGHT, DEFAULT_CONFIG);
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

describe('dragReach', () => {
  it('aims straight ahead wherever the finger lands, until it drags sideways', () => {
    // A finger landing far over on the right, then pulling straight back.
    const landed: Sample = { x: 700, y: 400, t: 1000 };
    const back = path(landed, { x: 700, y: 400 + 0.5 * fullDraw }, 6, 20);
    const straight = advanceStroke(gripStroke(landed, dragReach(700, 800, DEFAULT_CONFIG), 0.4), back, HEIGHT, DEFAULT_CONFIG);
    expect(straight.reading.aim).toBe(0);

    const sideways = path(landed, { x: 540, y: 400 + 0.5 * fullDraw }, 6, 20);
    const turned = advanceStroke(gripStroke(landed, dragReach(700, 800, DEFAULT_CONFIG), 0.4), sideways, HEIGHT, DEFAULT_CONFIG);
    expect(turned.reading.aim).toBeLessThan(0); // dragged left, aims left
  });
});

describe('lookReach', () => {
  it('turns as far as the mouse travels, with no edge to stop it', () => {
    // Mouse-look: 2000 px of travel at 0.004 rad/px is 8 radians — more than a full turn.
    const moved = path(grip, { x: 2400, y: 400 + 0.3 * fullDraw }, 10, 20);
    const { reading } = advanceStroke(gripStroke(grip, lookReach(400, 0.004), 0.4), moved, HEIGHT, DEFAULT_CONFIG);
    expect(reading.aim).toBeCloseTo(8, 9);
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

describe('pitchFromPointer', () => {
  const { minPitch, maxPitch } = DEFAULT_CONFIG.gesture;

  it('lobs with the hand high and throws down with it low', () => {
    expect(pitchFromPointer(0, 0, 1000, DEFAULT_CONFIG)).toBeCloseTo(maxPitch, 9);
    expect(pitchFromPointer(700, 0, 1000, DEFAULT_CONFIG)).toBeCloseTo(minPitch, 9);
    expect(pitchFromPointer(350, 0, 1000, DEFAULT_CONFIG)).toBeCloseTo((minPitch + maxPitch) / 2, 9);
  });

  it('holds at straight down below the band', () => {
    expect(pitchFromPointer(990, 0, 1000, DEFAULT_CONFIG)).toBeCloseTo(minPitch, 9);
  });
});

describe('whip', () => {
  it('reads a sharper push as a harder whip', () => {
    const gentle = swing(0.6, 250).reading.thrown!;
    const sharp = swing(0.6, 40).reading.thrown!;
    expect(sharp.whip!).toBeGreaterThan(gentle.whip!);
    expect(sharp.whip!).toBeLessThanOrEqual(1);
    expect(gentle.whip!).toBeGreaterThanOrEqual(0);
  });

  it('leaves the draw alone — power and spin are separate', () => {
    expect(swing(0.6, 250).reading.thrown!.draw).toBeCloseTo(swing(0.6, 40).reading.thrown!.draw, 9);
  });
});

describe('liftStroke', () => {
  /** Grip, draw back, then push up part of the way — `back` of the way home — and stop there. */
  const partWay = (back: number, pushMs: number) => {
    const bottom: Sample = { x: 400, y: 400 + 0.6 * fullDraw, t: 1300 };
    const draw = path(grip, bottom, 10, 30);
    const push = path(bottom, { x: 400, y: bottom.y - back * (bottom.y - grip.y) }, 5, pushMs / 5);
    const { stroke } = advanceStroke(gripStroke(grip, reach, 0.4), [...draw, ...push], HEIGHT, DEFAULT_CONFIG);
    return { stroke, lift: push.at(-1)! };
  };

  it('throws when the thumb lifts during a fast push, before reaching the grip point', () => {
    // The phone flick: pull back, flick up, and the thumb is off the glass halfway.
    const { stroke, lift } = partWay(0.6, 60);
    const thrown = liftStroke(stroke, lift, HEIGHT, DEFAULT_CONFIG);
    expect(thrown).not.toBeNull();
    expect(thrown!.draw).toBeCloseTo(0.6, 2);
  });

  it('calls it off when the thumb lifts without pushing', () => {
    const bottom: Sample = { x: 400, y: 400 + 0.6 * fullDraw, t: 1300 };
    const { stroke } = advanceStroke(gripStroke(grip, reach, 0.4), path(grip, bottom, 10, 30), HEIGHT, DEFAULT_CONFIG);
    expect(liftStroke(stroke, { ...bottom, t: 1320 }, HEIGHT, DEFAULT_CONFIG)).toBeNull();
  });

  it('calls it off when the push is only a thumb rolling off the glass', () => {
    const { stroke, lift } = partWay(0.1, 20);
    expect(liftStroke(stroke, lift, HEIGHT, DEFAULT_CONFIG)).toBeNull();
  });

  it('calls it off when the hand was easing back up slowly', () => {
    const { stroke, lift } = partWay(0.6, 1500);
    expect(liftStroke(stroke, lift, HEIGHT, DEFAULT_CONFIG)).toBeNull();
  });
});

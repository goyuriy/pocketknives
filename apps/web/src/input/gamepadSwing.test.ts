import { describe, expect, it } from 'vitest';
import { DEFAULT_CONFIG } from '@pocketknives/core';
import { GRIP_LIFT, PAD_SCREEN, padGripY, padHandOf, padSample } from './gamepadSwing.js';
import { advanceStroke, gripStroke, lookReach, type Sample } from './throwStroke.js';

/** A stick moving through `ys` (down positive) at `ms` per frame, fed to the stroke reader. */
const swing = (ys: readonly number[], ms: number) => {
  const grip: Sample = { x: 0, y: padGripY(DEFAULT_CONFIG), t: 0 };
  const samples = ys.map((y, i) => padSample([0, y], 0, (i + 1) * ms, DEFAULT_CONFIG));
  return advanceStroke(gripStroke(grip, lookReach(0, 0.003), 0.35), samples, PAD_SCREEN, DEFAULT_CONFIG).reading;
};

describe('padHandOf', () => {
  it('reads the right stick and grips on the trigger or the bumper', () => {
    const buttons = Array.from({ length: 8 }, () => ({ pressed: false, value: 0 }));
    const idle = padHandOf({ axes: [0, 0, 0.9, 0], buttons });
    expect(idle.stick[0]).toBeGreaterThan(0.8);
    expect(idle.grip).toBe(false);
    const trigger = buttons.map((b, i) => (i === 7 ? { pressed: true, value: 0.8 } : b));
    expect(padHandOf({ axes: [0, 0, 0, 0], buttons: trigger }).grip).toBe(true);
    const bumper = buttons.map((b, i) => (i === 5 ? { pressed: true, value: 1 } : b));
    expect(padHandOf({ axes: [0, 0, 0, 0], buttons: bumper }).grip).toBe(true);
  });

  it('ignores a stick resting a little off centre', () => {
    const buttons = Array.from({ length: 8 }, () => ({ pressed: false, value: 0 }));
    expect(padHandOf({ axes: [0, 0, 0.08, -0.1], buttons }).stick).toEqual([0, 0]);
  });
});

describe('the stick as a swing', () => {
  it('draws all the way back with the stick pulled all the way down', () => {
    const { draw, thrown } = swing([0.5, 1, 1], 16);
    expect(draw).toBeCloseTo(1, 9);
    expect(thrown).toBeNull();
  });

  it('throws on a flick from pulled back to pushed up', () => {
    const { thrown } = swing([0.5, 1, 1, 0.4, -0.2, -0.6], 16);
    expect(thrown).not.toBeNull();
    expect(thrown!.draw).toBeCloseTo(1, 9);
  });

  it('does not throw when a pulled-back stick is simply let go and springs to centre', () => {
    // The spring snaps it back in a frame or two — fast, but only to the middle,
    // which is short of the grip point.
    const { thrown } = swing([0.5, 1, 1, 0.3, 0, 0, 0], 16);
    expect(thrown).toBeNull();
    expect(GRIP_LIFT).toBeGreaterThan(0);
  });

  it('eases off rather than throwing when the stick comes up slowly', () => {
    const slowly = [1, 0.9, 0.8, 0.7, 0.6, 0.5, 0.4, 0.3, 0.2, 0.1, 0, -0.1, -0.2, -0.3, -0.4];
    expect(swing(slowly, 120).thrown).toBeNull();
  });
});

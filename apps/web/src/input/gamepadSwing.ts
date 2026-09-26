import type { ThrowConfig } from '@pocketknives/core';
import { withDeadzone } from './walk.js';
import type { Sample } from './throwStroke.js';

/**
 * What a gamepad's throwing hand is doing: the right stick, and whether the
 * right trigger (or bumper) is held to grip.
 */
export type PadHand = {
  /** Right stick, deadzone applied: x right, y down, each -1 to 1. */
  readonly stick: readonly [number, number];
  readonly grip: boolean;
};

/** Standard Gamepad API layout: right stick on axes 2 and 3, bumper 5, trigger 7. */
const RIGHT_X = 2;
const RIGHT_Y = 3;
const RIGHT_BUMPER = 5;
const RIGHT_TRIGGER = 7;

type PadLike = {
  readonly axes: readonly number[];
  readonly buttons: readonly { readonly pressed: boolean; readonly value: number }[];
};

export const padHandOf = (pad: PadLike): PadHand => ({
  stick: withDeadzone(pad.axes[RIGHT_X] ?? 0, pad.axes[RIGHT_Y] ?? 0),
  grip: (pad.buttons[RIGHT_TRIGGER]?.value ?? 0) > 0.5 || (pad.buttons[RIGHT_BUMPER]?.pressed ?? false),
});

/** Turn rate with the stick pushed all the way across, radians per second. */
export const PAD_TURN_RATE = 2.4;
/** Change in launch angle with the stick pushed all the way up or down, radians per second. */
export const PAD_PITCH_RATE = 0.7;

/**
 * The swing is read by the same stroke reader as a mouse or a finger, in a
 * made-up screen this tall — the stick is turned into a pointer position.
 */
export const PAD_SCREEN = 1000;

/**
 * How far above the stick's centre the grip point sits, as a fraction of the
 * stick's travel.
 *
 * A stick springs back to centre when it is let go. If the grip point were the
 * centre, simply letting go of a pulled-back stick would push through it and
 * throw. Setting it a quarter of the way up means a throw has to be pushed past
 * the middle on purpose — the way a golf game's swing stick asks for a follow
 * through, not a release.
 */
export const GRIP_LIFT = 0.25;

/** Pointer pixels per unit of stick travel: all the way down, from the grip point, is a full draw. */
const verticalScale = (config: ThrowConfig): number =>
  (PAD_SCREEN * config.gesture.fullDraw) / (1 + GRIP_LIFT);

/** Where the grip point is, in the made-up screen. */
export const padGripY = (config: ThrowConfig): number => -GRIP_LIFT * verticalScale(config);

/**
 * The stick as a pointer sample for the stroke reader.
 *
 * Up and down is a position — pull the stick down and the arm draws back that
 * far, as a golf game's swing stick does. Across is a rate — held over, the
 * hand keeps turning — so `across` is carried along from frame to frame and
 * passed back in: the pixels turned so far.
 */
export const padSample = (stick: readonly [number, number], across: number, t: number, config: ThrowConfig): Sample => ({
  x: across,
  y: stick[1] * verticalScale(config),
  t,
});

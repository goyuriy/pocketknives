import type { Vec2 } from '@pocketknives/core';

/**
 * Which way the player wants to walk, relative to where they face.
 *
 * The same two numbers whatever the device: keys give whole steps, a stick
 * gives anything in between. `forward` is along the facing, `right` across it,
 * each from -1 to 1.
 */
export type WalkInput = {
  readonly forward: number;
  readonly right: number;
};

export const STANDING_STILL: WalkInput = { forward: 0, right: 0 };

/** Walking pace, arena units per second: a few seconds to cross your own wedge. */
export const WALK_SPEED = 3;

/**
 * Stick travel below which a stick counts as centred. Worn sticks rest a little
 * off centre and would otherwise creep the player across the ground.
 */
const DEADZONE = 0.18;

/** WASD and the arrow keys, by `KeyboardEvent.code`. */
const KEYS: Record<string, WalkInput> = {
  KeyW: { forward: 1, right: 0 },
  ArrowUp: { forward: 1, right: 0 },
  KeyS: { forward: -1, right: 0 },
  ArrowDown: { forward: -1, right: 0 },
  KeyA: { forward: 0, right: -1 },
  ArrowLeft: { forward: 0, right: -1 },
  KeyD: { forward: 0, right: 1 },
  ArrowRight: { forward: 0, right: 1 },
};

export const isWalkKey = (code: string): boolean => code in KEYS;

/** The walk the held keys ask for. Opposite keys cancel, as they do in every game. */
export const walkFromKeys = (held: ReadonlySet<string>): WalkInput =>
  [...held].reduce<WalkInput>(
    (sum, code) => {
      const key = KEYS[code];
      return key ? { forward: sum.forward + key.forward, right: sum.right + key.right } : sum;
    },
    STANDING_STILL,
  );

/**
 * A stick's position as a walk, with a deadzone at the centre that the rest of
 * the travel is rescaled around — so leaving the deadzone starts from a crawl
 * rather than jumping to a fifth of full speed.
 *
 * @param x stick right, -1 to 1
 * @param y stick *down*, -1 to 1 — the way gamepads and screens both count
 */
export const walkFromStick = (x: number, y: number): WalkInput => {
  const travel = Math.hypot(x, y);
  if (travel < DEADZONE) return STANDING_STILL;
  const scaled = Math.min(1, (travel - DEADZONE) / (1 - DEADZONE)) / travel;
  return { forward: -y * scaled, right: x * scaled };
};

/**
 * Several inputs as one: whichever the player is using wins, and two at once
 * add up but never beyond a full walk. Diagonals are no faster than straight
 * lines — the old bug of running diagonally to go quicker.
 */
export const combineWalks = (...walks: readonly WalkInput[]): WalkInput => {
  const forward = walks.reduce((sum, w) => sum + w.forward, 0);
  const right = walks.reduce((sum, w) => sum + w.right, 0);
  const length = Math.hypot(forward, right);
  return length > 1 ? { forward: forward / length, right: right / length } : { forward, right };
};

/** Where a walk takes the player's feet over `seconds`, facing `facing` (radians). */
export const walkStep = (feet: Vec2, walk: WalkInput, facing: number, seconds: number, speed = WALK_SPEED): Vec2 => {
  const ahead: Vec2 = [Math.cos(facing), Math.sin(facing)];
  const right: Vec2 = [Math.sin(facing), -Math.cos(facing)];
  const distance = speed * seconds;
  return [
    feet[0] + (ahead[0] * walk.forward + right[0] * walk.right) * distance,
    feet[1] + (ahead[1] * walk.forward + right[1] * walk.right) * distance,
  ];
};

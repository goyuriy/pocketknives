import type { Vec2 } from '../types.js';

/** Where a thrower stands and which way they face — what every throw is thrown from. */
export type Stance = {
  readonly feet: Vec2;
  /** Heading the body faces, radians; the hand aims relative to it. */
  readonly facing: number;
};

/**
 * Where the knife leaves the hand relative to the feet: out in front, where the
 * arm reaches to let go, and a little right, under the throwing shoulder. In
 * metres, for a person of 1.75 m.
 *
 * Part of the rules, not only of the drawing: it is where the flight starts, so
 * the authority and every client must agree on it.
 */
export const RELEASE_AHEAD = 0.6;
export const RELEASE_RIGHT = 0.19;

/** Where the knife leaves the hand for a thrower standing at `feet` and throwing along `heading`. */
export const releasePoint = (feet: Vec2, heading: number): Vec2 => {
  const forward: Vec2 = [Math.cos(heading), Math.sin(heading)];
  const right: Vec2 = [Math.sin(heading), -Math.cos(heading)];
  return [
    feet[0] + forward[0] * RELEASE_AHEAD + right[0] * RELEASE_RIGHT,
    feet[1] + forward[1] * RELEASE_AHEAD + right[1] * RELEASE_RIGHT,
  ];
};

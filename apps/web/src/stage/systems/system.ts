import type { Frame } from '../frame.js';

/**
 * One part of the stage's frame: owns some views, and poses them from the
 * frame's facts. A system is a pair of functions over data — no base class,
 * no lifecycle beyond being made and disposed — and the director is the list
 * of them, run in order.
 *
 * `Out` is what it hands on to the systems after it: where the thrower's hand
 * is, how hard the ground was just hit.
 */
export type System<Out, In = void> = {
  readonly update: (frame: Frame, input: In) => Out;
  readonly dispose: () => void;
};

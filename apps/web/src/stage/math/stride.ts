import type { Vec2 } from '@pocketknives/core';
import { easeToward } from './armMotion.js';
import { strideAfter, type Stride } from './bodyPose.js';

/** Below this pace, units per second, the legs are standing, not walking. */
const WALKING_PACE = 0.3;
/** How quickly the legs fall into and out of a walk, per second. */
const STRIDE_EASE = 8;
/** How quickly the character's pace follows the feet, per second. */
const PACE_EASE = 10;

/**
 * The legs after moving from `from` to `to` in `seconds`, facing `facing`: the
 * stride advances by the distance walked, swings along the way it went, and
 * eases in and out so starting and stopping is not a snap.
 */
export const strideFor = (stride: Stride, from: Vec2, to: Vec2, facing: number, seconds: number): Stride => {
  const [dx, dy] = [to[0] - from[0], to[1] - from[1]];
  const distance = Math.hypot(dx, dy);
  const walking = seconds > 0 && distance / seconds > WALKING_PACE;
  const along: Stride['along'] = walking
    ? [dx * Math.cos(facing) + dy * Math.sin(facing), dx * Math.sin(facing) - dy * Math.cos(facing)]
    : stride.along;
  return {
    phase: strideAfter(stride.phase, distance),
    amount: easeToward(stride.amount, walking ? 1 : 0, STRIDE_EASE, seconds),
    along,
  };
};

/** How fast the feet are going, eased so one uneven frame does not jolt the clips. */
export const paceFor = (pace: number, from: Vec2, to: Vec2, seconds: number): number => {
  const speed = seconds > 0 ? Math.hypot(to[0] - from[0], to[1] - from[1]) / seconds : 0;
  return easeToward(pace, speed, PACE_EASE, seconds);
};

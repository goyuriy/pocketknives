import type { Vec2, Vec3 } from '@pocketknives/core';

/**
 * Where the camera sits, and what it looks at.
 *
 * Two poses, and the whole feel of a throw lives in the move between them.
 * Aiming, the camera stands just over the thrower's right shoulder, close
 * enough that their own arm is in the foreground — it is the thing they are
 * controlling, so it has to be seen — and high enough that the circle still
 * spreads out above it. The moment the knife lands the camera lifts and swings
 * over the circle, because what the throw *won* is a shape, and a shape is only
 * legible from above.
 */
const AIM_SWING = -0.1;
const AIM_HEIGHT = 4.5;
const AIM_SETBACK = 7;
const OVER_HEIGHT = 30;
const OVER_SETBACK = 4;
/*
 * The HUD floats over the lower part of the screen, so the circle has to sit
 * high in frame to stay clear of it. Aiming below the ground plane tilts the
 * camera down, which lifts everything above that point up the screen.
 */
const AIM_FOCUS_DROP = -6.5;

export type CameraPose = {
  /** Game coordinates. */
  readonly eye: Vec3;
  readonly focus: Vec3;
};

export const cameraPose = (stand: Vec2, overhead: boolean, arenaRadius: number): CameraPose => {
  // A little off the throwing line. Dead behind it the arc collapses to a
  // straight line — the one thing the player most needs to judge.
  const bearing = Math.atan2(stand[1], stand[0]) + (overhead ? 0 : AIM_SWING);
  const setback = overhead ? OVER_SETBACK : AIM_SETBACK;
  return {
    eye: [
      Math.cos(bearing) * (arenaRadius + setback),
      Math.sin(bearing) * (arenaRadius + setback),
      overhead ? OVER_HEIGHT : AIM_HEIGHT,
    ],
    focus: [0, 0, overhead ? 0 : AIM_FOCUS_DROP],
  };
};

/** How quickly the camera settles into a new pose, per second. Landing is a slower, grander move. */
export const cameraEaseRate = (overhead: boolean): number => (overhead ? 2.4 : 4);

import type { Vec2, Vec3 } from '@pocketknives/core';

/**
 * Where the camera sits, and what it looks at.
 *
 * Two poses, and the whole feel of a throw lives in the move between them.
 *
 * Aiming, the camera rides just behind the thrower's hand, close enough that
 * the arm is in the foreground — it is the thing being controlled, so it has to
 * be seen — and it looks where the hand points. Like a body-worn camera, it does
 * not lead: the hand moves first and the view catches up (the director eases
 * `look` towards the hand), so a quick sweep of the arm is felt as the arm
 * moving, not the world lurching.
 *
 * The moment the knife lands the camera lifts and swings over the circle,
 * because what the throw *won* is a shape, and a shape is only legible from
 * above.
 */
const AIM_SETBACK = 5;
/** Sideways from the throwing line, so the arm sits right of centre instead of hiding the arc. */
const AIM_SHOULDER = 1.7;
const AIM_HEIGHT = 4.5;
/** How far ahead of the thrower the eye rests — about the middle of the circle. */
const AIM_REACH = 12;
/*
 * The HUD floats over the lower part of the screen, so the circle has to sit
 * high in frame to stay clear of it. Aiming below the ground plane tilts the
 * camera down, which lifts everything above that point up the screen.
 */
const AIM_FOCUS_DROP = -6.5;
const OVER_HEIGHT = 30;
const OVER_SETBACK = 4;

export type CameraPose = {
  /** Game coordinates. */
  readonly eye: Vec3;
  readonly focus: Vec3;
};

/**
 * @param look where the view is pointing across the ground, radians — the
 *             hand's heading, lagged
 */
export const cameraPose = (
  stand: Vec2,
  overhead: boolean,
  arenaRadius: number,
  look: number,
): CameraPose => {
  if (overhead) {
    const bearing = Math.atan2(stand[1], stand[0]);
    return {
      eye: [
        Math.cos(bearing) * (arenaRadius + OVER_SETBACK),
        Math.sin(bearing) * (arenaRadius + OVER_SETBACK),
        OVER_HEIGHT,
      ],
      focus: [0, 0, 0],
    };
  }
  const forward: Vec2 = [Math.cos(look), Math.sin(look)];
  const right: Vec2 = [Math.sin(look), -Math.cos(look)];
  return {
    eye: [
      stand[0] - forward[0] * AIM_SETBACK - right[0] * AIM_SHOULDER,
      stand[1] - forward[1] * AIM_SETBACK - right[1] * AIM_SHOULDER,
      AIM_HEIGHT,
    ],
    focus: [stand[0] + forward[0] * AIM_REACH, stand[1] + forward[1] * AIM_REACH, AIM_FOCUS_DROP],
  };
};

/** How quickly the camera settles into a new pose, per second. Landing is a slower, grander move. */
export const cameraEaseRate = (overhead: boolean): number => (overhead ? 2.4 : 4);

/** How quickly the view catches up with the hand, per second. Lower is lazier. */
export const LOOK_FOLLOW_RATE = 3.5;

/** Eases one heading towards another the short way round, frame-rate independently. */
export const easeHeading = (from: number, to: number, rate: number, seconds: number): number => {
  const gap = Math.atan2(Math.sin(to - from), Math.cos(to - from));
  return from + gap * (1 - Math.exp(-rate * seconds));
};

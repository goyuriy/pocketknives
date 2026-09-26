import type { Vec2, Vec3 } from '@pocketknives/core';
import { eyeAt } from './bodyPose.js';

/**
 * Where the camera sits, and what it looks at.
 *
 * Two poses, and the whole feel of a throw lives in the move between them.
 *
 * Aiming, the camera is the thrower's eyes: eye level, looking out over their
 * own hands at the circle. It looks where the hand points, but like a
 * body-worn camera it does not lead — the hand moves first and the view catches
 * up (the director eases `look` towards the hand), so a quick sweep of the arm
 * is felt as the arm moving, not the world lurching.
 *
 * The moment the knife lands the camera lifts and swings over the circle,
 * because what the throw *won* is a shape, and a shape is only legible from
 * above.
 */
/**
 * How far below level the eyes look, radians. Down past the hands at the
 * circle — and down enough that the circle clears the HUD at the bottom of the
 * screen.
 */
const EYE_DIP = 0.22;
const OVER_HEIGHT = 30;
const OVER_SETBACK = 4;

export type CameraPose = {
  /** Game coordinates. */
  readonly eye: Vec3;
  readonly focus: Vec3;
};

/**
 * @param release where the knife leaves the hand — the thrower stands just behind it
 * @param look    where the view is pointing across the ground, radians — the
 *                hand's heading, lagged
 */
export const cameraPose = (
  release: Vec3,
  overhead: boolean,
  arenaRadius: number,
  look: number,
): CameraPose => {
  if (overhead) {
    const bearing = Math.atan2(release[1], release[0]);
    return {
      eye: [
        Math.cos(bearing) * (arenaRadius + OVER_SETBACK),
        Math.sin(bearing) * (arenaRadius + OVER_SETBACK),
        OVER_HEIGHT,
      ],
      focus: [0, 0, 0],
    };
  }
  const eye = eyeAt(release, look);
  const ahead: Vec2 = [Math.cos(look) * Math.cos(EYE_DIP), Math.sin(look) * Math.cos(EYE_DIP)];
  return {
    eye,
    focus: [eye[0] + ahead[0], eye[1] + ahead[1], eye[2] - Math.sin(EYE_DIP)],
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

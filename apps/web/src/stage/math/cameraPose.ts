import type { Vec2, Vec3 } from '@pocketknives/core';
import { EYE_HEIGHT } from './bodyPose.js';

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
/** How much further down a phone held upright looks, at its tallest. */
const TALL_EXTRA_DIP = 0.16;

/**
 * How far down the eyes look, for a screen of this shape (width / height).
 *
 * A tall screen sees further up and down (see `fieldOfView`), and at the usual
 * dip the extra goes on sky: a third of a phone screen of nothing. Looking
 * further down spends it on the circle instead.
 */
export const eyeDip = (aspect: number): number =>
  EYE_DIP + TALL_EXTRA_DIP * Math.min(1, Math.max(0, (0.9 - aspect) / 0.4));
const OVER_HEIGHT = 30;
const OVER_SETBACK = 4;
/**
 * Behind the thrower: this far back and this high, a little over the free
 * shoulder so the throwing arm and the knife stay in sight, looking at a spot
 * this far ahead on the ground.
 */
const BEHIND_BACK = 3.6;
const BEHIND_HEIGHT = 2.6;
const BEHIND_ASIDE = -0.45;
const BEHIND_AHEAD = 2;
const BEHIND_FOCUS_HEIGHT = 0.5;

export type CameraPose = {
  /** Game coordinates. */
  readonly eye: Vec3;
  readonly focus: Vec3;
};

/**
 * @param feet where the thrower stands — the eye is right above them
 * @param look where the view is pointing across the ground, radians — the
 *             hand's heading, lagged
 * @param dip  how far below level the eyes look, radians — see `eyeDip`
 * @param behind watch the thrower from behind and above instead of through
 *             their eyes — to see the character, not to play
 */
export const cameraPose = (
  feet: Vec2,
  overhead: boolean,
  arenaRadius: number,
  look: number,
  dip = EYE_DIP,
  behind = false,
): CameraPose => {
  if (overhead) {
    // Over the circle from the thrower's side, so the cut reads the way it was thrown.
    const bearing = Math.hypot(feet[0], feet[1]) > 1e-6 ? Math.atan2(feet[1], feet[0]) : look + Math.PI;
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
  if (behind) {
    const right: Vec2 = [Math.sin(look), -Math.cos(look)];
    return {
      eye: [
        feet[0] - forward[0] * BEHIND_BACK + right[0] * BEHIND_ASIDE,
        feet[1] - forward[1] * BEHIND_BACK + right[1] * BEHIND_ASIDE,
        BEHIND_HEIGHT,
      ],
      focus: [feet[0] + forward[0] * BEHIND_AHEAD, feet[1] + forward[1] * BEHIND_AHEAD, BEHIND_FOCUS_HEIGHT],
    };
  }
  const eye: Vec3 = [feet[0], feet[1], EYE_HEIGHT];
  const ahead: Vec2 = [Math.cos(look) * Math.cos(dip), Math.sin(look) * Math.cos(dip)];
  return {
    eye,
    focus: [eye[0] + ahead[0], eye[1] + ahead[1], eye[2] - Math.sin(dip)],
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

/**
 * Within this distance of where the eye should be, it stops easing and locks on.
 *
 * Easing is for the camera's big moves — lifting over the circle and coming back
 * down. At eye level it would make the head trail the body: walk and the hands,
 * which go where the feet go, slide away from the eye and snap back when you
 * stop. So once the eye has arrived it stays arrived.
 */
export const EYE_LOCK_DISTANCE = 0.6;

/** Whether the eye should lock to its pose outright rather than ease towards it. */
export const eyeLocks = (overhead: boolean, distance: number): boolean =>
  !overhead && distance <= EYE_LOCK_DISTANCE;

export type FieldOfView = {
  /** Which way the angle is held: across the screen, or up it. */
  readonly held: 'vertical' | 'horizontal';
  readonly radians: number;
};

/**
 * The first-person view, up the screen, on a screen wider than tall. Widened
 * from 62° after play: at 62 the ground came right up to the screen and the
 * circle felt close enough to touch, with little of it in view at once.
 */
const VERTICAL_VIEW = (72 * Math.PI) / 180;
/** The narrowest the view may get across the screen before it is held there instead. Widened from 56°. */
const LEAST_ACROSS = (64 * Math.PI) / 180;

/**
 * How wide the camera sees, for a screen of this shape (width / height).
 *
 * A camera normally holds its angle up the screen and lets the angle across
 * follow the screen's width. On a phone held upright that leaves a sliver —
 * about 30° across — too narrow for both hands and the circle: the throwing hand
 * fills the edge and the rest is sky. So once the view across would drop below
 * `LEAST_ACROSS` it is held across instead, and a tall screen sees further up
 * and down rather than less side to side.
 */
export const fieldOfView = (aspect: number): FieldOfView => {
  const across = 2 * Math.atan(Math.tan(VERTICAL_VIEW / 2) * aspect);
  return across >= LEAST_ACROSS ? { held: 'vertical', radians: VERTICAL_VIEW } : { held: 'horizontal', radians: LEAST_ACROSS };
};

import type { Vec2, Vec3 } from '@pocketknives/core';
import { EYE_HEIGHT } from './bodyPose.js';

/**
 * Where the camera sits, and what it looks at.
 *
 * Two poses, and the whole feel of a throw lives in the move between them.
 *
 * Aiming, the camera is the thrower's eyes: eye level, looking down over their
 * own hands at the ground the knife is meant for. It looks where the hand points, but like a
 * body-worn camera it does not lead — the hand moves first and the view catches
 * up (the director eases `look` towards the hand), so a quick sweep of the arm
 * is felt as the arm moving, not the world lurching.
 *
 * The moment the knife lands the camera lifts and swings over the circle,
 * because what the throw *won* is a shape, and a shape is only legible from
 * above.
 */
/**
 * How far below level the eyes look, radians, for a throw aimed level. Down
 * past the hands at the circle — and down enough that the circle clears the
 * HUD at the bottom of the screen.
 */
const EYE_DIP = 0.35;
/**
 * How much further down the eyes look for each radian the throw is aimed down.
 * Enough that they rest roughly on the ground the knife is headed for: at your
 * feet for a throw straight down, a stride or two ahead at the resting angle,
 * out over the circle for a lob.
 */
const DIP_PER_PITCH = 0.38;
/** Never quite level, and never so far down that the hands leave the top of the view. */
const LEAST_DIP = 0.05;
const MOST_DIP = 1;
/** How much further down a phone held upright looks, at its tallest. */
const TALL_EXTRA_DIP = 0.16;

/**
 * How far the eyes can look up and down, radians. Up, all but straight up,
 * where a camera loses track of which way is up. Down, 70°: as far as a head
 * tips before the chin meets the chest — the arms are still in the sides of
 * the view there, as they are for a real pair of eyes, not under the lens.
 */
export const LOOK_UP_LIMIT = (89 * Math.PI) / 180;
export const LOOK_DOWN_LIMIT = (70 * Math.PI) / 180;

/**
 * How far down the eyes look, for a screen of this shape (width / height) and
 * a throw set at `pitch` (radians above level).
 *
 * In the yard your eyes are on the ground under your knees, where the knife is
 * going — so the view follows the angle of the throw down, the way a head
 * follows the hand. A tall screen sees further up and down (see
 * `fieldOfView`), and at the usual dip the extra goes on sky: a third of a
 * phone screen of nothing. Looking further down spends it on the ground
 * instead.
 */
export const eyeDip = (aspect: number, pitch = 0): number =>
  Math.min(
    LOOK_DOWN_LIMIT,
    Math.min(MOST_DIP, Math.max(LEAST_DIP, EYE_DIP - DIP_PER_PITCH * pitch)) +
      TALL_EXTRA_DIP * Math.min(1, Math.max(0, (0.9 - aspect) / 0.4)),
  );
/**
 * How far in front of the middle of the head the eyes are, metres. Real eyes
 * sit well forward of the shoulders; from the middle of the head, looking down
 * puts the tops of both arms right under the lens.
 */
const EYE_FORWARD = 0.1;
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

/**
 * Where the camera can be put, for looking at the game rather than playing it.
 *
 * `eyes` is the game's own camera: through the thrower's eyes, lifting over
 * the circle once a knife lands. Every other view is for debugging — a fixed
 * place relative to the thrower that stays put through a throw, so a
 * screenshot from it shows the same thing every time.
 */
export const CAMERA_VIEWS = ['eyes', 'behind', 'side', 'front', 'hand', 'top', 'arena'] as const;
export type CameraView = (typeof CAMERA_VIEWS)[number];

export const isCameraView = (value: unknown): value is CameraView =>
  typeof value === 'string' && (CAMERA_VIEWS as readonly string[]).includes(value);

/** Side on from the throwing side, and face on from in front: far enough for the whole body. */
const SIDE_DISTANCE = 3.4;
const FRONT_DISTANCE = 3;
const BODY_MIDDLE = 1.05;
/** Close on the throwing hand, from out to its side and a little ahead. */
const HAND_ASIDE = 0.8;
const HAND_AHEAD = 0.6;
const HAND_ABOVE = 0.15;
/** Straight down on the thrower, high enough for their reach around them. */
const TOP_HEIGHT = 7;

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
 * @param view where to look from — see `CameraView`
 * @param hand where the throwing hand is, for the `hand` view
 */
export const cameraPose = (
  feet: Vec2,
  overhead: boolean,
  arenaRadius: number,
  look: number,
  dip = EYE_DIP,
  view: CameraView = 'eyes',
  hand: Vec3 = [feet[0], feet[1], BODY_MIDDLE],
): CameraPose => {
  if (view !== 'eyes' && view !== 'arena') return debugPose(view, feet, look, hand);
  if (overhead || view === 'arena') {
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
  const eye: Vec3 = [feet[0] + Math.cos(look) * EYE_FORWARD, feet[1] + Math.sin(look) * EYE_FORWARD, EYE_HEIGHT];
  const ahead: Vec2 = [Math.cos(look) * Math.cos(dip), Math.sin(look) * Math.cos(dip)];
  return {
    eye,
    focus: [eye[0] + ahead[0], eye[1] + ahead[1], eye[2] - Math.sin(dip)],
  };
};

/** The debug views, each fixed relative to where the thrower stands and faces. */
const debugPose = (view: Exclude<CameraView, 'eyes' | 'arena'>, feet: Vec2, look: number, hand: Vec3): CameraPose => {
  const forward: Vec3 = [Math.cos(look), Math.sin(look), 0];
  const right: Vec3 = [Math.sin(look), -Math.cos(look), 0];
  const at = (along: number, aside: number, up: number, from: Vec3 = [feet[0], feet[1], 0]): Vec3 => [
    from[0] + forward[0] * along + right[0] * aside,
    from[1] + forward[1] * along + right[1] * aside,
    from[2] + up,
  ];
  const body = at(0, 0, BODY_MIDDLE);
  switch (view) {
    case 'behind':
      return { eye: at(-BEHIND_BACK, BEHIND_ASIDE, BEHIND_HEIGHT), focus: at(BEHIND_AHEAD, 0, BEHIND_FOCUS_HEIGHT) };
    case 'side':
      return { eye: at(0.3, SIDE_DISTANCE, 1.2), focus: at(0.3, 0, 0.9) };
    case 'front':
      return { eye: at(FRONT_DISTANCE, 0.3, 1.5), focus: body };
    case 'hand':
      return { eye: at(HAND_AHEAD, HAND_ASIDE, HAND_ABOVE, hand), focus: hand };
    case 'top':
      // A hair behind straight down, so the camera still knows which way is up the screen.
      return { eye: at(-0.01, 0, TOP_HEIGHT), focus: at(0.6, 0, 0) };
  }
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

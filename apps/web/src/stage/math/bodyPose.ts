import type { KnifeSpec, Vec2, Vec3 } from '@pocketknives/core';
import { bladeDirection } from './coords.js';
import { twoBoneIk, type Limb } from './twoBoneIk.js';

/**
 * Where the arm rests while waiting to throw: a little drawn back, so the first
 * touch of the pointer visibly moves something.
 */
export const READY_SWING = -0.35;

/*
 * The thrower's body, in their own frame: forward along the throw, right,
 * and up from the ground. Metres, at a person's real proportions: about
 * 1.75 m tall, eyes at 1.62, arms reaching 0.63 from the shoulder to the
 * middle of the fist, with a real 30 cm knife in it.
 */
/** How far behind the release point the thrower stands. The arm reaches forward to let go. */
const STAND_BACK = 0.6;
/** How far left of the throwing line the body is, so the throwing shoulder is on it. */
const BODY_LEFT = 0.19;
const SHOULDER_HEIGHT = 1.42;
const SHOULDER_HALF_WIDTH = 0.19;
export const EYE_HEIGHT = 1.62;
const UPPER_ARM = 0.3;
/** Elbow to the middle of the fist, where the handle is. */
const FOREARM = 0.33;
/** Where the legs join the body, and how far apart. */
const HIP_HEIGHT = 0.95;
const HIP_HALF_WIDTH = 0.1;
const THIGH = 0.48;
const SHIN = 0.47;
/** How high the ankle sits above the sole. */
const ANKLE_HEIGHT = 0.07;
/**
 * How the feet stand while still: the free side's foot a little forward, the
 * throwing side's a little back — a thrower's stance, not a soldier's.
 */
const LEAD_FOOT = 0.16;
const TRAIL_FOOT = -0.12;
const FOOT_HALF_SPREAD = 0.12;
/** How far a foot swings either way of its place in a stride, and how high it lifts. */
const STRIDE_REACH = 0.3;
const STRIDE_LIFT = 0.1;
/** How much the chest leans into the throw, forward at the release, back at full draw. */
const THROW_LEAN = 0.08;
/** The base of the neck, and the middle of the head: the eyes are in it. */
const NECK_HEIGHT = 1.5;
const HEAD_HEIGHT = EYE_HEIGHT;
/** Where each fist sits either side of the grip's middle on a two-handed weapon, as a fraction of the handle. */
const TWO_HANDED_SPREAD = 0.3;
/**
 * What the free hand points at: a spot this far out along the throwing line,
 * and this high. Pointing *at* a spot rather than parallel to the throw angles
 * the arm in towards the middle of the view, which is what makes it read as
 * pointing there — a parallel arm seen from behind is just a fist.
 */
const POINT_DISTANCE = 5;
const POINT_HEIGHT = 2.1;
const POINT_REACH = 0.58;
/** How far below the shoulder the free hand hangs at rest — down at the hip, out of view. */
const HANG_DROP = 0.6;
/** Which way a hanging hand's knuckles face: down. */
const HANGING_TILT = -1.4;

/**
 * How much a steeper or flatter throw lifts or lowers the throwing hand, in
 * units per radian of loft. The pointing arm tilts by the loft itself, so it
 * shows the angle outright; the throwing hand only has to agree with it.
 */
const HAND_LIFT = 0.22;
/**
 * A throw aimed down barely lowers the hand. Down into the ground is thrown
 * overhand — the fist stays up by the shoulder and it is the knife that tips
 * down — so dropping the hand to match would throw from the hip.
 */
const HAND_DROP = 0.05;
const BLADE_LIFT = 0.8;

/**
 * The throwing hand's path through a swing, as grip positions relative to the
 * throwing shoulder `[forward, right, up]` and the knife's tilt at each.
 *
 * A hammer grip's throw, laid out so the first-person camera can follow it:
 * held, the fist is out in front of the throwing shoulder with the knife
 * standing up out of it, point up and a little forward, the way a thrower
 * holds it before the throw — low and right enough to leave the middle of the
 * view to the circle; drawn back, the fist goes up by the ear and the
 * knife stands nearly upright, still a little ahead of the eyes so its tip
 * stays in the top corner of the view — a knife drawn clean out of shot leaves
 * the player nothing to read the draw from; at release it is out in front at
 * eye level; after, it carries down across the body. The release
 * keyframe is not listed — it is wherever the flight begins, worked out per
 * throw.
 */
const DRAWN: Keyframe = { at: [0.28, 0.1, 0.26], bladeAngle: 1.0 };
const HELD: Keyframe = { at: [0.4, 0.04, 0.04], bladeAngle: 0.95 };
const FOLLOWED: Keyframe = { at: [0.34, -0.19, -0.41], bladeAngle: -1.0 };

type Keyframe = { readonly at: Vec3; readonly bladeAngle: number };

/**
 * How the legs are walking: where in the stride they are, how much of a stride
 * it is (0 standing, 1 walking), and which way, as `[forward, right]` in the
 * body's own terms — a sidestep swings the legs sideways.
 */
export type Stride = {
  readonly phase: number;
  readonly amount: number;
  readonly along: readonly [forward: number, right: number];
};

export const STANDING: Stride = { phase: 0, amount: 0, along: [1, 0] };

/** Walking distance that makes one step, one foot passing the other. */
export const STEP_LENGTH = 0.7;

/** Where the stride is after walking `distance` further. Half a turn of the phase is a step. */
export const strideAfter = (phase: number, distance: number): number => phase + (distance / STEP_LENGTH) * Math.PI;

export type BodySetup = {
  /** Where the knife leaves the hand — the flight's origin. */
  readonly release: Vec3;
  /** The line the body faces and the knife points along. */
  readonly heading: number;
  /** The blade angle the flight begins from. */
  readonly releaseBladeAngle: number;
  readonly spec: KnifeSpec;
  readonly hands: 1 | 2;
  /**
   * How much steeper (positive) or flatter than the resting angle the hand is
   * set to throw, radians. Raises the hands and the pointing arm to match.
   */
  readonly loft: number;
  /**
   * How far the free arm is raised to point, 0 hanging at the side, 1 pointing
   * at the target. Eased by the caller, so the arm lifts rather than snaps.
   */
  readonly raised: number;
  /** How the legs are walking. Standing still when left out. */
  readonly stride?: Stride;
};

/** The rest of the thrower: trunk, head and legs. */
export type Figure = {
  readonly hips: Vec3;
  readonly neck: Vec3;
  readonly head: Vec3;
  /** Hip, knee and ankle. The throwing side's leg, and the free side's. */
  readonly throwingLeg: Limb;
  readonly otherLeg: Limb;
};

export type BodyPose = {
  readonly figure: Figure;
  /** The knife's balance point, which is what the flight tracks. */
  readonly knifeAt: Vec3;
  readonly bladeAngle: number;
  readonly throwingArm: Limb;
  readonly otherArm: Limb;
  /** True when the other hand is pointing the way, rather than holding the grip too. */
  readonly pointing: boolean;
  /** Which way the pointing finger points, as a heading and a tilt above level. */
  readonly pointHeading: number;
  readonly pointTilt: number;
};

/** Distance from the knife's balance point to the middle of its grip, signed along the blade. */
export const gripOffset = ({ bladeLength, handleLength, balance }: KnifeSpec): number => {
  const tip = (1 - balance) * (bladeLength + handleLength);
  return tip - bladeLength - handleLength / 2;
};

/** A frame on the ground at the thrower's feet, facing `heading`. */
type BodyFrame = {
  readonly origin: Vec3;
  readonly forward: Vec3;
  readonly right: Vec3;
};

const frameAt = (release: Vec3, heading: number): BodyFrame => {
  const forward: Vec3 = [Math.cos(heading), Math.sin(heading), 0];
  const right: Vec3 = [Math.sin(heading), -Math.cos(heading), 0];
  return {
    origin: [
      release[0] - forward[0] * STAND_BACK - right[0] * BODY_LEFT,
      release[1] - forward[1] * STAND_BACK - right[1] * BODY_LEFT,
      0,
    ],
    forward,
    right,
  };
};

/** A point given in the body's own terms: forward, right, up from its feet. */
const inFrame = ({ origin, forward, right }: BodyFrame, [f, r, u]: Vec3): Vec3 => [
  origin[0] + forward[0] * f + right[0] * r,
  origin[1] + forward[1] * f + right[1] * r,
  origin[2] + u,
];

/** And back again. */
const ofFrame = ({ origin, forward, right }: BodyFrame, [x, y, z]: Vec3): Vec3 => {
  const [dx, dy] = [x - origin[0], y - origin[1]];
  return [dx * forward[0] + dy * forward[1], dx * right[0] + dy * right[1], z - origin[2]];
};

const add = (a: Vec3, b: Vec3, scale = 1): Vec3 => [a[0] + b[0] * scale, a[1] + b[1] * scale, a[2] + b[2] * scale];
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const lerp3 = (a: Vec3, b: Vec3, t: number): Vec3 => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];

/**
 * Where the knife leaves the hand for a thrower standing at `feet` and throwing
 * along `heading`: out in front, and a little right, where the throwing arm is.
 * The inverse of how `bodyPose` finds the feet from a release.
 */
export const releasePointFor = (feet: Vec2, heading: number): Vec2 => {
  const forward: Vec2 = [Math.cos(heading), Math.sin(heading)];
  const right: Vec2 = [Math.sin(heading), -Math.cos(heading)];
  return [
    feet[0] + forward[0] * STAND_BACK + right[0] * BODY_LEFT,
    feet[1] + forward[1] * STAND_BACK + right[1] * BODY_LEFT,
  ];
};

/** Where the eye is, for a thrower about to throw from `release` along `heading`. */
export const eyeAt = (release: Vec3, heading: number): Vec3 =>
  inFrame(frameAt(release, heading), [0, 0, EYE_HEIGHT]);

/**
 * The whole thrower at one moment of the swing.
 *
 * The throwing hand follows the keyframed path above, and the arm is solved to
 * reach it; the knife is carried rigidly in the fist. The release keyframe is
 * worked backwards from the flight — at the moment of letting go the knife is
 * exactly where the flight begins and at exactly the angle it begins at — so it
 * leaves the hand without a visible jump.
 *
 * The other hand hangs at the side until the player commits — gripping raises
 * it to point along the throw, the way a javelin thrower sights down their free
 * arm before letting go — and it tucks in as the throw follows through. On a
 * two-handed weapon it holds the grip instead.
 *
 * @param swing -1 drawn back, `READY_SWING` held, 0 release, 1 followed through
 */
export const bodyPose = (setup: BodySetup, swing: number): BodyPose => {
  const { release, heading, releaseBladeAngle, spec, hands, loft, raised } = setup;
  const frame = frameAt(release, heading);
  const throwingShoulder: Vec3 = [0, SHOULDER_HALF_WIDTH, SHOULDER_HEIGHT];
  const otherShoulder: Vec3 = [0, -SHOULDER_HALF_WIDTH, SHOULDER_HEIGHT];

  const grip = gripOffset(spec);
  // Keyframes are relative to the throwing shoulder; the release one is found in
  // the world and brought into the same terms.
  const fromShoulder = (at: Vec3): Vec3 => inFrame(frame, add(throwingShoulder, at));
  const releaseGrip = add(
    ofFrame(frame, add(release, bladeDirection(heading, releaseBladeAngle), grip)),
    throwingShoulder,
    -1,
  );
  const released: Keyframe = { at: releaseGrip, bladeAngle: releaseBladeAngle };

  const { at, bladeAngle } = keyframeAt(swing, released, loft);
  const gripAt = fromShoulder(at);
  const along = bladeDirection(heading, bladeAngle);
  const knifeAt = add(gripAt, along, -grip);

  const figure = figureAt(frame, swing, setup.stride ?? STANDING);

  const elbowDownAndOut = (side: number): Vec3 => add(add(frame.right, [0, 0, -1.6], 1), frame.right, side - 1);
  const throwingPole = add(elbowDownAndOut(1), frame.forward, -0.3);
  const otherPole = add(elbowDownAndOut(-1), frame.forward, -0.3);

  if (hands === 2) {
    const spread = spec.handleLength * TWO_HANDED_SPREAD;
    // Leading fist nearer the guard, trailing one nearer the pommel.
    const lead = add(gripAt, along, spread);
    const trail = add(gripAt, along, -spread);
    return {
      figure,
      knifeAt,
      bladeAngle,
      throwingArm: twoBoneIk(inFrame(frame, throwingShoulder), trail, UPPER_ARM, FOREARM, throwingPole),
      otherArm: twoBoneIk(inFrame(frame, otherShoulder), lead, UPPER_ARM, FOREARM, otherPole),
      pointing: false,
      pointHeading: heading,
      pointTilt: bladeAngle,
    };
  }

  // Hangs until gripped, points while drawing, pulls in to the chest through the throw.
  const lift = Math.min(1, Math.max(0, raised));
  const tuck = Math.min(1, Math.max(0, swing));
  const shoulder = inFrame(frame, otherShoulder);
  const across = [
    release[0] + frame.forward[0] * POINT_DISTANCE - shoulder[0],
    release[1] + frame.forward[1] * POINT_DISTANCE - shoulder[1],
  ] as const;
  const level = Math.hypot(across[0], across[1]);
  const pointHeading = Math.atan2(across[1], across[0]);
  const pointTilt = Math.atan2(POINT_HEIGHT - shoulder[2], level) + loft;
  const pointAt = add(
    shoulder,
    [
      (across[0] / level) * Math.cos(pointTilt),
      (across[1] / level) * Math.cos(pointTilt),
      Math.sin(pointTilt),
    ],
    POINT_REACH,
  );
  const chest = inFrame(frame, [0.28, -0.05, SHOULDER_HEIGHT - 0.3]);
  const hanging = inFrame(frame, [0.14, -SHOULDER_HALF_WIDTH - 0.06, SHOULDER_HEIGHT - HANG_DROP]);
  const reaching = lerp3(hanging, pointAt, lift);

  return {
    figure,
    knifeAt,
    bladeAngle,
    throwingArm: twoBoneIk(inFrame(frame, throwingShoulder), gripAt, UPPER_ARM, FOREARM, throwingPole),
    otherArm: twoBoneIk(shoulder, lerp3(reaching, chest, tuck), UPPER_ARM, FOREARM, otherPole),
    pointing: lift > 0.5 && tuck < 0.5,
    pointHeading,
    pointTilt: lerp(lerp(HANGING_TILT, pointTilt, lift), -1.2, tuck),
  };
};

/**
 * Trunk, head and legs, in the body's frame.
 *
 * The feet stand in a thrower's stance and walk by swinging along the way the
 * body is moving, each lifting on its way forward; the legs are solved from the
 * hips down to them, knees bending forward. The chest leans back as the arm
 * draws and forward through the throw. The shoulders the arms hang from stay
 * where they are: the lean is small, and moving them would move the eye.
 */
const figureAt = (frame: BodyFrame, swing: number, stride: Stride): Figure => {
  const amount = Math.min(1, Math.max(0, stride.amount));
  const [f, r] = stride.along;
  const norm = Math.hypot(f, r) || 1;
  const along: Vec3 = [f / norm, r / norm, 0];
  const bob = 0.03 * amount * Math.abs(Math.cos(stride.phase));
  const hips = inFrame(frame, [0, 0, HIP_HEIGHT - bob]);

  const foot = (side: number, place: number, phase: number): Vec3 => {
    const swingOut = STRIDE_REACH * amount * Math.sin(phase);
    const lift = STRIDE_LIFT * amount * Math.max(0, Math.cos(phase));
    return inFrame(frame, [
      place + along[0] * swingOut,
      side * FOOT_HALF_SPREAD + along[1] * swingOut,
      ANKLE_HEIGHT + lift,
    ]);
  };
  const knees = add(frame.forward, [0, 0, 0.3]);
  const leg = (side: number, ankle: Vec3): Limb =>
    twoBoneIk(inFrame(frame, [0, side * HIP_HALF_WIDTH, HIP_HEIGHT - bob]), ankle, THIGH, SHIN, knees);

  const lean = THROW_LEAN * Math.max(-1, Math.min(1, swing));
  return {
    hips,
    neck: inFrame(frame, [lean, 0, NECK_HEIGHT]),
    head: inFrame(frame, [0.02, 0, HEAD_HEIGHT]),
    throwingLeg: leg(1, foot(1, TRAIL_FOOT, stride.phase + Math.PI)),
    otherLeg: leg(-1, foot(-1, LEAD_FOOT, stride.phase)),
  };
};

/**
 * The hand's place and the knife's tilt at `swing`, between the keyframes
 * either side of it. Loft raises the held and drawn poses; the release pose is
 * fixed by the flight and the follow-through does not need to show it.
 */
const keyframeAt = (swing: number, released: Keyframe, loft: number): Keyframe => {
  const lifted = ({ at, bladeAngle }: Keyframe): Keyframe => ({
    at: [at[0], at[1], at[2] + loft * (loft > 0 ? HAND_LIFT : HAND_DROP)],
    bladeAngle: bladeAngle + loft * BLADE_LIFT,
  });
  const between = (a: Keyframe, b: Keyframe, t: number): Keyframe => ({
    at: lerp3(a.at, b.at, t),
    bladeAngle: lerp(a.bladeAngle, b.bladeAngle, t),
  });
  const held = lifted(HELD);
  if (swing <= READY_SWING) {
    return between(held, lifted(DRAWN), Math.min(1, (READY_SWING - swing) / (1 + READY_SWING)));
  }
  if (swing <= 0) return between(released, held, swing / READY_SWING);
  return between(released, FOLLOWED, Math.min(1, swing));
};

/** How far past the grip the pointer comes up before the arm reaches the release pose. */
const LIFT = 0.1;

/**
 * Where the arm is in its swing for a given draw.
 *
 * Nothing drawn is the resting pose; a full draw is the arm all the way back.
 * Coming up past the grip without throwing lifts it to the release pose — the
 * arm follows the hand even when the hand decides not to throw.
 */
export const swingForDraw = (draw: number): number =>
  draw >= 0
    ? READY_SWING + (-1 - READY_SWING) * Math.min(1, draw)
    : READY_SWING * (1 - Math.min(1, -draw / LIFT));

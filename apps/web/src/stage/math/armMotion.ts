import { READY_SWING } from './bodyPose.js';

/** How briskly the arm answers the finger, and how briskly it follows through. */
const TRACKING_RATE = 20;
const FOLLOW_THROUGH_RATE = 11;
const RECOVERY_RATE = 5;

export type ArmMotion = {
  /** Where the arm is drawn this frame, -1 drawn back … 0 release … 1 followed through. */
  readonly shown: number;
  /** Coming back from a follow-through, which should look unhurried. */
  readonly recovering: boolean;
};

export const RESTING_ARM: ArmMotion = { shown: READY_SWING, recovering: false };

/**
 * Moves the drawn arm one frame towards where it should be.
 *
 * Eased rather than snapped, so a sparse stream of pointer events still draws a
 * smooth arm. Exponential easing — a fixed fraction of the remaining distance
 * per second — takes the same time on a slow device as a fast one, which a
 * fixed fraction per frame would not.
 *
 * Once released the arm swings through; afterwards it comes back slowly, since
 * that is a reset and not a throw. Everything else is the player's hand and must
 * be quick.
 */
export const stepArm = (
  motion: ArmMotion,
  target: number,
  released: boolean,
  seconds: number,
): ArmMotion => {
  const goal = released ? 1 : target;
  const recovering = released || (motion.recovering && Math.abs(motion.shown - goal) >= 0.02);
  const rate = released ? FOLLOW_THROUGH_RATE : recovering ? RECOVERY_RATE : TRACKING_RATE;
  return {
    shown: motion.shown + (goal - motion.shown) * (1 - Math.exp(-seconds * rate)),
    recovering,
  };
};

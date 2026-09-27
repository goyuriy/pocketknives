import { launchPitch, type ThrowConfig } from '@pocketknives/core';

/**
 * Looking up and down, for the ways of playing that have a free look: the
 * captured mouse and the gamepad's right stick.
 *
 * The eyes go anywhere from the feet to the sky, and the throw goes where they
 * look, as far as an arm can throw it: straight down at the most, a 45° lob
 * (`GestureTuning.maxPitch`) at the least. Look higher than that and the knife
 * is still thrown at the steepest lob.
 */

/**
 * How far up or down the eyes can look, radians: all but straight up and
 * straight down, where a camera loses track of which way is up.
 */
export const LOOK_LIMIT = (89 * Math.PI) / 180;

/** The eyes tilted by `down` radians (positive looks further down), within `LOOK_LIMIT`. */
export const tiltLook = (look: number, down: number): number =>
  Math.min(LOOK_LIMIT, Math.max(-LOOK_LIMIT, look - down));

/** The angle a knife is thrown at for eyes looking at `look`, radians above level. */
export const throwPitchFor = (look: number, config: ThrowConfig): number =>
  launchPitch({ aim: 0, pitch: look, draw: 0, drift: 0 }, config);

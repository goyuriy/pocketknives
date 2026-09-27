import { launchPitch, type ThrowConfig } from '@pocketknives/core';
import { LOOK_DOWN_LIMIT, LOOK_UP_LIMIT } from '../stage/math/cameraPose.js';

/**
 * Looking up and down, for the ways of playing that have a free look: the
 * captured mouse and the gamepad's right stick.
 *
 * The eyes go from 70° down to the sky (`LOOK_DOWN_LIMIT`, `LOOK_UP_LIMIT`),
 * and the throw goes where they look, as far as an arm can throw it: a 45° lob
 * (`GestureTuning.maxPitch`) at the highest — look higher and the knife is
 * still thrown at the lob — and straight down at the lowest. Straight down is
 * reached by looking 70° down, not 90° (see `throwPitchFor`).
 */

/** The eyes tilted by `down` radians (positive looks further down), within the limits. */
export const tiltLook = (look: number, down: number): number =>
  Math.min(LOOK_UP_LIMIT, Math.max(-LOOK_DOWN_LIMIT, look - down));

/**
 * Below this the throw steepens faster than the eyes, radians: 45° down.
 * Above it, the knife is thrown exactly where the eyes look.
 */
const STEEPENS_FROM = -Math.PI / 4;

/**
 * The angle a knife is thrown at for eyes looking at `look`, radians above
 * level.
 *
 * Where the eyes look and where the knife lands agree: looking 45° down or
 * higher, the throw goes the way the eyes do. Below that the throw steepens
 * faster, so that looking as far down as a head goes (70°) throws straight
 * down — and a knife thrown straight down from the outstretched hand lands
 * about 0.6 m ahead, which is where eyes 70° down are looking.
 */
export const throwPitchFor = (look: number, config: ThrowConfig): number => {
  const { minPitch } = config.gesture;
  const pitch =
    look >= STEEPENS_FROM
      ? look
      : STEEPENS_FROM + ((look - STEEPENS_FROM) * (minPitch - STEEPENS_FROM)) / (-LOOK_DOWN_LIMIT - STEEPENS_FROM);
  return launchPitch({ aim: 0, pitch, draw: 0, drift: 0 }, config);
};

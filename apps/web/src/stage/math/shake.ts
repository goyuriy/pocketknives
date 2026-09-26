import type { Vec3 } from '@pocketknives/core';

/** How long a shake lasts, in seconds. Short: a jolt, not an earthquake. */
export const SHAKE_DURATION = 0.35;

/**
 * How far to knock the camera off its pose `t` seconds after an impact, in
 * world units.
 *
 * Three sines at unrelated rates make a jitter that never repeats within the
 * shake, and a squared fall-off gives the jolt a hard start and a soft finish.
 * A function of time, not a random number per frame, so it looks the same at
 * any frame rate.
 */
export const shakeOffset = (t: number, amplitude: number): Vec3 => {
  if (t < 0 || t >= SHAKE_DURATION || amplitude <= 0) return [0, 0, 0];
  const fade = Math.pow(1 - t / SHAKE_DURATION, 2) * amplitude;
  return [fade * Math.sin(t * 71), fade * Math.sin(t * 53 + 1.3), fade * Math.sin(t * 61 + 2.1)];
};

/** How hard an impact shakes the camera, from its feel. Sticks land hardest; a tap barely registers. */
export const shakeAmplitude = (kind: 'stick' | 'clatter' | 'tap', strength: number): number =>
  kind === 'stick' ? 0.03 + 0.09 * strength : kind === 'clatter' ? 0.02 + 0.03 * strength : 0;

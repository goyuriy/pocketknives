import type { Vec3 } from '@pocketknives/core';

/**
 * How long a shake lasts, in seconds. Short for a light knife — a tick — and
 * longer for a heavy one, which the ground takes a moment to stop feeling.
 */
export const shakeDuration = (weight: number): number => 0.2 + 0.35 * weight;

/**
 * How far to knock the camera off its pose `t` seconds after an impact, in
 * world units.
 *
 * Three sines at unrelated rates make a jitter that never repeats within the
 * shake, and a squared fall-off gives the jolt a hard start and a soft finish.
 * A function of time, not a random number per frame, so it looks the same at
 * any frame rate.
 */
export const shakeOffset = (t: number, amplitude: number, duration: number): Vec3 => {
  if (t < 0 || t >= duration || amplitude <= 0) return [0, 0, 0];
  const fade = Math.pow(1 - t / duration, 2) * amplitude;
  return [fade * Math.sin(t * 71), fade * Math.sin(t * 53 + 1.3), fade * Math.sin(t * 61 + 2.1)];
};

/**
 * How hard an impact shakes the camera, in world units.
 *
 * Weight squared, so the scale is steep at the top: a needle only ticks the
 * view, a cleaver knocks it, a greatsword slams it. Pace shades it, and a knife
 * that bounced off shakes less than one that went in — its weight went into
 * skidding, not into the ground. A dropped knife does not shake anything.
 */
export const shakeAmplitude = (kind: 'stick' | 'clatter' | 'tap', weight: number, pace: number): number => {
  if (kind === 'tap') return 0;
  const jolt = 0.015 + 0.17 * weight * weight * (0.5 + 0.5 * pace);
  return kind === 'stick' ? jolt : jolt * 0.45;
};

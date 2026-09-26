import { seededRandom, type Vec3 } from '@pocketknives/core';

/** One puff of dirt kicked up by an impact. */
export type Puff = {
  /** Initial horizontal velocity, units per second. */
  readonly drift: readonly [number, number];
  /** Initial upward velocity. */
  readonly rise: number;
  /** Starting radius. */
  readonly size: number;
  /** Seconds until it has faded away. */
  readonly life: number;
};

export type PuffState = {
  readonly position: Vec3;
  readonly radius: number;
  /** 0 invisible, 1 solid. */
  readonly opacity: number;
};

/** Air drag on a puff, per second: dust flies out fast and stops short. */
const DRAG = 4;

/** The most puffs any impact throws up — a greatsword thrown flat out. */
export const MOST_PUFFS = 26;

/** How many puffs an impact throws up: set by the knife's weight, shaded by its pace. */
export const puffCount = (weight: number, pace: number): number =>
  Math.round(4 + (MOST_PUFFS - 4) * weight * (0.4 + 0.6 * pace));

/**
 * The puffs an impact throws up, sprayed mostly forward along the throw — the
 * knife carries the dirt with it.
 *
 * Weight is what shows: a heavy knife throws up many big, slow-hanging clods,
 * a light one a few small wisps. Pace only shades it — throws faster, a few
 * more. Seeded, so the same throw always kicks up the same dust.
 */
export const dustPuffs = (heading: number, weight: number, pace: number, seed: number): Puff[] => {
  const next = seededRandom(seed);
  const push = 0.5 + 0.6 * pace + 0.4 * weight;
  return Array.from({ length: puffCount(weight, pace) }, () => {
    // Forward-biased fan: most puffs within ±70° of the heading.
    const angle = heading + (next() + next() - 1) * 1.2;
    const speed = (0.8 + 2.2 * next()) * push;
    return {
      drift: [Math.cos(angle) * speed, Math.sin(angle) * speed] as const,
      rise: (0.4 + 1.1 * next()) * push,
      size: (0.06 + 0.1 * next()) * (0.6 + 1.2 * weight),
      life: 0.5 + 0.5 * next() + 0.4 * weight,
    };
  });
};

/**
 * Where a puff is `t` seconds after the impact, or null once it has gone.
 *
 * It flies out and slows under drag, drifts up, swells and thins as it goes —
 * the way a scuff of dry dirt hangs for a moment and disappears.
 */
export const puffAt = (puff: Puff, origin: Vec3, t: number): PuffState | null => {
  if (t < 0 || t >= puff.life) return null;
  const u = t / puff.life;
  const travelled = (1 - Math.exp(-DRAG * t)) / DRAG;
  return {
    position: [
      origin[0] + puff.drift[0] * travelled,
      origin[1] + puff.drift[1] * travelled,
      origin[2] + puff.rise * travelled + 0.1 * t,
    ],
    radius: puff.size * (1 + 2.5 * u),
    opacity: 0.6 * Math.pow(1 - u, 1.5),
  };
};

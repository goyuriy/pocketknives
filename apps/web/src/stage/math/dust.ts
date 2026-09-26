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

/**
 * The puffs an impact throws up, sprayed mostly forward along the throw — the
 * knife carries the dirt with it — and more of them, bigger and faster, the
 * harder it hit. Seeded, so the same throw always kicks up the same dust.
 */
export const dustPuffs = (heading: number, strength: number, seed: number): Puff[] => {
  const next = seededRandom(seed);
  const count = Math.round(6 + 10 * strength);
  return Array.from({ length: count }, () => {
    // Forward-biased fan: most puffs within ±70° of the heading.
    const angle = heading + (next() + next() - 1) * 1.2;
    const speed = (0.8 + 2.2 * next()) * (0.5 + strength);
    return {
      drift: [Math.cos(angle) * speed, Math.sin(angle) * speed] as const,
      rise: (0.4 + 1.1 * next()) * (0.5 + strength),
      size: 0.08 + 0.12 * next() * (0.6 + strength),
      life: 0.55 + 0.6 * next(),
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

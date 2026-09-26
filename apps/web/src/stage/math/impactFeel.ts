import type { Impact, KnifeSpec, StickVerdict } from '@pocketknives/core';

/**
 * How an impact should *feel*, boiled down to what every effect needs.
 *
 * - **stick** — the point went in: a thunk, a spray of dirt, a quiver.
 * - **clatter** — it arrived on its flat or its handle and bounced.
 * - **tap** — it arrived with no pace left and just dropped.
 *
 * `weight` is how heavy the knife is, and it is what the eye should read first:
 * a greatsword coming down should shake the world and throw up dirt, a needle
 * should barely scuff it, whatever the pace. `pace` is how fast it arrived, and
 * only shades that. `strength` is the two together — momentum — for the effects
 * that are about how hard this particular impact was: the sound, the quiver,
 * the bounce. `clean` is how well a stick went in: a clean one rings, a
 * scrappy one shudders.
 */
export type ImpactFeel = {
  readonly kind: 'stick' | 'clatter' | 'tap';
  /** 0 the lightest knife in the game, 1 the heaviest. */
  readonly weight: number;
  /** 0 dropped, 1 as fast as anything in the game arrives. */
  readonly pace: number;
  /** Momentum: 0 barely touched down, 1 as hard as anything in the game lands. */
  readonly strength: number;
  /** How cleanly a stick went in, 0 to 1. Zero for anything that did not stick. */
  readonly clean: number;
};

/** Momentum that counts as a full-strength impact: a greatsword thrown hard, roughly. */
const FULL_MOMENTUM = 8;
/** The lightest and heaviest a knife can be, for placing a knife's weight between them. */
const LIGHTEST = 0.08;
const HEAVIEST = 0.9;
/** Impact speed that counts as full pace. */
const FULL_PACE = 28;

const clamp01 = (value: number): number => Math.min(1, Math.max(0, value));

/**
 * How heavy a knife is, 0 to 1, on a log scale.
 *
 * Log, because the knives span more than tenfold in mass and a straight line
 * would squash every knife but the sword into the bottom tenth — the needle and
 * the thrower would land alike. On a log scale each step up in the rack reads
 * as a step up in the dirt.
 */
export const knifeWeight = (mass: number): number =>
  clamp01(Math.log(Math.max(mass, LIGHTEST) / LIGHTEST) / Math.log(HEAVIEST / LIGHTEST));

export const impactFeel = (verdict: StickVerdict, impact: Impact, knife: KnifeSpec): ImpactFeel => {
  const weight = knifeWeight(knife.mass);
  const pace = clamp01(impact.speed / FULL_PACE);
  const strength = clamp01((knife.mass * impact.speed) / FULL_MOMENTUM);
  if (verdict.stuck) return { kind: 'stick', weight, pace, strength, clean: verdict.quality };
  return { kind: verdict.outcome === 'too_slow' ? 'tap' : 'clatter', weight, pace, strength, clean: 0 };
};

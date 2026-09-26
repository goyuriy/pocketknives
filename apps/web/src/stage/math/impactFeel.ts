import type { Impact, KnifeSpec, StickVerdict } from '@pocketknives/core';

/**
 * How an impact should *feel*, boiled down to what every effect needs.
 *
 * - **stick** — the point went in: a thunk, a spray of dirt, a quiver.
 * - **clatter** — it arrived on its flat or its handle and bounced.
 * - **tap** — it arrived with no pace left and just dropped.
 *
 * `strength` is the impact's momentum against a hard throw of a heavy knife,
 * so the same throw lands harder with a cleaver than a needle. `clean` is how
 * well a stick went in: a clean one rings, a scrappy one shudders.
 */
export type ImpactFeel = {
  readonly kind: 'stick' | 'clatter' | 'tap';
  /** 0 barely touched down, 1 as hard as anything in the game lands. */
  readonly strength: number;
  /** How cleanly a stick went in, 0 to 1. Zero for anything that did not stick. */
  readonly clean: number;
};

/** Momentum that counts as a full-strength impact: a greatsword thrown hard, roughly. */
const FULL_MOMENTUM = 8;

export const impactFeel = (verdict: StickVerdict, impact: Impact, knife: KnifeSpec): ImpactFeel => {
  const strength = Math.min(1, (knife.mass * impact.speed) / FULL_MOMENTUM);
  if (verdict.stuck) return { kind: 'stick', strength, clean: verdict.quality };
  return { kind: verdict.outcome === 'too_slow' ? 'tap' : 'clatter', strength, clean: 0 };
};

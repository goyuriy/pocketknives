import type { ImpactFeel } from '../stage/math/impactFeel.js';

/** A low thump that drops in pitch: the body of the sound, the knife's weight arriving. */
export type Thump = { readonly from: number; readonly to: number; readonly gain: number; readonly seconds: number };
/** A burst of filtered noise: dirt giving way, or steel skittering. */
export type Noise = {
  readonly at: number;
  readonly centre: number;
  readonly width: number;
  readonly gain: number;
  readonly seconds: number;
};
/** A decaying tone: the blade ringing in the ground. */
export type Ring = { readonly frequency: number; readonly gain: number; readonly seconds: number };

/** Everything that sounds when a knife lands, as numbers — nothing here touches the speakers. */
export type Voice = {
  readonly thump: Thump | null;
  readonly noises: readonly Noise[];
  readonly ring: Ring | null;
};

/**
 * What an impact sounds like.
 *
 * Synthesised rather than recorded: three simple layers, each driven by the
 * impact's feel, so every landing is a little different and nothing has to be
 * downloaded.
 *
 * - A **stick** is a thunk — a thump that drops in pitch, heavier knives
 *   lower — with a crunch of dirt, and the blade ringing on. A clean stick rings
 *   true; a scrappy one barely rings at all.
 * - A **clatter** is steel on ground: a few bright skitters, one per bounce,
 *   each quieter than the last.
 * - A **tap** is a knife with nothing left, dropping: one soft, dull knock.
 */
export const impactVoice = ({ kind, strength, clean }: ImpactFeel): Voice => {
  if (kind === 'stick') {
    return {
      thump: { from: 150 - 50 * strength, to: 55, gain: 0.35 + 0.5 * strength, seconds: 0.16 },
      noises: [{ at: 0, centre: 700, width: 1.2, gain: 0.25 + 0.35 * strength, seconds: 0.07 }],
      ring: clean > 0.3 ? { frequency: 480 + 220 * clean, gain: 0.05 + 0.1 * clean, seconds: 0.45 } : null,
    };
  }
  if (kind === 'clatter') {
    const bounces = [0, 0.14, 0.26];
    return {
      thump: { from: 110, to: 70, gain: 0.15 + 0.2 * strength, seconds: 0.08 },
      noises: bounces.map((at, i) => ({
        at,
        centre: 3200 - 400 * i,
        width: 3,
        gain: (0.3 + 0.3 * strength) * Math.pow(0.55, i),
        seconds: 0.05,
      })),
      ring: null,
    };
  }
  return {
    thump: { from: 90, to: 60, gain: 0.12, seconds: 0.07 },
    noises: [{ at: 0, centre: 500, width: 1, gain: 0.08, seconds: 0.04 }],
    ring: null,
  };
};

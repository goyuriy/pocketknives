import type { KnifeSpec, Vec2 } from '@pocketknives/core';

/** A blade this long is a sword, and a sword has a guard and the width to carry it. */
const SWORD_LENGTH = 0.8;

export type Part = {
  /** Convex, counter-clockwise, in the knife's tumble plane: `u` along the knife, `v` across. */
  readonly outline: readonly Vec2[];
  readonly thickness: number;
};

export type KnifeShape = {
  readonly blade: Part;
  readonly handle: Part;
  readonly guard: Part | null;
};

/**
 * A knife's silhouette, built around its balance point.
 *
 * The flight tracks the balance point and the knife visibly turns about it, so
 * that is the origin; the tip points along `+u`. Everything comes from the spec,
 * so the knife a player picks is the knife they see.
 */
export const knifeShape = ({ bladeLength, handleLength, balance, edgeWidth }: KnifeSpec): KnifeShape => {
  const tip = (1 - balance) * (bladeLength + handleLength);
  const butt = tip - (bladeLength + handleLength);
  const shoulder = tip - bladeLength;
  const isSword = bladeLength >= SWORD_LENGTH;
  const halfWidth = isSword ? 0.085 : 0.055;
  const taper = tip - bladeLength * 0.3;

  return {
    blade: {
      outline: [
        [shoulder, -halfWidth],
        [taper, -halfWidth * 0.9],
        [tip, 0],
        [taper, halfWidth * 0.9],
        [shoulder, halfWidth],
      ],
      thickness: Math.max(edgeWidth, 0.006),
    },
    handle: {
      outline: [
        [butt, -0.045],
        [shoulder + 0.02, -0.062],
        [shoulder + 0.02, 0.062],
        [butt, 0.045],
      ],
      thickness: 0.05,
    },
    guard: isSword
      ? {
          outline: [
            [shoulder - 0.025, -0.21],
            [shoulder + 0.025, -0.21],
            [shoulder + 0.025, 0.21],
            [shoulder - 0.025, 0.21],
          ],
          thickness: 0.07,
        }
      : null,
  };
};

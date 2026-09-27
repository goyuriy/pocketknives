import type { KnifeSpec, Vec2 } from '@pocketknives/core';

/** A blade this long is a sword, and a sword has a guard and the width to carry it. */
const SWORD_LENGTH = 0.27;

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
  // Real widths, in metres: a knife's blade about 3.5 cm across, a sword's 5.5.
  const halfWidth = isSword ? 0.028 : 0.018;
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
      thickness: Math.max(edgeWidth, 0.003),
    },
    handle: {
      outline: [
        [butt, -0.013],
        [shoulder + 0.007, -0.017],
        [shoulder + 0.007, 0.017],
        [butt, 0.013],
      ],
      // A handle a hand closes round: about 3 cm deep and 2 cm thick.
      thickness: 0.02,
    },
    guard: isSword
      ? {
          outline: [
            [shoulder - 0.008, -0.07],
            [shoulder + 0.008, -0.07],
            [shoulder + 0.008, 0.07],
            [shoulder - 0.008, 0.07],
          ],
          thickness: 0.022,
        }
      : null,
  };
};

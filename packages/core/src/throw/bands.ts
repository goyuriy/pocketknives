import type { Vec2 } from '../types.js';
import { simulateFlight } from './flight.js';
import { DEFAULT_CONFIG, type ThrowConfig } from './config.js';
import { aimedLaunch } from './launch.js';
import { stickVerdict } from './stick.js';

/** A stretch of the power range, from 0 to 1, that lands the knife blade-first. */
export type PowerBand = {
  readonly from: number;
  readonly to: number;
};

/**
 * Finds the powers at which the knife arrives blade-first.
 *
 * Sampled rather than solved: the tumble angle and the flight time are both
 * closed-form, but the condition couples them through a wrapped angle, and a
 * sweep is clearer than the algebra and fast enough to run whenever the throw is
 * retuned.
 *
 * Swept with scatter switched off, so these are the bands for a perfectly
 * obedient knife. With scatter on they are where a throw is *likely* to stick
 * rather than where it certainly will, and the wider the scatter the softer
 * their edges.
 *
 * Two uses, pulling in opposite directions. As a tuning instrument this is how
 * you check a change left the game playable — bands too narrow and it is
 * frustrating, too wide and there is no skill in it. As something shown to a
 * player it is a strong hint, and whether the real game reveals it is a design
 * decision, not a technical one.
 */
export const stickingBands = (
  from: Vec2,
  heading: number,
  config: ThrowConfig = DEFAULT_CONFIG,
  steps = 240,
): PowerBand[] => {
  const bands: PowerBand[] = [];
  let openedAt: number | null = null;

  for (let step = 0; step <= steps; step++) {
    const power = step / steps;
    const flight = simulateFlight(aimedLaunch(from, heading, power, config), config.flight);
    const sticks = stickVerdict(flight.impact, config).stuck;

    if (sticks && openedAt === null) openedAt = power;
    if (!sticks && openedAt !== null) {
      bands.push({ from: openedAt, to: power });
      openedAt = null;
    }
  }
  if (openedAt !== null) bands.push({ from: openedAt, to: 1 });

  return bands;
};

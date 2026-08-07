import type { Throw } from '../types.js';
import type { Impact, StickVerdict } from './types.js';
import {
  DEFAULT_CONFIG,
  biteDepth,
  minStickSpeed,
  stickWindow,
  type ThrowConfig,
} from './config.js';

/**
 * Did it stick?
 *
 * One question decides it: was the blade pointing the way it was travelling?
 * A knife that arrives along its own path drives the point in. One that arrives
 * across its path lands on its flat and skips away, and no amount of force
 * changes that — throwing harder only makes it bounce further.
 *
 * Both thresholds come from the knife itself. A longer blade reaches the ground
 * over a wider range of angles and so forgives more; a heavier one needs less
 * speed to bury its point. Neither is a free-floating constant, which is what
 * makes the physical parameters worth tuning.
 */
export const stickVerdict = (
  impact: Impact,
  config: ThrowConfig = DEFAULT_CONFIG,
): StickVerdict => {
  const window = stickWindow(config);
  if (impact.speed < minStickSpeed(config)) return { stuck: false, quality: 0, depth: 0 };
  if (impact.misalignment >= window) return { stuck: false, quality: 0, depth: 0 };

  return {
    stuck: true,
    // 1 for a knife driving in exactly along its path, tapering to 0 where it
    // would have skipped.
    quality: 1 - impact.misalignment / window,
    depth: biteDepth(config, impact.speed),
  };
};

/**
 * The landed knife, as the rules see it.
 *
 * This is the seam between the two halves of the game. Everything about the
 * flight — arc, tumble, speed, scatter — collapses here into the only two things
 * the territory rules ever needed: where the point went in, and which way the
 * blade lies. The cut runs along the line it was thrown along, because a
 * tumbling knife turns within the plane of its own flight and comes to rest in
 * it.
 */
export const throwFromImpact = (impact: Impact): Throw => ({
  point: impact.point,
  direction: [Math.cos(impact.heading), Math.sin(impact.heading)],
});

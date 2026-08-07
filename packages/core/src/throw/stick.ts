import type { Throw } from '../types.js';
import type { Impact, StickOutcome, StickVerdict } from './types.js';
import {
  DEFAULT_CONFIG,
  biteDepth,
  minStickSpeed,
  stickWindow,
  type ThrowConfig,
} from './config.js';

const failed = (outcome: StickOutcome): StickVerdict => ({
  stuck: false,
  outcome,
  quality: 0,
  depth: 0,
});

/**
 * Did it stick?
 *
 * Three things have to be true, and they are genuinely different questions:
 *
 * 1. **Is the point the lowest part of the knife?** If the blade is tipped up,
 *    the butt of the handle is lower and strikes first, and a knife that lands
 *    on its handle has not stuck no matter how it was travelling.
 * 2. **Is it travelling the way it points?** A knife that arrives along its own
 *    path drives the point in. One that arrives across its path lands on its
 *    flat and skips, and throwing harder only makes it skip further.
 * 3. **Has it enough left to bury the point?**
 *
 * The first two are easy to conflate and must not be. A knife can be perfectly
 * aligned with its descending path and still have its tip above horizontal —
 * that happens whenever the path is steeper than the knife — and checking only
 * the alignment reports a handle-first landing as a clean stick.
 *
 * Both thresholds come from the knife itself: a longer blade reaches the ground
 * over a wider range of angles, a heavier one needs less speed to bury.
 */
export const stickVerdict = (
  impact: Impact,
  config: ThrowConfig = DEFAULT_CONFIG,
): StickVerdict => {
  if (impact.entryAngle <= config.stick.minEntryAngle) return failed('handle_first');
  if (impact.misalignment >= stickWindow(config)) return failed('flat');
  if (impact.speed < minStickSpeed(config)) return failed('too_slow');

  return {
    stuck: true,
    outcome: 'stuck',
    // 1 for a knife driving in exactly along its path, tapering to 0 where it
    // would have skipped.
    quality: 1 - impact.misalignment / stickWindow(config),
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

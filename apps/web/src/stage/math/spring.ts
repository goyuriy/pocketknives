/**
 * A damped spring: a value that chases a target the way a hand on a relaxed
 * arm chases where the eyes turned — it trails, overshoots a touch, and
 * settles.
 *
 * First-person games put the lag on the hands, never on the view: the view
 * has to follow the mouse exactly or aiming feels floaty, and a hand that
 * trails behind the turn is what makes the arm feel like it has weight.
 */
export type Spring = { readonly value: number; readonly velocity: number };

export type SpringTuning = {
  /** How briskly it chases, in cycles per second. */
  readonly frequency: number;
  /** 1 settles without overshooting; lower overshoots, then settles. */
  readonly damping: number;
};

/** The longest step taken at once. Longer frames are split, so a slow frame cannot fling the spring. */
const LONGEST_STEP = 1 / 120;

/** A spring at rest on `value`. */
export const springAt = (value: number): Spring => ({ value, velocity: 0 });

/** The spring after `seconds` of chasing `target`. Pure. */
export const stepSpring = (spring: Spring, target: number, seconds: number, { frequency, damping }: SpringTuning): Spring => {
  const omega = 2 * Math.PI * frequency;
  let { value, velocity } = spring;
  let left = Math.max(0, seconds);
  while (left > 0) {
    const dt = Math.min(LONGEST_STEP, left);
    velocity += (-2 * damping * omega * velocity - omega * omega * (value - target)) * dt;
    value += velocity * dt;
    left -= dt;
  }
  return { value, velocity };
};

/**
 * The same, for a heading: chases the target the short way round, so a turn
 * through due west does not send the hand spinning the long way.
 */
export const stepHeadingSpring = (spring: Spring, target: number, seconds: number, tuning: SpringTuning): Spring => {
  const gap = Math.atan2(Math.sin(target - spring.value), Math.cos(target - spring.value));
  return stepSpring(spring, spring.value + gap, seconds, tuning);
};

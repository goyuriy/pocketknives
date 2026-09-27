/**
 * Camera shake on impact, the trauma way (Squirrel Eiserloh, "Juicing Your
 * Cameras With Math", GDC 2016).
 *
 * An impact adds *trauma*, 0 to 1, which wears off steadily. The shake is
 * trauma squared, so a light knife barely ticks the view and a heavy one
 * slams it — and two impacts close together add up rather than restart. The
 * camera is turned, never moved: a knock to the position reads as the world
 * jumping, a small turn as the head taking the blow. The turn follows smooth
 * noise, not a fresh random number every frame, so it shakes the same at any
 * frame rate.
 */

/** Yaw, pitch and roll to turn the camera by, radians. */
export type ShakeAngles = readonly [yaw: number, pitch: number, roll: number];

export const STILL: ShakeAngles = [0, 0, 0];

/** How much trauma wears off per second: a full slam is gone in about 0.7 s. */
const TRAUMA_DECAY = 1.4;
/** The furthest a full shake turns the view, radians: about 3° across and up, 2.5° of roll. */
const MOST_TURN: ShakeAngles = [0.055, 0.055, 0.045];
/** How fast the shake wanders, in noise cells per second. */
const SHAKE_RATE = 16;

/**
 * How much trauma an impact adds. Weight squared, so the scale is steep at the
 * top: a needle only ticks the view, a greatsword slams it. Pace shades it,
 * and a knife that bounced off adds less than one that went in — its weight
 * went into skidding, not into the ground. A dropped knife adds none.
 */
export const impactTrauma = (kind: 'stick' | 'clatter' | 'tap', weight: number, pace: number): number => {
  if (kind === 'tap') return 0;
  const blow = 0.2 + 0.7 * weight * weight * (0.5 + 0.5 * pace);
  return kind === 'stick' ? blow : blow * 0.45;
};

export const addTrauma = (trauma: number, amount: number): number => Math.min(1, trauma + Math.max(0, amount));

export const decayTrauma = (trauma: number, seconds: number): number => Math.max(0, trauma - TRAUMA_DECAY * seconds);

/** A repeatable pseudo-random number in [0, 1) for a whole number. */
const hash = (n: number): number => {
  const s = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return s - Math.floor(s);
};

/** Smooth noise in [-1, 1]: random at whole numbers, eased between them. */
export const smoothNoise = (x: number): number => {
  const cell = Math.floor(x);
  const t = x - cell;
  const eased = t * t * (3 - 2 * t);
  const a = hash(cell);
  return (a + (hash(cell + 1) - a) * eased) * 2 - 1;
};

/** How far to turn the camera `t` seconds into the world's clock, for this much trauma. */
export const shakeAngles = (trauma: number, t: number): ShakeAngles => {
  const shake = trauma * trauma;
  if (shake <= 0) return STILL;
  const x = t * SHAKE_RATE;
  return [
    MOST_TURN[0] * shake * smoothNoise(x),
    MOST_TURN[1] * shake * smoothNoise(x + 101.3),
    MOST_TURN[2] * shake * smoothNoise(x + 211.7),
  ];
};

/**
 * How long the world holds still at the moment of impact, seconds — the
 * *hitstop* fighting games use to make a blow land. A few frames: longer for
 * a heavier knife, none for one that was only dropped.
 */
export const hitstopFor = (kind: 'stick' | 'clatter' | 'tap', weight: number): number =>
  kind === 'tap' ? 0 : (kind === 'stick' ? 0.035 : 0.02) + 0.055 * weight;

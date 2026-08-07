import type { FlightTuning } from './types.js';

/**
 * Every number that decides how a throw behaves, in one place.
 *
 * This is the tuning surface for the whole mechanic. Nothing here is decorative:
 * each field feeds a derived quantity below, so changing the knife's mass or
 * length really does change how it tumbles, how forgiving the stick is, and how
 * deep it buries. That matters because the alternative — physical-sounding
 * fields that quietly do nothing — makes a tuning session a guessing game.
 *
 * The derived values are the ones the flight actually uses. Read them through
 * the helpers rather than duplicating the arithmetic, so there is exactly one
 * definition of how a heavier knife behaves.
 */

/** A knife, as a physical object. Lengths in arena units, mass in arbitrary but consistent units. */
export type KnifeSpec = {
  readonly bladeLength: number;
  readonly handleLength: number;
  readonly mass: number;
  /**
   * Where the balance point sits along the whole knife, 0 at the butt and 1 at
   * the tip. A tip-heavy knife rotates about a point nearer the blade, which
   * changes what "arriving blade-first" looks like.
   */
  readonly balance: number;
  /** How narrow the edge is. A finer edge bites at lower speed. */
  readonly edgeWidth: number;
};

/** How the player throws — fixed per player, not per throw. */
export type ThrowStyle = {
  /** Launch angle above the horizontal, radians. */
  readonly pitch: number;
  /** How high above the ground the knife leaves the hand. */
  readonly releaseHeight: number;
  /**
   * Angular impulse imparted at release.
   *
   * Not a spin rate: the same flick of the wrist spins a light knife faster than
   * a heavy one, so this is the input and the rate is derived through the
   * knife's moment of inertia.
   */
  readonly spinImpulse: number;
  /** Where in its tumble the knife starts. Zero points along the throw. */
  readonly startingBladeAngle: number;
  readonly minSpeed: number;
  readonly maxSpeed: number;
};

/**
 * How much a throw wanders from what was aimed.
 *
 * All of it is seeded — see `scatterLaunch`. Randomness that cannot be replayed
 * would make a throw impossible to verify on a server or show back in a replay,
 * so nothing here reaches for a global random source.
 *
 * Set every field to zero for a perfectly obedient knife, which is the right
 * setting while tuning everything else.
 */
export type Scatter = {
  /** Spread in release spin, radians per second. */
  readonly spin: number;
  /** Spread in aim, radians. */
  readonly heading: number;
  /** Spread in power, as a fraction of the full range. */
  readonly power: number;
  /** Spread in the starting blade angle, radians. */
  readonly startingBladeAngle: number;
};

export type StickTuning = {
  /**
   * How far off its path the blade may be and still bite, for a knife of
   * `referenceBladeLength`. Longer blades get a proportionally wider window.
   */
  readonly baseMisalignment: number;
  readonly referenceBladeLength: number;
  /** Momentum needed to bury the point at all, before the edge helps. */
  readonly minMomentum: number;
  /** How hard the ground is. Higher means shallower bites. */
  readonly soilResistance: number;
};

export type ThrowConfig = {
  readonly knife: KnifeSpec;
  readonly style: ThrowStyle;
  readonly scatter: Scatter;
  readonly stick: StickTuning;
  readonly flight: FlightTuning;
};

export const DEFAULT_CONFIG: ThrowConfig = {
  knife: {
    bladeLength: 0.42,
    handleLength: 0.48,
    mass: 0.2,
    balance: 0.5,
    edgeWidth: 0.03,
  },
  style: {
    pitch: 0.35,
    releaseHeight: 1.4,
    // Chosen to give a 24 rad/s tumble with the default knife — the rate the
    // sticking bands were swept against.
    spinImpulse: 0.324,
    startingBladeAngle: 0,
    minSpeed: 7,
    maxSpeed: 26,
  },
  scatter: {
    spin: 0,
    heading: 0,
    power: 0,
    startingBladeAngle: 0,
  },
  stick: {
    baseMisalignment: Math.PI / 5,
    referenceBladeLength: 0.42,
    minMomentum: 1.2,
    soilResistance: 14,
  },
  flight: {
    gravity: 24,
    sampleInterval: 1 / 120,
  },
};

// ---------------------------------------------------------------------------
// Derived quantities. The flight reads these, never the raw fields.
// ---------------------------------------------------------------------------

export const knifeLength = (knife: KnifeSpec): number => knife.bladeLength + knife.handleLength;

/**
 * Resistance to being spun, as a thin rod about its balance point.
 *
 * `mL²/12` is the rod about its centre; the parallel-axis term adds what moving
 * the balance point off centre costs. This is why a long knife is hard to make
 * tumble quickly and a short one whips round.
 */
export const momentOfInertia = (knife: KnifeSpec): number => {
  const length = knifeLength(knife);
  const offset = (knife.balance - 0.5) * length;
  return knife.mass * ((length * length) / 12 + offset * offset);
};

/** Tumble rate the knife actually leaves the hand with. */
export const spinRate = (config: ThrowConfig): number =>
  config.style.spinImpulse / momentOfInertia(config.knife);

/**
 * How far off its path the blade may be and still stick.
 *
 * Scales with blade length: a longer point leads further ahead of the knife's
 * centre, so it reaches the ground first over a wider range of angles. This is
 * the main reason a bigger knife feels more forgiving.
 */
export const stickWindow = (config: ThrowConfig): number =>
  config.stick.baseMisalignment *
  (config.knife.bladeLength / config.stick.referenceBladeLength);

/** Impact speed below which the point will not bury, whatever the angle. */
export const minStickSpeed = (config: ThrowConfig): number =>
  config.stick.minMomentum / Math.max(config.knife.mass, 1e-6);

/**
 * How deep the point goes, in arena units, capped at the blade's length.
 *
 * Momentum drives it in and a narrow edge concentrates that momentum, so a
 * heavy knife with a fine edge buries itself and a light blunt one stands proud.
 */
export const biteDepth = (config: ThrowConfig, impactSpeed: number): number => {
  const drive = (config.knife.mass * impactSpeed) / config.stick.soilResistance;
  const edgeFactor = config.stick.referenceBladeLength / Math.max(config.knife.edgeWidth, 1e-6) / 14;
  return Math.min(config.knife.bladeLength, Math.max(0, drive * edgeFactor));
};

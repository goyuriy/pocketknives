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
  /**
   * Launch angle above the horizontal, radians, when nobody chooses one — the
   * hand's resting angle, and the angle raw `aimedLaunch` throws at.
   */
  readonly pitch: number;
  /** How high above the ground the knife leaves the hand. */
  readonly releaseHeight: number;
  /**
   * Angular impulse a relaxed wrist imparts at release.
   *
   * Not a spin rate: the same wrist spins a light knife faster than a heavy one,
   * so this is the input and the rate is derived through the knife's moment of
   * inertia. Nobody sets the spin of a throw directly — the wrist picks the
   * sticking tumble nearest this natural one — so this decides how many turns a
   * knife makes on its way, and so how it looks in the air.
   */
  readonly spinImpulse: number;
  /** Where in its tumble the knife starts. Zero points along the throw. */
  readonly startingBladeAngle: number;
  /** Launch speed of the gentlest and hardest throw, for a knife of `referenceMass`. */
  readonly minSpeed: number;
  readonly maxSpeed: number;
  /** The weight the speed range above is for. */
  readonly referenceMass: number;
  /**
   * How much a heavier knife holds the arm back: launch speed scales as
   * `(referenceMass / mass) ^ weightPenalty`. Zero ignores weight altogether;
   * one half would be an arm putting the same energy into everything.
   */
  readonly weightPenalty: number;
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
  /**
   * How far below horizontal the blade must point for the tip to be the part
   * that arrives. At or under this the butt of the handle is the lowest point
   * and the knife lands on its handle.
   */
  readonly minEntryAngle: number;
  /** Momentum needed to bury the point at all, before the edge helps. */
  readonly minMomentum: number;
  /** How hard the ground is. Higher means shallower bites. */
  readonly soilResistance: number;
};

/**
 * How a hand's motion is read as a throw.
 *
 * In screen-heights and radians rather than pixels, so the same motion of the
 * same hand reads the same on a laptop, a monitor and a phone.
 */
export type GestureTuning = {
  /** How far the pointer is pulled back, in screen-heights, to draw the arm all the way. */
  readonly fullDraw: number;
  /** Least draw that counts as a throw — below it the push is just letting go. */
  readonly minDraw: number;
  /** Slowest push, screen-heights per second, that still throws rather than eases off. */
  readonly minPushSpeed: number;
  /** Push speed, screen-heights per second, that whips the knife round as hard as it goes. */
  readonly fullWhip: number;
  /** How far either side the hand can point, radians, from edge of the screen to edge. */
  readonly maxAim: number;
  /** How much of the push's sideways drift ends up in the knife's line. */
  readonly driftGain: number;
  /** The flattest and steepest the hand can throw, radians above level. */
  readonly minPitch: number;
  readonly maxPitch: number;
};

export type ThrowConfig = {
  readonly knife: KnifeSpec;
  readonly gesture: GestureTuning;
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
    // Tip-heavy, as a throwing knife is. This is not decoration: weight forward
    // raises the moment of inertia, which slows the tumble, which pushes the
    // first blade-first arrival further downrange — and that is what makes the
    // short band land on someone else's ground instead of your own.
    balance: 0.62,
    edgeWidth: 0.03,
  },
  style: {
    pitch: 0.35,
    releaseHeight: 1.4,
    // The knife's natural tumble; the wrist settles on the sticking rate nearest
    // it, so this sets how many turns a throw makes rather than whether it sticks.
    spinImpulse: 0.475, // 30 rad/s with the knife above
    // Tip up, as the knife sits in the hand — the tumble carries it forward from
    // there, so the throw begins where the held knife was left.
    startingBladeAngle: 0.8,
    // Tuned for throwing from inside your own ground, about five units from the
    // centre: the least draw tosses just over your own border, a full draw at
    // the resting angle falls just short of the far rim, and only a full lob
    // crosses the circle. Not lower at the bottom: the lightest knife needs
    // some pace to bury itself, and a gentler least throw would not stick.
    minSpeed: 6,
    maxSpeed: 20,
    referenceMass: 0.2,
    // Gentler than equal energy. Enough that a greatsword cannot reach the far
    // side of the circle, which is the price of a blade that almost never misses.
    weightPenalty: 0.25,
  },
  /*
   * The only thing between a clean throw and a stuck knife, now that the wrist
   * is automatic. Measured with the Thrower: a short throw sticks all but
   * always, a full-range one about three times in four. Aim is left exact —
   * where the knife goes is the player's decision, and wobbling it would only
   * take the decision away.
   */
  scatter: {
    spin: 1.5,
    heading: 0,
    power: 0.03,
    startingBladeAngle: 0.2,
  },
  stick: {
    /*
     * 55°, widened from 36° after play. The tumble is the hard part; it does not
     * need to be exacting as well.
     *
     * This gate turns out not to be the one doing most of the rejecting —
     * measured across the tumble range, over half of all failures are
     * handle-first, and those are the entry gate's doing, not this one. Widening
     * here alone bought little. The two have to move together, which is why
     * `minEntryAngle` came down at the same time.
     */
    baseMisalignment: (Math.PI * 55) / 180,
    referenceBladeLength: 0.42,
    // Just under 3°. All that is truly required is that the tip be lower than
    // the butt — anything above zero means the point lands first. The old 0.15
    // was caution rather than physics, and it was quietly the tightest
    // constraint on the whole throw.
    minEntryAngle: 0.05,
    minMomentum: 1.2,
    soilResistance: 14,
  },
  gesture: {
    // A third of the screen: long enough that power is a thing a player sets
    // with care, still a thumb's length on a phone.
    fullDraw: 0.33,
    minDraw: 0.06,
    // Slower than this across the grip point and the player is easing the arm
    // back to rest, not throwing — which is how a throw is called off.
    minPushSpeed: 0.7,
    // A sharp flick; an ordinary push lands around the middle of the range.
    fullWhip: 4,
    // From a stand just outside the rim, the far edges of the circle are a
    // little under 60° either side.
    maxAim: 0.95,
    // Half the drift: enough that a sloppy push visibly pulls the knife, not so
    // much that an ordinary one throws it at the wrong player.
    driftGain: 0.5,
    // From a skimming 6° to a 46° lob. The style's own pitch sits in between
    // and is where the hand rests before the player moves it.
    minPitch: 0.1,
    maxPitch: 0.8,
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

/** How much faster or slower than the reference knife this one leaves the hand. */
export const weightFactor = (config: ThrowConfig): number =>
  Math.pow(
    config.style.referenceMass / Math.max(config.knife.mass, 1e-6),
    config.style.weightPenalty,
  );

/** Launch speed for a throw of `power` (0 to 1), after the knife's weight has had its say. */
export const launchSpeed = (config: ThrowConfig, power: number): number => {
  const { minSpeed, maxSpeed } = config.style;
  const clamped = Math.min(1, Math.max(0, power));
  return (minSpeed + (maxSpeed - minSpeed) * clamped) * weightFactor(config);
};

/** The knife's natural tumble — what a relaxed wrist gives it. */
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

import type { Vec2, Vec3 } from '../types.js';

/**
 * A knife leaving the hand.
 *
 * The whole flight happens in one vertical plane — the plane containing
 * `heading` — so the knife's tumble is a single angle rather than a full
 * orientation. That is not a simplification of the physics so much as a
 * statement of it: a thrown knife rotates about one axis, and everything the
 * game needs follows from where in that rotation it happens to be when it
 * arrives.
 */
export type Launch = {
  readonly origin: Vec3;
  /** Bearing across the ground, radians. The cut will run along this line. */
  readonly heading: number;
  /** Launch angle above the horizontal, radians. */
  readonly pitch: number;
  /** Launch speed, arena units per second. */
  readonly speed: number;
  /** Tumble rate in the flight plane, radians per second. */
  readonly spin: number;
  /** Where in its tumble the knife starts, radians. Zero points along the throw. */
  readonly bladeAngle: number;
};

export type FlightSample = {
  readonly time: number;
  readonly position: Vec3;
  /** Blade angle within the flight plane: 0 is tip-forward, -π/2 is tip-down. */
  readonly bladeAngle: number;
};

export type Impact = {
  readonly time: number;
  /** Where it met the ground, in playfield coordinates. */
  readonly point: Vec2;
  readonly speed: number;
  readonly bladeAngle: number;
  /** Direction of travel within the flight plane, radians below horizontal. */
  readonly descentAngle: number;
  /**
   * How far the blade was from pointing along its own path, radians.
   *
   * Zero is a knife driving in exactly the way it was travelling — the clean
   * stick. Approaching a right angle it is landing flat, and it will slap and
   * bounce however hard it was thrown.
   */
  readonly misalignment: number;
  /**
   * How far below horizontal the blade itself is pointing, radians.
   *
   * Positive means the point is the lowest part of the knife and will reach the
   * ground first. Negative means the blade is tipped up and the butt of the
   * handle is lower — whatever else is true, that knife lands handle-first.
   *
   * Distinct from `misalignment`, and both are needed. Misalignment asks whether
   * the knife is travelling the way it points; this asks which end is down. A
   * knife can be beautifully aligned with a descending path and still have its
   * tip above horizontal, because the path is steeper than the knife.
   */
  readonly entryAngle: number;
  /** Bearing of the blade across the ground — the same line it was thrown along. */
  readonly heading: number;
};

export type Flight = {
  readonly samples: readonly FlightSample[];
  readonly impact: Impact;
};

export type FlightTuning = {
  readonly gravity: number;
  /** Seconds between trajectory samples. The impact is always sampled exactly. */
  readonly sampleInterval: number;
};

/** Why a throw ended the way it did — the difference between learning and guessing. */
export type StickOutcome =
  | 'stuck'
  /** Landed across its own path and skipped away. A fault of power. */
  | 'flat'
  /** Tip was above horizontal, so the butt struck first. A fault of the tumble. */
  | 'handle_first'
  /** Nothing left in it to bury the point. */
  | 'too_slow'
  /**
   * Went in, but lies too low to get your fingers under the handle — so by the
   * yard's rule it does not count. Under-turned, like `handle_first`, only not
   * so badly.
   */
  | 'handle_low';

export type StickVerdict = {
  /** Whether it counts: stuck, and standing up well enough to be pulled out by the handle. */
  readonly stuck: boolean;
  /**
   * Whether the point went into the ground at all. True for every knife that
   * counts, and for one lying too low to (`handle_low`): that knife stays
   * standing where it went in, it just claims nothing.
   */
  readonly planted: boolean;
  readonly outcome: StickOutcome;
  /**
   * How cleanly, from 0 to 1. Drives how the landing reads: a bare stick
   * shudders and leans, a perfect one goes in dead straight and rings.
   */
  readonly quality: number;
  /**
   * How far the point buried itself along the blade, in arena units. Zero when
   * it skipped. A scrappy stick goes in shallower than a clean one.
   */
  readonly depth: number;
};

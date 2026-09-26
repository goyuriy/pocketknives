/**
 * How a throw is played back, from the instant the hand lets go.
 *
 * The throw is already decided — flight, stick and cut are solved before the
 * first frame — so this is purely a question of pacing. Two beats:
 *
 * 1. **Hand-off.** The arm swings through to the release pose with the knife
 *    still in the fist. The pointer's push is over in a few milliseconds; this
 *    is the swing the push stood for, shown so the knife is seen to *leave the
 *    hand* rather than appear in the air beside it.
 * 2. **Flight, in slow motion.** The knife comes off the fingers at a crawl —
 *    the moment worth watching, and the moment a clip is made of — then ramps
 *    up to the cruising pace for the rest of the flight.
 *
 * Everything is in seconds: *real* seconds are wall-clock playback, *flight*
 * seconds are the flight's own clock (`FlightSample.time`). The rate between
 * them is how fast the world is running.
 *
 * Pure, and shared by the state (to know when the knife lands) and the stage
 * (to draw it), so the two can never disagree about where the knife is.
 */
export type SlowMotion = {
  /** Real seconds the arm takes to swing through to the release. */
  readonly handOff: number;
  /** World speed as the knife leaves the hand, flight seconds per real second. */
  readonly startRate: number;
  /** Real seconds it stays that slow. */
  readonly hold: number;
  /** Real seconds it takes to speed up to the cruising pace. */
  readonly ramp: number;
};

export const RELEASE_SLOW_MOTION: SlowMotion = {
  handOff: 0.22,
  startRate: 0.12,
  hold: 0.3,
  ramp: 0.6,
};

/**
 * How fast the world runs `real` seconds into the flight (after the hand-off),
 * given the cruising pace.
 */
export const rateAt = (real: number, cruise: number, slow: SlowMotion = RELEASE_SLOW_MOTION): number => {
  if (real <= slow.hold) return slow.startRate;
  const into = real - slow.hold;
  if (into >= slow.ramp) return cruise;
  return slow.startRate + (cruise - slow.startRate) * (into / slow.ramp);
};

/** Flight seconds reached `real` seconds into the flight (after the hand-off). */
export const flightTimeAt = (real: number, cruise: number, slow: SlowMotion = RELEASE_SLOW_MOTION): number => {
  const { startRate: s, hold: h, ramp: r } = slow;
  if (real <= 0) return 0;
  if (real <= h) return s * real;
  const u = Math.min(real - h, r);
  // The ramp's rate rises linearly, so the time it covers is a trapezium.
  const ramped = s * u + ((cruise - s) * u * u) / (2 * r);
  return s * h + ramped + cruise * Math.max(0, real - h - r);
};

/** Real seconds (after the hand-off) until the flight's clock reaches `flight`. The inverse of `flightTimeAt`. */
export const realTimeFor = (flight: number, cruise: number, slow: SlowMotion = RELEASE_SLOW_MOTION): number => {
  const { startRate: s, hold: h, ramp: r } = slow;
  if (flight <= 0) return 0;
  const afterHold = s * h;
  if (flight <= afterHold) return flight / s;
  const afterRamp = afterHold + ((s + cruise) / 2) * r;
  if (flight >= afterRamp) return h + r + (flight - afterRamp) / cruise;
  // Inside the ramp: solve  s·u + (c−s)·u²/(2r) = flight − s·h  for u.
  const left = flight - afterHold;
  const a = (cruise - s) / (2 * r);
  const u = Math.abs(a) < 1e-12 ? left / s : (-s + Math.sqrt(s * s + 4 * a * left)) / (2 * a);
  return h + u;
};

/** Real seconds from letting go to the knife reaching the ground. */
export const playbackDuration = (flightTime: number, cruise: number, slow: SlowMotion = RELEASE_SLOW_MOTION): number =>
  slow.handOff + realTimeFor(flightTime, cruise, slow);

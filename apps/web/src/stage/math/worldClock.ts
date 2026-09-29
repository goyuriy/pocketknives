/**
 * The world's clock: real time, except that it stands still for the few frames
 * of hitstop when a knife hits (`hitstopFor`). Everything that happens on
 * impact — dust, quiver, bounce, shake, the arm's follow-through — is timed on
 * it, so the whole world freezes together and carries on together.
 *
 * The playback of a throw stays on real time: the flight is on a schedule.
 */
export type WorldClock = {
  /** The world's time, milliseconds. */
  readonly now: number;
  /** Real time, milliseconds, until which the world holds still. */
  readonly holdUntil: number;
};

/** What the world's clock says this frame. */
export type WorldTime = {
  /** The world's time, milliseconds. */
  readonly now: number;
  /** Seconds the world moved on this frame: none while it holds. */
  readonly seconds: number;
  /** Held still by a hitstop. */
  readonly holding: boolean;
};

export const WORLD_START: WorldClock = { now: 0, holdUntil: -Infinity };

/** The clock after a frame of `seconds` ending at real time `realNow`, and what it says. */
export const tickWorld = (clock: WorldClock, realNow: number, seconds: number): { clock: WorldClock; time: WorldTime } => {
  const holding = realNow < clock.holdUntil;
  const moved = holding ? 0 : seconds;
  const now = clock.now + moved * 1000;
  return { clock: { ...clock, now }, time: { now, seconds: moved, holding } };
};

/** The clock held still from real time `realNow` for `seconds`, or longer if already held longer. */
export const holdWorld = (clock: WorldClock, realNow: number, seconds: number): WorldClock => ({
  ...clock,
  holdUntil: Math.max(clock.holdUntil, realNow + seconds * 1000),
});

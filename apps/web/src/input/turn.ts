/**
 * Turning the body round, for every way of playing that has no mouse-look.
 *
 * With the mouse captured, moving it turns you, as in any first-person game.
 * Without capture — a browser that refuses it, an iPad with a trackpad — a
 * visible cursor stops dead at the edge of the screen, and so would you. So
 * the keys turn you, and so does the hand: reach the cursor out towards the
 * edge and the body comes round after it, the way an arm pulled past the
 * shoulder turns the shoulders.
 *
 * Every turn here is a rate from -1 to 1, positive to the right; `TURN_SPEED`
 * makes it radians per second.
 */

/** Turning pace at full, radians per second: all the way round in about three seconds. */
export const TURN_SPEED = 2.2;

/** How far out along the cursor's reach, as a fraction of it, the body starts to follow. */
const EDGE_START = 0.8;

const KEYS: Record<string, number> = { KeyQ: -1, KeyE: 1 };

export const isTurnKey = (code: string): boolean => code in KEYS;

/** The turn the held keys ask for. Opposite keys cancel. */
export const turnFromKeys = (held: ReadonlySet<string>): number =>
  [...held].reduce((sum, code) => sum + (KEYS[code] ?? 0), 0);

/**
 * How hard a free cursor asks the body to turn, from where it points: nothing
 * across most of the screen, rising to a full turn at the edge.
 *
 * @param aim    where the hand points, radians, positive right — see `aimFromPointer`
 * @param maxAim the furthest the cursor can point, at the edge of the screen
 */
export const edgeTurn = (aim: number, maxAim: number): number => {
  const past = (Math.abs(aim) / Math.max(1e-6, maxAim) - EDGE_START) / (1 - EDGE_START);
  return past <= 0 ? 0 : Math.sign(aim) * Math.min(1, past);
};

/** Several turns as one, never beyond a full turn either way. */
export const combineTurns = (...turns: readonly number[]): number =>
  Math.max(-1, Math.min(1, turns.reduce((sum, turn) => sum + turn, 0)));

/**
 * The body's facing after turning at `turn` for `seconds`. Positive turns to
 * the right, which is clockwise seen from above — a falling heading.
 */
export const turnedFacing = (facing: number, turn: number, seconds: number, speed = TURN_SPEED): number =>
  facing - turn * speed * seconds;

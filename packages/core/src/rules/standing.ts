import type { Board, PlayerId, Vec2 } from '../types.js';
import { area, centroid, containsPoint, distanceToBoundary } from '../geometry/ring.js';

/**
 * Where a player may stand: anywhere on their own ground, and nowhere else.
 *
 * You throw from where you stand, so this is also where you may throw from.
 * It makes the shape of your land matter in a new way — ground that reaches
 * towards an opponent is ground you can walk out on and throw short from, and
 * losing it pushes you back.
 */
export const isOnOwnLand = (board: Board, playerId: PlayerId, point: Vec2): boolean =>
  board.territories.some((t) => t.ownerId === playerId && containsPoint(t.ring, point));

/**
 * How far `point` is from the nearest of the player's own ground: zero on it,
 * Infinity for a player who holds nothing. Measured to whatever piece is
 * nearest, so it never matters how many pieces a field is stored as.
 */
export const distanceToLand = (board: Board, playerId: PlayerId, point: Vec2): number => {
  let nearest = Infinity;
  for (const t of board.territories) {
    if (t.ownerId !== playerId) continue;
    if (containsPoint(t.ring, point)) return 0;
    nearest = Math.min(nearest, distanceToBoundary(t.ring, point));
  }
  return nearest;
};

/** How finely a blocked step is searched for the furthest point still on your land. */
const SEARCH_STEPS = 12;

/**
 * Takes a step from `from` towards `to` without leaving the player's own land.
 *
 * A step that stays on your ground is taken as it is. One that would cross your
 * border slides along it instead — the part of the step running along the
 * border is kept, the part pushing out through it is dropped — which is how a
 * wall feels to walk into in any game, rather than stopping dead. If neither
 * sliding direction works, the step goes as far as it can.
 *
 * Pure. `from` is assumed to be on the player's land; if it is not (the ground
 * was taken from under them), the step is taken unchecked so they can walk
 * home — see `homeSpot` for putting them somewhere sensible instead.
 */
export const keepOnOwnLand = (board: Board, playerId: PlayerId, from: Vec2, to: Vec2): Vec2 => {
  const onLand = (p: Vec2) => isOnOwnLand(board, playerId, p);
  if (!onLand(from) || onLand(to)) return to;

  // Slide: try each axis of the step on its own, keep whichever goes further.
  const slides: Vec2[] = [
    [to[0], from[1]],
    [from[0], to[1]],
  ];
  const reach = (p: Vec2) => Math.hypot(p[0] - from[0], p[1] - from[1]);
  const slid = slides.filter(onLand).sort((a, b) => reach(b) - reach(a))[0];
  if (slid) return slid;

  // Blocked both ways: go as far along the step as the land allows.
  let inside = 0;
  let outside = 1;
  for (let i = 0; i < SEARCH_STEPS; i++) {
    const mid = (inside + outside) / 2;
    const p: Vec2 = [from[0] + (to[0] - from[0]) * mid, from[1] + (to[1] - from[1]) * mid];
    if (onLand(p)) inside = mid;
    else outside = mid;
  }
  return [from[0] + (to[0] - from[0]) * inside, from[1] + (to[1] - from[1]) * inside];
};

/**
 * Where a player starts their turn when they are not standing anywhere yet:
 * the middle of their largest piece of ground.
 *
 * Every territory is convex, so its centroid is always inside it — this can
 * never put a player on someone else's land. Null only for a player with no
 * ground at all.
 */
export const homeSpot = (board: Board, playerId: PlayerId): Vec2 | null => {
  const own = board.territories.filter((t) => t.ownerId === playerId);
  if (own.length === 0) return null;
  const largest = own.reduce((best, t) => (area(t.ring) > area(best.ring) ? t : best));
  return centroid(largest.ring);
};

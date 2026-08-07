import type { Board, PlayerId, Ring, RuleSet, Territory, Throw, ThrowOutcome, Vec2 } from '../types.js';
import { firstBoundaryHit } from '../geometry/raycast.js';
import { splitRingByChord } from '../geometry/split.js';
import { area, centroid, containsPoint, sharedBorderUpTo } from '../geometry/ring.js';
import { cross, length, normalize, scale, sub } from '../geometry/vector.js';
import { absorbOrphans } from './orphans.js';
import { territoriesOf } from './board.js';

export const DEFAULT_RULES: RuleSet = {
  standRadius: 0.6,
  minSharedBorder: 0.05,
};

/** Geometric slack, scaled to the arena so the rules read the same at any size. */
const toleranceFor = (board: Board): number => board.radius * 1e-6;

/**
 * Resolves one throw against the board.
 *
 * The whole rule set in one sentence: the blade's line is extended both ways
 * until it meets a border, the piece of ground it isolates is taken **only** if
 * it touches land the thrower already holds, and anything else costs the turn.
 *
 * Pure — the input board is never mutated. On a miss the same board is simply
 * carried forward by the caller.
 */
export const resolveThrow = (
  board: Board,
  throwerId: PlayerId,
  attempt: Throw,
  rules: RuleSet = DEFAULT_RULES,
): ThrowOutcome => {
  const tolerance = toleranceFor(board);

  if (length(attempt.direction) < tolerance) {
    return { kind: 'miss', reason: 'degenerate_cut', cut: null };
  }
  if (!containsPoint(board.arena, attempt.point)) {
    return { kind: 'miss', reason: 'outside_arena', cut: null };
  }

  const victim = board.territories.find((t) => containsPoint(t.ring, attempt.point));
  if (!victim) {
    // Landed exactly on a border between two pieces — no ground was clearly hit.
    return { kind: 'miss', reason: 'degenerate_cut', cut: null };
  }
  if (victim.ownerId === throwerId) {
    return { kind: 'miss', reason: 'own_territory', cut: null };
  }

  const heading = normalize(attempt.direction);
  const ahead = firstBoundaryHit(victim.ring, attempt.point, heading);
  const behind = firstBoundaryHit(victim.ring, attempt.point, scale(heading, -1));
  if (!ahead || !behind) {
    return { kind: 'miss', reason: 'degenerate_cut', cut: null };
  }

  const split = splitRingByChord(victim.ring, ahead, behind, tolerance);
  if (!split) {
    return { kind: 'miss', reason: 'degenerate_cut', cut: [behind.point, ahead.point] };
  }

  const claimable = pickClaimablePiece(board, throwerId, split.pieces, split.chord, rules, tolerance);
  if (!claimable) {
    return { kind: 'miss', reason: 'no_connection', cut: split.chord };
  }

  const [claimed, remainder] = claimable;
  const afterCut = board.territories.flatMap((t): Territory[] =>
    t.id !== victim.id
      ? [t]
      : [
          { id: `t${board.nextTerritoryId}`, ownerId: throwerId, ring: claimed },
          { id: `t${board.nextTerritoryId + 1}`, ownerId: victim.ownerId, ring: remainder },
        ],
  );

  // Won ground is kept as its own polygon rather than fused into the land it
  // borders. Fusing needs a polygon union, which is both fragile on these
  // near-collinear shapes and unnecessary: everything that has to see a player's
  // holdings as one field goes through `clusterRings` instead.
  const cutBoard: Board = {
    ...board,
    nextTerritoryId: board.nextTerritoryId + 2,
    territories: afterCut,
  };

  // Taking a piece can sever the stretch of border that was joining two of the
  // victim's holdings, marooning the far one. Islands are not allowed, so that
  // ground changes hands here rather than sitting unreachable.
  const { board: nextBoard, transferred } = absorbOrphans(
    cutBoard,
    victim.ownerId,
    rules.minSharedBorder,
    tolerance,
  );
  const absorbedRings = transferred.get(throwerId) ?? [];

  return {
    kind: 'claimed',
    board: nextBoard,
    victimId: victim.ownerId,
    gainedArea: area(claimed) + absorbedRings.reduce((sum, ring) => sum + area(ring), 0),
    claimedRing: claimed,
    absorbedRings,
    cut: split.chord,
  };
};

/**
 * Of the two halves the cut produced, which one may the thrower actually take?
 *
 * Two rules decide it, in this order:
 *
 * 1. **Your side of the line.** You take the half lying on the same side of the
 *    cut as your own land. Your territory grows *up to* the blade; it never
 *    jumps across it. Size has nothing to do with it — a cut that slices the
 *    corner off a neighbour hands you that corner, not the larger remainder,
 *    even though both halves touch you.
 * 2. **It has to connect.** That half must still share a real stretch of border
 *    with ground you already hold, which is what stops a throw across the circle
 *    from paying off.
 *
 * Returns `[claimed, remainder]`, or null when the half on your side is not
 * connected to you.
 */
const pickClaimablePiece = (
  board: Board,
  throwerId: PlayerId,
  pieces: readonly [Ring, Ring],
  cut: readonly [Vec2, Vec2],
  rules: RuleSet,
  tolerance: number,
): readonly [Ring, Ring] | null => {
  const own = territoriesOf(board, throwerId);

  // Border shared with any of the thrower's pieces counts towards the same
  // total, and the scan stops as soon as the total clears the bar.
  const connects = (piece: Ring): boolean => {
    let total = 0;
    for (const t of own) {
      total += sharedBorderUpTo(piece, t.ring, rules.minSharedBorder - total, tolerance);
      if (total >= rules.minSharedBorder) return true;
    }
    return false;
  };

  const [first, second] = pieces;
  const offset = offsetFromCut(cut);
  const throwerOffset = own.reduce((sum, t) => sum + area(t.ring) * offset(centroid(t.ring)), 0);

  // Only reachable if the thrower's land is balanced exactly across the cut, in
  // which case no side is "theirs" — fall back to whichever half connects.
  if (Math.abs(throwerOffset) < tolerance) {
    if (connects(first)) return [first, second];
    if (connects(second)) return [second, first];
    return null;
  }

  const onThrowerSide =
    Math.sign(offset(centroid(first))) === Math.sign(throwerOffset) ? first : second;
  const remainder = onThrowerSide === first ? second : first;

  return connects(onThrowerSide) ? [onThrowerSide, remainder] : null;
};

/**
 * Which side of the cut a point falls on, as a signed value.
 *
 * Every piece lies wholly on one side: territories start convex (wedges of a
 * disc) and a chord cut of a convex shape yields two convex shapes, so the
 * property holds for the life of a match and a piece's centroid is a sound
 * stand-in for the piece.
 */
const offsetFromCut = ([from, to]: readonly [Vec2, Vec2]) => {
  const direction = sub(to, from);
  return (p: Vec2): number => cross(direction, sub(p, from));
};

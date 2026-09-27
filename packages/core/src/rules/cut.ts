import type { Board, PlayerId, RuleSet, Territory, Throw, ThrowOutcome, Vec2 } from '../types.js';
import { clusterTerritories } from '../geometry/cluster.js';
import { area, centroid, containsPoint, sharedBorderUpTo } from '../geometry/ring.js';
import { length, normalize } from '../geometry/vector.js';
import { cutField, offsetFromChord, type FieldSide } from './fieldCut.js';
import { mergeConvexNeighbours } from './tidy.js';
import { absorbOrphans } from './orphans.js';
import { territoriesOf } from './board.js';
import { distanceToLand } from './standing.js';

export const DEFAULT_RULES: RuleSet = {
  standRadius: 0.6,
  minSharedBorder: 0.05,
  // Half the circle's radius. From your own border that is a short throw, and
  // a player who wants more has to walk out to the edge of their land first.
  reach: 5,
};

/** Geometric slack, scaled to the arena so the rules read the same at any size. */
const toleranceFor = (board: Board): number => board.radius * 1e-6;

/**
 * Resolves one throw against the board.
 *
 * The whole rule set in one sentence: the blade's line is extended both ways
 * until it meets a border — a real one, where someone else's ground or the
 * circle's edge begins, not a seam inside the victim's own field — and the side
 * of it facing the thrower is taken **only** if it touches land the thrower
 * already holds; anything else costs the turn. And only if the knife is within
 * reach of the thrower's own ground to begin with — the line is drawn by hand.
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
  if (distanceToLand(board, throwerId, attempt.point) > rules.reach) {
    // Stuck fair and square, but you cannot draw a line you cannot reach.
    return { kind: 'miss', reason: 'out_of_reach', cut: null };
  }

  const heading = normalize(attempt.direction);
  // The field the knife landed in — all of the victim's ground joined to this
  // piece. The cut runs across the whole of it, not just the piece it hit.
  const field =
    clusterTerritories(territoriesOf(board, victim.ownerId), rules.minSharedBorder, tolerance).find((group) =>
      group.includes(victim),
    ) ?? [victim];

  const cut = cutField(field, victim, attempt.point, heading, rules.minSharedBorder, tolerance);
  if (cut.kind === 'degenerate') {
    return { kind: 'miss', reason: 'degenerate_cut', cut: cut.chord };
  }

  const claimable = pickClaimableSide(board, throwerId, cut.sides, cut.chord, rules, tolerance);
  if (!claimable) {
    return { kind: 'miss', reason: 'no_connection', cut: cut.chord };
  }

  // Every piece of the field is replaced by what the cut made of it, owned by
  // whichever side it fell on. Pieces keep their place in the board's order so
  // the board reads the same way every time.
  const claimedSide = new Set(claimable.pieces);
  let nextId = board.nextTerritoryId;
  const replaced = new Map<Territory, Territory[]>();
  for (const side of cut.sides) {
    for (const piece of side.pieces) {
      const ownerId = claimedSide.has(piece) ? throwerId : victim.ownerId;
      replaced.set(piece.from, [...(replaced.get(piece.from) ?? []), { id: `t${nextId++}`, ownerId, ring: piece.ring }]);
    }
  }
  const afterCut = board.territories.flatMap((t) => replaced.get(t) ?? [t]);
  const claimedRings = claimable.pieces.map((piece) => piece.ring);

  // Won ground is kept as its own polygons rather than fused into the land it
  // borders. Fusing needs a polygon union, which is both fragile on these
  // near-collinear shapes and unnecessary: everything that has to see a player's
  // holdings as one field goes through `clusterRings` instead.
  const cutBoard: Board = {
    ...board,
    nextTerritoryId: nextId,
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
    board: mergeConvexNeighbours(nextBoard, rules.minSharedBorder, tolerance),
    victimId: victim.ownerId,
    gainedArea: [...claimedRings, ...absorbedRings].reduce((sum, ring) => sum + area(ring), 0),
    claimedRings,
    absorbedRings,
    cut: cut.chord,
  };
};

/**
 * Of the two sides the cut produced, which one may the thrower actually take?
 *
 * Two rules decide it, in this order:
 *
 * 1. **Your side of the line.** You take the side lying on the same side of the
 *    cut as your own land. Your territory grows *up to* the blade; it never
 *    jumps across it. Size has nothing to do with it — a cut that slices the
 *    corner off a neighbour hands you that corner, not the larger remainder,
 *    even though both halves touch you.
 * 2. **It has to connect.** That side must share a real stretch of border
 *    with ground you already hold, which is what stops a throw across the circle
 *    from paying off.
 *
 * Returns the side to take, or null when the side facing you is not connected
 * to you.
 */
const pickClaimableSide = (
  board: Board,
  throwerId: PlayerId,
  sides: readonly [FieldSide, FieldSide],
  chord: readonly [Vec2, Vec2],
  rules: RuleSet,
  tolerance: number,
): FieldSide | null => {
  const own = territoriesOf(board, throwerId);

  // Border shared with any of the thrower's pieces counts towards the same
  // total, and the scan stops as soon as the total clears the bar.
  const connects = (side: FieldSide): boolean => {
    let total = 0;
    for (const piece of side.pieces) {
      for (const t of own) {
        total += sharedBorderUpTo(piece.ring, t.ring, rules.minSharedBorder - total, tolerance);
        if (total >= rules.minSharedBorder) return true;
      }
    }
    return false;
  };

  const offset = offsetFromChord(chord);
  const throwerOffset = own.reduce((sum, t) => sum + area(t.ring) * offset(centroid(t.ring)), 0);

  // Only reachable if the thrower's land is balanced exactly across the cut, in
  // which case no side is "theirs" — fall back to whichever side connects.
  if (Math.abs(throwerOffset) < tolerance) return sides.find(connects) ?? null;

  const facing = sides.find((side) => side.side === Math.sign(throwerOffset))!;
  return connects(facing) ? facing : null;
};

/**
 * What each level of the Long hands skill adds to a player's reach, as a
 * share of the base: a little more each level, so the last levels are the
 * ones worth chasing. See docs/progression-tree.md, *Long hands*.
 */
export const LONG_HANDS_STEPS: readonly number[] = [0.02, 0.03, 0.04, 0.05, 0.06];

/**
 * A player's reach with `level` levels of Long hands (0 to 5): the base
 * reach and every level's share of it, so level 5 reaches 20% further.
 * Levels outside the range are held to it.
 */
export const longHandsReach = (baseReach: number, level: number): number => {
  const levels = Math.min(LONG_HANDS_STEPS.length, Math.max(0, Math.floor(level)));
  const bonus = LONG_HANDS_STEPS.slice(0, levels).reduce((sum, step) => sum + step, 0);
  return baseReach * (1 + bonus);
};

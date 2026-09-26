import type { Ring, Territory, Vec2 } from '../types.js';
import { firstBoundaryHit } from '../geometry/raycast.js';
import { splitRingByChord } from '../geometry/split.js';
import { centroid, containsPoint, sharedBorderUpTo } from '../geometry/ring.js';
import { add, cross, lerp, scale, sub } from '../geometry/vector.js';

/** A piece of the victim's field after the cut, and the territory it came from. */
export type CutPiece = {
  readonly ring: Ring;
  readonly from: Territory;
};

/** Everything of the field on one side of the line, joined up through its own pieces. */
export type FieldSide = {
  /** Which side of the chord, as the sign of `offsetFromChord`: +1 or -1. */
  readonly side: number;
  readonly pieces: readonly CutPiece[];
};

export type FieldCut =
  | {
      readonly kind: 'cut';
      readonly chord: readonly [Vec2, Vec2];
      readonly sides: readonly [FieldSide, FieldSide];
    }
  | {
      /** The line did not divide the field in two — see `cutField`. */
      readonly kind: 'degenerate';
      readonly chord: readonly [Vec2, Vec2] | null;
    };

/** How far past an edge to look for the ground beyond it, in multiples of the tolerance. */
const PROBE = 50;

/**
 * Cuts a player's whole field along a line, not just the piece the knife hit.
 *
 * A field won over several turns is stored as several polygons, but on the
 * ground it is one field: the seams between its own pieces are not borders,
 * nobody can see them, and a knife's line has no reason to stop at them. So the
 * line is walked out from where the knife bit in, piece to piece across those
 * seams, until the ground beyond belongs to someone else or the circle ends —
 * the first *real* border, in both directions.
 *
 * Every piece the line crossed is split in two; the rest stay whole. The pieces
 * then fall into two sides, each joined up through its own pieces but not
 * across the line.
 *
 * The walk is used rather than a ray against the field's outline because an
 * outline is only approximate where three pieces meet at a point — which after
 * a few cuts is everywhere. Stepping from piece to piece asks the exact question
 * each time: whose ground is just past this edge?
 *
 * Returns `degenerate` if the line cannot be walked (it lies along an edge) or
 * does not divide the field — possible only when the field wraps round someone
 * else's ground, so the two sides join up again behind it.
 */
export const cutField = (
  field: readonly Territory[],
  start: Territory,
  point: Vec2,
  heading: Vec2,
  minSharedBorder: number,
  tolerance: number,
): FieldCut => {
  const ahead = walk(field, start, point, heading, tolerance);
  const behind = walk(field, start, point, scale(heading, -1), tolerance);
  if (!ahead || !behind) return { kind: 'degenerate', chord: null };

  const chord: readonly [Vec2, Vec2] = [behind.exit, ahead.exit];
  // Where the line runs through each piece it crossed: the landing point for
  // the piece it started in, the middle of its passage for the rest.
  const insides = new Map<Territory, Vec2>([[start, point], ...ahead.crossed, ...behind.crossed]);
  const offset = offsetFromChord(chord);

  // Each crossed piece becomes two halves that must not be joined to each other
  // — they meet only along the line itself.
  const pieces: (CutPiece & { half: number | null })[] = [];
  field.forEach((territory, index) => {
    const inside = insides.get(territory);
    const halves = inside ? splitAcross(territory.ring, heading, inside, tolerance) : null;
    if (halves) halves.forEach((ring) => pieces.push({ ring, from: territory, half: index }));
    else pieces.push({ ring: territory.ring, from: territory, half: null });
  });

  const groups = joinedUp(pieces, minSharedBorder, tolerance);
  if (groups.length !== 2) return { kind: 'degenerate', chord };

  const sides = groups.map((group): FieldSide | null => {
    // A side is named by its split halves, which lie wholly one side of the line.
    const signs = new Set(
      group.filter((p) => p.half !== null).map((p) => Math.sign(offset(centroid(p.ring)))),
    );
    if (signs.size !== 1) return null;
    return { side: [...signs][0]!, pieces: group.map(({ ring, from }) => ({ ring, from })) };
  });
  const [first, second] = sides;
  if (!first || !second || first.side === second.side) return { kind: 'degenerate', chord };

  return { kind: 'cut', chord, sides: [first, second] };
};

/**
 * Which side of a chord a point is on, as a signed value: positive on the left
 * looking from its start to its end.
 */
export const offsetFromChord = ([from, to]: readonly [Vec2, Vec2]) => {
  const direction = sub(to, from);
  return (p: Vec2): number => cross(direction, sub(p, from));
};

/**
 * Follows a ray out of `start` and on through the field's own pieces until the
 * ground beyond an edge belongs to someone else, or to no one.
 *
 * Returns where it left the field, and each further piece it passed through
 * with a point on the line inside it.
 */
const walk = (
  field: readonly Territory[],
  start: Territory,
  origin: Vec2,
  direction: Vec2,
  tolerance: number,
): { exit: Vec2; crossed: [Territory, Vec2][] } | null => {
  const crossed: [Territory, Vec2][] = [];
  let current = start;
  let from = origin;
  // A straight line crosses a convex piece at most once, so the walk can never
  // take more steps than there are pieces.
  for (let step = 0; step <= field.length; step++) {
    const hit = firstBoundaryHit(current.ring, from, direction);
    if (!hit) return null;
    if (current !== start) crossed.push([current, lerp(from, hit.point, 0.5)]);
    const beyond = add(hit.point, scale(direction, tolerance * PROBE));
    const next = field.find(
      (t) => t !== current && t !== start && !crossed.some(([seen]) => seen === t) && containsPoint(t.ring, beyond),
    );
    if (!next) return { exit: hit.point, crossed };
    current = next;
    from = hit.point;
  }
  return null;
};

/** Splits a convex piece along the line through `inside`, or null if the line only grazes it. */
const splitAcross = (
  ring: Ring,
  heading: Vec2,
  inside: Vec2,
  tolerance: number,
): readonly [Ring, Ring] | null => {
  const forward = firstBoundaryHit(ring, inside, heading);
  const backward = firstBoundaryHit(ring, inside, scale(heading, -1));
  if (!forward || !backward) return null;
  return splitRingByChord(ring, backward, forward, tolerance)?.pieces ?? null;
};

/** Groups pieces that share a real stretch of border, never joining a split piece's two halves. */
const joinedUp = <P extends { ring: Ring; half: number | null }>(
  pieces: readonly P[],
  minSharedBorder: number,
  tolerance: number,
): P[][] => {
  const parent = pieces.map((_, i) => i);
  const find = (i: number): number => (parent[i] === i ? i : (parent[i] = find(parent[i]!)));

  for (let i = 0; i < pieces.length; i++) {
    for (let j = i + 1; j < pieces.length; j++) {
      const a = pieces[i]!;
      const b = pieces[j]!;
      if (a.half !== null && a.half === b.half) continue;
      if (find(i) === find(j)) continue;
      if (sharedBorderUpTo(a.ring, b.ring, minSharedBorder, tolerance) >= minSharedBorder) {
        parent[find(i)] = find(j);
      }
    }
  }

  const groups = new Map<number, P[]>();
  pieces.forEach((piece, i) => groups.set(find(i), [...(groups.get(find(i)) ?? []), piece]));
  return [...groups.values()];
};

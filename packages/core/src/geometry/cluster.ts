import type { Board, PlayerId, Ring, Territory, Vec2 } from '../types.js';
import { bounds, containsPoint, distanceToBoundary, largestInscribedRadius, edges } from './ring.js';
import { distanceToSegment, lerp } from './vector.js';

export type Segment = readonly [Vec2, Vec2];

/**
 * Groups a player's pieces into connected fields.
 *
 * Ground won over several turns is stored as several polygons even when it sits
 * side by side on the ground. Anything that asks "how much room does this player
 * really have?" has to see those pieces as one field, and this is what supplies
 * that view — without ever fusing the polygons themselves, which turns out to be
 * both fragile and unnecessary.
 */
export const clusterRings = (
  rings: readonly Ring[],
  minSharedBorder: number,
  tolerance: number,
): Ring[][] => connectedGroups(rings, (ring) => ring, minSharedBorder, tolerance);

/** Same grouping, keeping the territories themselves so owners can be reassigned. */
export const clusterTerritories = (
  territories: readonly Territory[],
  minSharedBorder: number,
  tolerance: number,
): Territory[][] =>
  connectedGroups(territories, (territory) => territory.ring, minSharedBorder, tolerance);

const connectedGroups = <T>(
  items: readonly T[],
  ringOf: (item: T) => Ring,
  minSharedBorder: number,
  tolerance: number,
): T[][] => {
  const parent = items.map((_, i) => i);
  const find = (i: number): number => (parent[i] === i ? i : (parent[i] = find(parent[i]!)));

  for (let i = 0; i < items.length; i++) {
    for (let j = i + 1; j < items.length; j++) {
      if (sharesBorder(ringOf(items[i]!), ringOf(items[j]!), minSharedBorder, tolerance)) {
        parent[find(i)] = find(j);
      }
    }
  }

  const groups = new Map<number, T[]>();
  items.forEach((item, i) => {
    const root = find(i);
    groups.set(root, [...(groups.get(root) ?? []), item]);
  });
  return [...groups.values()];
};

const sharesBorder = (a: Ring, b: Ring, minSharedBorder: number, tolerance: number): boolean => {
  let shared = 0;
  for (const segment of subdivide(a, 4)) {
    const mid = lerp(segment[0], segment[1], 0.5);
    if (distanceToBoundary(b, mid) <= tolerance) {
      shared += segmentLength(segment);
      if (shared >= minSharedBorder) return true;
    }
  }
  return false;
};

const segmentLength = ([a, b]: Segment): number => Math.hypot(b[0] - a[0], b[1] - a[1]);

/** Chops every edge of a ring into `parts`, so partial overlaps resolve cleanly. */
function* subdivide(ring: Ring, parts: number): Generator<Segment> {
  for (const [a, b] of edges(ring)) {
    for (let k = 0; k < parts; k++) {
      yield [lerp(a, b, k / parts), lerp(a, b, (k + 1) / parts)] as const;
    }
  }
}

/**
 * The outline of a group of touching pieces, minus the seams between them.
 *
 * This is the union's boundary obtained by subtraction rather than construction:
 * every stretch of edge that another piece in the group also runs along is an
 * internal seam, not a real border. Cheaper than a polygon union, and it cannot
 * fail on the near-collinear geometry that repeated chord cuts produce.
 */
export const outerSegments = (cluster: readonly Ring[], tolerance: number): Segment[] => {
  const external: Segment[] = [];
  for (const ring of cluster) {
    for (const segment of subdivide(ring, 4)) {
      const mid = lerp(segment[0], segment[1], 0.5);
      const isSeam = cluster.some((other) => other !== ring && distanceToBoundary(other, mid) <= tolerance);
      if (!isSeam) external.push(segment);
    }
  }
  return external;
};

/**
 * Radius of the largest circle that fits in a group of touching pieces.
 *
 * Checks each piece on its own first: a single piece roomy enough settles the
 * question, and that is the usual case. Only when every piece is individually
 * too small does it pay for the grid sweep across the combined field.
 */
export const clusterInscribedRadius = (cluster: readonly Ring[], tolerance: number): number => {
  const best = Math.max(0, ...cluster.map(largestInscribedRadius));
  if (cluster.length < 2) return best;

  const border = outerSegments(cluster, tolerance);
  if (border.length === 0) return best;

  const boxes = cluster.map(bounds);
  const min: Vec2 = [
    Math.min(...boxes.map((b) => b.min[0])),
    Math.min(...boxes.map((b) => b.min[1])),
  ];
  const max: Vec2 = [
    Math.max(...boxes.map((b) => b.max[0])),
    Math.max(...boxes.map((b) => b.max[1])),
  ];

  const GRID = 32;
  let radius = best;
  for (let i = 0; i <= GRID; i++) {
    for (let j = 0; j <= GRID; j++) {
      const p: Vec2 = [
        min[0] + ((max[0] - min[0]) * i) / GRID,
        min[1] + ((max[1] - min[1]) * j) / GRID,
      ];
      if (!cluster.some((ring) => containsPoint(ring, p))) continue;

      let nearest = Infinity;
      for (const [a, b] of border) {
        nearest = Math.min(nearest, distanceToSegment(p, a, b));
        if (nearest <= radius) break;
      }
      if (nearest > radius) radius = nearest;
    }
  }
  return radius;
};

export const ringsOf = (territories: readonly Territory[]): Ring[] =>
  territories.map((t) => t.ring);

export type FieldOutline = {
  readonly ownerId: PlayerId;
  /** The pieces making up this field — abutting, never overlapping. */
  readonly rings: readonly Ring[];
  /** Only the real frontier: seams between the field's own pieces are dropped. */
  readonly segments: readonly Segment[];
};

/**
 * A player's holdings as connected fields, each with the lines that genuinely
 * bound it.
 *
 * The opening wedge lines are not permanent furniture. Ground changes hands and
 * a line that once separated two players can end up with the same player on both
 * sides — at which point it is a leftover seam, not a border, and drawing it
 * would split a field that is in fact whole. What survives is the real frontier:
 * where a player's land meets someone else's, or the edge of the circle.
 *
 * Derived from the board rather than stored, so borders can never drift out of
 * step with ownership.
 */
export const fieldOutlines = (
  board: Board,
  minSharedBorder: number,
  tolerance: number,
): FieldOutline[] => {
  const owners = [...new Set(board.territories.map((t) => t.ownerId))];

  return owners.flatMap((ownerId) =>
    clusterTerritories(
      board.territories.filter((t) => t.ownerId === ownerId),
      minSharedBorder,
      tolerance,
    ).map((field) => {
      const rings = ringsOf(field);
      return { ownerId, rings, segments: outerSegments(rings, tolerance) };
    }),
  );
};

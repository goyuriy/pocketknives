import type { Board, Territory } from '../types.js';
import { area, bounds, sharedBorderUpTo } from '../geometry/ring.js';
import { convexHull } from '../geometry/hull.js';

/**
 * Joins neighbouring pieces of the same player back together wherever the join
 * is still convex.
 *
 * A cut splits every piece of the victim's field that its line crosses, so
 * without this the board fragments into hundreds of slivers over a match, and
 * everything that looks at a player's pieces — who is still standing, where the
 * borders are — slows down with it. Fusing arbitrary polygons needs a polygon
 * union, which is fragile on near-collinear geometry; fusing two convex pieces
 * into one convex piece needs only a hull, and is exact.
 *
 * The test: two touching pieces whose convex hull has exactly their combined
 * area *are* that hull — there is no gap in it to account for. It does not care
 * whether their vertices line up along the seam, which after a few cuts they
 * often do not.
 *
 * Every territory stays convex, the invariant the cut relies on. Deterministic:
 * pieces are considered in board order and a merged piece keeps the first id.
 */
export const mergeConvexNeighbours = (
  board: Board,
  minSharedBorder: number,
  tolerance: number,
): Board => {
  const pieces: (Territory | null)[] = [...board.territories];
  const areaSlack = Math.max(tolerance, 1e-9) * board.radius * 10;

  let merged = true;
  while (merged) {
    merged = false;
    for (let i = 0; i < pieces.length; i++) {
      for (let j = i + 1; j < pieces.length; j++) {
        const a = pieces[i];
        const b = pieces[j];
        if (!a || !b || a.ownerId !== b.ownerId) continue;
        if (!boxesTouch(a, b, tolerance)) continue;
        if (sharedBorderUpTo(a.ring, b.ring, minSharedBorder, tolerance) < minSharedBorder) continue;
        const hull = convexHull([...a.ring, ...b.ring]);
        if (Math.abs(area(hull) - area(a.ring) - area(b.ring)) > areaSlack) continue;
        pieces[i] = { ...a, ring: hull };
        pieces[j] = null;
        merged = true;
      }
    }
  }

  const territories = pieces.filter((t): t is Territory => t !== null);
  return territories.length === board.territories.length ? board : { ...board, territories };
};

const boxesTouch = (a: Territory, b: Territory, tolerance: number): boolean => {
  const [p, q] = [bounds(a.ring), bounds(b.ring)];
  return (
    p.min[0] <= q.max[0] + tolerance &&
    q.min[0] <= p.max[0] + tolerance &&
    p.min[1] <= q.max[1] + tolerance &&
    q.min[1] <= p.max[1] + tolerance
  );
};

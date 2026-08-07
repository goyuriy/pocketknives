import type { Ring, Vec2 } from '../types.js';
import { EPS, add, cross, scale, sub } from './vector.js';
import { edges } from './ring.js';

/** Where a ray left the polygon: the point, and which edge it crossed. */
export type BoundaryHit = {
  readonly point: Vec2;
  readonly edgeIndex: number;
  readonly distance: number;
};

/**
 * First point at which a ray from `origin` along `direction` meets the ring.
 *
 * This is the rule "the line stops where it meets another line" expressed
 * literally: the ray is fired from where the blade bit in, and whatever border
 * it reaches first — a neighbour's edge or the arena rim — is where the cut
 * ends. Returns null if the ray never meets the ring, which for an origin
 * inside a closed polygon only happens on numerical edge cases.
 */
export const firstBoundaryHit = (
  ring: Ring,
  origin: Vec2,
  direction: Vec2,
): BoundaryHit | null => {
  let best: BoundaryHit | null = null;

  for (const [a, b, index] of edges(ring)) {
    const edge = sub(b, a);
    const denominator = cross(direction, edge);
    if (Math.abs(denominator) < EPS) continue; // parallel: no single crossing

    const toEdgeStart = sub(a, origin);
    const t = cross(toEdgeStart, edge) / denominator; // distance along the ray
    const u = cross(toEdgeStart, direction) / denominator; // position along the edge

    if (t <= EPS || u < -EPS || u > 1 + EPS) continue;
    if (best && t >= best.distance) continue;

    best = { point: add(origin, scale(direction, t)), edgeIndex: index, distance: t };
  }

  return best;
};

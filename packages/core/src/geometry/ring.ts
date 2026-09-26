import type { Ring, Vec2 } from '../types.js';
import { EPS, distance, distanceToSegment, lerp } from './vector.js';

/** Walks the closed edges of a ring, including the wrap-around edge. */
export function* edges(ring: Ring): Generator<readonly [Vec2, Vec2, number]> {
  for (let i = 0; i < ring.length; i++) {
    yield [ring[i]!, ring[(i + 1) % ring.length]!, i] as const;
  }
}

/** Signed area — positive when the ring winds counter-clockwise. */
export const signedArea = (ring: Ring): number => {
  let sum = 0;
  for (const [a, b] of edges(ring)) sum += a[0] * b[1] - b[0] * a[1];
  return sum / 2;
};

export const area = (ring: Ring): number => Math.abs(signedArea(ring));

export const perimeter = (ring: Ring): number => {
  let sum = 0;
  for (const [a, b] of edges(ring)) sum += distance(a, b);
  return sum;
};

export const centroid = (ring: Ring): Vec2 => {
  const a2 = signedArea(ring) * 6;
  if (Math.abs(a2) < EPS) {
    // Degenerate sliver: fall back to the vertex average so callers always get
    // a usable point (labels, camera targets) instead of NaN.
    const sum = ring.reduce<[number, number]>((acc, p) => [acc[0] + p[0], acc[1] + p[1]], [0, 0]);
    return [sum[0] / ring.length, sum[1] / ring.length];
  }
  let cx = 0;
  let cy = 0;
  for (const [p, q] of edges(ring)) {
    const w = p[0] * q[1] - q[0] * p[1];
    cx += (p[0] + q[0]) * w;
    cy += (p[1] + q[1]) * w;
  }
  return [cx / a2, cy / a2];
};

/** Even-odd ray casting. Points exactly on the boundary are not guaranteed either way. */
export const containsPoint = (ring: Ring, p: Vec2): boolean => {
  let inside = false;
  for (const [a, b] of edges(ring)) {
    const straddles = a[1] > p[1] !== b[1] > p[1];
    if (!straddles) continue;
    const xAtY = a[0] + ((p[1] - a[1]) / (b[1] - a[1])) * (b[0] - a[0]);
    if (p[0] < xAtY) inside = !inside;
  }
  return inside;
};

export const distanceToBoundary = (ring: Ring, p: Vec2): number => {
  let best = Infinity;
  for (const [a, b] of edges(ring)) best = Math.min(best, distanceToSegment(p, a, b));
  return best;
};

export const bounds = (ring: Ring): { min: Vec2; max: Vec2 } => {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const [x, y] of ring) {
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, x);
    maxY = Math.max(maxY, y);
  }
  return { min: [minX, minY], max: [maxX, maxY] };
};

/** Drops vertices that collapsed onto their neighbour during a cut. */
export const dropDuplicateVertices = (ring: Ring, tolerance: number): Ring => {
  const out: Vec2[] = [];
  for (const p of ring) {
    const last = out[out.length - 1];
    if (!last || distance(last, p) > tolerance) out.push(p);
  }
  while (out.length > 1 && distance(out[0]!, out[out.length - 1]!) <= tolerance) out.pop();
  return out;
};

/**
 * How much of `ring`'s outline lies on top of `other`'s outline.
 *
 * Two territories are neighbours when they share a stretch of border, so this is
 * the test behind "the piece you cut must touch land you already own". It
 * samples each edge rather than computing an exact overlap: the shapes here are
 * always produced by chord cuts, so shared borders are exact sub-segments and a
 * modest sample count resolves them cleanly.
 */
export const sharedBorderLength = (ring: Ring, other: Ring, tolerance: number): number =>
  measureSharedBorder(ring, other, tolerance, Infinity);

/**
 * Whether two outlines run together for at least `atLeast`.
 *
 * The adjacency question is almost always a yes/no one, and answering it that
 * way lets the scan stop the moment the threshold is passed. Measuring the full
 * length instead costs a pass over every edge against every other edge — fine
 * once, ruinous when it runs on each frame of an aim drag.
 */
export const sharedBorderUpTo = (
  ring: Ring,
  other: Ring,
  stopAt: number,
  tolerance: number,
): number => measureSharedBorder(ring, other, tolerance, stopAt);

/**
 * Measured from both sides, and the longer taken.
 *
 * Sampling only one outline's edges is lopsided: a long edge touched along a
 * short stretch by a small neighbour can have every sample miss that stretch,
 * and two pieces that plainly touch read as apart. From the small neighbour's
 * side the same stretch is its whole edge, and cannot be missed.
 */
const measureSharedBorder = (
  ring: Ring,
  other: Ring,
  tolerance: number,
  stopAt: number,
): number => {
  if (!boundsOverlap(ring, other, tolerance)) return 0;
  const one = measureAlong(ring, other, tolerance, stopAt);
  return one >= stopAt ? one : Math.max(one, measureAlong(other, ring, tolerance, stopAt));
};

/** How much of `ring`'s outline runs along `other`'s, sampled along `ring`'s edges. */
const measureAlong = (ring: Ring, other: Ring, tolerance: number, stopAt: number): number => {
  const SAMPLES = 8;
  let shared = 0;
  for (const [a, b] of edges(ring)) {
    const edgeLength = distance(a, b);
    if (edgeLength < tolerance) continue;
    let hits = 0;
    for (let s = 0; s < SAMPLES; s++) {
      const t = (s + 0.5) / SAMPLES;
      if (distanceToBoundary(other, lerp(a, b, t)) <= tolerance) hits++;
    }
    shared += edgeLength * (hits / SAMPLES);
    if (shared >= stopAt) return shared;
  }
  return shared;
};

const boundsOverlap = (a: Ring, b: Ring, tolerance: number): boolean => {
  const boxA = bounds(a);
  const boxB = bounds(b);
  return (
    boxA.min[0] - tolerance <= boxB.max[0] &&
    boxB.min[0] - tolerance <= boxA.max[0] &&
    boxA.min[1] - tolerance <= boxB.max[1] &&
    boxB.min[1] - tolerance <= boxA.max[1]
  );
};

/**
 * Radius of the largest circle that fits inside `ring` — our proxy for "can this
 * player still stand on their own land?".
 *
 * Approximated by a coarse grid sweep followed by a local refinement pass. Exact
 * maximum-inscribed-circle algorithms exist but are far more machinery than an
 * elimination check needs.
 */
export const largestInscribedRadius = (ring: Ring): number => {
  if (ring.length < 3) return 0;
  const { min, max } = bounds(ring);
  const width = max[0] - min[0];
  const height = max[1] - min[1];
  if (width < EPS || height < EPS) return 0;

  let best = 0;
  let bestPoint: Vec2 = [min[0] + width / 2, min[1] + height / 2];
  const GRID = 48;
  for (let i = 0; i <= GRID; i++) {
    for (let j = 0; j <= GRID; j++) {
      const p: Vec2 = [min[0] + (width * i) / GRID, min[1] + (height * j) / GRID];
      if (!containsPoint(ring, p)) continue;
      const d = distanceToBoundary(ring, p);
      if (d > best) {
        best = d;
        bestPoint = p;
      }
    }
  }

  let step = Math.max(width, height) / GRID;
  for (let pass = 0; pass < 6; pass++) {
    step /= 2;
    for (const [dx, dy] of [
      [step, 0],
      [-step, 0],
      [0, step],
      [0, -step],
    ] as const) {
      const p: Vec2 = [bestPoint[0] + dx, bestPoint[1] + dy];
      if (!containsPoint(ring, p)) continue;
      const d = distanceToBoundary(ring, p);
      if (d > best) {
        best = d;
        bestPoint = p;
      }
    }
  }
  return best;
};

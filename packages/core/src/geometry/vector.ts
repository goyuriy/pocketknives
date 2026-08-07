import type { Vec2 } from '../types.js';

export const EPS = 1e-9;

export const add = (a: Vec2, b: Vec2): Vec2 => [a[0] + b[0], a[1] + b[1]];
export const sub = (a: Vec2, b: Vec2): Vec2 => [a[0] - b[0], a[1] - b[1]];
export const scale = (a: Vec2, k: number): Vec2 => [a[0] * k, a[1] * k];

/**
 * The 2D cross product: the signed area of the parallelogram spanned by `a` and
 * `b`. Its sign tells you which side of `a` the vector `b` falls on, which is
 * the workhorse behind every line/segment test below.
 */
export const cross = (a: Vec2, b: Vec2): number => a[0] * b[1] - a[1] * b[0];

export const length = (a: Vec2): number => Math.hypot(a[0], a[1]);
export const distance = (a: Vec2, b: Vec2): number => length(sub(a, b));

export const normalize = (a: Vec2): Vec2 => {
  const len = length(a);
  return len < EPS ? [0, 0] : [a[0] / len, a[1] / len];
};

/** Shortest distance from `p` to the segment `a`–`b`. */
export const distanceToSegment = (p: Vec2, a: Vec2, b: Vec2): number => {
  const ab = sub(b, a);
  const lenSq = ab[0] * ab[0] + ab[1] * ab[1];
  if (lenSq < EPS) return distance(p, a);
  const ap = sub(p, a);
  const t = Math.max(0, Math.min(1, (ap[0] * ab[0] + ap[1] * ab[1]) / lenSq));
  return distance(p, add(a, scale(ab, t)));
};

export const lerp = (a: Vec2, b: Vec2, t: number): Vec2 => add(a, scale(sub(b, a), t));

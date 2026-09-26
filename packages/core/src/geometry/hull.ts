import type { Ring, Vec2 } from '../types.js';
import { cross, sub } from './vector.js';

/**
 * The convex hull of a set of points: the tightest convex polygon holding them
 * all, counter-clockwise, without collinear points.
 *
 * Andrew's monotone chain — sort, then sweep once along the bottom and once
 * along the top, dropping any point that makes the chain turn the wrong way.
 */
export const convexHull = (points: readonly Vec2[]): Ring => {
  const sorted = [...points].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  if (sorted.length < 3) return sorted;

  const turnsLeft = (chain: Vec2[], p: Vec2) =>
    cross(sub(chain[chain.length - 1]!, chain[chain.length - 2]!), sub(p, chain[chain.length - 1]!)) > 1e-12;

  const sweep = (ordered: readonly Vec2[]): Vec2[] => {
    const chain: Vec2[] = [];
    for (const p of ordered) {
      while (chain.length >= 2 && !turnsLeft(chain, p)) chain.pop();
      chain.push(p);
    }
    chain.pop(); // the last point starts the other chain
    return chain;
  };

  return [...sweep(sorted), ...sweep([...sorted].reverse())];
};

import type { Ring, Vec2 } from '../types.js';
import type { BoundaryHit } from './raycast.js';
import { area, dropDuplicateVertices } from './ring.js';

export type SplitResult = {
  readonly pieces: readonly [Ring, Ring];
  readonly chord: readonly [Vec2, Vec2];
};

/**
 * Cuts a ring in two along a chord whose endpoints lie on its own outline.
 *
 * The two hits are inserted as vertices and the outline is walked twice — once
 * forward from `hitA` to `hitB`, once from `hitB` back around to `hitA` — which
 * yields the two halves without any polygon-boolean machinery. This is exact
 * for the shapes this game produces (simple, hole-free, cut only by chords).
 *
 * Returns null when the cut is degenerate: both ends landing on the same edge,
 * or one half collapsing to a sliver of no consequence.
 */
export const splitRingByChord = (
  ring: Ring,
  hitA: BoundaryHit,
  hitB: BoundaryHit,
  tolerance: number,
): SplitResult | null => {
  if (hitA.edgeIndex === hitB.edgeIndex) return null;

  const walkForward = (from: BoundaryHit, to: BoundaryHit): Vec2[] => {
    const out: Vec2[] = [from.point];
    let index = (from.edgeIndex + 1) % ring.length;
    // Guard the walk by the vertex count so a corrupt hit pair can never loop.
    for (let steps = 0; steps <= ring.length; steps++) {
      out.push(ring[index]!);
      if (index === to.edgeIndex) break;
      index = (index + 1) % ring.length;
    }
    out.push(to.point);
    return out;
  };

  const first = dropDuplicateVertices(walkForward(hitA, hitB), tolerance);
  const second = dropDuplicateVertices(walkForward(hitB, hitA), tolerance);

  if (first.length < 3 || second.length < 3) return null;
  const minArea = tolerance * tolerance;
  if (area(first) <= minArea || area(second) <= minArea) return null;

  return { pieces: [first, second], chord: [hitA.point, hitB.point] };
};

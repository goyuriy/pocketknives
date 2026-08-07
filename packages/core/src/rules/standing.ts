import type { Board, PlayerId, Vec2 } from '../types.js';
import { containsPoint } from '../geometry/ring.js';

/** A stretch of the rim, as bearings. `to` may exceed 2π where the arc wraps. */
export type RimArc = {
  readonly from: number;
  readonly to: number;
};

export const arcLength = (arc: RimArc): number => arc.to - arc.from;

/**
 * The stretches of rim a player may stand on.
 *
 * You throw from your own ground, so where you may stand is whatever you still
 * hold at the edge of the circle. That makes rim frontage worth something in its
 * own right: a player squeezed inland keeps their area but loses the angles they
 * can throw from, and can find themselves holding plenty of ground with no line
 * on anybody.
 *
 * Sampled around the rim rather than derived from the polygons, because a
 * territory's edge meets the rim in arcs made of many short segments and reading
 * them back out is fiddler's work for no gain — the answer only needs to be
 * accurate to where a person could stand.
 */
export const ownedRimArcs = (
  board: Board,
  ownerId: PlayerId,
  samples = 360,
): RimArc[] => {
  const step = (2 * Math.PI) / samples;
  // Probe just inside the rim: exactly on it the containment test is undecided.
  const radius = board.radius * 0.995;
  const owned = Array.from({ length: samples }, (_, i) => {
    const bearing = i * step;
    const probe: Vec2 = [Math.cos(bearing) * radius, Math.sin(bearing) * radius];
    return board.territories.some((t) => t.ownerId === ownerId && containsPoint(t.ring, probe));
  });

  if (owned.every(Boolean)) return [{ from: 0, to: 2 * Math.PI }];
  if (!owned.some(Boolean)) return [];

  // Start from a gap so a run spanning bearing zero comes out as one arc rather
  // than two that happen to meet at the seam.
  const start = owned.indexOf(false);
  const arcs: RimArc[] = [];
  let runStart: number | null = null;

  for (let n = 0; n <= samples; n++) {
    const i = (start + n) % samples;
    const here = n < samples && owned[i];
    if (here && runStart === null) runStart = n;
    if (!here && runStart !== null) {
      arcs.push({ from: (start + runStart) * step, to: (start + n) * step });
      runStart = null;
    }
  }
  return arcs;
};

/**
 * Where a player stands, given how far along their frontage they choose to be.
 *
 * `position` runs from 0 to 1 across the widest stretch they hold. Expressed as
 * a fraction rather than an angle so a choice survives the ground moving under
 * it: lose half your frontage and you are still standing proportionally where
 * you were, not suddenly outside your own land.
 *
 * Arcs keep an unwrapped form — an arc across the seam runs past 2π — because
 * that is what makes their length readable. A single bearing has no such need,
 * so it comes back wrapped, and callers can compare it without knowing any of
 * this.
 */
export const standingBearing = (
  board: Board,
  ownerId: PlayerId,
  position: number,
): number | null => {
  const arcs = ownedRimArcs(board, ownerId);
  if (arcs.length === 0) return null;
  const widest = arcs.reduce((best, arc) => (arcLength(arc) > arcLength(best) ? arc : best));
  const bearing = widest.from + arcLength(widest) * Math.min(1, Math.max(0, position));
  return ((bearing % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
};

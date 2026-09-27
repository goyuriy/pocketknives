import { containsPoint, distanceToSegment, type FieldOutline, type Vec2 } from '@pocketknives/core';

/** A piece of the line, from one end to the other. */
export type LinePiece = readonly [Vec2, Vec2];

/** How finely the ground is measured for the line, in arena units. Fine enough that the line reads smooth. */
const CELL = 0.1;

/**
 * The edge of a player's reach, as a line all the way round their ground:
 * every point exactly `reach` from the nearest of it, inside the circle.
 *
 * Found the way a contour line is drawn on a map (marching squares): the
 * distance to the player's ground is measured over a fine grid, and wherever
 * it passes `reach` between two neighbouring points, the line crosses there.
 * That handles every shape of ground at once — straight runs along each
 * border, round the corners, and where the reach of two separate pieces of
 * ground meets — and gives a line with no gaps, where offsetting the borders
 * one by one leaves overlaps to trim.
 *
 * Pure. Costs a few milliseconds, so the caller keeps the result until the
 * ground or the reach changes.
 */
export const reachOutline = (
  fields: readonly Pick<FieldOutline, 'rings'>[],
  reach: number,
  arenaRadius: number,
  cell: number = CELL,
): LinePiece[] => {
  const rings = fields.flatMap((field) => field.rings);
  if (!(reach > 0) || !Number.isFinite(reach) || rings.length === 0) return [];
  const edges = rings.flatMap((ring) => ring.map((a, i): LinePiece => [a, ring[(i + 1) % ring.length]!]));

  const side = Math.ceil((2 * arenaRadius) / cell);
  const at = (i: number, j: number): Vec2 => [-arenaRadius + i * cell, -arenaRadius + j * cell];
  // How far past the reach each grid point is: negative within it, positive beyond.
  const beyond = new Float64Array((side + 1) * (side + 1));
  for (let j = 0; j <= side; j++) {
    for (let i = 0; i <= side; i++) {
      const p = at(i, j);
      let distance = Infinity;
      if (!rings.some((ring) => containsPoint(ring, p))) {
        for (const [a, b] of edges) distance = Math.min(distance, distanceToSegment(p, a, b));
      } else distance = 0;
      beyond[j * (side + 1) + i] = distance - reach;
    }
  }

  const value = (i: number, j: number) => beyond[j * (side + 1) + i]!;
  const crossing = (p: Vec2, q: Vec2, vp: number, vq: number): Vec2 => {
    const t = vp / (vp - vq);
    return [p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t];
  };
  const inside = (p: Vec2) => Math.hypot(p[0], p[1]) <= arenaRadius;

  const pieces: LinePiece[] = [];
  for (let j = 0; j < side; j++) {
    for (let i = 0; i < side; i++) {
      // The cell's corners, round it: bottom left, bottom right, top right, top left.
      const corners = [at(i, j), at(i + 1, j), at(i + 1, j + 1), at(i, j + 1)];
      const values = [value(i, j), value(i + 1, j), value(i + 1, j + 1), value(i, j + 1)];
      const crossings: Vec2[] = [];
      for (let k = 0; k < 4; k++) {
        const [va, vb] = [values[k]!, values[(k + 1) % 4]!];
        if (va < 0 !== vb < 0) crossings.push(crossing(corners[k]!, corners[(k + 1) % 4]!, va, vb));
      }
      // Two crossings are one piece of line; four (a saddle) are two, paired round the cell.
      for (let k = 0; k + 1 < crossings.length; k += 2) {
        const piece: LinePiece = [crossings[k]!, crossings[k + 1]!];
        if (inside(piece[0]) && inside(piece[1])) pieces.push(piece);
      }
    }
  }
  return pieces;
};

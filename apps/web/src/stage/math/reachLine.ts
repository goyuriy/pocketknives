import { containsPoint, distanceToSegment, type FieldOutline, type Vec2 } from '@pocketknives/core';

/** Room between chalk dots, in arena units. */
const DOT_SPACING = 0.35;
/** How close to the exact reach a dot must fall to be on the line. */
const ON_THE_LINE = 1e-3;

/**
 * Where to chalk the edge of a player's reach: dots `reach` out from their
 * ground, all the way round it, inside the circle.
 *
 * The edge of everything within `reach` of a field is made of the field's own
 * borders pushed straight out, joined by arcs round its corners. So the dots
 * are sampled along those, and each is kept only if it really is `reach` from
 * the nearest ground — the push-outs and arcs overlap near the corners, and a
 * dot that is nearer some other border is inside the reach, not on its edge.
 * A dotted line survives the gaps that leaves; a solid one would show them.
 */
export const reachDots = (
  fields: readonly Pick<FieldOutline, 'rings' | 'segments'>[],
  reach: number,
  arenaRadius: number,
  spacing: number = DOT_SPACING,
): Vec2[] => {
  if (!(reach > 0) || !Number.isFinite(reach)) return [];
  const segments = fields.flatMap((field) => field.segments);
  const rings = fields.flatMap((field) => field.rings);

  const candidates: Vec2[] = [];
  for (const [a, b] of segments) {
    const dx = b[0] - a[0];
    const dy = b[1] - a[1];
    const length = Math.hypot(dx, dy);
    if (length === 0) continue;
    const normal: Vec2 = [-dy / length, dx / length];
    const steps = Math.max(1, Math.ceil(length / spacing));
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      for (const side of [1, -1]) {
        candidates.push([a[0] + dx * t + normal[0] * reach * side, a[1] + dy * t + normal[1] * reach * side]);
      }
    }
    const around = Math.max(8, Math.ceil((2 * Math.PI * reach) / spacing));
    for (let i = 0; i < around; i++) {
      const angle = (2 * Math.PI * i) / around;
      candidates.push([a[0] + Math.cos(angle) * reach, a[1] + Math.sin(angle) * reach]);
    }
  }

  const taken = new Set<string>();
  const cell = spacing * 0.6;
  const dots: Vec2[] = [];
  for (const p of candidates) {
    if (Math.hypot(p[0], p[1]) > arenaRadius) continue;
    const key = `${Math.round(p[0] / cell)},${Math.round(p[1] / cell)}`;
    if (taken.has(key)) continue;
    if (rings.some((ring) => containsPoint(ring, p))) continue;
    let nearest = Infinity;
    for (const [a, b] of segments) nearest = Math.min(nearest, distanceToSegment(p, a, b));
    if (nearest < reach - ON_THE_LINE) continue;
    taken.add(key);
    dots.push(p);
  }
  return dots;
};

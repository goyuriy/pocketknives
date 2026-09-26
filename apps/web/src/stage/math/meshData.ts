import type { Ring, Vec2, Vec3 } from '@pocketknives/core';

/**
 * Raw triangles, ready to hand to any engine's vertex buffers.
 *
 * Kept engine-free on purpose: this is where the shapes are actually worked out,
 * and doing it in plain arrays means it can be tested without a GPU and would
 * survive a change of engine untouched.
 */
export type MeshData = {
  readonly positions: readonly number[];
  readonly normals: readonly number[];
  readonly indices: readonly number[];
};

const EMPTY: MeshData = { positions: [], normals: [], indices: [] };

/** Several meshes as one, so a whole field or set of borders is a single draw. */
export const merge = (parts: readonly MeshData[]): MeshData => {
  // Built in place: a border is hundreds of quads, and copying the growing
  // arrays at every step would make that quadratic. Nothing escapes until done.
  const positions: number[] = [];
  const normals: number[] = [];
  const indices: number[] = [];
  for (const part of parts) {
    const offset = positions.length / 3;
    positions.push(...part.positions);
    normals.push(...part.normals);
    for (const index of part.indices) indices.push(index + offset);
  }
  return { positions, normals, indices };
};

/**
 * A flat polygon at height `z`, facing up.
 *
 * Triangulated as a fan from the first corner, which is exact for a convex
 * polygon — and every territory is convex, an invariant the rules guarantee
 * (a chord cut of a convex shape leaves two convex shapes). That is why no
 * general-purpose triangulator is needed here.
 */
export const flatPolygon = (ring: Ring, z: number): MeshData => {
  if (ring.length < 3) return EMPTY;
  return {
    positions: ring.flatMap(([x, y]) => [x, y, z]),
    normals: ring.flatMap(() => [0, 0, 1]),
    indices: ring.slice(2).flatMap((_, i) => [0, i + 1, i + 2]),
  };
};

/**
 * A line with width, as a flat quad at height `z`.
 *
 * Line primitives ignore line width on almost every platform, so a border that
 * must read clearly from a low camera has to be actual geometry.
 */
export const ribbon = ([ax, ay]: Vec2, [bx, by]: Vec2, width: number, z: number): MeshData => {
  const dx = bx - ax;
  const dy = by - ay;
  const length = Math.hypot(dx, dy) || 1;
  const nx = (-dy / length) * (width / 2);
  const ny = (dx / length) * (width / 2);
  return flatPolygon(
    [
      [ax + nx, ay + ny],
      [bx + nx, by + ny],
      [bx - nx, by - ny],
      [ax - nx, ay - ny],
    ],
    z,
  );
};

/**
 * A convex outline given thickness, standing on edge.
 *
 * The outline is drawn in the `x`–`z` plane — the plane a knife tumbles
 * through — and thickened along `y`. Every face gets its own corners so the
 * shading is flat and crisp: a knife has to look obviously different edge-on and
 * flat-on, because reading its turn is how a player reads the throw.
 */
export const slab = (outline: readonly Vec2[], thickness: number): MeshData => {
  const half = thickness / 2;
  const at = ([u, v]: Vec2, side: number): Vec3 => [u, side * half, v];
  const faces: MeshData[] = [];

  const cap = (side: number): MeshData => {
    const corners = outline.map((point) => at(point, side));
    return {
      positions: corners.flat(),
      normals: corners.flatMap(() => [0, side, 0]),
      indices: outline.slice(2).flatMap((_, i) => [0, i + 1, i + 2]),
    };
  };
  faces.push(cap(1), cap(-1));

  outline.forEach((from, i) => {
    const to = outline[(i + 1) % outline.length]!;
    const du = to[0] - from[0];
    const dv = to[1] - from[1];
    const length = Math.hypot(du, dv) || 1;
    // Outward in the outline's plane for a counter-clockwise outline; the
    // material draws both sides, so a clockwise one still shades acceptably.
    const normal: Vec3 = [dv / length, 0, -du / length];
    faces.push({
      positions: [...at(from, 1), ...at(to, 1), ...at(to, -1), ...at(from, -1)],
      normals: [...normal, ...normal, ...normal, ...normal],
      indices: [0, 1, 2, 0, 2, 3],
    });
  });

  return merge(faces);
};

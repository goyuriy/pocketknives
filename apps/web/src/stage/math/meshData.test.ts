import { describe, expect, it } from 'vitest';
import type { Ring } from '@pocketknives/core';
import { flatPolygon, merge, ribbon, slab } from './meshData.js';

const square: Ring = [[0, 0], [1, 0], [1, 1], [0, 1]];

describe('meshData', () => {
  it('fans a convex polygon into one triangle per corner past the second', () => {
    const mesh = flatPolygon(square, 0.5);
    expect(mesh.indices).toEqual([0, 1, 2, 0, 2, 3]);
    expect(mesh.positions.filter((_, i) => i % 3 === 2).every((z) => z === 0.5)).toBe(true);
  });

  it('gives a ribbon the width asked for', () => {
    const mesh = ribbon([0, 0], [2, 0], 0.2, 0);
    const ys = mesh.positions.filter((_, i) => i % 3 === 1);
    expect(Math.max(...ys) - Math.min(...ys)).toBeCloseTo(0.2, 9);
  });

  it('offsets indices when merging, so every triangle still points at its own corners', () => {
    const both = merge([flatPolygon(square, 0), flatPolygon(square, 1)]);
    expect(both.positions).toHaveLength(24);
    expect(Math.max(...both.indices)).toBe(7);
    expect(both.indices.slice(6)).toEqual([4, 5, 6, 4, 6, 7]);
  });

  it('builds a closed slab: two caps and a side per edge, of the thickness asked', () => {
    const mesh = slab(square, 0.1);
    // 2 caps × 2 triangles + 4 sides × 2 triangles
    expect(mesh.indices.length / 3).toBe(12);
    const ys = mesh.positions.filter((_, i) => i % 3 === 1);
    expect(Math.max(...ys) - Math.min(...ys)).toBeCloseTo(0.1, 9);
    expect(mesh.normals).toHaveLength(mesh.positions.length);
  });
});

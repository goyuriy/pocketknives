import { describe, expect, it } from 'vitest';
import { circleRing } from '../rules/board.js';
import { firstBoundaryHit } from './raycast.js';
import { splitRingByChord } from './split.js';
import {
  area,
  centroid,
  containsPoint,
  largestInscribedRadius,
  sharedBorderLength,
} from './ring.js';

const square = [
  [0, 0],
  [4, 0],
  [4, 4],
  [0, 4],
] as const;

describe('ring measurements', () => {
  it('measures area and centre of a square', () => {
    expect(area(square)).toBe(16);
    expect(centroid(square)).toEqual([2, 2]);
  });

  it('approaches the true circle area as segments increase', () => {
    expect(area(circleRing(10, 720))).toBeCloseTo(Math.PI * 100, 1);
  });

  it('tells inside from outside', () => {
    expect(containsPoint(square, [2, 2])).toBe(true);
    expect(containsPoint(square, [5, 2])).toBe(false);
  });

  it('finds the inscribed circle of a square', () => {
    expect(largestInscribedRadius(square)).toBeCloseTo(2, 1);
  });

  it('reports no shared border between separated shapes', () => {
    const far = [
      [10, 10],
      [12, 10],
      [12, 12],
    ] as const;
    expect(sharedBorderLength(square, far, 1e-6)).toBe(0);
  });

  it('measures the border two touching shapes have in common', () => {
    const neighbour = [
      [4, 0],
      [8, 0],
      [8, 4],
      [4, 4],
    ] as const;
    expect(sharedBorderLength(square, neighbour, 1e-6)).toBeCloseTo(4, 6);
  });
});

describe('firstBoundaryHit', () => {
  it('stops at the nearest edge, not a further one', () => {
    const hit = firstBoundaryHit(square, [1, 2], [1, 0]);
    expect(hit?.point[0]).toBeCloseTo(4, 9);
    expect(hit?.distance).toBeCloseTo(3, 9);
  });

  it('reports the distance in world units for a unit direction', () => {
    const hit = firstBoundaryHit(square, [2, 2], [0, 1]);
    expect(hit?.distance).toBeCloseTo(2, 9);
  });
});

describe('splitRingByChord', () => {
  it('divides a square into two halves that add back up', () => {
    const right = firstBoundaryHit(square, [2, 2], [1, 0])!;
    const left = firstBoundaryHit(square, [2, 2], [-1, 0])!;
    const split = splitRingByChord(square, right, left, 1e-9);

    expect(split).not.toBeNull();
    const [first, second] = split!.pieces;
    expect(area(first)).toBeCloseTo(8, 9);
    expect(area(second)).toBeCloseTo(8, 9);
    expect(area(first) + area(second)).toBeCloseTo(area(square), 9);
  });

  it('refuses a cut with both ends on one edge', () => {
    const hit = firstBoundaryHit(square, [2, 2], [1, 0])!;
    expect(splitRingByChord(square, hit, hit, 1e-9)).toBeNull();
  });
});

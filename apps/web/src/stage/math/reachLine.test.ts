import { describe, expect, it } from 'vitest';
import { createBoard, distanceToLand, fieldOutlines } from '@pocketknives/core';
import { reachOutline } from './reachLine.js';

const RADIUS = 10;
const board = createBoard(['a', 'b', 'c', 'd'], RADIUS);
const fieldsOf = (id: string) => fieldOutlines(board, 0.05, RADIUS * 1e-6).filter((f) => f.ownerId === id);

describe('reachOutline', () => {
  const line = reachOutline(fieldsOf('a'), 2, RADIUS);
  const ends = line.flat();

  it('runs exactly a reach from your ground, inside the circle', () => {
    expect(line.length).toBeGreaterThan(50);
    for (const p of ends) {
      expect(distanceToLand(board, 'a', p)).toBeCloseTo(2, 1);
      expect(Math.hypot(p[0], p[1])).toBeLessThanOrEqual(RADIUS);
    }
  });

  it('goes right round your ground: along both borders and round the centre corner', () => {
    // a holds the upper right quarter: the line runs beside each border and
    // swings round the corner at the centre.
    expect(ends.some(([x, y]) => x < -1.9 && y > 3)).toBe(true);
    expect(ends.some(([x, y]) => y < -1.9 && x > 3)).toBe(true);
    expect(ends.some(([x, y]) => x < -1 && y < -1)).toBe(true);
  });

  it('has no gaps: every end meets the start of another piece', () => {
    const key = ([x, y]: readonly [number, number]) => `${x.toFixed(6)},${y.toFixed(6)}`;
    const counts = new Map<string, number>();
    for (const p of ends) counts.set(key(p), (counts.get(key(p)) ?? 0) + 1);
    const loose = [...counts.values()].filter((n) => n === 1).length;
    // Only the two ends where the line meets the circle's rim are loose.
    expect(loose).toBeLessThanOrEqual(4);
  });

  it('draws nothing for a reach that has no edge', () => {
    expect(reachOutline(fieldsOf('a'), Infinity, RADIUS)).toEqual([]);
    expect(reachOutline([], 2, RADIUS)).toEqual([]);
  });
});

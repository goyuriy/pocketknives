import { describe, expect, it } from 'vitest';
import { createBoard, distanceToLand, fieldOutlines } from '@pocketknives/core';
import { reachDots } from './reachLine.js';

const RADIUS = 10;
const board = createBoard(['a', 'b', 'c', 'd'], RADIUS);
const fieldsOf = (id: string) => fieldOutlines(board, 0.05, RADIUS * 1e-6).filter((f) => f.ownerId === id);

describe('reachDots', () => {
  const dots = reachDots(fieldsOf('a'), 5, RADIUS);

  it('chalks every dot exactly a reach from your ground, inside the circle', () => {
    expect(dots.length).toBeGreaterThan(20);
    for (const dot of dots) {
      expect(distanceToLand(board, 'a', dot)).toBeCloseTo(5, 2);
      expect(Math.hypot(dot[0], dot[1])).toBeLessThanOrEqual(RADIUS);
    }
  });

  it('goes right round your ground: over both borders and round the centre corner', () => {
    // a holds the upper right quarter. The line runs parallel to each border
    // and swings round the corner at the centre.
    expect(dots.some(([x, y]) => x < -4.9 && y > 1)).toBe(true);
    expect(dots.some(([x, y]) => y < -4.9 && x > 1)).toBe(true);
    expect(dots.some(([x, y]) => x < -3 && y < -3)).toBe(true);
  });

  it('draws nothing for a reach that has no edge', () => {
    expect(reachDots(fieldsOf('a'), Infinity, RADIUS)).toEqual([]);
    expect(reachDots([], 5, RADIUS)).toEqual([]);
  });
});

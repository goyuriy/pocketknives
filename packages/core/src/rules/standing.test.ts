import { describe, expect, it } from 'vitest';
import type { Vec2 } from '../types.js';
import { createBoard } from './board.js';
import { resolveThrow } from './cut.js';
import { homeSpot, isOnOwnLand, keepOnOwnLand } from './standing.js';

const RADIUS = 10;
// Four wedges: 'a' holds the upper right quarter (x > 0, y > 0).
const board = createBoard(['a', 'b', 'c', 'd'], RADIUS);

describe('isOnOwnLand', () => {
  it('knows your ground from everyone else’s', () => {
    expect(isOnOwnLand(board, 'a', [3, 3])).toBe(true);
    expect(isOnOwnLand(board, 'a', [-3, 3])).toBe(false);
    expect(isOnOwnLand(board, 'a', [30, 30])).toBe(false);
  });
});

describe('keepOnOwnLand', () => {
  it('takes a step that stays on your ground as it is', () => {
    expect(keepOnOwnLand(board, 'a', [3, 3], [4, 3.5])).toEqual([4, 3.5]);
  });

  it('slides along your border instead of crossing it', () => {
    // Walking up-left from near the y axis: the leftward part would cross into
    // b's ground, so only the upward part is kept.
    const step = keepOnOwnLand(board, 'a', [0.2, 3], [-0.5, 3.6]);
    expect(step).toEqual([0.2, 3.6]);
    expect(isOnOwnLand(board, 'a', step)).toBe(true);
  });

  it('never ends a step on someone else’s ground', () => {
    const from: Vec2 = [2, 2];
    for (let angle = 0; angle < 2 * Math.PI; angle += 0.3) {
      const to: Vec2 = [from[0] + Math.cos(angle) * 3, from[1] + Math.sin(angle) * 3];
      expect(isOnOwnLand(board, 'a', keepOnOwnLand(board, 'a', from, to))).toBe(true);
    }
  });

  it('goes as far as it can when both slides are blocked', () => {
    // Straight into the corner at the centre: both axes leave a's quarter.
    const step = keepOnOwnLand(board, 'a', [0.5, 0.5], [-0.5, -0.5]);
    expect(isOnOwnLand(board, 'a', step)).toBe(true);
    // As far as it can go is the corner itself.
    expect(step[0]).toBeCloseTo(0, 2);
    expect(step[1]).toBeCloseTo(0, 2);
  });

  it('lets a player whose ground was taken from under them walk away', () => {
    expect(keepOnOwnLand(board, 'a', [-3, 3], [-3, 4])).toEqual([-3, 4]);
  });
});

describe('homeSpot', () => {
  it('starts a player in the middle of their own ground', () => {
    for (const player of ['a', 'b', 'c', 'd']) {
      expect(isOnOwnLand(board, player, homeSpot(board, player)!), player).toBe(true);
    }
  });

  it('picks the largest piece once a player holds several', () => {
    const outcome = resolveThrow(board, 'a', { point: [-1.5, 1.5], direction: [1, -1] });
    if (outcome.kind !== 'claimed') throw new Error(`expected a claim, got ${outcome.reason}`);
    const spot = homeSpot(outcome.board, 'a')!;
    expect(isOnOwnLand(outcome.board, 'a', spot)).toBe(true);
    expect(spot[0]).toBeGreaterThan(0); // in the original quarter, not the small gain
  });

  it('has nowhere to put a player with no ground', () => {
    expect(homeSpot(board, 'nobody')).toBeNull();
  });
});

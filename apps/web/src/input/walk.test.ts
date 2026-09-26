import { describe, expect, it } from 'vitest';
import { combineWalks, walkFromKeys, walkFromStick, walkStep, STANDING_STILL } from './walk.js';

describe('walk input', () => {
  it('reads WASD and the arrows alike', () => {
    expect(walkFromKeys(new Set(['KeyW']))).toEqual({ forward: 1, right: 0 });
    expect(walkFromKeys(new Set(['ArrowUp']))).toEqual({ forward: 1, right: 0 });
    expect(walkFromKeys(new Set(['KeyA', 'ArrowDown']))).toEqual({ forward: -1, right: -1 });
  });

  it('cancels opposite keys', () => {
    expect(walkFromKeys(new Set(['KeyW', 'KeyS']))).toEqual(STANDING_STILL);
  });

  it('ignores a stick resting near the centre, and starts from a crawl outside it', () => {
    expect(walkFromStick(0.1, -0.1)).toEqual(STANDING_STILL);
    expect(walkFromStick(0, -0.25).forward).toBeLessThan(0.15);
    expect(walkFromStick(0, -1).forward).toBeCloseTo(1, 9);
  });

  it('reads a stick pushed up as walking forward', () => {
    expect(walkFromStick(0, -1).forward).toBeGreaterThan(0);
    expect(walkFromStick(1, 0).right).toBeGreaterThan(0);
  });

  it('never walks faster diagonally than straight', () => {
    const diagonal = combineWalks(walkFromKeys(new Set(['KeyW', 'KeyD'])));
    expect(Math.hypot(diagonal.forward, diagonal.right)).toBeCloseTo(1, 9);
  });
});

describe('walkStep', () => {
  it('walks forward along the facing and right across it', () => {
    const north = Math.PI / 2;
    const ahead = walkStep([0, 0], { forward: 1, right: 0 }, north, 1, 3);
    expect(ahead[0]).toBeCloseTo(0, 9);
    expect(ahead[1]).toBeCloseTo(3, 9);
    const right = walkStep([0, 0], { forward: 0, right: 1 }, north, 1, 3);
    expect(right[0]).toBeCloseTo(3, 9); // facing north, right is east
  });
});

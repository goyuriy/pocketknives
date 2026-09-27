import { describe, expect, it } from 'vitest';
import { combineTurns, edgeTurn, turnedFacing, turnFromKeys, TURN_SPEED } from './turn.js';

describe('turning', () => {
  it('turns left on Q and right on E, and not at all on both', () => {
    expect(turnFromKeys(new Set(['KeyQ']))).toBe(-1);
    expect(turnFromKeys(new Set(['KeyE']))).toBe(1);
    expect(turnFromKeys(new Set(['KeyQ', 'KeyE']))).toBe(0);
    expect(turnFromKeys(new Set(['KeyW']))).toBe(0);
  });

  it('leaves a cursor across most of the screen alone, and turns hardest at the edge', () => {
    expect(edgeTurn(0, 1)).toBe(0);
    expect(edgeTurn(0.7, 1)).toBe(0);
    expect(edgeTurn(0.9, 1)).toBeCloseTo(0.5, 9);
    expect(edgeTurn(1, 1)).toBe(1);
    expect(edgeTurn(-1, 1)).toBe(-1);
  });

  it('never turns faster than a full turn, however many things ask', () => {
    expect(combineTurns(1, 1)).toBe(1);
    expect(combineTurns(-0.5, -0.8)).toBe(-1);
    expect(combineTurns(0.3, -0.3)).toBe(0);
  });

  it('turns right as a falling heading, at the turning speed', () => {
    expect(turnedFacing(1, 1, 0.5)).toBeCloseTo(1 - TURN_SPEED * 0.5, 9);
    expect(turnedFacing(1, -1, 0.5)).toBeGreaterThan(1);
  });

  it('goes all the way round, with nothing to stop it', () => {
    let facing = 0;
    for (let frame = 0; frame < 600; frame++) facing = turnedFacing(facing, 1, 1 / 60);
    expect(-facing).toBeGreaterThan(2 * Math.PI);
  });
});

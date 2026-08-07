import { describe, expect, it } from 'vitest';
import { createBoard } from './board.js';
import { resolveThrow } from './cut.js';
import { containsPoint } from '../geometry/ring.js';
import { arcLength, ownedRimArcs, standingBearing } from './standing.js';

const RADIUS = 10;
const board = createBoard(['a', 'b', 'c', 'd'], RADIUS);
const bearingOf = (x: number, y: number) => ((Math.atan2(y, x) + 2 * Math.PI) % (2 * Math.PI));

describe('where a player may stand', () => {
  it('gives each opening wedge a quarter of the rim', () => {
    for (const player of ['a', 'b', 'c', 'd']) {
      const arcs = ownedRimArcs(board, player);
      expect(arcs).toHaveLength(1);
      expect(arcLength(arcs[0]!)).toBeCloseTo(Math.PI / 2, 1);
    }
  });

  it('places a stand on ground the player actually holds', () => {
    // 'a' opens holding bearings 0 to 90 degrees. Bearings come back wrapped, so
    // the far end of the arc reads as just under a full turn.
    for (const position of [0.05, 0.5, 0.95]) {
      const bearing = standingBearing(board, 'a', position)!;
      const probe: [number, number] = [Math.cos(bearing) * 9.5, Math.sin(bearing) * 9.5];
      const owner = board.territories.find((t) => containsPoint(t.ring, probe))?.ownerId;
      expect(owner, `position ${position} stood on ${owner}`).toBe('a');
    }
  });

  it('shrinks a player’s frontage when their edge is taken', () => {
    const before = arcLength(ownedRimArcs(board, 'b')[0]!);
    const outcome = resolveThrow(board, 'a', { point: [-1.5, 1.5], direction: [1, 1] });
    if (outcome.kind !== 'claimed') throw new Error('expected a claim');

    const after = ownedRimArcs(outcome.board, 'b');
    expect(after.reduce((sum, arc) => sum + arcLength(arc), 0)).toBeLessThan(before);
  });

  it('reports no frontage for a player with nothing on the rim', () => {
    expect(ownedRimArcs(board, 'nobody')).toEqual([]);
    expect(standingBearing(board, 'nobody', 0.5)).toBeNull();
  });

  it('reads a stretch spanning bearing zero as one arc, not two', () => {
    // 'a' opens on 0–90 degrees; two players puts one of them across the seam.
    const halves = createBoard(['x', 'y'], RADIUS);
    const across = ownedRimArcs(halves, 'y');
    expect(across).toHaveLength(1);
    expect(arcLength(across[0]!)).toBeCloseTo(Math.PI, 1);
  });

  it('keeps the widest stretch when holdings are split in two', () => {
    // Take a bite out of the middle of b's frontage so it becomes two arcs.
    const bitten = resolveThrow(board, 'a', { point: [-5, 5], direction: [1, 0] });
    if (bitten.kind !== 'claimed') throw new Error('expected a claim');
    const arcs = ownedRimArcs(bitten.board, 'b');
    const chosen = standingBearing(bitten.board, 'b', 0.5)!;
    const widest = arcs.reduce((best, arc) => (arcLength(arc) > arcLength(best) ? arc : best));
    expect(chosen).toBeGreaterThanOrEqual(widest.from);
    expect(chosen).toBeLessThanOrEqual(widest.to);
  });

  it('spans the frontage from one end to the other', () => {
    const near = standingBearing(board, 'a', 0)!;
    const far = standingBearing(board, 'a', 1)!;
    expect(bearingOf(Math.cos(far), Math.sin(far))).toBeCloseTo(Math.PI / 2, 1);
    expect(Math.min(near, 2 * Math.PI - near)).toBeLessThan(0.1);
  });
});

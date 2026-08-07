import { describe, expect, it } from 'vitest';
import type { Vec2 } from '../types.js';
import { area } from '../geometry/ring.js';
import { clusterRings, ringsOf } from '../geometry/cluster.js';
import { createBoard, territoriesOf } from './board.js';
import { DEFAULT_RULES, resolveThrow } from './cut.js';
import { createMatch, isAlive, playTurn, winner } from './turn.js';

const RADIUS = 10;
const players = ['a', 'b'] as const;

const totalArea = (rings: readonly { ring: readonly Vec2[] }[]): number =>
  rings.reduce((sum, t) => sum + area(t.ring), 0);

describe('createBoard', () => {
  it('splits the circle into equal wedges, one per player', () => {
    const board = createBoard(['a', 'b', 'c', 'd'], RADIUS);
    expect(board.territories).toHaveLength(4);

    const areas = board.territories.map((t) => area(t.ring));
    for (const a of areas) expect(a).toBeCloseTo(areas[0]!, 6);
    expect(totalArea(board.territories)).toBeCloseTo(area(board.arena), 6);
  });

  it('refuses a one-player match', () => {
    expect(() => createBoard(['a'])).toThrow();
  });
});

describe('resolveThrow', () => {
  // Two players: 'a' owns the upper half (y > 0), 'b' the lower half.
  const board = createBoard([...players], RADIUS);

  it("takes the half of the victim's ground that touches the thrower", () => {
    // Land in b's half and cut horizontally: the piece nearer a's border is taken.
    const outcome = resolveThrow(board, 'a', { point: [0, -3], direction: [1, 0] });

    expect(outcome.kind).toBe('claimed');
    if (outcome.kind !== 'claimed') return;
    expect(outcome.victimId).toBe('b');
    expect(outcome.gainedArea).toBeGreaterThan(0);
    expect(totalArea(territoriesOf(outcome.board, 'a'))).toBeGreaterThan(
      totalArea(territoriesOf(board, 'a')),
    );
  });

  it('conserves the total ground — cutting never creates or destroys area', () => {
    const outcome = resolveThrow(board, 'a', { point: [0, -3], direction: [1, 0] });
    if (outcome.kind !== 'claimed') throw new Error('expected a claim');
    expect(totalArea(outcome.board.territories)).toBeCloseTo(area(board.arena), 6);
  });

  it('reaches all the way to the far side when the near piece connects', () => {
    // Cutting deep in b's half still pays: everything between the blade and the
    // shared border is one connected piece. Depth is reward, not risk — the risk
    // lives in whether the knife sticks at all.
    const outcome = resolveThrow(board, 'a', { point: [0, -8], direction: [1, 0] });
    if (outcome.kind !== 'claimed') throw new Error('expected a claim');
    expect(outcome.gainedArea).toBeGreaterThan(area(board.arena) * 0.4);
  });

  it('takes the corner it sliced off, not the larger remainder behind the line', () => {
    // Four wedges. 'b' holds the upper left, 'c' the lower left. 'b' cuts across
    // the corner of 'c' nearest the centre: the blade runs from the border they
    // share to c's border with 'd', isolating a small triangle at the middle.
    //
    // Both halves touch 'b', so size cannot decide it. 'b' stands on the centre
    // side of that line, so 'b' gets the triangle — the outer bulk of the wedge
    // is behind the blade and stays with 'c'.
    const four = createBoard(['a', 'b', 'c', 'd'], RADIUS);
    const outcome = resolveThrow(four, 'b', { point: [-1.5, -1.5], direction: [1, -1] });

    if (outcome.kind !== 'claimed') throw new Error(`expected a claim, got ${outcome.reason}`);
    expect(outcome.victimId).toBe('c');
    // The triangle spanning (0,0), (-3,0), (0,-3).
    expect(outcome.gainedArea).toBeCloseTo(4.5, 6);
    expect(totalArea(territoriesOf(outcome.board, 'c'))).toBeGreaterThan(
      totalArea(territoriesOf(outcome.board, 'b')) * 0.5,
    );
  });

  describe('stranded ground', () => {
    // Four wedges: 'a' upper right, 'b' upper left, meeting along the +y axis.
    //
    // 'a' cuts the centre corner off b's wedge, taking a triangle that reaches
    // back to a's own land along that axis. 'b' then cuts the centre corner off
    // a's wedge — and takes with it the very stretch of axis that a's prize was
    // hanging on to. That triangle is now landlocked inside b's ground.
    const openingPosition = createBoard(['a', 'b', 'c', 'd'], RADIUS);

    const afterFirstCut = () => {
      const outcome = resolveThrow(openingPosition, 'a', { point: [-2, 2], direction: [1, 1] });
      if (outcome.kind !== 'claimed') throw new Error(`expected a claim, got ${outcome.reason}`);
      return outcome;
    };

    const afterCounterCut = () => {
      const outcome = resolveThrow(afterFirstCut().board, 'b', {
        point: [3, 3],
        direction: [1, -1],
      });
      if (outcome.kind !== 'claimed') throw new Error(`expected a claim, got ${outcome.reason}`);
      return outcome;
    };

    it('sets up a foothold inside the opponent that reaches back home', () => {
      const first = afterFirstCut();
      expect(first.victimId).toBe('b');
      expect(first.gainedArea).toBeCloseTo(8, 6); // triangle (0,0)-(0,4)-(-4,0)
      expect(territoriesOf(first.board, 'a')).toHaveLength(2);
    });

    it('hands the marooned foothold to whoever surrounds it', () => {
      const second = afterCounterCut();

      // 18 for the piece the blade cut off, 8 for a's stranded foothold.
      expect(second.gainedArea).toBeCloseTo(26, 6);
      expect(second.absorbedRings).toHaveLength(1);
      expect(area(second.absorbedRings[0]!)).toBeCloseTo(8, 6);
    });

    it('leaves no player holding an island', () => {
      const board = afterCounterCut().board;
      for (const playerId of ['a', 'b', 'c', 'd']) {
        const fields = clusterRings(
          ringsOf(territoriesOf(board, playerId)),
          DEFAULT_RULES.minSharedBorder,
          RADIUS * 1e-6,
        );
        expect(fields.length, `${playerId} should hold one connected field`).toBeLessThanOrEqual(1);
      }
    });

    it('still conserves the circle when ground is absorbed', () => {
      expect(totalArea(afterCounterCut().board.territories)).toBeCloseTo(
        area(openingPosition.arena),
        4,
      );
    });
  });

  it('gains nothing when the cut piece does not connect to the thrower', () => {
    // Four wedges: 'a' and 'c' sit opposite each other, meeting only at the
    // centre point. Nothing 'a' carves out of 'c' can touch land 'a' holds.
    const four = createBoard(['a', 'b', 'c', 'd'], RADIUS);
    const outcome = resolveThrow(four, 'a', { point: [-5, -5], direction: [1, -1] });

    expect(outcome.kind).toBe('miss');
    if (outcome.kind !== 'miss') return;
    expect(outcome.reason).toBe('no_connection');
    expect(outcome.cut).not.toBeNull();
  });

  it('stops the line at the first border it meets, not at the arena rim', () => {
    const outcome = resolveThrow(board, 'a', { point: [0, -3], direction: [1, 0] });
    if (outcome.kind !== 'claimed') throw new Error('expected a claim');

    const [start, end] = outcome.cut;
    // A horizontal chord at y = -3 through a circle of radius 10 spans 2*sqrt(91).
    // The arena is a 180-gon, so the real chord sits a hair inside that.
    expect(Math.hypot(end[0] - start[0], end[1] - start[1])).toBeCloseTo(2 * Math.sqrt(91), 2);
    expect(start[1]).toBeCloseTo(-3, 6);
    expect(end[1]).toBeCloseTo(-3, 6);
  });

  it('wastes the turn when the knife lands outside the circle', () => {
    const outcome = resolveThrow(board, 'a', { point: [0, -RADIUS - 1], direction: [1, 0] });
    expect(outcome).toMatchObject({ kind: 'miss', reason: 'outside_arena' });
  });

  it('wastes the turn when the knife lands on your own ground', () => {
    const outcome = resolveThrow(board, 'a', { point: [0, 3], direction: [1, 0] });
    expect(outcome).toMatchObject({ kind: 'miss', reason: 'own_territory' });
  });

  it('conserves area across a run of conquests', () => {
    let current = board;
    for (const y of [-2, -4, -6]) {
      const outcome = resolveThrow(current, 'a', { point: [0, y], direction: [1, 0] });
      if (outcome.kind !== 'claimed') throw new Error(`expected a claim at y=${y}`);
      current = outcome.board;
    }
    expect(totalArea(current.territories)).toBeCloseTo(area(board.arena), 4);
  });

  it('sees a player’s touching pieces as one field, not separate strips', () => {
    let current = board;
    for (const y of [-2, -4, -6]) {
      const outcome = resolveThrow(current, 'a', { point: [0, y], direction: [1, 0] });
      if (outcome.kind !== 'claimed') throw new Error('expected a claim');
      current = outcome.board;
    }

    const fields = clusterRings(
      ringsOf(territoriesOf(current, 'a')),
      DEFAULT_RULES.minSharedBorder,
      RADIUS * 1e-6,
    );
    expect(territoriesOf(current, 'a').length).toBeGreaterThan(1);
    expect(fields).toHaveLength(1);
  });

  it('keeps a player standing while their pieces add up to solid ground', () => {
    let current = board;
    for (const y of [-2, -4, -6]) {
      const outcome = resolveThrow(current, 'a', { point: [0, y], direction: [1, 0] });
      if (outcome.kind !== 'claimed') throw new Error('expected a claim');
      current = outcome.board;
    }
    expect(isAlive(current, DEFAULT_RULES, 'a')).toBe(true);
  });

  it('leaves the original board untouched', () => {
    const before = JSON.stringify(board);
    resolveThrow(board, 'a', { point: [0, -3], direction: [1, 0] });
    expect(JSON.stringify(board)).toBe(before);
  });

  it('is deterministic — the same throw always yields the same board', () => {
    const first = resolveThrow(board, 'a', { point: [0, -3], direction: [0.4, 0.9] });
    const second = resolveThrow(board, 'a', { point: [0, -3], direction: [0.4, 0.9] });
    expect(JSON.stringify(first)).toBe(JSON.stringify(second));
  });

  it('ignores the length of the direction vector', () => {
    const short = resolveThrow(board, 'a', { point: [0, -3], direction: [1, 0] });
    const long = resolveThrow(board, 'a', { point: [0, -3], direction: [500, 0] });
    expect(JSON.stringify(short)).toBe(JSON.stringify(long));
  });
});

describe('elimination', () => {
  it('keeps a player alive while they still hold ground to stand on', () => {
    const board = createBoard([...players], RADIUS);
    expect(isAlive(board, DEFAULT_RULES, 'b')).toBe(true);
  });

  it('declares a winner once no opponent can stand anywhere', () => {
    const match = createMatch(createBoard([...players], RADIUS), [...players]);

    // One deep cut leaves b a sliver of a cap — ground they own but cannot
    // stand on, which is what ends the game.
    const { match: after } = playTurn(match, { point: [0, -9.9], direction: [1, 0] });

    expect(isAlive(after.board, after.rules, 'b')).toBe(false);
    expect(winner(after)).toBe('a');
  });
});

describe('playTurn', () => {
  it('passes the turn even when the throw achieves nothing', () => {
    const match = createMatch(createBoard([...players], RADIUS), [...players]);
    const { match: next, outcome } = playTurn(match, {
      point: [0, -RADIUS - 5],
      direction: [1, 0],
    });

    expect(outcome.kind).toBe('miss');
    expect(next.players[next.turn]).toBe('b');
    expect(next.history).toHaveLength(1);
  });
});

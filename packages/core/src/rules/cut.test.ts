import { describe, expect, it } from 'vitest';
import type { Board, Vec2 } from '../types.js';
import { area } from '../geometry/ring.js';
import { clusterRings, ringsOf } from '../geometry/cluster.js';
import { createBoard, territoriesOf } from './board.js';
import { DEFAULT_RULES, resolveThrow } from './cut.js';
import { createMatch, isAlive, playTurn, winner } from './turn.js';
import { seededRandom } from '../throw/random.js';

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

    it('takes the foothold along with the corner, as one side of a single field', () => {
      // a's wedge and foothold are one field, and the foothold lies on b's side
      // of the line, joined to the corner the blade cut off. So b's cut takes
      // both: 18 for the corner, 8 for the foothold. (Before cuts ran across
      // whole fields, the foothold was left stranded and handed over by the
      // no-islands rule instead — same ground, arrived at by accident.)
      const second = afterCounterCut();
      expect(second.gainedArea).toBeCloseTo(26, 6);
      expect(second.claimedRings.map(area).sort((x, y) => x - y)).toEqual([
        expect.closeTo(8, 6),
        expect.closeTo(18, 6),
      ]);
      expect(second.absorbedRings).toHaveLength(0);
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

    it('still conserves the circle when a cut crosses a field of several pieces', () => {
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

  describe('a field won over several turns', () => {
    // The shape from the bug report: a field made of two pieces that cannot be
    // merged, only one of which touches the thrower.
    //
    //   a  — the cap of the circle above y = 6
    //   b  — its lower half (y < 0), plus a post up the middle (-2 < x < 2,
    //        0 < y < 6) that reaches a's border. Half and post are one field on
    //        screen, but together they are not convex, so they stay two polygons
    //        with an invisible seam along y = 0.
    //   c, d — either side of the post
    //
    // 'a' throws straight down into b's half — the piece that does not touch 'a'.
    const arena = createBoard(['x', 'y'], RADIUS).arena;
    const within = (...keep: ((p: Vec2) => boolean)[]) =>
      keep.reduce<readonly Vec2[]>((ring, inside) => clipRing(ring, inside), arena);
    const field: Board = {
      arena,
      radius: RADIUS,
      nextTerritoryId: 5,
      territories: [
        { id: 't0', ownerId: 'a', ring: within((p) => p[1] >= 6) },
        { id: 't1', ownerId: 'b', ring: within((p) => p[1] <= 0) },
        { id: 't2', ownerId: 'b', ring: within((p) => p[1] >= 0, (p) => p[1] <= 6, (p) => p[0] >= -2, (p) => p[0] <= 2) },
        { id: 't3', ownerId: 'c', ring: within((p) => p[1] >= 0, (p) => p[1] <= 6, (p) => p[0] <= -2) },
        { id: 't4', ownerId: 'd', ring: within((p) => p[1] >= 0, (p) => p[1] <= 6, (p) => p[0] >= 2) },
      ],
    };
    const deepThrow = { point: [1, -4] as Vec2, direction: [0, -1] as Vec2 };

    it('is a board that tiles the circle, with b in two pieces', () => {
      expect(totalArea(field.territories)).toBeCloseTo(area(arena), 6);
      expect(territoriesOf(field, 'b')).toHaveLength(2);
    });

    it('cuts through the seams between a field’s own pieces, not just the piece it landed in', () => {
      // The bug: the line stopped at the seam at y = 0, cut only the half, which
      // does not touch 'a', and the throw was refused as not reaching a's land.
      const outcome = resolveThrow(field, 'a', deepThrow);
      if (outcome.kind !== 'claimed') throw new Error(`expected a claim, got ${outcome.reason}`);

      const [start, end] = outcome.cut;
      expect(Math.max(start[1], end[1])).toBeCloseTo(6, 6); // on up to a's real border
      expect(start[0]).toBeCloseTo(1, 6);
      expect(end[0]).toBeCloseTo(1, 6);
    });

    it('takes everything of that field on the thrower’s side of the line', () => {
      const outcome = resolveThrow(field, 'a', deepThrow);
      if (outcome.kind !== 'claimed') throw new Error(`expected a claim, got ${outcome.reason}`);

      // a's cap is centred on x = 0, left of the line x = 1: so the left of
      // b's whole field — half and post alike — changes hands.
      const bField = totalArea(territoriesOf(field, 'b'));
      expect(outcome.gainedArea).toBeGreaterThan(bField * 0.5);
      expect(outcome.gainedArea).toBeLessThan(bField * 0.65);
      expect(outcome.claimedRings).toHaveLength(2);
      expect(totalArea(outcome.board.territories)).toBeCloseTo(area(arena), 6);
    });

    it('leaves both players holding one connected field', () => {
      const outcome = resolveThrow(field, 'a', deepThrow);
      if (outcome.kind !== 'claimed') throw new Error(`expected a claim, got ${outcome.reason}`);
      for (const playerId of ['a', 'b']) {
        const fields = clusterRings(
          ringsOf(territoriesOf(outcome.board, playerId)),
          DEFAULT_RULES.minSharedBorder,
          RADIUS * 1e-6,
        );
        expect(fields, playerId).toHaveLength(1);
      }
    });
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
    expect(fields).toHaveLength(1);
    // Half and strips together are still convex, so they are joined back into a
    // single piece rather than left as a stack of slivers.
    expect(territoriesOf(current, 'a')).toHaveLength(1);
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

describe('invariants over many random throws', () => {
  // Hundreds of seeded random throws, checking after every one the promises
  // the rules make (RULES.md, "Invariants"). Cuts that cross whole fields are
  // the newest and least obvious part of the geometry, and this is where a
  // subtle mistake in them would show.
  const isConvex = (ring: readonly Vec2[]): boolean => {
    let sign = 0;
    for (let i = 0; i < ring.length; i++) {
      const [a, b, c] = [ring[i]!, ring[(i + 1) % ring.length]!, ring[(i + 2) % ring.length]!];
      const turn = (b[0] - a[0]) * (c[1] - b[1]) - (b[1] - a[1]) * (c[0] - b[0]);
      if (Math.abs(turn) < 1e-9) continue;
      if (sign === 0) sign = Math.sign(turn);
      else if (Math.sign(turn) !== sign) return false;
    }
    return true;
  };

  it('conserves area, keeps every field whole and every piece convex', () => {
    const next = seededRandom(20260926);
    let match = createMatch(createBoard(['a', 'b', 'c', 'd'], RADIUS), ['a', 'b', 'c', 'd']);
    let claims = 0;
    for (let turn = 0; turn < 300 && !winner(match); turn++) {
      const angle = next() * 2 * Math.PI;
      const distance = Math.sqrt(next()) * RADIUS * 0.98;
      const point: Vec2 = [Math.cos(angle) * distance, Math.sin(angle) * distance];
      const heading = next() * 2 * Math.PI;
      const played = playTurn(match, { point, direction: [Math.cos(heading), Math.sin(heading)] });
      if (played.outcome.kind === 'claimed') claims++;
      match = played.match;

      const board = match.board;
      expect(totalArea(board.territories), `turn ${turn}`).toBeCloseTo(area(board.arena), 4);
      for (const t of board.territories) expect(isConvex(t.ring), `turn ${turn}, ${t.id}`).toBe(true);
      for (const playerId of match.players) {
        const fields = clusterRings(
          ringsOf(territoriesOf(board, playerId)),
          DEFAULT_RULES.minSharedBorder,
          RADIUS * 1e-6,
        );
        expect(fields.length, `turn ${turn}: ${playerId}`).toBeLessThanOrEqual(1);
      }
    }
    // Make sure the run actually exercised the rules rather than missing every throw.
    expect(claims).toBeGreaterThan(20);
  });
});

/** Keeps the part of a convex ring where `inside` holds (Sutherland–Hodgman, one straight edge at a time). */
function clipRing(ring: readonly Vec2[], inside: (p: Vec2) => boolean): Vec2[] {
  // `inside` is a half-plane test of the form f(p) >= 0; find the crossing by bisection.
  const crossing = (a: Vec2, b: Vec2): Vec2 => {
    let [lo, hi] = [0, 1];
    for (let i = 0; i < 60; i++) {
      const mid = (lo + hi) / 2;
      const p: Vec2 = [a[0] + (b[0] - a[0]) * mid, a[1] + (b[1] - a[1]) * mid];
      if (inside(p) === inside(a)) lo = mid;
      else hi = mid;
    }
    const t = (lo + hi) / 2;
    return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
  };
  const out: Vec2[] = [];
  ring.forEach((current, i) => {
    const next = ring[(i + 1) % ring.length]!;
    if (inside(current)) out.push(current);
    if (inside(current) !== inside(next)) out.push(crossing(current, next));
  });
  return out;
}

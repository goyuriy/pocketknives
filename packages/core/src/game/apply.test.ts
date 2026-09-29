import { describe, expect, it } from 'vitest';
import type { PlayerId } from '../types.js';
import { homeSpot } from '../rules/standing.js';
import { DEFAULT_RULES, longHandsReach, resolveThrow } from '../rules/cut.js';
import { DEFAULT_CONFIG } from '../throw/config.js';
import type { Command, Stamp } from './commands.js';
import { applyCommand, type Applied } from './apply.js';
import { createGame, currentPlayer, rulesFor, skillLevel, type GameState } from './state.js';
import { releasePoint } from './stance.js';

const players: PlayerId[] = ['Red', 'Blue', 'Gold', 'Mint'];
const stamp: Stamp = { seed: 7 };

/** A thrower at home, facing the middle, as a new turn puts them. */
const standingHome = (state: GameState, playerId: PlayerId) => {
  const feet = homeSpot(state.match.board, playerId)!;
  return { feet, facing: Math.atan2(-feet[1], -feet[0]) };
};

const throwing = (state: GameState, draw = 0.2, playerId = currentPlayer(state)): Command => ({
  type: 'throw',
  playerId,
  stance: standingHome(state, playerId),
  intent: { aim: 0, pitch: DEFAULT_CONFIG.style.pitch, draw, drift: 0 },
});

const ok = (applied: Applied) => {
  if (!applied.ok) throw new Error(`rejected: ${applied.reason}`);
  return applied;
};

describe('applyCommand: a throw', () => {
  const game = createGame({ players });

  it('records the throw, tells everyone, and hands the turn on', () => {
    const { state, events } = ok(applyCommand(game, throwing(game), stamp));
    expect(state.throws).toHaveLength(1);
    expect(state.throws[0]).toMatchObject({ index: 0, playerId: 'Red', seed: 7, knifeId: 'thrower' });
    expect(events[0]).toMatchObject({ type: 'thrown', boardBefore: game.match.board });
    expect(currentPlayer(state)).toBe('Blue');
    expect(events.at(-1)).toEqual({ type: 'turn', playerId: 'Blue' });
  });

  it('never changes the state it was given', () => {
    const before = JSON.stringify(game);
    applyCommand(game, throwing(game), stamp);
    expect(JSON.stringify(game)).toBe(before);
  });

  it('lands the same way for the same command and seed, anywhere — and differently for another seed', () => {
    const a = ok(applyCommand(game, throwing(game, 1), { seed: 11 })).state.throws[0]!;
    const b = ok(applyCommand(game, throwing(game, 1), { seed: 11 })).state.throws[0]!;
    const c = ok(applyCommand(game, throwing(game, 1), { seed: 12 })).state.throws[0]!;
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
    expect(c.impact.point).not.toEqual(a.impact.point);
  });

  it('starts the flight where the hand lets go, out in front of the feet', () => {
    const command = throwing(game) as Extract<Command, { type: 'throw' }>;
    const record = ok(applyCommand(game, command, stamp)).state.throws[0]!;
    const [x, y] = releasePoint(command.stance.feet, command.stance.facing);
    expect(record.launch.origin[0]).toBeCloseTo(x, 9);
    expect(record.launch.origin[1]).toBeCloseTo(y, 9);
  });

  it('turns down a throw out of turn, from off your own ground, or with no draw in it', () => {
    expect(applyCommand(game, throwing(game, 0.2, 'Blue'), stamp)).toEqual({ ok: false, reason: 'not_your_turn' });
    const offside = { ...(throwing(game) as Extract<Command, { type: 'throw' }>), stance: standingHome(game, 'Blue') };
    expect(applyCommand(game, offside, stamp)).toEqual({ ok: false, reason: 'off_your_ground' });
    expect(applyCommand(game, throwing(game, 0.01), stamp)).toEqual({ ok: false, reason: 'not_a_throw' });
    const stranger = { ...(throwing(game) as Extract<Command, { type: 'throw' }>), playerId: 'Nobody' };
    expect(applyCommand(game, stranger, stamp)).toEqual({ ok: false, reason: 'unknown_player' });
  });

  it('keeps the turn in a sandbox set not to pass it', () => {
    const practice = createGame({ players, settings: { sandbox: true, passTurns: false } });
    expect(currentPlayer(ok(applyCommand(practice, throwing(practice), stamp)).state)).toBe('Red');
  });

  it('replays: the first state and the stamped commands give the same match again', () => {
    const played: [Command, Stamp][] = [];
    let state = game;
    for (let seed = 1; seed <= 8; seed++) {
      const command = throwing(state, 0.15 + seed * 0.05);
      played.push([command, { seed }]);
      state = ok(applyCommand(state, command, { seed })).state;
    }
    const again = played.reduce((s, [command, s2]) => ok(applyCommand(s, command, s2)).state, game);
    expect(JSON.stringify(again)).toBe(JSON.stringify(state));
  });
});

describe('applyCommand: the rest', () => {
  it('lets a player choose an open knife before the match, and not a locked one', () => {
    const game = createGame({ players });
    const chosen = ok(applyCommand(game, { type: 'chooseKnife', playerId: 'Red', knifeId: 'needle' }, stamp));
    expect(chosen.state.players.Red!.knifeId).toBe('needle');
    expect(chosen.state.throws).toHaveLength(0);
    expect(applyCommand(game, { type: 'chooseKnife', playerId: 'Red', knifeId: 'greatsword' }, stamp)).toEqual({
      ok: false,
      reason: 'knife_locked',
    });
    expect(applyCommand(game, { type: 'chooseKnife', playerId: 'Red', knifeId: 'spoon' }, stamp)).toEqual({
      ok: false,
      reason: 'unknown_knife',
    });
  });

  it('keeps the knife fixed once the match is under way, except in the sandbox', () => {
    const game = createGame({ players });
    const started = ok(applyCommand(game, throwing(game), stamp)).state;
    expect(applyCommand(started, { type: 'chooseKnife', playerId: 'Red', knifeId: 'needle' }, stamp)).toEqual({
      ok: false,
      reason: 'match_under_way',
    });
    const practice = createGame({ players, settings: { sandbox: true } });
    const practising = ok(applyCommand(practice, throwing(practice), stamp)).state;
    expect(applyCommand(practising, { type: 'chooseKnife', playerId: 'Red', knifeId: 'needle' }, stamp).ok).toBe(true);
  });

  it('throws with the thrower’s own knife', () => {
    const game = ok(applyCommand(createGame({ players }), { type: 'chooseKnife', playerId: 'Red', knifeId: 'cleaver' }, stamp)).state;
    expect(ok(applyCommand(game, throwing(game), stamp)).state.throws[0]!.knifeId).toBe('cleaver');
  });

  it('only lets the sandbox be tuned or have its turn handed about', () => {
    const game = createGame({ players });
    expect(applyCommand(game, { type: 'giveTurn', playerId: 'Gold' }, stamp)).toEqual({ ok: false, reason: 'sandbox_only' });
    expect(applyCommand(game, { type: 'configure', settings: { passTurns: false } }, stamp)).toEqual({
      ok: false,
      reason: 'sandbox_only',
    });
    const practice = createGame({ players, settings: { sandbox: true } });
    expect(currentPlayer(ok(applyCommand(practice, { type: 'giveTurn', playerId: 'Gold' }, stamp)).state)).toBe('Gold');
    const tuned = ok(applyCommand(practice, { type: 'configure', settings: { passTurns: false } }, stamp)).state;
    expect(tuned.settings).toMatchObject({ passTurns: false, sandbox: true });
  });

  it('starts a new match at the same table, keeping the settings and everyone’s knife', () => {
    let game = createGame({ players, settings: { sandbox: true } });
    game = ok(applyCommand(game, { type: 'chooseKnife', playerId: 'Blue', knifeId: 'kitchen' }, stamp)).state;
    game = ok(applyCommand(game, throwing(game), stamp)).state;
    const fresh = ok(applyCommand(game, { type: 'newMatch', players: ['Red', 'Blue'] }, stamp)).state;
    expect(fresh.throws).toHaveLength(0);
    expect(fresh.match.players).toEqual(['Red', 'Blue']);
    expect(fresh.players.Blue!.knifeId).toBe('kitchen');
    expect(fresh.settings.sandbox).toBe(true);
  });

  it('takes no more throws once the match has a winner', () => {
    // One deep cut leaves Blue a sliver of rim nobody can stand on.
    const game = createGame({ players: ['Red', 'Blue'], rules: { ...DEFAULT_RULES, reach: Infinity } });
    const cut = resolveThrow(game.match.board, 'Red', { point: [0, -9.9], direction: [1, 0] }, game.match.rules);
    if (cut.kind !== 'claimed') throw new Error('expected a claim');
    const over: GameState = { ...game, match: { ...game.match, board: cut.board } };
    expect(applyCommand(over, throwing(game), stamp)).toEqual({ ok: false, reason: 'match_over' });
  });
  it('trains a skill only at the practice table, and keeps it into the next match', () => {
    const game = createGame({ players });
    const training = { type: 'setSkill', playerId: 'Red', skill: 'longHands', level: 3 } as const;
    expect(applyCommand(game, training, stamp)).toEqual({ ok: false, reason: 'sandbox_only' });
    const practice = createGame({ players, settings: { sandbox: true } });
    const trained = ok(applyCommand(practice, training, stamp)).state;
    expect(skillLevel(trained, 'Red', 'longHands')).toBe(3);
    expect(skillLevel(trained, 'Blue', 'longHands')).toBe(0);
    const fresh = ok(applyCommand(trained, { type: 'newMatch', players }, stamp)).state;
    expect(skillLevel(fresh, 'Red', 'longHands')).toBe(3);
  });

  it('lengthens only its owner’s reach with Long hands', () => {
    const practice = createGame({ players, settings: { sandbox: true } });
    const trained = ok(applyCommand(practice, { type: 'setSkill', playerId: 'Red', skill: 'longHands', level: 5 }, stamp)).state;
    const base = practice.match.rules.reach;
    expect(rulesFor(trained, 'Red').reach).toBeCloseTo(longHandsReach(base, 5), 9);
    expect(rulesFor(trained, 'Blue').reach).toBe(base);
  });
});

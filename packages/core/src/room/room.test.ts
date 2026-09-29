import { describe, expect, it } from 'vitest';
import type { PlayerId } from '../types.js';
import { homeSpot } from '../rules/standing.js';
import { DEFAULT_CONFIG } from '../throw/config.js';
import type { Command } from '../game/commands.js';
import { createGame, currentPlayer, type GameState } from '../game/state.js';
import type { ClientMessage } from './protocol.js';
import { createRoom, joinRoom, leaveRoom, receive, type Room, type RoomStep } from './room.js';

const game = createGame({ players: ['Red', 'Blue'] });

const throwFor = (state: GameState, playerId: PlayerId): Command => {
  const feet = homeSpot(state.match.board, playerId)!;
  return {
    type: 'throw',
    playerId,
    stance: { feet, facing: Math.atan2(-feet[1], -feet[0]) },
    intent: { aim: 0, pitch: DEFAULT_CONFIG.style.pitch, draw: 0.2, drift: 0 },
  };
};
const command = (id: number, asked: Command): ClientMessage => ({ type: 'command', id, command: asked });

/** Joins everyone in order, keeping only the room. */
const seated = (...connections: string[]): Room =>
  connections.reduce((room, connection) => joinRoom(room, connection).room, createRoom(game));

describe('a room', () => {
  it('seats players in turn order, the first as host, and then lets people watch', () => {
    const first = joinRoom(createRoom(game), 'a');
    expect(first.out).toEqual([
      { to: 'a', message: { type: 'welcome', you: 'Red', host: true, state: game } },
      { to: 'everyone', except: 'a', message: { type: 'joined', playerId: 'Red' } },
    ]);
    const second = joinRoom(first.room, 'b');
    expect(second.out).toEqual([
      { to: 'b', message: { type: 'welcome', you: 'Blue', host: false, state: game } },
      { to: 'everyone', except: 'b', message: { type: 'joined', playerId: 'Blue' } },
    ]);
    const third = joinRoom(second.room, 'c');
    expect(third.out).toEqual([{ to: 'c', message: { type: 'welcome', you: null, host: false, state: game } }]);
  });

  it('applies a player’s throw with the room’s seed, and tells everyone', () => {
    const room = seated('a', 'b');
    const step = receive(room, 'a', command(1, throwFor(game, 'Red')), 99);
    expect(step.room.game.throws[0]!.seed).toBe(99);
    expect(currentPlayer(step.room.game)).toBe('Blue');
    expect(step.out).toHaveLength(1);
    expect(step.out[0]).toMatchObject({ to: 'everyone', message: { type: 'update', state: step.room.game } });
  });

  it('lets nobody act for someone else, or play from the stands', () => {
    const room = seated('a', 'b', 'c');
    const refused = (step: RoomStep) => step.out[0]!.message;
    expect(refused(receive(room, 'b', command(7, throwFor(game, 'Red')), 1))).toEqual({ type: 'rejected', id: 7, reason: 'not_yours' });
    expect(refused(receive(room, 'c', command(8, throwFor(game, 'Red')), 1))).toEqual({ type: 'rejected', id: 8, reason: 'not_seated' });
    // Blue's own throw, out of turn: the game's reason, not the room's.
    expect(refused(receive(room, 'b', command(9, throwFor(game, 'Blue')), 1))).toEqual({ type: 'rejected', id: 9, reason: 'not_your_turn' });
  });

  it('keeps running the table to the host', () => {
    const room = seated('a', 'b');
    const again = command(3, { type: 'newMatch', players: ['Red', 'Blue'] });
    expect(receive(room, 'b', again, 1).out[0]!.message).toEqual({ type: 'rejected', id: 3, reason: 'host_only' });
    expect(receive(room, 'a', again, 1).out[0]!.message).toMatchObject({ type: 'update' });
  });

  it('passes presence on to everyone else, under the sender’s own seat', () => {
    const room = seated('a', 'b', 'c');
    const presence = { stance: { feet: [0, 0] as const, facing: 0 }, aim: 0.2, pitch: 0, draw: 0.5 };
    expect(receive(room, 'b', { type: 'presence', presence }, 1).out).toEqual([
      { to: 'everyone', except: 'b', message: { type: 'presence', playerId: 'Blue', presence } },
    ]);
    expect(receive(room, 'c', { type: 'presence', presence }, 1).out).toEqual([]);
  });

  it('frees a seat for the next to come, and hands the table on when the host goes', () => {
    const room = seated('a', 'b', 'c');
    const gone = leaveRoom(room, 'a');
    expect(gone.room.host).toBe('b');
    expect(gone.out).toEqual([
      { to: 'everyone', message: { type: 'left', playerId: 'Red' } },
      { to: 'b', message: { type: 'host' } },
    ]);
    const back = joinRoom(gone.room, 'd');
    expect(back.out[0]!.message).toMatchObject({ type: 'welcome', you: 'Red', host: false });
  });

  it('ignores anyone it has not seated', () => {
    const room = seated('a');
    expect(receive(room, 'stranger', command(1, throwFor(game, 'Red')), 1)).toEqual({ room, out: [] });
    expect(leaveRoom(room, 'stranger')).toEqual({ room, out: [] });
  });
});

describe('the game over the wire', () => {
  it('arrives exactly as it was sent, throws and all', () => {
    let state = game;
    for (const seed of [3, 4, 5]) {
      const step = receive({ ...seated('a', 'b'), game: state }, currentPlayer(state) === 'Red' ? 'a' : 'b', command(seed, throwFor(state, currentPlayer(state))), seed);
      state = step.room.game;
    }
    expect(state.throws).toHaveLength(3);
    expect(JSON.parse(JSON.stringify(state))).toEqual(state);
  });
});

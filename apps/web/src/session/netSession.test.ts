import { describe, expect, it } from 'vitest';
import { createGame, currentPlayer, DEFAULT_CONFIG, homeSpot, type Command, type GameState, type PlayerId } from '@pocketknives/core';
import { connectNetSession } from './netSession.js';
import { createLoopbackRoom } from './loopback.js';
import type { SessionUpdate } from './session.js';

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

/** Lets every message in flight arrive. */
const settle = () => new Promise((done) => setTimeout(done, 0));

describe('connectNetSession, through a loopback room', () => {
  it('seats each screen as one player, the first as host', async () => {
    const room = createLoopbackRoom(game, () => 11);
    const red = await connectNetSession(room.connect());
    const blue = await connectNetSession(room.connect());
    expect(red.controls()).toEqual(['Red']);
    expect(blue.controls()).toEqual(['Blue']);
    expect([red.isHost(), blue.isHost()]).toEqual([true, false]);
  });

  it('shows one player’s throw on the other’s screen, with the room’s seed', async () => {
    const room = createLoopbackRoom(game, () => 11);
    const red = await connectNetSession(room.connect());
    const blue = await connectNetSession(room.connect());
    const seen: SessionUpdate[] = [];
    blue.subscribe((update) => seen.push(update));

    expect(red.send(throwFor(game, 'Red'))).toBeNull();
    await settle();
    expect(seen).toHaveLength(1);
    expect(seen[0]!.events[0]!.type).toBe('thrown');
    expect(blue.state().throws[0]!.seed).toBe(11);
    expect(red.state()).toEqual(blue.state());
    expect(currentPlayer(blue.state())).toBe('Blue');
  });

  it('tells a screen when its command was turned down, and changes nothing', async () => {
    const room = createLoopbackRoom(game);
    await connectNetSession(room.connect());
    const blue = await connectNetSession(room.connect());
    const refusals: string[] = [];
    blue.onRejected((reason) => refusals.push(reason));
    blue.send(throwFor(game, 'Red'));
    blue.send(throwFor(game, 'Blue'));
    await settle();
    expect(refusals).toEqual(['not_yours', 'not_your_turn']);
    expect(room.room().game).toBe(game);
  });

  it('gives a late joiner the match so far', async () => {
    const room = createLoopbackRoom(createGame({ players: ['Red', 'Blue', 'Gold'] }));
    const red = await connectNetSession(room.connect());
    red.send(throwFor(red.state(), 'Red'));
    await settle();
    const late = await connectNetSession(room.connect());
    expect(late.state().throws).toHaveLength(1);
  });

  it('passes presence between players, and says when one has gone', async () => {
    const room = createLoopbackRoom(game);
    const redLine = room.connect();
    const red = await connectNetSession(redLine);
    const blue = await connectNetSession(room.connect());
    const heard: [string, unknown][] = [];
    blue.presence.subscribe((playerId, presence) => heard.push([playerId, presence]));
    const presence = { stance: { feet: [1, 2] as const, facing: 0 }, aim: 0.1, pitch: 0, draw: null };
    red.presence.publish(presence);
    await settle();
    redLine.close();
    await settle();
    expect(heard).toEqual([
      ['Red', presence],
      ['Red', null],
    ]);
    expect(blue.isHost()).toBe(true);
  });
});

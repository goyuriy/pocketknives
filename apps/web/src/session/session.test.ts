import { describe, expect, it } from 'vitest';
import { createGame, currentPlayer, DEFAULT_CONFIG, homeSpot } from '@pocketknives/core';
import { createLocalSession, type SessionUpdate } from './session.js';

const game = createGame({ players: ['Red', 'Blue'] });
const feet = homeSpot(game.match.board, 'Red')!;
const throwCommand = {
  type: 'throw' as const,
  playerId: 'Red',
  stance: { feet, facing: Math.atan2(-feet[1], -feet[0]) },
  intent: { aim: 0, pitch: DEFAULT_CONFIG.style.pitch, draw: 0.2, drift: 0 },
};

describe('createLocalSession', () => {
  it('applies a command with its own seed and tells whoever is listening', () => {
    const session = createLocalSession(game, () => 42);
    const heard: SessionUpdate[] = [];
    session.subscribe((update) => heard.push(update));
    expect(session.send(throwCommand)).toBeNull();
    expect(session.state().throws[0]!.seed).toBe(42);
    expect(currentPlayer(session.state())).toBe('Blue');
    expect(heard).toHaveLength(1);
    expect(heard[0]!.events[0]!.type).toBe('thrown');
  });

  it('says why a command was turned down, and changes nothing', () => {
    const session = createLocalSession(game, () => 42);
    let heard = 0;
    session.subscribe(() => heard++);
    expect(session.send({ ...throwCommand, playerId: 'Blue' })).toBe('not_your_turn');
    expect(session.state()).toBe(game);
    expect(heard).toBe(0);
  });

  it('stops telling a listener that has gone', () => {
    const session = createLocalSession(game, () => 42);
    let heard = 0;
    const stop = session.subscribe(() => heard++);
    stop();
    session.send(throwCommand);
    expect(heard).toBe(0);
  });
});

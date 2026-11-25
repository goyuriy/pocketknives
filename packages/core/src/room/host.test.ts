import { describe, expect, it } from 'vitest';
import { homeSpot } from '../rules/standing.js';
import { DEFAULT_CONFIG } from '../throw/config.js';
import { createGame } from '../game/state.js';
import type { ServerMessage } from './protocol.js';
import { createRoomHost } from './host.js';

const game = createGame({ players: ['Red', 'Blue'] });
const feet = homeSpot(game.match.board, 'Red')!;
const throwing = JSON.stringify({
  type: 'command',
  id: 1,
  command: {
    type: 'throw',
    playerId: 'Red',
    stance: { feet, facing: Math.atan2(-feet[1], -feet[0]) },
    intent: { aim: 0, pitch: DEFAULT_CONFIG.style.pitch, draw: 0.2, drift: 0 },
  },
});

/** A host with two players in, and everything each has been sent. */
const table = () => {
  const host = createRoomHost(game, () => 5);
  const heard: Record<string, ServerMessage[]> = { a: [], b: [] };
  for (const id of ['a', 'b']) host.connect(id, (wire) => heard[id]!.push(JSON.parse(wire) as ServerMessage));
  return { host, heard };
};

describe('a room host', () => {
  it('welcomes whoever connects, and tells the others', () => {
    const { host, heard } = table();
    expect(host.size()).toBe(2);
    expect(heard.a!.map((message) => message.type)).toEqual(['welcome', 'joined']);
    expect(heard.b![0]).toMatchObject({ type: 'welcome', you: 'Blue', host: false });
  });

  it('applies a command off the wire with its own seed, and sends everyone the result', () => {
    const { host, heard } = table();
    host.receive('a', throwing);
    expect(host.room().game.throws[0]!.seed).toBe(5);
    expect(heard.a!.at(-1)).toMatchObject({ type: 'update' });
    expect(heard.b!.at(-1)).toEqual(heard.a!.at(-1));
  });

  it('drops anything that is not a message, without a murmur', () => {
    const { host, heard } = table();
    const before = heard.a!.length;
    for (const junk of ['', 'not json', '{"type":"shout"}', '[1,2', 'null', '{"type":"command","id":1,"command":{"type":"throw"}}']) {
      host.receive('a', junk);
    }
    expect(host.room().game).toBe(game);
    expect(heard.a).toHaveLength(before);
  });

  it('frees the seat of whoever disconnects, once', () => {
    const { host, heard } = table();
    host.disconnect('a');
    host.disconnect('a');
    expect(host.size()).toBe(1);
    expect(heard.b!.filter((message) => message.type === 'left')).toHaveLength(1);
    expect(heard.b!.at(-1)).toEqual({ type: 'host' });
  });
});

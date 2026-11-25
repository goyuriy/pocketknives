import { afterEach, describe, expect, it } from 'vitest';
import { DEFAULT_CONFIG, homeSpot, type GameState, type ServerMessage } from '@pocketknives/core';
import { isRoomCode, MAX_SEATS, MIN_SEATS, seatsFor } from './rooms.js';
import { CLOSED, startRoomServer, type RoomServer } from './server.js';

let server: RoomServer | null = null;
afterEach(async () => {
  await server?.close();
  server = null;
});

/** A player's socket, with everything the room has sent it and a way to wait for the next of a kind. */
const join = async (port: number, path: string) => {
  const socket = new WebSocket(`ws://127.0.0.1:${port}${path}`);
  const heard: ServerMessage[] = [];
  const waiting: { type: string; done: (message: ServerMessage) => void }[] = [];
  socket.addEventListener('message', (event) => {
    const message = JSON.parse(String(event.data)) as ServerMessage;
    heard.push(message);
    const at = waiting.findIndex((wait) => wait.type === message.type);
    if (at >= 0) waiting.splice(at, 1)[0]!.done(message);
  });
  const next = <T extends ServerMessage['type']>(type: T) =>
    new Promise<Extract<ServerMessage, { type: T }>>((done) => waiting.push({ type, done: done as (message: ServerMessage) => void }));
  const welcome = await next('welcome');
  return { socket, heard, next, welcome, send: (message: unknown) => socket.send(JSON.stringify(message)) };
};

const closeCode = (port: number, path: string) =>
  new Promise<number>((done) => new WebSocket(`ws://127.0.0.1:${port}${path}`).addEventListener('close', (event) => done(event.code)));

const throwFor = (state: GameState, playerId: string) => {
  const feet = homeSpot(state.match.board, playerId)!;
  return {
    type: 'throw',
    playerId,
    stance: { feet, facing: Math.atan2(-feet[1], -feet[0]) },
    intent: { aim: 0, pitch: DEFAULT_CONFIG.style.pitch, draw: 0.2, drift: 0 },
  };
};

describe('the room server', () => {
  it('seats two players in one room, and shows each the other’s throw', async () => {
    server = await startRoomServer(0);
    const red = await join(server.port, '/rooms/yard?seats=2');
    const blue = await join(server.port, '/rooms/yard');
    expect([red.welcome.you, red.welcome.host]).toEqual(['Red', true]);
    expect([blue.welcome.you, blue.welcome.host]).toEqual(['Blue', false]);
    expect(blue.welcome.state.match.players).toEqual(['Red', 'Blue']);

    const seen = Promise.all([red.next('update'), blue.next('update')]);
    red.send({ type: 'command', id: 1, command: throwFor(red.welcome.state, 'Red') });
    const [redSaw, blueSaw] = await seen;
    expect(blueSaw.events[0]!.type).toBe('thrown');
    expect(blueSaw.state).toEqual(redSaw.state);
    expect(blueSaw.state.throws).toHaveLength(1);
  });

  it('turns down a throw for someone else’s seat, and survives rubbish', async () => {
    server = await startRoomServer(0);
    const red = await join(server.port, '/rooms/yard');
    const blue = await join(server.port, '/rooms/yard');
    blue.socket.send('not json at all');
    const refused = blue.next('rejected');
    blue.send({ type: 'command', id: 9, command: throwFor(red.welcome.state, 'Red') });
    expect(await refused).toEqual({ type: 'rejected', id: 9, reason: 'not_yours' });
  });

  it('keeps rooms apart, and forgets one when the last player leaves', async () => {
    server = await startRoomServer(0);
    const here = await join(server.port, '/rooms/yard');
    const there = await join(server.port, '/rooms/alley');
    expect([here.welcome.you, there.welcome.you]).toEqual(['Red', 'Red']);
    expect(server.rooms()).toBe(2);
    const gone = new Promise((done) => there.socket.addEventListener('close', done));
    there.socket.close();
    await gone;
    await expect.poll(() => server!.rooms()).toBe(1);
  });

  it('hands the table on when the host leaves', async () => {
    server = await startRoomServer(0);
    const red = await join(server.port, '/rooms/yard');
    const blue = await join(server.port, '/rooms/yard');
    const promoted = blue.next('host');
    red.socket.close();
    expect(await promoted).toEqual({ type: 'host' });
  });

  it('closes a socket that names no room', async () => {
    server = await startRoomServer(0);
    expect(await closeCode(server.port, '/somewhere')).toBe(CLOSED.noSuchRoom);
    expect(await closeCode(server.port, '/rooms/Not%20A%20Code')).toBe(CLOSED.noSuchRoom);
  });
});

describe('room codes and seats', () => {
  it('takes short lower-case codes, and nothing that needs escaping', () => {
    expect(['yard', 'a-b-3', 'x'.repeat(32)].every(isRoomCode)).toBe(true);
    expect(['', 'ab', 'Yard', 'a b', 'a/b', 'x'.repeat(33)].some(isRoomCode)).toBe(false);
  });

  it('lays a room out for two to four, whatever is asked', () => {
    expect([null, 1, 2, 3, 9, NaN].map(seatsFor)).toEqual([MAX_SEATS, MIN_SEATS, 2, 3, MAX_SEATS, MAX_SEATS]);
  });
});

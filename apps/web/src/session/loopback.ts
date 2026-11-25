import { createRoomHost, type GameState, type ServerMessage } from '@pocketknives/core';
import { drawSeed } from './session.js';
import type { Transport } from './transport.js';

/**
 * A room held in this page's memory, with players connecting to it through
 * `Transport`s — the network, minus the network.
 *
 * The same `createRoomHost` a real server runs (`apps/server`), with a queue
 * where the socket would be: every message crosses as JSON text and through
 * `parseClientMessage`, and arrives a moment later rather than at once, so
 * what works here works over the wire. For tests.
 *
 * Effectful: holds the room host and delivers the messages.
 */
export const createLoopbackRoom = (game: GameState, nextSeed: () => number = drawSeed) => {
  const host = createRoomHost(game, nextSeed);
  let nextConnection = 0;

  return {
    /** The room as it stands, for tests to look at. */
    room: host.room,
    /** A new player walks in: a line to the room for their session. */
    connect: (): Transport => {
      const id = `loopback-${nextConnection++}`;
      const listeners = new Set<(message: ServerMessage) => void>();
      const later = (wire: string) => queueMicrotask(() => listeners.forEach((listener) => listener(JSON.parse(wire) as ServerMessage)));
      queueMicrotask(() => host.connect(id, later));
      return {
        send: (message) => {
          const wire = JSON.stringify(message);
          queueMicrotask(() => host.receive(id, wire));
        },
        subscribe: (listener) => {
          listeners.add(listener);
          return () => listeners.delete(listener);
        },
        close: () => {
          listeners.clear();
          host.disconnect(id);
        },
      };
    },
  };
};

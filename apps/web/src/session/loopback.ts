import {
  createRoom,
  joinRoom,
  leaveRoom,
  parseClientMessage,
  receive,
  recipients,
  type ConnectionId,
  type GameState,
  type Room,
  type RoomStep,
  type ServerMessage,
} from '@pocketknives/core';
import { drawSeed } from './session.js';
import type { Transport } from './transport.js';

/**
 * A room held in this page's memory, with players connecting to it through
 * `Transport`s — the network, minus the network.
 *
 * It is the whole shape of a room server, small enough to read in one go:
 * keep a `Room`, feed it what arrives, deliver what it answers. Every message
 * goes through JSON and `parseClientMessage` exactly as it would off a socket,
 * and arrives a moment later rather than at once, so what works here works
 * over the wire. For tests, and for trying multiplayer in one browser.
 *
 * Effectful: holds the room, draws the seeds, delivers the messages.
 */
export const createLoopbackRoom = (game: GameState, nextSeed: () => number = drawSeed) => {
  let room: Room = createRoom(game);
  let nextConnection = 0;
  const inboxes = new Map<ConnectionId, Set<(message: ServerMessage) => void>>();

  const deliver = (step: RoomStep) => {
    room = step.room;
    for (const outbound of step.out) {
      const wire = JSON.stringify(outbound.message);
      for (const target of recipients(outbound, [...inboxes.keys()])) {
        queueMicrotask(() => inboxes.get(target)?.forEach((listener) => listener(JSON.parse(wire) as ServerMessage)));
      }
    }
  };

  return {
    /** The room as it stands, for tests to look at. */
    room: () => room,
    /** A new player walks in: a line to the room for their session. */
    connect: (): Transport => {
      const id = `loopback-${nextConnection++}`;
      inboxes.set(id, new Set());
      queueMicrotask(() => deliver(joinRoom(room, id)));
      return {
        send: (message) => {
          const arrived = parseClientMessage(JSON.parse(JSON.stringify(message)));
          if (arrived) queueMicrotask(() => deliver(receive(room, id, arrived, nextSeed())));
        },
        subscribe: (listener) => {
          inboxes.get(id)?.add(listener);
          return () => inboxes.get(id)?.delete(listener);
        },
        close: () => {
          inboxes.delete(id);
          deliver(leaveRoom(room, id));
        },
      };
    },
  };
};

import type { GameState } from '../game/state.js';
import { parseClientMessage } from './protocol.js';
import { createRoom, joinRoom, leaveRoom, receive, recipients, type ConnectionId, type Room, type RoomStep } from './room.js';

/**
 * A room, kept: the one stateful thing in the core, and still no IO.
 *
 * The room's rules are pure functions (`room.ts`); something has to hold the
 * `Room` between messages, draw the seeds, put messages on and off the wire
 * (JSON), and hand each reply to whoever it is for. That is the same job
 * whatever carries the messages — a WebSocket server, a room in a page's
 * memory for tests — so it is written once, here, and each carrier only plugs
 * its connections in.
 */
export type RoomHost = {
  /** The room as it stands. */
  readonly room: () => Room;
  /** How many connections are in the room. */
  readonly size: () => number;
  /** Someone arrives. `deliver` is how the room reaches them, a message at a time, as text for the wire. */
  readonly connect: (connection: ConnectionId, deliver: (wire: string) => void) => void;
  /**
   * Text off the wire from `connection`. Anything that is not a well-formed
   * message (`parseClientMessage`) is dropped: nothing a stranger sends can
   * throw here or reach the game unchecked.
   */
  readonly receive: (connection: ConnectionId, wire: string) => void;
  /** Someone goes: their seat comes free, and the others are told. */
  readonly disconnect: (connection: ConnectionId) => void;
};

/**
 * Keeps a room for `game`. `nextSeed` is the authority's dice, passed in so
 * the core itself stays free of randomness: a server draws real ones, a test
 * fixed ones.
 *
 * Effectful only in holding the room and calling `deliver`.
 */
export const createRoomHost = (game: GameState, nextSeed: () => number): RoomHost => {
  let room: Room = createRoom(game);
  const lines = new Map<ConnectionId, (wire: string) => void>();

  const carryOut = (step: RoomStep) => {
    room = step.room;
    for (const outbound of step.out) {
      const wire = JSON.stringify(outbound.message);
      for (const target of recipients(outbound, [...lines.keys()])) lines.get(target)?.(wire);
    }
  };

  return {
    room: () => room,
    size: () => lines.size,
    connect: (connection, deliver) => {
      if (lines.has(connection)) return;
      lines.set(connection, deliver);
      carryOut(joinRoom(room, connection));
    },
    receive: (connection, wire) => {
      const message = parseClientMessage(readJson(wire));
      if (message) carryOut(receive(room, connection, message, nextSeed()));
    },
    disconnect: (connection) => {
      if (!lines.delete(connection)) return;
      carryOut(leaveRoom(room, connection));
    },
  };
};

/** The value `wire` spells in JSON; null when it spells none. */
const readJson = (wire: string): unknown => {
  try {
    return JSON.parse(wire);
  } catch {
    return null;
  }
};

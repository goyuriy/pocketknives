import type { PlayerId } from '../types.js';
import { applyCommand } from '../game/apply.js';
import type { Command } from '../game/commands.js';
import type { GameState } from '../game/state.js';
import type { ClientMessage, RoomRejection, ServerMessage } from './protocol.js';

/** One connection to the room: a browser tab, a phone. Chosen by whatever carries the messages. */
export type ConnectionId = string;

/**
 * A table people play at over a network: the game, and who is sitting where.
 *
 * Plain data, moved on only by the pure functions below, so the room's whole
 * behaviour — seating, who may ask for what, what everyone is told — is
 * tested without a network, and any server (a WebSocket process, a Colyseus
 * room, a worker) is only a thin shell that keeps a `Room`, feeds it what
 * arrives, and delivers what it answers.
 */
export type Room = {
  readonly game: GameState;
  /** Which player each seated connection plays for. Connections not listed are watching. */
  readonly seats: Readonly<Record<ConnectionId, PlayerId>>;
  /** Everyone connected, in the order they came. */
  readonly connections: readonly ConnectionId[];
  /**
   * Who runs the table: starts a new match, tunes the sandbox, hands the turn
   * about. The first to join; when they leave, the next longest there.
   */
  readonly host: ConnectionId | null;
};

/** A message for the transport to deliver: to one connection, or to everyone (but perhaps one). */
export type Outbound =
  | { readonly to: 'one'; readonly connection: ConnectionId; readonly message: ServerMessage }
  | { readonly to: 'everyone'; readonly except?: ConnectionId; readonly message: ServerMessage };

/** The room after something happened, and what to tell whom. */
export type RoomStep = { readonly room: Room; readonly out: readonly Outbound[] };

export const createRoom = (game: GameState): Room => ({ game, seats: {}, connections: [], host: null });

/** Which player `connection` plays for; null when watching or not here. */
export const seatOf = (room: Room, connection: ConnectionId): PlayerId | null => room.seats[connection] ?? null;

/**
 * Someone arrives: they take the first free player of the match, or watch if
 * every seat is taken. The first to arrive hosts. They are told where the game
 * stands — a late joiner gets the whole state, knives already lying where they
 * fell — and everyone else hears who sat down.
 */
export const joinRoom = (room: Room, connection: ConnectionId): RoomStep => {
  if (room.connections.includes(connection)) return { room, out: [] };
  const taken = new Set(Object.values(room.seats));
  const seat = room.game.match.players.find((player) => !taken.has(player)) ?? null;
  const next: Room = {
    ...room,
    seats: seat ? { ...room.seats, [connection]: seat } : room.seats,
    connections: [...room.connections, connection],
    host: room.host ?? connection,
  };
  const welcome: ServerMessage = { type: 'welcome', you: seat, host: next.host === connection, state: next.game };
  return {
    room: next,
    out: [
      { to: 'one', connection, message: welcome },
      ...(seat ? [{ to: 'everyone' as const, except: connection, message: { type: 'joined' as const, playerId: seat } }] : []),
    ],
  };
};

/**
 * Someone goes: their seat comes free for the next to join, and if they
 * hosted, the next longest there takes over. The game itself is untouched —
 * their ground and their turn wait for whoever sits down next.
 */
export const leaveRoom = (room: Room, connection: ConnectionId): RoomStep => {
  if (!room.connections.includes(connection)) return { room, out: [] };
  const seat = seatOf(room, connection);
  const connections = room.connections.filter((other) => other !== connection);
  const host = room.host === connection ? (connections[0] ?? null) : room.host;
  const seats = Object.fromEntries(Object.entries(room.seats).filter(([seated]) => seated !== connection));
  const out: Outbound[] = [];
  if (seat) out.push({ to: 'everyone', message: { type: 'left', playerId: seat } });
  if (host && host !== room.host) out.push({ to: 'one', connection: host, message: { type: 'host' } });
  return { room: { ...room, seats, connections, host }, out };
};

/**
 * Whether `connection` may ask for `command` at all, before the game is asked:
 * a player acts only for themselves, and only the host runs the table. The
 * game then has its own say (`applyCommand`) — whose turn it is, and the rest.
 */
export const mayAsk = (room: Room, connection: ConnectionId, command: Command): RoomRejection | null => {
  switch (command.type) {
    case 'throw':
    case 'chooseKnife':
    case 'setSkill': {
      const seat = seatOf(room, connection);
      if (!seat) return 'not_seated';
      return command.playerId === seat ? null : 'not_yours';
    }
    case 'newMatch':
    case 'configure':
    case 'giveTurn':
      return room.host === connection ? null : 'host_only';
  }
};

/**
 * A message from `connection`, already checked (`parseClientMessage`).
 *
 * A command is allowed or turned down (`mayAsk`), then applied with the
 * room's own `seed` — the authority's dice — and everyone, the sender
 * included, hears the new state and what happened. Presence is passed on to
 * everyone else under the sender's seat, never a player id they claim.
 */
export const receive = (room: Room, connection: ConnectionId, message: ClientMessage, seed: number): RoomStep => {
  if (!room.connections.includes(connection)) return { room, out: [] };
  if (message.type === 'presence') {
    const seat = seatOf(room, connection);
    return seat
      ? { room, out: [{ to: 'everyone', except: connection, message: { type: 'presence', playerId: seat, presence: message.presence } }] }
      : { room, out: [] };
  }
  const refused = (reason: RoomRejection): RoomStep => ({
    room,
    out: [{ to: 'one', connection, message: { type: 'rejected', id: message.id, reason } }],
  });
  const allowed = mayAsk(room, connection, message.command);
  if (allowed) return refused(allowed);
  const applied = applyCommand(room.game, message.command, { seed });
  if (!applied.ok) return refused(applied.reason);
  return {
    room: { ...room, game: applied.state },
    out: [{ to: 'everyone', message: { type: 'update', state: applied.state, events: applied.events } }],
  };
};

/** Who, of `connections`, an outbound message is for. */
export const recipients = (outbound: Outbound, connections: readonly ConnectionId[]): readonly ConnectionId[] => {
  if (outbound.to === 'one') return connections.includes(outbound.connection) ? [outbound.connection] : [];
  const { except } = outbound;
  return connections.filter((connection) => connection !== except);
};

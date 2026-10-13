import { createGame, createRoomHost, SEAT_NAMES, type GameState, type RoomHost } from '@pocketknives/core';

/** The fewest and the most players a room's match is laid out for. */
export const MIN_SEATS = 2;
export const MAX_SEATS = SEAT_NAMES.length;
/** The most rooms kept at once. Past it, new rooms are refused rather than the server run out of memory. */
export const MAX_ROOMS = 500;

/** A room's code, as it appears in a join link: short, and safe in a URL. */
export const isRoomCode = (code: string): boolean => /^[a-z0-9-]{3,32}$/.test(code);

/** How many seats a new room has: what was asked for, kept within what a match can be. */
export const seatsFor = (asked: number | null): number =>
  asked === null || !Number.isFinite(asked) ? MAX_SEATS : Math.min(MAX_SEATS, Math.max(MIN_SEATS, Math.floor(asked)));

/** The match a new room opens on: a real one — turns pass, nothing is tunable. */
export const newRoomGame = (seats: number): GameState => createGame({ players: SEAT_NAMES.slice(0, seats) });

/**
 * Every room this server keeps, by code.
 *
 * A room is made by the first to open its link and forgotten when the last
 * one leaves: a match lives exactly as long as someone is at the table.
 *
 * Effectful: holds the rooms.
 */
export const createRoomRegistry = (nextSeed: () => number) => {
  const rooms = new Map<string, RoomHost>();
  return {
    count: () => rooms.size,
    /** The room with this code, made with `seats` seats if nobody has opened it yet; null when the server is full. */
    open: (code: string, seats: number): RoomHost | null => {
      const known = rooms.get(code);
      if (known) return known;
      if (rooms.size >= MAX_ROOMS) return null;
      const room = createRoomHost(newRoomGame(seats), nextSeed);
      rooms.set(code, room);
      return room;
    },
    /** Forgets the room once it is empty. Call after every disconnect. */
    tidy: (code: string) => {
      if (rooms.get(code)?.size() === 0) rooms.delete(code);
    },
  };
};

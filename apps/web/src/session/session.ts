import {
  applyCommand,
  type Command,
  type GameEvent,
  type GameState,
  type PlayerId,
  type Presence,
  type Rejection,
  type RoomRejection,
} from '@pocketknives/core';

/** A change to the game: where it stands now, and what happened to get there. */
export type SessionUpdate = { readonly state: GameState; readonly events: readonly GameEvent[] };

/**
 * Where the other players stand and point, as they move: lossy, never deciding
 * anything. `null` when a player has gone.
 */
export type PresenceChannel = {
  /** Tells the others where this screen's player is. Fire and forget. */
  readonly publish: (presence: Presence) => void;
  readonly subscribe: (listener: (playerId: PlayerId, presence: Presence | null) => void) => () => void;
};

/**
 * The client's one line to the game — the seam multiplayer plugs into.
 *
 * The client never changes the game itself. It reads the latest state, sends
 * commands, and hears back what the authority decided. Whether that authority
 * is this browser (a hotseat game, the sandbox) or a room across the network
 * (`netSession.ts`) is the session's business alone: everything above it —
 * the HUD, the stage, the controls — is the same either way.
 */
export type Session = {
  readonly state: () => GameState;
  /**
   * Asks for something. A local session answers at once with why it was
   * turned down, or null if it went through; a networked one answers null and
   * lets the outcome arrive as an update, like everyone else's.
   */
  readonly send: (command: Command) => Rejection | null;
  readonly subscribe: (listener: (update: SessionUpdate) => void) => () => void;
  /** Hears every command of this screen's that was turned down, and why — however late the answer comes. */
  readonly onRejected: (listener: (reason: RoomRejection) => void) => () => void;
  /**
   * The players this screen plays for: every player at a hotseat table, one
   * seat in a room, none for someone watching. Only these may throw from here.
   */
  readonly controls: () => readonly PlayerId[];
  /** Whether this screen runs the table: a new match, the sandbox's settings, the turn. */
  readonly isHost: () => boolean;
  readonly presence: PresenceChannel;
};

/** A seed for a throw's wobble, drawn by whoever is the authority. */
export const drawSeed = (): number => Math.floor(Math.random() * 0x1_0000_0000);

/** A presence channel for a screen with nobody else to tell. */
export const NO_PRESENCE: PresenceChannel = { publish: () => {}, subscribe: () => () => {} };

/**
 * A game run in this browser: this session is the authority. Every command is
 * checked and applied here, with the seed drawn here, and every player sits
 * at this screen.
 *
 * Effectful only in keeping the current state and telling listeners.
 */
export const createLocalSession = (initial: GameState, nextSeed: () => number = drawSeed): Session => {
  let state = initial;
  const listeners = new Set<(update: SessionUpdate) => void>();
  const refusals = new Set<(reason: RoomRejection) => void>();
  return {
    state: () => state,
    send: (command) => {
      const applied = applyCommand(state, command, { seed: nextSeed() });
      if (!applied.ok) {
        refusals.forEach((listener) => listener(applied.reason));
        return applied.reason;
      }
      state = applied.state;
      const update = { state, events: applied.events };
      listeners.forEach((listener) => listener(update));
      return null;
    },
    subscribe: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    onRejected: (listener) => {
      refusals.add(listener);
      return () => refusals.delete(listener);
    },
    controls: () => state.match.players,
    isHost: () => true,
    presence: NO_PRESENCE,
  };
};

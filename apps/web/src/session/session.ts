import { applyCommand, type Command, type GameEvent, type GameState, type Rejection } from '@pocketknives/core';

/** A change to the game: where it stands now, and what happened to get there. */
export type SessionUpdate = { readonly state: GameState; readonly events: readonly GameEvent[] };

/**
 * The client's one line to the game — the seam multiplayer plugs into.
 *
 * The client never changes the game itself. It reads the latest state, sends
 * commands, and hears back what the authority decided. Whether that authority
 * is this browser (a hotseat game, the sandbox) or a server across the
 * network (a link room) is the session's business alone: everything above it
 * — the HUD, the stage, the controls — is the same either way.
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
};

/** A seed for a throw's wobble, drawn by whoever is the authority. */
const drawSeed = (): number => Math.floor(Math.random() * 0x1_0000_0000);

/**
 * A game run in this browser: this session is the authority. Every command is
 * checked and applied here, with the seed drawn here.
 *
 * Effectful only in keeping the current state and telling listeners.
 */
export const createLocalSession = (initial: GameState, nextSeed: () => number = drawSeed): Session => {
  let state = initial;
  const listeners = new Set<(update: SessionUpdate) => void>();
  return {
    state: () => state,
    send: (command) => {
      const applied = applyCommand(state, command, { seed: nextSeed() });
      if (!applied.ok) return applied.reason;
      state = applied.state;
      const update = { state, events: applied.events };
      listeners.forEach((listener) => listener(update));
      return null;
    },
    subscribe: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
};

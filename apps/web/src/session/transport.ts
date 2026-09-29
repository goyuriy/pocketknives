import type { ClientMessage, ServerMessage } from '@pocketknives/core';

/**
 * A line to a room: whatever carries the messages — a WebSocket, a WebRTC
 * channel, or an in-memory room for tests (`loopback.ts`). The session speaks
 * only in messages, so swapping one carrier for another changes nothing above.
 */
export type Transport = {
  readonly send: (message: ClientMessage) => void;
  readonly subscribe: (listener: (message: ServerMessage) => void) => () => void;
  /** Hangs up: the room hears that this player has gone. */
  readonly close: () => void;
};

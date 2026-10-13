import type { ServerMessage } from '@pocketknives/core';
import type { Transport } from './transport.js';

/** A line to a room server, and a promise that settles when the line drops. */
export type RoomLine = {
  readonly transport: Transport;
  /** Resolves with why, once the connection has closed — hung up, lost, or refused by the server. */
  readonly closed: Promise<string>;
};

/**
 * Opens a WebSocket to a room (`ws://host/rooms/<code>`) as a `Transport`.
 *
 * Messages that arrive before anyone listens are kept and handed to the first
 * listener, so the room's welcome cannot slip past between the socket opening
 * and the session subscribing. Rejects if the socket never opens.
 *
 * Effectful: opens a network connection.
 */
export const openWebSocketTransport = (url: string): Promise<RoomLine> =>
  new Promise((resolve, reject) => {
    const socket = new WebSocket(url);
    const listeners = new Set<(message: ServerMessage) => void>();
    let early: ServerMessage[] = [];
    let opened = false;
    let hangUp: (reason: string) => void = () => {};
    const closed = new Promise<string>((done) => (hangUp = done));

    socket.addEventListener('message', (event) => {
      const message = JSON.parse(String(event.data)) as ServerMessage;
      if (listeners.size === 0) early.push(message);
      else listeners.forEach((listener) => listener(message));
    });
    socket.addEventListener('close', (event) => {
      if (opened) hangUp(event.reason || 'the connection to the room was lost');
      else reject(new Error(event.reason || 'could not reach the room server'));
    });
    socket.addEventListener('open', () => {
      opened = true;
      resolve({
        closed,
        transport: {
          send: (message) => {
            if (socket.readyState === WebSocket.OPEN) socket.send(JSON.stringify(message));
          },
          subscribe: (listener) => {
            listeners.add(listener);
            const kept = early;
            early = [];
            kept.forEach((message) => listener(message));
            return () => listeners.delete(listener);
          },
          close: () => socket.close(),
        },
      });
    });
  });

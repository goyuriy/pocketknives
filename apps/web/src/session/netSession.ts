import type { GameState, PlayerId, Presence, RoomRejection, ServerMessage } from '@pocketknives/core';
import type { Session, SessionUpdate } from './session.js';
import type { Transport } from './transport.js';

/**
 * A game run by a room across the network: the room is the authority, and
 * this session only asks and listens. The same shape as a local session, so
 * nothing above it knows the difference.
 *
 * Resolves once the room has said who this screen is and where the game
 * stands (its `welcome`) — for a late joiner, that is the whole match so far.
 *
 * Effectful: keeps the latest state the room sent, and tells listeners.
 */
export const connectNetSession = (transport: Transport): Promise<Session> =>
  new Promise((resolve) => {
    let state: GameState | null = null;
    let you: PlayerId | null = null;
    let host = false;
    let nextId = 0;
    const listeners = new Set<(update: SessionUpdate) => void>();
    const refusals = new Set<(reason: RoomRejection) => void>();
    const watchers = new Set<(playerId: PlayerId, presence: Presence | null) => void>();

    const session: Session = {
      state: () => state!,
      send: (command) => {
        transport.send({ type: 'command', id: nextId++, command });
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
      controls: () => (you ? [you] : []),
      isHost: () => host,
      presence: {
        publish: (presence) => {
          if (you) transport.send({ type: 'presence', presence });
        },
        subscribe: (listener) => {
          watchers.add(listener);
          return () => watchers.delete(listener);
        },
      },
    };

    const hear = (message: ServerMessage) => {
      switch (message.type) {
        case 'welcome':
          ({ you, host, state } = message);
          resolve(session);
          return;
        case 'update': {
          state = message.state;
          const update = { state: message.state, events: message.events };
          listeners.forEach((listener) => listener(update));
          return;
        }
        case 'rejected':
          refusals.forEach((listener) => listener(message.reason));
          return;
        case 'presence':
          watchers.forEach((listener) => listener(message.playerId, message.presence));
          return;
        case 'left':
          watchers.forEach((listener) => listener(message.playerId, null));
          return;
        case 'host':
          host = true;
          return;
        case 'joined':
          return;
      }
    };
    transport.subscribe(hear);
  });

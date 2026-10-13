import { useEffect, useState } from 'react';
import { SEAT_NAMES } from '@pocketknives/core';
import { connectNetSession } from '../session/netSession.js';
import { roomCodeIn, roomSocketUrl } from '../session/roomLink.js';
import type { Session } from '../session/session.js';
import { openWebSocketTransport } from '../session/webSocketTransport.js';

/** Where this screen is sitting: at its own practice table, or at a room's — joining, in, or cut off. */
export type Table =
  | { readonly kind: 'local' }
  | { readonly kind: 'joining'; readonly room: string }
  | { readonly kind: 'room'; readonly room: string; readonly session: Session }
  | { readonly kind: 'lost'; readonly room: string; readonly reason: string };

/**
 * The table the page's address asks for: `?room=<code>` joins that room on the
 * room server, anything else is the practice table in this browser.
 *
 * Effectful: opens the connection to the room, and closes it on the way out.
 */
export const useTable = (): Table => {
  const [room] = useState(() => roomCodeIn(window.location.search));
  const [table, setTable] = useState<Table>(room ? { kind: 'joining', room } : { kind: 'local' });

  useEffect(() => {
    if (!room) return;
    let left = false;
    let hangUp = () => {};
    const url = roomSocketUrl(window.location, room, SEAT_NAMES.length, import.meta.env.VITE_ROOM_SERVER);
    openWebSocketTransport(url)
      .then(async ({ transport, closed }) => {
        hangUp = transport.close;
        if (left) return transport.close();
        void closed.then((reason) => !left && setTable({ kind: 'lost', room, reason }));
        const session = await connectNetSession(transport);
        if (!left) setTable({ kind: 'room', room, session });
      })
      .catch((error: unknown) => !left && setTable({ kind: 'lost', room, reason: error instanceof Error ? error.message : 'could not reach the room' }));
    return () => {
      left = true;
      hangUp();
    };
  }, [room]);

  return table;
};

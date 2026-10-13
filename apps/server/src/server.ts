import { randomInt, randomUUID } from 'node:crypto';
import { createServer } from 'node:http';
import { WebSocketServer, type WebSocket } from 'ws';
import { createRoomRegistry, isRoomCode, seatsFor } from './rooms.js';

/** The longest message a player may send, bytes. A throw is a few hundred; a whole tuning a few thousand. */
const MAX_MESSAGE = 16 * 1024;
/** How often every connection is pinged, milliseconds. One that missed the last ping is gone. */
const HEARTBEAT = 30_000;
/** Close codes this server uses, from the range WebSocket leaves to applications. */
export const CLOSED = { noSuchRoom: 4404, full: 4503 } as const;

export type RoomServer = {
  /** The port it is listening on — the one asked for, or the one the system gave for port 0. */
  readonly port: number;
  readonly rooms: () => number;
  readonly close: () => Promise<void>;
};

/** Which room a request's path names, and how many seats were asked for: `/rooms/<code>?seats=3`. */
const roomOf = (url: string | undefined): { code: string; seats: number } | null => {
  const { pathname, searchParams } = new URL(url ?? '/', 'http://room');
  const code = /^\/rooms\/([^/]+)$/.exec(pathname)?.[1];
  if (!code || !isRoomCode(code)) return null;
  const asked = searchParams.get('seats');
  return { code, seats: seatsFor(asked === null ? null : Number(asked)) };
};

/**
 * The room server: WebSockets in, the core's rooms behind them.
 *
 * Everything that decides anything is in `@pocketknives/core` — who sits
 * where, who may ask for what, what a throw comes to. This only carries: a
 * socket opened on `/rooms/<code>` joins that room, its text goes to the room,
 * the room's replies go back down the sockets they are for, and closing the
 * socket leaves. The seeds are drawn here, where no player can reach them.
 *
 * Effectful: listens on `port` (0 for any free one), keeps the rooms, pings.
 */
export const startRoomServer = (port: number): Promise<RoomServer> =>
  new Promise((resolve) => {
    const registry = createRoomRegistry(() => randomInt(0, 2 ** 32));
    const http = createServer((_request, response) => {
      response.writeHead(200, { 'content-type': 'text/plain' }).end('Pocket Knives rooms\n');
    });
    const sockets = new WebSocketServer({ server: http, maxPayload: MAX_MESSAGE });
    const alive = new WeakSet<WebSocket>();

    sockets.on('connection', (socket, request) => {
      const asked = roomOf(request.url);
      if (!asked) return socket.close(CLOSED.noSuchRoom, 'no such room');
      const room = registry.open(asked.code, asked.seats);
      if (!room) return socket.close(CLOSED.full, 'the server is full');

      const id = randomUUID();
      alive.add(socket);
      socket.on('pong', () => alive.add(socket));
      socket.on('message', (data, isBinary) => {
        if (!isBinary) room.receive(id, data.toString());
      });
      socket.on('close', () => {
        room.disconnect(id);
        registry.tidy(asked.code);
      });
      socket.on('error', () => socket.terminate());
      room.connect(id, (wire) => socket.send(wire));
    });

    // The usual WebSocket heartbeat: a connection that did not answer the last ping is dropped.
    const heartbeat = setInterval(() => {
      for (const socket of sockets.clients) {
        if (!alive.has(socket)) socket.terminate();
        else {
          alive.delete(socket);
          socket.ping();
        }
      }
    }, HEARTBEAT);

    http.listen(port, () => {
      const address = http.address();
      resolve({
        port: typeof address === 'object' && address ? address.port : port,
        rooms: registry.count,
        close: () =>
          new Promise((closed) => {
            clearInterval(heartbeat);
            for (const socket of sockets.clients) socket.terminate();
            sockets.close(() => http.close(() => closed()));
          }),
      });
    });
  });

/** Where the room server listens when nothing says otherwise (`apps/server`). */
export const ROOM_SERVER_PORT = 8787;

/** The letters a room code is made of: no vowels, so no accidental words, and nothing that reads like another. */
const CODE_LETTERS = 'bcdfghjkmnpqrstvwxz23456789';
const CODE_LENGTH = 6;

/** A room's code, as the server takes it: short, lower-case, safe in a URL. */
export const isRoomCode = (code: string): boolean => /^[a-z0-9-]{3,32}$/.test(code);

/** A fresh room code. `random` gives numbers in [0, 1), as `Math.random` does. */
export const newRoomCode = (random: () => number): string =>
  Array.from({ length: CODE_LENGTH }, () => CODE_LETTERS[Math.floor(random() * CODE_LETTERS.length)]).join('');

/** The room a page's address asks for (`?room=<code>`); null when it asks for none, or for nonsense. */
export const roomCodeIn = (search: string): string | null => {
  const code = new URLSearchParams(search).get('room')?.toLowerCase() ?? null;
  return code !== null && isRoomCode(code) ? code : null;
};

/** The address to send a friend: this page, in that room. */
export const roomLinkFor = (href: string, code: string): string => {
  const url = new URL(href);
  url.search = new URLSearchParams({ room: code }).toString();
  url.hash = '';
  return url.toString();
};

/**
 * The room's WebSocket address. By default the room server is on the same
 * machine the page came from, on its own port — which is what a phone on the
 * same Wi-Fi needs; `server` (a `ws://` or `wss://` origin) says otherwise for
 * a deployed one.
 */
export const roomSocketUrl = (page: { protocol: string; hostname: string }, code: string, seats: number, server?: string): string => {
  const origin = server?.replace(/\/+$/, '') ?? `${page.protocol === 'https:' ? 'wss:' : 'ws:'}//${page.hostname}:${ROOM_SERVER_PORT}`;
  return `${origin}/rooms/${code}?seats=${seats}`;
};

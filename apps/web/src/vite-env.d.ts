/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Where the room server is, as a `ws://` or `wss://` origin. Unset, it is beside the page on port 8787. */
  readonly VITE_ROOM_SERVER?: string;
}

import { startRoomServer } from './server.js';

/** Where the room server listens unless `PORT` says otherwise; the web app looks for it here too. */
const DEFAULT_PORT = 8787;

const server = await startRoomServer(Number(process.env.PORT) || DEFAULT_PORT);
console.log(`Pocket Knives rooms on :${server.port}`);

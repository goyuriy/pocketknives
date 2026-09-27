/**
 * The one piece of Node the tests use: reading a shipped asset off disk. The
 * game itself never runs in Node, so it gets this rather than all of Node's
 * types, which would change what `setTimeout` and friends return everywhere.
 */
declare module 'node:fs' {
  export const readFileSync: (path: URL) => { toString(encoding: 'base64'): string };
}

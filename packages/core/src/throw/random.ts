/**
 * A tiny deterministic random source.
 *
 * The knife is allowed to wander, but only in a way that can be replayed. A
 * throw is recorded as an aim, a power and a seed; feed the same three back in
 * anywhere — another machine, a server checking a client, a replay months later
 * — and the knife lands in exactly the same place. Reaching for `Math.random`
 * would make the scatter unverifiable and the game uncheckable.
 *
 * mulberry32: small, fast, and good enough for scattering a throw. Not for
 * anything where the numbers must be unguessable.
 */
export const seededRandom = (seed: number): (() => number) => {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

/**
 * A spread centred on zero, from a source of uniform numbers.
 *
 * Two draws averaged rather than one, which bunches results toward the middle:
 * most throws land near what was aimed and the wild ones are rare. A flat
 * distribution makes a badly-off throw exactly as likely as a good one, which
 * reads as the controls being broken rather than the throw being hard.
 */
export const jitter = (next: () => number, spread: number): number =>
  spread === 0 ? 0 : (next() + next() - 1) * spread;

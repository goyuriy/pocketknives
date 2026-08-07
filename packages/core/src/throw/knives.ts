import type { KnifeSpec } from './config.js';

export type KnifeChoice = {
  readonly id: string;
  readonly name: string;
  /** One line a player can decide on without reading a stat block. */
  readonly character: string;
  readonly spec: KnifeSpec;
};

/**
 * The knives a player picks between before a match.
 *
 * Hand-made rather than generated, because most of the possible space is bad:
 * knives that cannot be made to tumble, or that forgive so much there is no
 * throw left in them. Four that are each clearly a different way to play beat a
 * hundred that differ by a decimal.
 *
 * Every difference here is physical and already drives the flight — mass and
 * balance set how the wrist translates into tumble, blade length sets how much
 * the ground forgives, edge sets how deep it goes. None of it is a stat bar
 * bolted on top of a fixed knife.
 */
export const KNIVES: readonly KnifeChoice[] = [
  {
    id: 'kitchen',
    name: 'Kitchen',
    character: 'Turns easily and forgives a rough landing. The one to learn on.',
    spec: {
      bladeLength: 0.52,
      handleLength: 0.42,
      mass: 0.16,
      balance: 0.58,
      edgeWidth: 0.028,
    },
  },
  {
    id: 'thrower',
    name: 'Thrower',
    character: 'Weighted forward and even-tempered. Nothing it does will surprise you.',
    spec: {
      bladeLength: 0.42,
      handleLength: 0.48,
      mass: 0.2,
      balance: 0.62,
      edgeWidth: 0.03,
    },
  },
  {
    id: 'cleaver',
    name: 'Cleaver',
    character: 'Heavy and slow to turn. Needs a real swing, and buries itself when it lands.',
    spec: {
      bladeLength: 0.46,
      handleLength: 0.44,
      mass: 0.42,
      balance: 0.68,
      edgeWidth: 0.05,
    },
  },
  {
    id: 'needle',
    name: 'Needle',
    character: 'Light and fast. Spins off the smallest flick and punishes a sloppy one.',
    spec: {
      bladeLength: 0.34,
      handleLength: 0.36,
      mass: 0.09,
      balance: 0.55,
      edgeWidth: 0.012,
    },
  },
];

export const knifeById = (id: string): KnifeChoice =>
  KNIVES.find((knife) => knife.id === id) ?? KNIVES[1]!;

import type { KnifeSpec } from './config.js';

export type KnifeChoice = {
  readonly id: string;
  readonly name: string;
  /** One line a player can decide on without reading a stat block. */
  readonly character: string;
  readonly spec: KnifeSpec;
  /**
   * How many hands it takes to throw. Not physics — the flight never reads it —
   * but it is how the thing is held, and so what the player sees themselves
   * doing: a knife is flicked from one fist, a sword heaved from two.
   */
  readonly hands: 1 | 2;
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
 * balance set how lazily or wildly it turns, blade length sets how much a shaky
 * throw is forgiven, edge sets how deep it goes. None of it is a stat bar bolted
 * on top of a fixed knife.
 */
export const KNIVES: readonly KnifeChoice[] = [
  {
    id: 'kitchen',
    name: 'Kitchen',
    character: 'Long in the blade and forgiving of a shaky hand. The one to learn on.',
    spec: {
      bladeLength: 0.52,
      handleLength: 0.42,
      mass: 0.16,
      balance: 0.58,
      edgeWidth: 0.028,
    },
    hands: 1,
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
    hands: 1,
  },
  {
    id: 'cleaver',
    name: 'Cleaver',
    character: 'Heavy and slow to turn, and buries itself to the handle when it lands.',
    spec: {
      bladeLength: 0.46,
      handleLength: 0.44,
      mass: 0.42,
      balance: 0.68,
      edgeWidth: 0.05,
    },
    hands: 1,
  },
  {
    id: 'needle',
    name: 'Needle',
    character: 'Light and whirling. Flies furthest, and its short point forgives nothing.',
    spec: {
      bladeLength: 0.36,
      handleLength: 0.44,
      mass: 0.12,
      balance: 0.55,
      edgeWidth: 0.012,
    },
    hands: 1,
  },
  {
    id: 'greatsword',
    name: 'Greatsword',
    character: 'Two hands, barely a turn in the air, and it drops point-first from anywhere.',
    spec: {
      bladeLength: 1.15,
      handleLength: 0.5,
      mass: 0.9,
      // Balanced close to the guard, as a sword is — so it is the long blade,
      // not the grip, that swings round and leads it down.
      balance: 0.4,
      edgeWidth: 0.04,
    },
    hands: 2,
  },
];

export const knifeById = (id: string): KnifeChoice =>
  KNIVES.find((knife) => knife.id === id) ?? KNIVES[1]!;

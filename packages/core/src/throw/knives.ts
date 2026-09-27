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
  /**
   * The character level it opens at, for a knife held back until much later
   * in the game. Absent means it is in the rack from the start.
   */
  readonly unlocksAt?: number;
};

/**
 * The knives a player picks between before a match.
 *
 * In metres and kilograms, at the size of the real thing: a throwing knife is
 * about thirty centimetres long.
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
      bladeLength: 0.173,
      handleLength: 0.14,
      mass: 0.16,
      balance: 0.58,
      edgeWidth: 0.0093,
    },
    hands: 1,
  },
  {
    id: 'thrower',
    name: 'Thrower',
    character: 'Weighted forward and even-tempered. Nothing it does will surprise you.',
    spec: {
      bladeLength: 0.14,
      handleLength: 0.16,
      mass: 0.2,
      balance: 0.62,
      edgeWidth: 0.01,
    },
    hands: 1,
  },
  {
    id: 'cleaver',
    name: 'Cleaver',
    character: 'Heavy and slow to turn, and buries itself to the handle when it lands.',
    spec: {
      bladeLength: 0.153,
      handleLength: 0.147,
      mass: 0.42,
      balance: 0.68,
      edgeWidth: 0.0167,
    },
    hands: 1,
  },
  {
    id: 'needle',
    name: 'Needle',
    character: 'Light and whirling. Flies furthest, and its short point forgives nothing.',
    spec: {
      bladeLength: 0.12,
      handleLength: 0.147,
      mass: 0.12,
      balance: 0.55,
      edgeWidth: 0.004,
    },
    hands: 1,
  },
  {
    id: 'greatsword',
    name: 'Greatsword',
    character: 'Two hands, barely a turn in the air, and it drops point-first from anywhere.',
    spec: {
      bladeLength: 0.383,
      handleLength: 0.167,
      mass: 0.9,
      // Balanced close to the guard, as a sword is — so it is the long blade,
      // not the grip, that swings round and leads it down.
      balance: 0.4,
      edgeWidth: 0.0133,
    },
    hands: 2,
    // Two-handed throwing is not finished: held back until late in the game.
    unlocksAt: 30,
  },
];

/** Whether a knife is in the rack for a character at `level`. */
export const isUnlocked = (knife: KnifeChoice, level: number): boolean =>
  knife.unlocksAt === undefined || level >= knife.unlocksAt;

export const knifeById = (id: string): KnifeChoice =>
  KNIVES.find((knife) => knife.id === id) ?? KNIVES[1]!;

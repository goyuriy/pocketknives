import type { Vec2 } from '../types.js';

/**
 * Checks for data that arrived from outside — over a network, from a stranger.
 *
 * Every function here is total: it looks at `unknown` and answers yes or no,
 * never throws, and never trusts a field it has not looked at. The room runs
 * these before a message is allowed anywhere near the game.
 */

/** Longest name or id a message may carry. */
export const MAX_ID_LENGTH = 32;

export const isRecord = (value: unknown): value is Readonly<Record<string, unknown>> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/** A real number: not NaN, not infinite. JSON cannot carry the others, but a hand-made message can try. */
export const isFiniteNumber = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);

export const isId = (value: unknown): value is string =>
  typeof value === 'string' && value.length > 0 && value.length <= MAX_ID_LENGTH;

export const isVec2 = (value: unknown): value is Vec2 =>
  Array.isArray(value) && value.length === 2 && value.every(isFiniteNumber);

/**
 * Whether `value` has exactly the shape of `template`: the same keys, all the
 * way down, each holding the same kind of thing — a finite number where the
 * template has a number, a string where it has a string. For the tunings
 * (`ThrowConfig`, `RuleSet`), which are trees of numbers: the default is the
 * template, so a new field is checked the moment it is added.
 */
export const matchesShape = (value: unknown, template: unknown): boolean => {
  if (typeof template === 'number') return isFiniteNumber(value);
  if (typeof template === 'string' || typeof template === 'boolean') return typeof value === typeof template;
  if (Array.isArray(template)) {
    return Array.isArray(value) && value.length === template.length && value.every((item, i) => matchesShape(item, template[i]));
  }
  if (isRecord(template)) {
    if (!isRecord(value)) return false;
    const keys = Object.keys(template);
    return Object.keys(value).length === keys.length && keys.every((key) => matchesShape(value[key], template[key]));
  }
  return false;
};

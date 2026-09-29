import { describe, expect, it } from 'vitest';
import { DEFAULT_CONFIG } from '../throw/config.js';
import { DEFAULT_RULES } from '../rules/cut.js';
import { parseClientMessage } from './protocol.js';
import { matchesShape } from './shape.js';

const throwing = {
  type: 'command',
  id: 1,
  command: {
    type: 'throw',
    playerId: 'Red',
    stance: { feet: [0, -5], facing: 1.57 },
    intent: { aim: 0, pitch: -0.4, draw: 0.5, drift: 0 },
  },
};
const viaJson = (value: unknown): unknown => JSON.parse(JSON.stringify(value));

describe('parseClientMessage', () => {
  it('takes a well-formed throw, as it arrives over the wire', () => {
    expect(parseClientMessage(viaJson(throwing))).toEqual(throwing);
  });

  it('keeps only the fields it checked', () => {
    const padded = { ...throwing, command: { ...throwing.command, seed: 7, outcome: 'win' } };
    expect(parseClientMessage(padded)).toEqual(throwing);
  });

  it('turns away anything malformed, whatever it is', () => {
    const broken: unknown[] = [
      null,
      42,
      'throw',
      [],
      { type: 'shout' },
      { ...throwing, id: 'one' },
      { ...throwing, command: { ...throwing.command, playerId: '' } },
      { ...throwing, command: { ...throwing.command, playerId: 'x'.repeat(33) } },
      { ...throwing, command: { ...throwing.command, stance: { feet: [0], facing: 0 } } },
      { ...throwing, command: { ...throwing.command, intent: { aim: NaN, pitch: 0, draw: 0.5, drift: 0 } } },
      { ...throwing, command: { ...throwing.command, intent: { aim: 0, pitch: 0, draw: Infinity, drift: 0 } } },
      { type: 'command', id: 2, command: { type: 'newMatch', players: [] } },
      { type: 'command', id: 2, command: { type: 'newMatch', players: ['Red', 'Red'] } },
      { type: 'command', id: 2, command: { type: 'newMatch', players: Array.from({ length: 9 }, (_, i) => `P${i}`) } },
      { type: 'command', id: 3, command: { type: 'setSkill', playerId: 'Red', skill: 'flight', level: 1 } },
      { type: 'command', id: 4, command: { type: 'configure', settings: { passTurns: 'no' } } },
      { type: 'command', id: 4, command: { type: 'configure', settings: { throw: { knife: {} } } } },
      { type: 'presence', presence: { stance: { feet: [0, 0], facing: 0 }, aim: 0, pitch: 0, draw: 'half' } },
    ];
    for (const message of broken) expect(parseClientMessage(message)).toBeNull();
  });

  it('takes the sandbox’s whole tuning, but only in the shape the game has', () => {
    const configure = { type: 'command', id: 5, command: { type: 'configure', settings: { passTurns: false, throw: DEFAULT_CONFIG } } };
    expect(parseClientMessage(viaJson(configure))).toEqual(configure);
    const newMatch = { type: 'command', id: 6, command: { type: 'newMatch', players: ['Red', 'Blue'], rules: DEFAULT_RULES } };
    expect(parseClientMessage(viaJson(newMatch))).toEqual(newMatch);
  });

  it('takes presence, holding a throw or not', () => {
    const presence = { type: 'presence', presence: { stance: { feet: [1, 2], facing: 0.5 }, aim: 0.1, pitch: -0.2, draw: null } };
    expect(parseClientMessage(viaJson(presence))).toEqual(presence);
  });
});

describe('matchesShape', () => {
  it('wants the same keys and kinds all the way down', () => {
    expect(matchesShape({ a: 1, b: { c: 'x' } }, { a: 0, b: { c: '' } })).toBe(true);
    expect(matchesShape({ a: 1, b: { c: 2 } }, { a: 0, b: { c: '' } })).toBe(false);
    expect(matchesShape({ a: 1 }, { a: 0, b: 0 })).toBe(false);
    expect(matchesShape({ a: 1, b: 0, c: 0 }, { a: 0, b: 0 })).toBe(false);
    expect(matchesShape([1, 2], [0, 0])).toBe(true);
    expect(matchesShape([1], [0, 0])).toBe(false);
  });
});

import type { PlayerId, RuleSet } from '../types.js';
import type { ThrowIntent } from '../throw/swing.js';
import { DEFAULT_CONFIG, type ThrowConfig } from '../throw/config.js';
import { DEFAULT_RULES } from '../rules/cut.js';
import type { Command } from '../game/commands.js';
import type { GameEvent } from '../game/events.js';
import type { Rejection } from '../game/apply.js';
import type { Stance } from '../game/stance.js';
import { SKILL_IDS, type GameSettings, type GameState, type SkillId } from '../game/state.js';
import { isFiniteNumber, isId, isRecord, isVec2, matchesShape } from './shape.js';

/**
 * What the room and its players say to each other — the wire, as types.
 *
 * Shared by both ends, so a server and a client can never disagree about a
 * message's shape. Everything is plain data, sent as JSON; the room reads every
 * message a player sends through `parseClientMessage` first, because anything
 * can arrive over a network.
 */

/**
 * Where a player stands and points this instant: for drawing them, on every
 * other screen, as they walk and aim. Lossy and frequent — a missed one is
 * simply replaced by the next — and it never decides anything. Only the stance
 * inside a throw command counts.
 */
export type Presence = {
  readonly stance: Stance;
  /** Where the hand points, radians from the way the body faces, positive right. */
  readonly aim: number;
  /** How steeply the hand is set to throw, radians above level. */
  readonly pitch: number;
  /** How far the arm is drawn, 0 to 1; null when not holding a throw. */
  readonly draw: number | null;
};

/** Why the room turned a command down: the game's reasons, and the room's own. */
export type RoomRejection =
  | Rejection
  /** Watching, not playing: a spectator has no seat to act for. */
  | 'not_seated'
  /** Asked on behalf of a player the sender does not play for. */
  | 'not_yours'
  /** Only the host runs the table: a new match, the sandbox's settings, the turn. */
  | 'host_only';

/** From a player to the room. */
export type ClientMessage =
  /** `id` is the sender's own count, so a rejection can say which command it was. */
  | { readonly type: 'command'; readonly id: number; readonly command: Command }
  | { readonly type: 'presence'; readonly presence: Presence };

/** From the room to a player. */
export type ServerMessage =
  /**
   * The first thing a player hears on joining: where the game stands, and
   * which player they are (null to watch, when every seat is taken).
   */
  | { readonly type: 'welcome'; readonly you: PlayerId | null; readonly host: boolean; readonly state: GameState }
  /** The game moved on: everyone hears it, the sender too — that is their answer. */
  | { readonly type: 'update'; readonly state: GameState; readonly events: readonly GameEvent[] }
  /** The sender's command `id` was turned down. Nothing changed. */
  | { readonly type: 'rejected'; readonly id: number; readonly reason: RoomRejection }
  | { readonly type: 'presence'; readonly playerId: PlayerId; readonly presence: Presence }
  | { readonly type: 'joined' | 'left'; readonly playerId: PlayerId }
  /** You run the table now: the host before you left. */
  | { readonly type: 'host' };

/** The most players a match may be started with. */
export const MAX_PLAYERS = 8;

/**
 * A message a player sent, if it is one — checked field by field and rebuilt
 * from only the fields that were checked. Null for anything else.
 *
 * Total: it never throws, whatever `data` is.
 */
export const parseClientMessage = (data: unknown): ClientMessage | null => {
  if (!isRecord(data)) return null;
  if (data.type === 'command') {
    const command = parseCommand(data.command);
    return isFiniteNumber(data.id) && command ? { type: 'command', id: data.id, command } : null;
  }
  if (data.type === 'presence') {
    const presence = parsePresence(data.presence);
    return presence ? { type: 'presence', presence } : null;
  }
  return null;
};

/** A command, if `data` is one; rebuilt from its checked fields only. */
export const parseCommand = (data: unknown): Command | null => {
  if (!isRecord(data)) return null;
  switch (data.type) {
    case 'throw': {
      const stance = parseStance(data.stance);
      const intent = parseIntent(data.intent);
      return isId(data.playerId) && stance && intent ? { type: 'throw', playerId: data.playerId, stance, intent } : null;
    }
    case 'chooseKnife':
      return isId(data.playerId) && isId(data.knifeId) ? { type: 'chooseKnife', playerId: data.playerId, knifeId: data.knifeId } : null;
    case 'newMatch': {
      const { players, rules } = data;
      if (!Array.isArray(players) || players.length < 1 || players.length > MAX_PLAYERS) return null;
      if (!players.every(isId) || new Set(players).size !== players.length) return null;
      if (rules === undefined) return { type: 'newMatch', players };
      return matchesShape(rules, DEFAULT_RULES) ? { type: 'newMatch', players, rules: rules as RuleSet } : null;
    }
    case 'configure': {
      const settings = parseSettings(data.settings);
      return settings ? { type: 'configure', settings } : null;
    }
    case 'giveTurn':
      return isId(data.playerId) ? { type: 'giveTurn', playerId: data.playerId } : null;
    case 'setSkill':
      return isId(data.playerId) && isSkillId(data.skill) && isFiniteNumber(data.level)
        ? { type: 'setSkill', playerId: data.playerId, skill: data.skill, level: data.level }
        : null;
    default:
      return null;
  }
};

const isSkillId = (value: unknown): value is SkillId => SKILL_IDS.some((skill) => skill === value);

const parseStance = (data: unknown): Stance | null =>
  isRecord(data) && isVec2(data.feet) && isFiniteNumber(data.facing) ? { feet: data.feet, facing: data.facing } : null;

const parseIntent = (data: unknown): ThrowIntent | null =>
  isRecord(data) && isFiniteNumber(data.aim) && isFiniteNumber(data.pitch) && isFiniteNumber(data.draw) && isFiniteNumber(data.drift)
    ? { aim: data.aim, pitch: data.pitch, draw: data.draw, drift: data.drift }
    : null;

const parsePresence = (data: unknown): Presence | null => {
  if (!isRecord(data)) return null;
  const stance = parseStance(data.stance);
  const drawOk = data.draw === null || isFiniteNumber(data.draw);
  return stance && isFiniteNumber(data.aim) && isFiniteNumber(data.pitch) && drawOk
    ? { stance, aim: data.aim, pitch: data.pitch, draw: data.draw as number | null }
    : null;
};

/** The sandbox settings a host may change: whether turns pass, and the throw's tuning, whole. */
const parseSettings = (data: unknown): Partial<Omit<GameSettings, 'sandbox'>> | null => {
  if (!isRecord(data)) return null;
  const { passTurns, throw: tuning } = data;
  if (passTurns !== undefined && typeof passTurns !== 'boolean') return null;
  if (tuning !== undefined && !matchesShape(tuning, DEFAULT_CONFIG)) return null;
  return {
    ...(passTurns === undefined ? {} : { passTurns }),
    ...(tuning === undefined ? {} : { throw: tuning as ThrowConfig }),
  };
};

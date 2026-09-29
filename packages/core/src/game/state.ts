import type { PlayerId } from '../types.js';
import type { FlightTuning, Impact, Launch, StickVerdict } from '../throw/types.js';
import type { ThrowIntent } from '../throw/swing.js';
import type { ThrowConfig } from '../throw/config.js';
import type { ThrowOutcome, RuleSet } from '../types.js';
import { DEFAULT_CONFIG } from '../throw/config.js';
import { knifeById } from '../throw/knives.js';
import { createBoard } from '../rules/board.js';
import { DEFAULT_RULES, longHandsReach } from '../rules/cut.js';
import { createMatch, type Match } from '../rules/turn.js';
import type { Stance } from './stance.js';

/**
 * The whole game, as data.
 *
 * Everything that decides who owns what lives here and nowhere else: plain,
 * serialisable values with no methods and no references to anything on
 * screen. The only way it changes is `applyCommand`, a pure function, so the
 * same code runs as the authority on a server, as a hotseat game in one
 * browser, as a bot's look-ahead, and as a replay from a list of commands.
 *
 * What is *not* here: where a player is walking this instant, how far their
 * arm is drawn, which camera is looking. Those are presentation — per device,
 * per frame — and never decide anything.
 */
export type GameState = {
  readonly match: Match;
  readonly players: Readonly<Record<PlayerId, PlayerState>>;
  readonly settings: GameSettings;
  /** Every throw of the match, oldest first. The last ones are the knives lying about. */
  readonly throws: readonly ThrowRecord[];
};

export type PlayerState = {
  readonly id: PlayerId;
  /** The knife they throw — chosen before the match, from those their level has opened. */
  readonly knifeId: string;
  /** Character level, which opens knives and buys skills. Everyone is 1 until experience is kept. */
  readonly level: number;
  /** How far each skill is trained; a skill not listed is untrained (0). */
  readonly skills: Skills;
};

/**
 * A passive skill a character trains, level by level (see
 * docs/progression-tree.md). Each one bends a rule for its owner only.
 *
 * - `longHands`: reach further past your own ground to draw the line, 0 to 5
 *   (`longHandsReach`).
 */
export const SKILL_IDS = ['longHands'] as const;

export type SkillId = (typeof SKILL_IDS)[number];

export type Skills = Readonly<Partial<Record<SkillId, number>>>;

export type GameSettings = {
  /**
   * How every throw behaves. The knife inside it is ignored: each player's
   * knife comes from their own choice, see `throwConfigFor`.
   */
  readonly throw: ThrowConfig;
  /** Whether the turn passes after a throw. Off only in the sandbox, to practise. */
  readonly passTurns: boolean;
  /**
   * A practice table: the settings can be changed and the turn handed about
   * mid-match. Never in a match against other people.
   */
  readonly sandbox: boolean;
};

/**
 * One throw, as it happened: what was asked for, the seed the authority gave
 * it, and what came of it.
 *
 * The flight is not stored, only where it began (`launch`) and how the world
 * was tuned — it is a closed-form arc, so anyone can redraw it exactly. That
 * keeps a record small enough to send over a network or keep a whole match of.
 */
export type ThrowRecord = {
  /** Its place in the match, from 0. */
  readonly index: number;
  readonly playerId: PlayerId;
  readonly knifeId: string;
  readonly stance: Stance;
  readonly intent: ThrowIntent;
  readonly seed: number;
  readonly launch: Launch;
  readonly flight: FlightTuning;
  readonly impact: Impact;
  readonly verdict: StickVerdict;
  /** Null when the knife never stuck — the rules were never consulted. */
  readonly outcome: ThrowOutcome | null;
};

export type NewGame = {
  readonly players: readonly PlayerId[];
  readonly radius?: number;
  readonly rules?: RuleSet;
  readonly settings?: Partial<GameSettings>;
  /** Each player's knife; anyone not listed starts with the Thrower. */
  readonly knives?: Readonly<Record<PlayerId, string>>;
  /** Each player's trained skills; anyone not listed starts untrained. */
  readonly skills?: Readonly<Record<PlayerId, Skills>>;
};

export const DEFAULT_SETTINGS: GameSettings = {
  throw: DEFAULT_CONFIG,
  passTurns: true,
  sandbox: false,
};

export const STARTING_KNIFE = 'thrower';

export const createGame = ({ players, radius = 10, rules = DEFAULT_RULES, settings, knives, skills }: NewGame): GameState => ({
  match: createMatch(createBoard([...players], radius), players, rules),
  players: Object.fromEntries(
    players.map((id) => [id, { id, knifeId: knives?.[id] ?? STARTING_KNIFE, level: 1, skills: skills?.[id] ?? {} }]),
  ),
  settings: { ...DEFAULT_SETTINGS, ...settings },
  throws: [],
});

/** Whose turn it is. */
export const currentPlayer = (state: GameState): PlayerId => state.match.players[state.match.turn]!;

/** How `playerId`'s throws behave: the match's settings, with their own knife in the hand. */
export const throwConfigFor = (state: GameState, playerId: PlayerId): ThrowConfig => ({
  ...state.settings.throw,
  knife: knifeById(state.players[playerId]?.knifeId ?? STARTING_KNIFE).spec,
});

/** How far `playerId` has trained `skill`; 0 when untrained or unknown. */
export const skillLevel = (state: GameState, playerId: PlayerId, skill: SkillId): number =>
  state.players[playerId]?.skills[skill] ?? 0;

/**
 * The rules as they apply to `playerId`: the match's rules, bent by their own
 * skills — Long hands lengthens their reach, and nobody else's.
 */
export const rulesFor = (state: GameState, playerId: PlayerId): RuleSet => ({
  ...state.match.rules,
  reach: longHandsReach(state.match.rules.reach, skillLevel(state, playerId, 'longHands')),
});

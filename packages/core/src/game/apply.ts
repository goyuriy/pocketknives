import type { PlayerId } from '../types.js';
import { simulateFlight } from '../throw/flight.js';
import { isUnlocked, KNIVES } from '../throw/knives.js';
import { stickVerdict, throwFromImpact } from '../throw/stick.js';
import { isThrow, swingLaunch, thrownHeading } from '../throw/swing.js';
import { resolveThrow } from '../rules/cut.js';
import { isOnOwnLand } from '../rules/standing.js';
import { nextLivePlayer, survivors, winner } from '../rules/turn.js';
import type { Command, Stamp } from './commands.js';
import type { GameEvent } from './events.js';
import { releasePoint } from './stance.js';
import { createGame, currentPlayer, throwConfigFor, type GameState, type ThrowRecord } from './state.js';

/** Why a command was turned down. The state is left exactly as it was. */
export type Rejection =
  | 'not_your_turn'
  | 'match_over'
  | 'not_a_throw'
  | 'off_your_ground'
  | 'unknown_player'
  | 'unknown_knife'
  | 'knife_locked'
  | 'match_under_way'
  | 'sandbox_only';

export type Applied =
  | { readonly ok: true; readonly state: GameState; readonly events: readonly GameEvent[] }
  | { readonly ok: false; readonly reason: Rejection };

const reject = (reason: Rejection): Applied => ({ ok: false, reason });

/**
 * The game's one way forward: a command, checked and applied.
 *
 * Pure and deterministic — the same state, command and stamp give the same
 * result on any machine — which is what lets one authority (a server, or the
 * browser in a hotseat game) decide, and everyone else simply be told. A
 * replay is the first state and the list of stamped commands.
 *
 * `stamp` is the authority's part: the seed a throw's wobble is drawn from.
 * Commands that roll no dice ignore it.
 */
export const applyCommand = (state: GameState, command: Command, stamp: Stamp): Applied => {
  switch (command.type) {
    case 'throw':
      return applyThrow(state, command, stamp.seed);
    case 'chooseKnife': {
      const player = state.players[command.playerId];
      if (!player) return reject('unknown_player');
      const knife = KNIVES.find((candidate) => candidate.id === command.knifeId);
      if (!knife) return reject('unknown_knife');
      if (!isUnlocked(knife, player.level)) return reject('knife_locked');
      // The knife is the strategy, chosen before the match; the sandbox lets it change.
      if (!state.settings.sandbox && state.throws.length > 0) return reject('match_under_way');
      return {
        ok: true,
        state: { ...state, players: { ...state.players, [player.id]: { ...player, knifeId: knife.id } } },
        events: [{ type: 'knifeChosen', playerId: player.id, knifeId: knife.id }],
      };
    }
    case 'newMatch': {
      const knives = Object.fromEntries(command.players.map((id) => [id, state.players[id]?.knifeId ?? 'thrower']));
      return {
        ok: true,
        state: createGame({
          players: command.players,
          radius: state.match.board.radius,
          rules: command.rules ?? state.match.rules,
          settings: state.settings,
          knives,
        }),
        events: [{ type: 'matchStarted' }],
      };
    }
    case 'configure':
      if (!state.settings.sandbox) return reject('sandbox_only');
      return {
        ok: true,
        state: { ...state, settings: { ...state.settings, ...command.settings, sandbox: true } },
        events: [{ type: 'configured' }],
      };
    case 'giveTurn': {
      if (!state.settings.sandbox) return reject('sandbox_only');
      const turn = state.match.players.indexOf(command.playerId);
      if (turn < 0) return reject('unknown_player');
      return {
        ok: true,
        state: { ...state, match: { ...state.match, turn } },
        events: [{ type: 'turn', playerId: command.playerId }],
      };
    }
  }
};

/**
 * A throw: the hand's intent, from where the thrower stands, with the
 * authority's seed. The whole of it is worked out here, the instant the hand
 * lets go — flight, stick and cut are pure functions — and everything a client
 * shows afterwards is playback of this result.
 */
const applyThrow = (state: GameState, command: Extract<Command, { type: 'throw' }>, seed: number): Applied => {
  const { match } = state;
  if (winner(match)) return reject('match_over');
  if (!state.players[command.playerId]) return reject('unknown_player');
  if (currentPlayer(state) !== command.playerId) return reject('not_your_turn');
  const config = throwConfigFor(state, command.playerId);
  if (!isThrow(command.intent, config)) return reject('not_a_throw');
  // Feet on your own ground when you let go; the arm may reach over the border.
  if (!isOnOwnLand(match.board, command.playerId, command.stance.feet)) return reject('off_your_ground');

  const { stance, intent } = command;
  const from = releasePoint(stance.feet, thrownHeading(stance.facing, intent, config));
  const launch = swingLaunch(from, stance.facing, intent, config, seed);
  const { impact } = simulateFlight(launch, config.flight);
  const verdict = stickVerdict(impact, config);
  const attempt = throwFromImpact(impact);
  const outcome = verdict.stuck ? resolveThrow(match.board, command.playerId, attempt, match.rules) : null;
  const board = outcome?.kind === 'claimed' ? outcome.board : match.board;

  const record: ThrowRecord = {
    index: state.throws.length,
    playerId: command.playerId,
    knifeId: state.players[command.playerId]!.knifeId,
    stance,
    intent,
    seed,
    launch,
    flight: config.flight,
    impact,
    verdict,
    outcome,
  };
  const passing = state.settings.passTurns;
  const next = {
    ...match,
    board,
    turn: passing ? nextLivePlayer(match, board) : match.turn,
    history: outcome ? [...match.history, { playerId: command.playerId, attempt, outcome }] : match.history,
  };
  const after: GameState = { ...state, match: next, throws: [...state.throws, record] };

  return { ok: true, state: after, events: [{ type: 'thrown', record, boardBefore: match.board }, ...consequences(state, after, passing)] };
};

/** Who was knocked out, who won, and whose turn it is now. */
const consequences = (before: GameState, after: GameState, passing: boolean): GameEvent[] => {
  const wasAlive = new Set(survivors(before.match.board, before.match.rules, before.match.players));
  const alive = new Set(survivors(after.match.board, after.match.rules, after.match.players));
  const events: GameEvent[] = [...wasAlive]
    .filter((id) => !alive.has(id))
    .map((playerId: PlayerId) => ({ type: 'eliminated', playerId }));
  const won = winner(after.match);
  if (won) events.push({ type: 'won', playerId: won });
  else if (passing) events.push({ type: 'turn', playerId: currentPlayer(after) });
  return events;
};

import type { Board, PlayerId, RuleSet, Throw, ThrowOutcome } from '../types.js';
import { clusterInscribedRadius, clusterRings, ringsOf } from '../geometry/cluster.js';
import { territoriesOf } from './board.js';
import { DEFAULT_RULES } from './cut.js';

export type Match = {
  readonly board: Board;
  readonly players: readonly PlayerId[];
  /** Index into `players`. Eliminated players are skipped, never removed. */
  readonly turn: number;
  readonly rules: RuleSet;
  readonly history: readonly TurnRecord[];
};

export type TurnRecord = {
  readonly playerId: PlayerId;
  readonly attempt: Throw;
  readonly outcome: ThrowOutcome;
};

/**
 * Is this player still in the game?
 *
 * Not "do they own any ground" but "can they still stand on it" — a player
 * whittled down to slivers is out even while technically holding land. That
 * mirrors the yard rule and stops matches from dragging on over crumbs.
 *
 * Measured over connected fields, not individual polygons: several strips won on
 * different turns that lie side by side are one place to stand, and judging them
 * separately would put a player out while they still hold open ground.
 */
export const isAlive = (board: Board, rules: RuleSet, playerId: PlayerId): boolean => {
  const tolerance = board.radius * 1e-6;
  const fields = clusterRings(
    ringsOf(territoriesOf(board, playerId)),
    rules.minSharedBorder,
    tolerance,
  );
  return fields.some((field) => clusterInscribedRadius(field, tolerance) >= rules.standRadius);
};

export const survivors = (board: Board, rules: RuleSet, players: readonly PlayerId[]): readonly PlayerId[] =>
  players.filter((id) => isAlive(board, rules, id));

export const createMatch = (
  board: Board,
  players: readonly PlayerId[],
  rules: RuleSet = DEFAULT_RULES,
): Match => ({ board, players, turn: 0, rules, history: [] });

/** The next player round from whoever has the turn who can still stand on `board`. */
export const nextLivePlayer = (match: Match, board: Board): number => {
  for (let step = 1; step <= match.players.length; step++) {
    const index = (match.turn + step) % match.players.length;
    if (isAlive(board, match.rules, match.players[index]!)) return index;
  }
  return match.turn;
};

export const winner = (match: Match): PlayerId | null => {
  const alive = survivors(match.board, match.rules, match.players);
  return alive.length === 1 ? alive[0]! : null;
};

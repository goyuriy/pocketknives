import { useCallback, useMemo, useState } from 'react';
import {
  createBoard,
  createMatch,
  playTurn,
  resolveThrow,
  survivors,
  fieldOutlines,
  type Match,
  type Throw,
  type ThrowOutcome,
} from '@pocketknives/core';
import { PLAYER_NAMES } from '../ui/theme.js';

export const ARENA_RADIUS = 10;

const newMatch = (playerCount: number): Match =>
  createMatch(
    createBoard(PLAYER_NAMES.slice(0, playerCount), ARENA_RADIUS),
    PLAYER_NAMES.slice(0, playerCount),
  );

/**
 * Holds the match and mediates between pointer gestures and the pure rules.
 *
 * `preview` resolves the in-progress gesture against the *current* board without
 * committing it. That is only affordable because resolving a throw is pure and
 * cheap — the same call the committed move will make, run speculatively every
 * frame of the drag.
 */
export const useMatch = (initialPlayers = 2) => {
  const [playerCount, setPlayerCount] = useState(initialPlayers);
  const [match, setMatch] = useState<Match>(() => newMatch(initialPlayers));
  const [lastOutcome, setLastOutcome] = useState<ThrowOutcome | null>(null);
  const [draft, setDraft] = useState<Throw | null>(null);

  const currentPlayer = match.players[match.turn]!;

  // Elimination sweeps a grid over each player's holdings, so it is recomputed
  // only when the board actually changes — not on every frame of an aim drag.
  const alive = useMemo(
    () => survivors(match.board, match.rules, match.players),
    [match.board, match.rules, match.players],
  );
  const champion = alive.length === 1 ? alive[0]! : null;

  // Which lines are real borders depends on who owns what, so it is derived from
  // the board — and only when the board changes, never per frame of a drag.
  const fields = useMemo(
    () => fieldOutlines(match.board, match.rules.minSharedBorder, ARENA_RADIUS * 1e-6),
    [match.board, match.rules.minSharedBorder],
  );

  const preview = useMemo<ThrowOutcome | null>(
    () => (draft && !champion ? resolveThrow(match.board, currentPlayer, draft, match.rules) : null),
    [draft, match.board, match.rules, currentPlayer, champion],
  );

  // Takes the attempt as an argument rather than reading the in-flight draft:
  // playing a turn is a side effect, and side effects inside a state updater run
  // twice under StrictMode — which would play the throw twice.
  const commit = useCallback(
    (attempt: Throw) => {
      if (champion) return;
      const played = playTurn(match, attempt);
      setMatch(played.match);
      setLastOutcome(played.outcome);
      setDraft(null);
    },
    [match, champion],
  );

  const reset = useCallback((count: number) => {
    setPlayerCount(count);
    setMatch(newMatch(count));
    setLastOutcome(null);
    setDraft(null);
  }, []);

  return {
    match,
    playerCount,
    currentPlayer,
    champion,
    alive,
    fields,
    draft,
    preview,
    lastOutcome,
    setDraft,
    commit,
    reset,
  };
};

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  aimedLaunch,
  createBoard,
  createMatch,
  fieldOutlines,
  passTurn,
  resolveThrow,
  simulateFlight,
  standingPoint,
  stickVerdict,
  stickingBands,
  survivors,
  throwFromImpact,
  DEFAULT_CONFIG,
  type Flight,
  type ThrowConfig,
  type Match,
  type PlayerId,
  type StickVerdict,
  type ThrowOutcome,
  type Vec2,
} from '@pocketknives/core';
import { PLAYER_NAMES } from '../ui/theme.js';

export const ARENA_RADIUS = 10;

/** Seconds the cut takes to draw itself across the ground before land changes hands. */
const CUT_DURATION = 0.55;
/** Seconds the result stays up before the next player may throw. */
const REST_DURATION = 0.7;

export type Attempt = {
  readonly playerId: PlayerId;
  readonly flight: Flight;
  readonly verdict: StickVerdict;
  /** Null when the knife never stuck — the rules were never consulted. */
  readonly outcome: ThrowOutcome | null;
  readonly playbackDuration: number;
  /** What the scatter was drawn from. Replays the throw exactly. */
  readonly seed: number;
};

export type Phase =
  | { readonly kind: 'ready' }
  | { readonly kind: 'flying'; readonly attempt: Attempt }
  | { readonly kind: 'cutting'; readonly attempt: Attempt }
  | { readonly kind: 'resting'; readonly attempt: Attempt };

export type Aim = {
  readonly heading: number;
  readonly power: number;
};

/**
 * The sandbox: a board, a knife, and somewhere to stand.
 *
 * A throw is resolved the instant it is released — flight, stick, and cut are
 * all pure functions, so the entire outcome is known before a single frame is
 * drawn. What follows is playback, not simulation. That separation is what lets
 * the same throw be replayed, recorded, or handed to a server later, and it
 * means the animation can never disagree with the result.
 *
 * The board is not updated when the knife lands, but when the cut finishes
 * drawing. Land changing hands is the payoff, and it has to arrive after the
 * line that caused it, not with it.
 */
export const useSandbox = (initialPlayers = 4) => {
  const [playerCount, setPlayerCount] = useState(initialPlayers);
  const [match, setMatch] = useState<Match>(() => newMatch(initialPlayers));
  const [phase, setPhase] = useState<Phase>({ kind: 'ready' });
  const [aim, setAim] = useState<Aim | null>(null);
  // The last throw outlives its animation: the knife stays in the ground and the
  // verdict stays on screen until the next one is released. A sandbox is for
  // studying what just happened, and a result that clears itself cannot be read.
  const [lastAttempt, setLastAttempt] = useState<Attempt | null>(null);
  const [config, setConfig] = useState<ThrowConfig>(DEFAULT_CONFIG);
  const [playbackScale, setPlaybackScale] = useState(0.55);
  const [stayOnPlayer, setStayOnPlayer] = useState(true);
  const timers = useRef<number[]>([]);

  const currentPlayer = match.players[match.turn]!;
  const bearing = bearingOf(match.turn, match.players.length);
  const stand = useMemo(() => standingPoint(bearing, ARENA_RADIUS), [bearing]);
  const restHeading = bearing + Math.PI; // facing the middle of the circle

  const alive = useMemo(
    () => survivors(match.board, match.rules, match.players),
    [match.board, match.rules, match.players],
  );
  const fields = useMemo(
    () => fieldOutlines(match.board, match.rules.minSharedBorder, ARENA_RADIUS * 1e-6),
    [match.board, match.rules.minSharedBorder],
  );

  // Where this player can reliably stick a knife from where they stand. Bands
  // move with the throw's tuning, so they are computed, never written down.
  const bands = useMemo(
    () => stickingBands(stand, restHeading, config),
    [stand, restHeading, config],
  );

  /**
   * The throw as it would resolve right now — drawn as the aiming preview.
   *
   * Deliberately unscattered. The preview is what the player is *aiming* at; if
   * it jittered with every frame it would be showing them the hand's error
   * before the hand has made it.
   */
  const previewFlight = useMemo(
    () => (aim ? simulateFlight(aimedLaunch(stand, aim.heading, aim.power, config), config.flight) : null),
    [aim, stand, config],
  );

  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  const schedule = (fn: () => void, seconds: number) => {
    timers.current.push(window.setTimeout(fn, seconds * 1000));
  };

  const release = useCallback(() => {
    if (phase.kind !== 'ready' || !aim) return;

    // A fresh seed per throw, recorded on the attempt so it can be replayed.
    const seed = Math.floor(Math.random() * 0xffffffff);
    const flight = simulateFlight(
      aimedLaunch(stand, aim.heading, aim.power, config, seed),
      config.flight,
    );
    const verdict = stickVerdict(flight.impact, config);
    // Resolved now so the animation knows what it is showing; the board it
    // produces is held back until the cut has finished drawing.
    const outcome = verdict.stuck
      ? resolveThrow(match.board, currentPlayer, throwFromImpact(flight.impact), match.rules)
      : null;

    const attempt: Attempt = {
      playerId: currentPlayer,
      flight,
      verdict,
      outcome,
      playbackDuration: flight.impact.time / playbackScale,
      seed,
    };

    setAim(null);
    setLastAttempt(attempt);
    setPhase({ kind: 'flying', attempt });

    schedule(() => setPhase({ kind: 'cutting', attempt }), attempt.playbackDuration);
    schedule(() => {
      const won = attempt.outcome;
      if (won?.kind === 'claimed') setMatch((current) => ({ ...current, board: won.board }));
      setPhase({ kind: 'resting', attempt });
    }, attempt.playbackDuration + CUT_DURATION);
    schedule(() => {
      if (!stayOnPlayer) setMatch(passTurn);
      setPhase({ kind: 'ready' });
    }, attempt.playbackDuration + CUT_DURATION + REST_DURATION);
  }, [phase.kind, aim, stand, match, currentPlayer, playbackScale, stayOnPlayer, config]);

  const reset = useCallback(
    (count: number) => {
      timers.current.forEach(clearTimeout);
      timers.current = [];
      setPlayerCount(count);
      setMatch(newMatch(count));
      setPhase({ kind: 'ready' });
      setAim(null);
      setLastAttempt(null);
    },
    [],
  );

  const selectPlayer = useCallback((index: number) => {
    setMatch((current) => ({ ...current, turn: index % current.players.length }));
    setPhase({ kind: 'ready' });
    setAim(null);
    setLastAttempt(null);
  }, []);

  return {
    match,
    phase,
    aim,
    setAim,
    lastAttempt,
    release,
    reset,
    selectPlayer,
    currentPlayer,
    stand,
    bearing,
    restHeading,
    alive,
    fields,
    bands,
    previewFlight,
    playerCount,
    config,
    setConfig,
    playbackScale,
    setPlaybackScale,
    stayOnPlayer,
    setStayOnPlayer,
  };
};

const newMatch = (playerCount: number): Match =>
  createMatch(
    createBoard(PLAYER_NAMES.slice(0, playerCount), ARENA_RADIUS),
    PLAYER_NAMES.slice(0, playerCount),
  );

/** Centre bearing of a player's opening wedge — where they stand to throw. */
const bearingOf = (index: number, playerCount: number): number =>
  ((index + 0.5) * 2 * Math.PI) / playerCount;

export type SandboxState = ReturnType<typeof useSandbox>;

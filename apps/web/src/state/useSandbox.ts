import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  DEFAULT_CONFIG,
  createBoard,
  createMatch,
  fieldOutlines,
  isThrow,
  knifeById,
  passTurn,
  resolveThrow,
  simulateFlight,
  standingBearing,
  standingPoint,
  stickVerdict,
  survivors,
  swingLaunch,
  throwFromImpact,
  type Flight,
  type Match,
  type PlayerId,
  type StickVerdict,
  type ThrowIntent,
  type ThrowConfig,
  type ThrowOutcome,
} from '@pocketknives/core';
import { PLAYER_NAMES } from '../ui/theme.js';

export const ARENA_RADIUS = 10;

/** Seconds the cut takes to draw itself before land changes hands. */
export const CUT_DURATION = 0.55;
/** Seconds the result stays up before the next player may throw. */
const REST_DURATION = 0.7;

export type Attempt = {
  readonly playerId: PlayerId;
  readonly flight: Flight;
  readonly verdict: StickVerdict;
  /** Null when the knife never stuck — the rules were never consulted. */
  readonly outcome: ThrowOutcome | null;
  readonly playbackDuration: number;
  readonly seed: number;
  /** What the player asked for, kept so the meter and the message can show the throw that was made. */
  readonly intent: ThrowIntent;
};

export type Phase =
  | { readonly kind: 'ready' }
  | { readonly kind: 'flying'; readonly attempt: Attempt }
  | { readonly kind: 'cutting'; readonly attempt: Attempt }
  | { readonly kind: 'resting'; readonly attempt: Attempt };

/**
 * The sandbox: a board, a knife, and a hand to throw it with.
 *
 * The player supplies an aim, a draw and a push; the wrist and the wobble
 * belong to the core (`swingLaunch`).
 *
 * A throw is resolved the instant the hand lets go — flight, stick and cut are
 * all pure functions, so the whole outcome is known before a frame is drawn.
 * What follows is playback, not simulation. The board is not updated when the
 * knife lands but when the cut finishes drawing, because land changing hands is
 * the payoff and has to arrive after the line that caused it.
 */
export const useSandbox = (initialPlayers = 4) => {
  const [playerCount, setPlayerCount] = useState(initialPlayers);
  const [match, setMatch] = useState<Match>(() => newMatch(initialPlayers));
  const [phase, setPhase] = useState<Phase>({ kind: 'ready' });
  // How far the arm is drawn while the button is down; null when it is not.
  // Only for the HUD — the scene reads the hand directly, far more often.
  const [draw, setDraw] = useState<number | null>(null);
  const [lastAttempt, setLastAttempt] = useState<Attempt | null>(null);
  const [knifeId, setKnifeId] = useState('thrower');
  // How far along their own frontage the player stands, 0 to 1. A fraction, not
  // an angle, so the choice survives the ground moving under them.
  const [standPosition, setStandPosition] = useState(0.5);
  const [tuning, setTuning] = useState<ThrowConfig>(DEFAULT_CONFIG);
  const [playbackScale, setPlaybackScale] = useState(0.55);
  const [stayOnPlayer, setStayOnPlayer] = useState(true);
  const timers = useRef<number[]>([]);

  // The chosen knife is part of the config, not a decoration on top of it, so
  // every derived quantity — tumble, forgiveness, bite — follows from the pick.
  const knife = knifeById(knifeId);
  const config = useMemo<ThrowConfig>(
    () => ({ ...tuning, knife: knifeById(knifeId).spec }),
    [tuning, knifeId],
  );

  const currentPlayer = match.players[match.turn]!;
  /*
   * You throw from your own ground, so the rim you still hold is the rim you may
   * throw from. A player squeezed inland keeps their area but loses their
   * angles — which is why this is read off the board every turn rather than
   * fixed at the wedge each player started with.
   */
  const bearing = useMemo(
    () =>
      standingBearing(match.board, currentPlayer, standPosition) ??
      bearingAtStart(match.turn, match.players.length),
    [match.board, currentPlayer, standPosition, match.turn, match.players.length],
  );
  const stand = useMemo(() => standingPoint(bearing, ARENA_RADIUS), [bearing]);
  const restHeading = bearing + Math.PI;

  const alive = useMemo(
    () => survivors(match.board, match.rules, match.players),
    [match.board, match.rules, match.players],
  );
  const fields = useMemo(
    () => fieldOutlines(match.board, match.rules.minSharedBorder, ARENA_RADIUS * 1e-6),
    [match.board, match.rules.minSharedBorder],
  );

  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  const schedule = (fn: () => void, seconds: number) => {
    timers.current.push(window.setTimeout(fn, seconds * 1000));
  };

  /**
   * Commits a throw.
   *
   * Takes the intent as an argument rather than from state: a whole push can
   * land inside one frame, and state React has not re-rendered yet would hold
   * the hand's position from before it moved.
   */
  const release = useCallback(
    (intent: ThrowIntent) => {
      setDraw(null);
      if (phase.kind !== 'ready' || !isThrow(intent, config)) return;

      const seed = Math.floor(Math.random() * 0xffffffff);
      const launch = swingLaunch(stand, restHeading, intent, config, seed);
      const flight = simulateFlight(launch, config.flight);
      const verdict = stickVerdict(flight.impact, config);
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
        intent,
      };

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
    },
    [phase.kind, stand, restHeading, match, currentPlayer, playbackScale, stayOnPlayer, config],
  );

  const reset = useCallback((count: number) => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
    setPlayerCount(count);
    setMatch(newMatch(count));
    setPhase({ kind: 'ready' });
    setDraw(null);
    setLastAttempt(null);
  }, []);

  const selectPlayer = useCallback((index: number) => {
    setMatch((current) => ({ ...current, turn: index % current.players.length }));
    setPhase({ kind: 'ready' });
    setDraw(null);
    setLastAttempt(null);
  }, []);

  return {
    match,
    phase,
    draw,
    setDraw,
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
    playerCount,
    config,
    knife,
    tuning,
    setTuning,
    knifeId,
    setKnifeId,
    standPosition,
    setStandPosition,
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

/** Centre of a player's opening wedge — the fallback when they hold no rim at all. */
const bearingAtStart = (index: number, playerCount: number): number =>
  ((index + 0.5) * 2 * Math.PI) / playerCount;

export type SandboxState = ReturnType<typeof useSandbox>;

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  DEFAULT_CONFIG,
  createBoard,
  createMatch,
  fieldOutlines,
  isThrow,
  knifeById,
  passTurn,
  isOnOwnLand,
  resolveThrow,
  simulateFlight,
  stickVerdict,
  survivors,
  swingLaunch,
  thrownHeading,
  throwFromImpact,
  type Flight,
  type KnifeSpec,
  type Vec2,
  type Match,
  type PlayerId,
  type StickVerdict,
  type ThrowIntent,
  type ThrowConfig,
  type ThrowOutcome,
} from '@pocketknives/core';
import { PLAYER_NAMES } from '../ui/theme.js';
import { useRememberedFlag } from '../ui/useRememberedFlag.js';
import { playbackDuration } from '../playback/releaseTimeline.js';
import { releasePointFor } from '../stage/math/bodyPose.js';

export const ARENA_RADIUS = 10;

/**
 * Seconds the camera stays with the knife after it hits, before lifting to show
 * the cut. The impact is the payoff of the throw and has to be seen where it
 * happens: the dirt, the quiver, the jolt.
 */
export const IMPACT_BEAT = 0.3;
/** Seconds the cut takes to draw itself before land changes hands. */
export const CUT_DURATION = 0.55;
/** Seconds the result stays up before the next player may throw. */
const REST_DURATION = 0.7;
/** How many thrown knives stay lying about the circle. The oldest is picked up first. */
const KNIVES_LEFT_OUT = 16;

/** Where the thrower is standing and which way they face — what a throw is thrown from. */
export type Stance = {
  readonly feet: Vec2;
  /** Heading the body faces, radians; the hand aims relative to it. */
  readonly facing: number;
};

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
  /** The knife thrown, so it can lie on the ground as itself after the next pick. */
  readonly knife: KnifeSpec;
};

export type Phase =
  | { readonly kind: 'ready' }
  | { readonly kind: 'flying'; readonly attempt: Attempt }
  | { readonly kind: 'cutting'; readonly attempt: Attempt }
  | { readonly kind: 'resting'; readonly attempt: Attempt };

/**
 * The sandbox: a board, a knife, and a hand to throw it with.
 *
 * The player walks their own ground and supplies an aim, a draw and a push;
 * the wrist and the wobble belong to the core (`swingLaunch`). Where they are
 * standing lives with the stage, which moves them every frame, and arrives here
 * only with the throw.
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
  // The angle the hand is set to throw at, for the HUD. Rounded to a whole
  // degree on the way in, so sweeping the pointer re-renders only when the
  // number shown would actually change.
  const [pitch, setPitchExactly] = useState(DEFAULT_CONFIG.style.pitch);
  const setPitch = useCallback(
    (radians: number) => setPitchExactly(Math.round((radians * 180) / Math.PI) * (Math.PI / 180)),
    [],
  );
  const [lastAttempt, setLastAttempt] = useState<Attempt | null>(null);
  // Every knife thrown this match, oldest first — they stay where they fell.
  const [thrown, setThrown] = useState<readonly Attempt[]>([]);
  const [knifeId, setKnifeId] = useState('thrower');
  const [tuning, setTuning] = useState<ThrowConfig>(DEFAULT_CONFIG);
  const [playbackScale, setPlaybackScale] = useState(0.55);
  const [stayOnPlayer, setStayOnPlayer] = useState(true);
  // Whether the edge of the thrower's reach is chalked on the ground. On by
  // default; switched off only to see the ground bare while debugging.
  const [showReach, setShowReach] = useRememberedFlag('pocketknives.reachLine', true);
  const timers = useRef<number[]>([]);

  // The chosen knife is part of the config, not a decoration on top of it, so
  // every derived quantity — tumble, forgiveness, bite — follows from the pick.
  const knife = knifeById(knifeId);
  const config = useMemo<ThrowConfig>(
    () => ({ ...tuning, knife: knifeById(knifeId).spec }),
    [tuning, knifeId],
  );

  const currentPlayer = match.players[match.turn]!;
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
   * Takes the intent and the stance as arguments rather than from state: a whole
   * push can land inside one frame, and the player walks every frame — state
   * React has not re-rendered yet would hold where they were, not where they are.
   *
   * The knife leaves the hand out in front of the thrower's feet, on the line it
   * is thrown along. The feet must be on the thrower's own ground; the reach of
   * the arm may be over the border, as it is in the yard.
   */
  const release = useCallback(
    (intent: ThrowIntent, stance: Stance) => {
      setDraw(null);
      if (phase.kind !== 'ready' || !isThrow(intent, config)) return;
      if (!isOnOwnLand(match.board, currentPlayer, stance.feet)) return;

      const seed = Math.floor(Math.random() * 0xffffffff);
      const from = releasePointFor(stance.feet, thrownHeading(stance.facing, intent, config));
      const launch = swingLaunch(from, stance.facing, intent, config, seed);
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
        playbackDuration: playbackDuration(flight.impact.time, playbackScale),
        seed,
        intent,
        knife: config.knife,
      };

      setLastAttempt(attempt);
      setThrown((knives) => [...knives, attempt].slice(-KNIVES_LEFT_OUT));
      setPhase({ kind: 'flying', attempt });

      schedule(() => setPhase({ kind: 'cutting', attempt }), attempt.playbackDuration);
      schedule(() => {
        const won = attempt.outcome;
        if (won?.kind === 'claimed') setMatch((current) => ({ ...current, board: won.board }));
        setPhase({ kind: 'resting', attempt });
      }, attempt.playbackDuration + IMPACT_BEAT + CUT_DURATION);
      schedule(() => {
        if (!stayOnPlayer) setMatch(passTurn);
        setPhase({ kind: 'ready' });
      }, attempt.playbackDuration + IMPACT_BEAT + CUT_DURATION + REST_DURATION);
    },
    [phase.kind, match, currentPlayer, playbackScale, stayOnPlayer, config],
  );

  const reset = useCallback((count: number) => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
    setPlayerCount(count);
    setMatch(newMatch(count));
    setPhase({ kind: 'ready' });
    setDraw(null);
    setLastAttempt(null);
    setThrown([]);
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
    pitch,
    setPitch,
    lastAttempt,
    release,
    reset,
    selectPlayer,
    currentPlayer,
    thrown,
    alive,
    fields,
    playerCount,
    config,
    knife,
    tuning,
    setTuning,
    knifeId,
    setKnifeId,
    playbackScale,
    setPlaybackScale,
    stayOnPlayer,
    setStayOnPlayer,
    showReach,
    setShowReach,
  };
};

const newMatch = (playerCount: number): Match =>
  createMatch(
    createBoard(PLAYER_NAMES.slice(0, playerCount), ARENA_RADIUS),
    PLAYER_NAMES.slice(0, playerCount),
  );

export type SandboxState = ReturnType<typeof useSandbox>;

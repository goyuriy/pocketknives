import { useCallback, useEffect, useMemo, useReducer, useState, useSyncExternalStore } from 'react';
import {
  createGame,
  currentPlayer,
  DEFAULT_CONFIG,
  fieldOutlines,
  knifeById,
  rulesFor,
  skillLevel,
  survivors,
  throwConfigFor,
  type GameState,
  type PlayerId,
  type Stance,
  type ThrowConfig,
  type ThrowIntent,
} from '@pocketknives/core';
import { PLAYER_NAMES } from '../ui/theme.js';
import { useRememberedFlag } from '../ui/useRememberedFlag.js';
import { useRememberedChoice } from '../ui/useRememberedChoice.js';
import { isCameraView } from '../stage/math/cameraPose.js';
import { createLocalSession, type Session } from '../session/session.js';
import { nextChangeAt, playbackPhase, shownBoard, startPlaying, type Playing } from '../playback/throwPlayback.js';
import { attemptOf, knivesOut, type Attempt } from './attempts.js';

export type { Attempt } from './attempts.js';
export type { Stance } from '@pocketknives/core';

export const ARENA_RADIUS = 10;

/** What the screen is doing with the last throw. Ready when there is none being shown. */
export type Phase =
  | { readonly kind: 'ready' }
  | { readonly kind: 'flying' | 'cutting' | 'resting'; readonly attempt: Attempt };

/** The practice table the game opens on: everyone at one screen, the settings open to tuning. */
const sandbox = (players: number): GameState =>
  createGame({
    players: PLAYER_NAMES.slice(0, players),
    radius: ARENA_RADIUS,
    // The sandbox keeps the turn with one player, to practise, until told otherwise.
    settings: { sandbox: true, passTurns: false, throw: DEFAULT_CONFIG },
  });

/**
 * The game as this screen sees it — the glue between the session and React.
 *
 * It decides nothing. The game lives behind the session; this reads it, sends
 * the player's commands to it, and turns what comes back into what to show:
 * a thrown knife starts a playback, the playback decides which board and whose
 * turn are on screen, and the rest is this device's own preferences — the
 * camera, the reach line, how slow the slow motion is.
 */
export const useGame = (initialPlayers = 4, makeSession: () => Session = () => createLocalSession(sandbox(initialPlayers))) => {
  const [session] = useState(makeSession);
  const subscribe = useCallback((onChange: () => void) => session.subscribe(() => onChange()), [session]);
  const state = useSyncExternalStore(subscribe, session.state);

  const [playbackScale, setPlaybackScale] = useState(0.55);
  const [playing, setPlaying] = useState<Playing | null>(null);
  useEffect(
    () =>
      session.subscribe(({ events }) => {
        for (const event of events) {
          if (event.type === 'thrown') {
            setPlaying(startPlaying(event.record, event.boardBefore, performance.now(), playbackScale));
          } else if (event.type === 'matchStarted') {
            setPlaying(null);
          }
        }
      }),
    [session, playbackScale],
  );

  // Re-render when the playback moves on — the one moment the HUD's answers
  // change — rather than on a chain of timers that each decide something.
  const [, moveOn] = useReducer((n: number) => n + 1, 0);
  useEffect(() => {
    const at = nextChangeAt(playing, performance.now());
    if (at === null) return;
    const wait = window.setTimeout(moveOn, Math.max(0, at - performance.now()) + 1);
    return () => window.clearTimeout(wait);
  });

  const now = performance.now();
  const stage = playbackPhase(playing, now);
  const phase: Phase =
    stage.kind === 'done' || !playing ? { kind: 'ready' } : { kind: stage.kind, attempt: attemptOf(playing.record) };
  // While a throw is shown it is still the thrower's go on screen, whatever
  // the game has moved on to.
  const thrower: PlayerId = phase.kind === 'ready' ? currentPlayer(state) : phase.attempt.playerId;
  const board = shownBoard(playing, now, state.match.board);

  // How far the arm is drawn while the button is down; null when it is not.
  // Only for the HUD — the stage reads the hand directly, far more often.
  const [draw, setDraw] = useState<number | null>(null);
  // The angle the hand is set to throw at, for the HUD. Rounded to a whole
  // degree on the way in, so sweeping the pointer re-renders only when the
  // number shown would actually change.
  const [pitch, setPitchExactly] = useState(DEFAULT_CONFIG.gesture.restingPitch);
  const setPitch = useCallback(
    (radians: number) => setPitchExactly(Math.round((radians * 180) / Math.PI) * (Math.PI / 180)),
    [],
  );
  // Whether the edge of the thrower's reach is chalked on the ground. On by
  // default; switched off only to see the ground bare while debugging.
  const [showReach, setShowReach] = useRememberedFlag('pocketknives.reachLine', true);
  // Where the camera is: through the thrower's eyes to play, or one of the
  // debug views to look at the scene. `?camera=side` in the address picks one.
  const [cameraView, setCameraView] = useRememberedChoice('pocketknives.camera', 'camera', isCameraView, 'eyes');

  const config = useMemo<ThrowConfig>(() => throwConfigFor(state, thrower), [state, thrower]);
  const knifeId = state.players[thrower]?.knifeId ?? 'thrower';
  const alive = useMemo(
    () => survivors(board, state.match.rules, state.match.players),
    [board, state.match.rules, state.match.players],
  );
  const fields = useMemo(
    () => fieldOutlines(board, state.match.rules.minSharedBorder, ARENA_RADIUS * 1e-6),
    [board, state.match.rules.minSharedBorder],
  );
  const thrown = useMemo(() => knivesOut(state.throws), [state.throws]);
  const last = state.throws.at(-1);

  /**
   * Lets go: sends the throw to the game. Takes the intent and the stance as
   * arguments rather than from state — a whole push can land inside one frame,
   * and the player walks every frame, so React's copy would be where they were.
   */
  const release = useCallback(
    (intent: ThrowIntent, stance: Stance) => {
      setDraw(null);
      if (phase.kind !== 'ready') return;
      session.send({ type: 'throw', playerId: thrower, stance, intent });
    },
    [session, phase.kind, thrower],
  );

  return {
    session,
    state,
    /** The board on screen, which lags the game's by the playback. */
    board,
    players: state.match.players,
    rules: state.match.rules,
    /** How far from their ground the thrower can reach to draw the line: the rules' reach, lengthened by their Long hands. */
    reach: rulesFor(state, thrower).reach,
    /** The thrower's level of Long hands, 0 to 5. */
    longHands: skillLevel(state, thrower, 'longHands'),
    setLongHands: (level: number) => session.send({ type: 'setSkill', playerId: thrower, skill: 'longHands', level }),
    phase,
    playing,
    currentPlayer: thrower,
    lastAttempt: last ? attemptOf(last) : null,
    thrown,
    alive,
    fields,
    config,
    knife: knifeById(knifeId),
    knifeId,
    // No experience is kept yet, so every player is a new character: level 1.
    characterLevel: state.players[thrower]?.level ?? 1,
    draw,
    setDraw,
    pitch,
    setPitch,
    release,
    playerCount: state.match.players.length,
    reset: (count: number) => {
      setPlaying(null);
      session.send({ type: 'newMatch', players: PLAYER_NAMES.slice(0, count) });
    },
    selectPlayer: (index: number) => {
      setPlaying(null);
      session.send({ type: 'giveTurn', playerId: state.match.players[index % state.match.players.length]! });
    },
    setKnifeId: (id: string) => session.send({ type: 'chooseKnife', playerId: thrower, knifeId: id }),
    setTuning: (tuned: ThrowConfig) => session.send({ type: 'configure', settings: { throw: tuned } }),
    stayOnPlayer: !state.settings.passTurns,
    setStayOnPlayer: (stay: boolean) => session.send({ type: 'configure', settings: { passTurns: !stay } }),
    showReach,
    setShowReach,
    cameraView,
    setCameraView,
    playbackScale,
    setPlaybackScale,
  };
};

export type GameUi = ReturnType<typeof useGame>;

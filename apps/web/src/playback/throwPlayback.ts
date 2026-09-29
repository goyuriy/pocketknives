import type { Board, ThrowRecord } from '@pocketknives/core';
import { playbackDuration } from './releaseTimeline.js';

/**
 * Seconds the camera stays with the knife after it hits, before lifting to show
 * the cut. The impact is the payoff of the throw and has to be seen where it
 * happens: the dirt, the quiver, the jolt.
 */
export const IMPACT_BEAT = 0.3;
/** Seconds the cut takes to draw itself before land changes hands. */
export const CUT_DURATION = 0.55;
/** Seconds the result stays up before the next player may throw. */
export const REST_DURATION = 0.7;

/**
 * A throw being shown: the authority's record of it, the board it landed on,
 * and when this screen started showing it.
 *
 * The game has already moved on — the land has changed hands, the turn has
 * passed — by the time the first frame of the throw is drawn. What the player
 * sees is a replay of a result, paced for drama, and everything about the
 * pacing follows from these few numbers and the clock. Nothing waits on a
 * timer: drop a frame, switch tabs, join a room mid-throw, and the next frame
 * is simply right.
 */
export type Playing = {
  readonly record: ThrowRecord;
  readonly boardBefore: Board;
  /** When playback began, in the clock's milliseconds (`performance.now`). */
  readonly startedAt: number;
  /** How fast the flight is played, as a share of real time once past the slow start. */
  readonly scale: number;
  /** Real seconds from letting go to the knife reaching the ground, at that pace. */
  readonly landsAfter: number;
};

export const startPlaying = (record: ThrowRecord, boardBefore: Board, startedAt: number, scale: number): Playing => ({
  record,
  boardBefore,
  startedAt,
  scale,
  landsAfter: playbackDuration(record.impact.time, scale),
});

export type PlaybackPhase =
  /** In the hand and then in the air. */
  | { readonly kind: 'flying'; readonly into: number }
  /** Landed: the impact's beat, then the cut drawing itself. */
  | { readonly kind: 'cutting'; readonly into: number }
  /** The result, held up before the next throw. */
  | { readonly kind: 'resting'; readonly into: number }
  /** Over; the game is ready for the next throw. */
  | { readonly kind: 'done' };

/** Where in the playback `now` is. `into` is seconds since that part began. */
export const playbackPhase = (playing: Playing | null, now: number): PlaybackPhase => {
  if (!playing) return { kind: 'done' };
  const t = (now - playing.startedAt) / 1000;
  if (t < playing.landsAfter) return { kind: 'flying', into: Math.max(0, t) };
  const landed = t - playing.landsAfter;
  if (landed < IMPACT_BEAT + CUT_DURATION) return { kind: 'cutting', into: landed };
  const rested = landed - IMPACT_BEAT - CUT_DURATION;
  if (rested < REST_DURATION) return { kind: 'resting', into: rested };
  return { kind: 'done' };
};

/** When the next part of the playback starts, in the clock's milliseconds; null once it is over. */
export const nextChangeAt = (playing: Playing | null, now: number): number | null => {
  if (!playing) return null;
  const marks = [playing.landsAfter, playing.landsAfter + IMPACT_BEAT + CUT_DURATION, playing.landsAfter + IMPACT_BEAT + CUT_DURATION + REST_DURATION];
  const at = marks.map((mark) => playing.startedAt + mark * 1000).find((mark) => mark > now);
  return at ?? null;
};

/**
 * The board as the player should see it: the one the knife is landing on
 * until the cut has drawn itself, then the one it made. Land changing hands is
 * the payoff, and has to arrive after the line that caused it.
 */
export const shownBoard = (playing: Playing | null, now: number, current: Board): Board => {
  const phase = playbackPhase(playing, now);
  return playing && (phase.kind === 'flying' || phase.kind === 'cutting') ? playing.boardBefore : current;
};

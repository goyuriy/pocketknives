import { describe, expect, it } from 'vitest';
import { applyCommand, createGame, DEFAULT_CONFIG, homeSpot, type ThrowRecord } from '@pocketknives/core';
import { CUT_DURATION, IMPACT_BEAT, nextChangeAt, playbackPhase, REST_DURATION, shownBoard, startPlaying } from './throwPlayback.js';

const game = createGame({ players: ['Red', 'Blue'] });
const feet = homeSpot(game.match.board, 'Red')!;
const applied = applyCommand(
  game,
  {
    type: 'throw',
    playerId: 'Red',
    stance: { feet, facing: Math.atan2(-feet[1], -feet[0]) },
    intent: { aim: 0, pitch: DEFAULT_CONFIG.style.pitch, draw: 0.3, drift: 0 },
  },
  { seed: 3 },
);
if (!applied.ok) throw new Error('expected a throw');
const record: ThrowRecord = applied.state.throws[0]!;
const playing = startPlaying(record, game.match.board, 1000, 0.55);
const at = (seconds: number) => 1000 + seconds * 1000;

describe('throw playback', () => {
  it('flies, lands, draws the cut, rests, and is done — in that order, on the clock', () => {
    expect(playbackPhase(playing, at(0)).kind).toBe('flying');
    expect(playbackPhase(playing, at(playing.landsAfter - 0.01)).kind).toBe('flying');
    expect(playbackPhase(playing, at(playing.landsAfter + 0.01))).toMatchObject({ kind: 'cutting' });
    expect(playbackPhase(playing, at(playing.landsAfter + IMPACT_BEAT + CUT_DURATION + 0.01)).kind).toBe('resting');
    expect(playbackPhase(playing, at(playing.landsAfter + IMPACT_BEAT + CUT_DURATION + REST_DURATION + 0.01)).kind).toBe('done');
    expect(playbackPhase(null, at(0)).kind).toBe('done');
  });

  it('knows when the next part starts, so a screen can wait for it instead of polling', () => {
    expect(nextChangeAt(playing, at(0))).toBeCloseTo(at(playing.landsAfter), 6);
    expect(nextChangeAt(playing, at(100))).toBeNull();
  });

  it('shows the board the knife landed on until the cut has drawn, then the one it made', () => {
    const after = applied.state.match.board;
    expect(shownBoard(playing, at(0), after)).toBe(game.match.board);
    expect(shownBoard(playing, at(playing.landsAfter + 0.1), after)).toBe(game.match.board);
    expect(shownBoard(playing, at(playing.landsAfter + IMPACT_BEAT + CUT_DURATION + 0.1), after)).toBe(after);
  });

  it('plays slower when asked to', () => {
    expect(startPlaying(record, game.match.board, 0, 0.3).landsAfter).toBeGreaterThan(playing.landsAfter);
  });
});

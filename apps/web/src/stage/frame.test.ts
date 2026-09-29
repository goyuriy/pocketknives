import { describe, expect, it } from 'vitest';
import { applyCommand, createGame, DEFAULT_CONFIG, homeSpot, knifeById } from '@pocketknives/core';
import { attemptOf } from '../state/attempts.js';
import { IMPACT_BEAT, startPlaying } from '../playback/throwPlayback.js';
import { RELEASE_SLOW_MOTION } from '../playback/releaseTimeline.js';
import { frameOf, LONGEST_FRAME } from './frame.js';
import type { StageSnapshot } from './snapshot.js';
import { DESIGNED_COMFORT } from '../state/useComfort.js';

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
  { seed: 5 },
);
if (!applied.ok) throw new Error('expected a throw');
const record = applied.state.throws[0]!;
const playing = startPlaying(record, game.match.board, 0, 0.55);

const snapshot = (changes: Partial<StageSnapshot> = {}): StageSnapshot => ({
  comfort: DESIGNED_COMFORT,
  board: game.match.board,
  fields: [],
  alive: ['Red', 'Blue'],
  playing,
  lastAttempt: attemptOf(record),
  swinging: false,
  playerId: 'Red',
  reach: 1.5,
  showReach: true,
  cameraView: 'eyes',
  thrown: [attemptOf(record)],
  config: DEFAULT_CONFIG,
  knife: DEFAULT_CONFIG.knife,
  hands: knifeById('thrower').hands,
  playerColor: '#c24d3f',
  arenaRadius: 10,
  ...changes,
});
const at = (seconds: number, changes: Partial<StageSnapshot> = {}) => frameOf(snapshot(changes), seconds * 1000, 1 / 60);

describe('frameOf', () => {
  it('holds the knife through the hand-off, then flies it', () => {
    expect(at(0.05)).toMatchObject({ released: true, handingOff: true, intoFlight: 0 });
    const flying = at(RELEASE_SLOW_MOTION.handOff + 0.1);
    expect(flying.handingOff).toBe(false);
    expect(flying.intoFlight).toBeCloseTo(0.1, 6);
  });

  it('lands, holds the impact at eye level for its beat, then lifts over the circle', () => {
    const justLanded = at(playing.landsAfter + 0.05);
    expect(justLanded).toMatchObject({ landed: true, overhead: false, lifted: false, outside: false });
    const lifting = at(playing.landsAfter + IMPACT_BEAT + 0.05);
    expect(lifting).toMatchObject({ overhead: true, lifted: true, outside: true });
  });

  it('keeps a debug camera where it is through the throw, and lifts the arena view always', () => {
    expect(at(playing.landsAfter + IMPACT_BEAT + 0.05, { cameraView: 'side' })).toMatchObject({ lifted: false, outside: true });
    expect(at(0, { playing: null, cameraView: 'arena' })).toMatchObject({ lifted: true });
  });

  it('keeps the last throw on show until the next one is being drawn', () => {
    expect(at(100).settled).toBe(attemptOf(record));
    expect(at(100, { swinging: true }).settled).toBeNull();
    expect(at(0.1).settled).toBeNull(); // in the air: nothing settled yet
  });

  it('never steps further than a tenth of a second, however long the tab slept', () => {
    expect(frameOf(snapshot(), 0, 30).seconds).toBe(LONGEST_FRAME);
  });
});

describe('the frame’s world time', () => {
  it('is real time unless the world is held', () => {
    expect(at(0.5).world).toEqual({ now: 500, seconds: 1 / 60, holding: false });
    const held = frameOf(snapshot(), 500, 1 / 60, { now: 320, seconds: 0, holding: true });
    expect(held.world).toEqual({ now: 320, seconds: 0, holding: true });
    expect(held.seconds).toBeCloseTo(1 / 60, 9);
  });
});

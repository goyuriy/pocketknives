import { useEffect, useRef } from 'react';
import type { SandboxState, Stance } from '../state/useSandbox.js';
import { ARENA_RADIUS } from '../state/useSandbox.js';
import { colorOf } from '../ui/theme.js';
import { createWalkDevices } from '../input/devices.js';
import { combineWalks, STANDING_STILL, type WalkInput } from '../input/walk.js';
import { createImpactSound, type ImpactSound } from '../audio/impactSound.js';
import { createStage } from './engine/createStage.js';
import { createDirector } from './director.js';
import type { HandInput, StageSnapshot } from './snapshot.js';
import { useThrowControls, STICK_REACH } from './useThrowControls.js';
import { useGamepadThrow } from './useGamepadThrow.js';

const snapshotOf = (game: SandboxState): StageSnapshot => ({
  board: game.match.board,
  fields: game.fields,
  alive: game.alive,
  phase: game.phase,
  lastAttempt: game.lastAttempt,
  swinging: game.draw !== null,
  playerId: game.currentPlayer,
  reach: game.match.rules.reach,
  showReach: game.showReach,
  cameraView: game.cameraView,
  thrown: game.thrown,
  config: game.config,
  knife: game.config.knife,
  hands: game.knife.hands,
  playerColor: colorOf(game.currentPlayer),
  playbackScale: game.playbackScale,
  arenaRadius: ARENA_RADIUS,
});

/**
 * The 3D stage, and the surface the player plays on.
 *
 * The engine is created once and left alone by React: it reads the latest
 * snapshot every frame, so a re-render never rebuilds the scene. Everything the
 * player does with their hands — walking, looking, throwing — comes through
 * `useThrowControls` (mouse and touch), `useGamepadThrow` (the right stick) and
 * the walking devices, into refs the stage reads each frame.
 */
export const Stage = ({ game }: { game: SandboxState }) => {
  const canvas = useRef<HTMLCanvasElement>(null);
  const snapshot = useRef(snapshotOf(game));
  const sound = useRef<ImpactSound | null>(null);
  const hand = useRef<HandInput>({ aim: 0, pitch: game.config.style.pitch, draw: null });
  // Placed by the stage on the thrower's own ground once it has a board to read.
  const stance = useRef<Stance>({ feet: [0, 0], facing: 0 });
  const touchWalk = useRef<WalkInput>(STANDING_STILL);

  useEffect(() => {
    snapshot.current = snapshotOf(game);
  });

  useEffect(() => {
    const target = canvas.current;
    if (!target) return;
    const stage = createStage(target, { gravity: snapshot.current.config.flight.gravity });
    const impacts = createImpactSound();
    const devices = createWalkDevices();
    sound.current = impacts;
    const director = createDirector(stage, {
      read: () => snapshot.current,
      hand: () => hand.current,
      walk: () => combineWalks(devices.read(), touchWalk.current),
      stance,
      sound: impacts,
    });
    stage.physics.catch((error: unknown) => console.error(error));
    // A handle for poking at the live scene from the browser console.
    if (import.meta.env.DEV) (window as unknown as { __stage: unknown }).__stage = stage;
    return () => {
      director.dispose();
      devices.dispose();
      stage.dispose();
      impacts.dispose();
      sound.current = null;
    };
  }, []);

  const { handlers, stick, looking } = useThrowControls({ game, canvas, stance, hand, touchWalk, sound });
  useGamepadThrow({ game, stance, hand });
  const desktop = typeof window !== 'undefined' && window.matchMedia?.('(pointer: fine)').matches;

  return (
    <div className="stage" {...handlers}>
      <canvas ref={canvas} />
      {stick && (
        <div className="walk-stick" style={{ left: stick.origin[0], top: stick.origin[1], width: STICK_REACH * 2, height: STICK_REACH * 2 }}>
          <div
            className="walk-stick-knob"
            style={{ transform: `translate(${stick.knob[0] - stick.origin[0]}px, ${stick.knob[1] - stick.origin[1]}px)` }}
          />
        </div>
      )}
      {desktop && !looking && (
        <div className="look-hint">Click to take the mouse · WASD or arrows to walk · Esc to let go</div>
      )}
    </div>
  );
};

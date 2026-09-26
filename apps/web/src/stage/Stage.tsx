import { useEffect, useRef } from 'react';
import type { SandboxState } from '../state/useSandbox.js';
import { ARENA_RADIUS } from '../state/useSandbox.js';
import { colorOf } from '../ui/theme.js';
import {
  advanceStroke,
  aimFromPointer,
  gripStroke,
  pitchFromPointer,
  type Sample,
  type Stroke,
} from '../input/throwStroke.js';
import { createStage } from './engine/createStage.js';
import { createDirector } from './director.js';
import { createImpactSound, type ImpactSound } from '../audio/impactSound.js';
import type { HandInput, StageSnapshot } from './snapshot.js';

const snapshotOf = (game: SandboxState): StageSnapshot => ({
  board: game.match.board,
  fields: game.fields,
  alive: game.alive,
  phase: game.phase,
  lastAttempt: game.lastAttempt,
  swinging: game.draw !== null,
  stand: game.stand,
  restHeading: game.restHeading,
  config: game.config,
  knife: game.config.knife,
  hands: game.knife.hands,
  playerColor: colorOf(game.currentPlayer),
  playbackScale: game.playbackScale,
  arenaRadius: ARENA_RADIUS,
});

/**
 * The 3D stage, and the surface the player throws on.
 *
 * Two jobs, kept apart. The engine is created once and left alone by React: it
 * reads the latest snapshot every frame, so a re-render never rebuilds the scene.
 * The pointer handlers are the player's hand:
 *
 * - **moving** points it — the pointer's place across the stage is where the
 *   hand aims, and its height how steeply; there is no cursor, only the hands;
 * - **pressing** grips;
 * - **pulling back and pushing through** throws, read by `advanceStroke` —
 *   and the hand keeps turning with the pointer while drawn, so the line can be
 *   settled with the arm already back;
 * - **letting go** before pushing through calls the throw off.
 *
 * The hand and the stroke live in refs, not state. They change on every pointer
 * event, a whole push can happen inside one frame, and the scene reads them
 * once a frame anyway.
 */
export const Stage = ({ game }: { game: SandboxState }) => {
  const { phase, setDraw, setPitch, release } = game;
  const canvas = useRef<HTMLCanvasElement>(null);
  const snapshot = useRef(snapshotOf(game));
  const stroke = useRef<Stroke | null>(null);
  const sound = useRef<ImpactSound | null>(null);
  const hand = useRef<HandInput>({ aim: 0, pitch: game.config.style.pitch, draw: null });

  useEffect(() => {
    snapshot.current = snapshotOf(game);
  });

  useEffect(() => {
    const target = canvas.current;
    if (!target) return;
    const stage = createStage(target, { gravity: snapshot.current.config.flight.gravity });
    const impacts = createImpactSound();
    sound.current = impacts;
    const director = createDirector(stage, () => snapshot.current, () => hand.current, impacts);
    stage.physics.catch((error: unknown) => console.error(error));
    // A handle for poking at the live scene from the browser console.
    if (import.meta.env.DEV) (window as unknown as { __stage: unknown }).__stage = stage;
    return () => {
      director.dispose();
      stage.dispose();
      impacts.dispose();
      sound.current = null;
    };
  }, []);

  const canThrow = phase.kind === 'ready';

  /*
   * Browsers batch pointer moves to one per frame and keep the rest. For a fast
   * push those kept events are most of the motion, and without them its speed
   * and line are guesses.
   */
  const samplesOf = (event: React.PointerEvent<HTMLElement>): Sample[] => {
    const coalesced = event.nativeEvent.getCoalescedEvents?.() ?? [];
    const points = coalesced.length > 0 ? coalesced : [event.nativeEvent];
    const now = event.timeStamp || performance.now();
    return points.map((point) => ({ x: point.clientX, y: point.clientY, t: point.timeStamp || now }));
  };

  const aimAt = (event: React.PointerEvent<HTMLElement>) => {
    const box = event.currentTarget.getBoundingClientRect();
    return aimFromPointer(event.clientX, box.left, box.width, game.config);
  };

  const pitchAt = (event: React.PointerEvent<HTMLElement>) => {
    const box = event.currentTarget.getBoundingClientRect();
    return pitchFromPointer(event.clientY, box.top, box.height, game.config);
  };

  /** Points the hand, and tells the HUD the angle — which only re-renders when it changes. */
  const point = (aim: number, pitch: number, draw: number | null) => {
    hand.current = { aim, pitch, draw };
    setPitch(pitch);
  };

  const letGo = () => {
    stroke.current = null;
    hand.current = { ...hand.current, draw: null };
    setDraw(null);
  };

  const onPointerDown = (event: React.PointerEvent<HTMLElement>) => {
    // Browsers keep audio silent until the player has done something; a press is something.
    sound.current?.unlock();
    if (!canThrow || event.button > 0) return;
    event.currentTarget.setPointerCapture?.(event.pointerId);
    const box = event.currentTarget.getBoundingClientRect();
    const [at] = samplesOf(event).slice(-1);
    // The angle is whatever the hand was set to before gripping; it locks here.
    const pitch = hand.current.pitch;
    stroke.current = gripStroke(at!, { left: box.left, width: box.width }, pitch);
    point(aimAt(event), pitch, 0);
    setDraw(0);
  };

  const onPointerMove = (event: React.PointerEvent<HTMLElement>) => {
    if (!stroke.current) {
      // Not gripping: the hand follows the pointer — across to aim, up and down to set the angle.
      point(aimAt(event), pitchAt(event), null);
      return;
    }
    const { stroke: next, reading } = advanceStroke(
      stroke.current,
      samplesOf(event),
      event.currentTarget.clientHeight,
      game.config,
    );
    if (reading.thrown) {
      letGo();
      release(reading.thrown);
      return;
    }
    stroke.current = next;
    hand.current = { aim: reading.aim, pitch: next.pitch, draw: reading.draw };
    setDraw(Math.max(0, reading.draw));
  };

  return (
    <div
      className="stage"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={letGo}
      onPointerCancel={letGo}
    >
      <canvas ref={canvas} />
    </div>
  );
};

import { useEffect, useRef } from 'react';
import type { SandboxState } from '../state/useSandbox.js';
import { ARENA_RADIUS } from '../state/useSandbox.js';
import { colorOf } from '../ui/theme.js';
import { armSwing, readSwing, type Sample } from '../input/gesture.js';
import { READY_SWING } from './math/armPose.js';
import { createStage } from './engine/createStage.js';
import { createDirector } from './director.js';
import type { StageSnapshot } from './snapshot.js';

/** How much of the stroke to remember. Older than this cannot be part of a throw. */
const STROKE_MEMORY = 400;

const snapshotOf = (game: SandboxState): StageSnapshot => ({
  board: game.match.board,
  fields: game.fields,
  alive: game.alive,
  phase: game.phase,
  lastAttempt: game.lastAttempt,
  swinging: game.swing !== null,
  previewFlight: game.previewFlight,
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
 * The pointer handlers turn the finger into a stroke — its position works the
 * arm while it moves, its last moments become the throw when it lets go.
 *
 * Samples and the arm's position live in refs, not state. A whole flick can
 * happen inside one frame, and a throw assembled from state React has not
 * re-rendered yet would be a throw that never moved.
 */
export const Stage = ({ game }: { game: SandboxState }) => {
  const { phase, setSwing, release } = game;
  const canvas = useRef<HTMLCanvasElement>(null);
  const snapshot = useRef(snapshotOf(game));
  const stroke = useRef<Sample[]>([]);
  // Where the finger first touched, which is what "drawn back" is measured from.
  const anchor = useRef<Sample | null>(null);
  const arm = useRef(READY_SWING);

  useEffect(() => {
    snapshot.current = snapshotOf(game);
  });

  useEffect(() => {
    const target = canvas.current;
    if (!target) return;
    const stage = createStage(target, { gravity: snapshot.current.config.flight.gravity });
    const director = createDirector(stage, () => snapshot.current, () => arm.current);
    stage.physics.catch((error: unknown) => console.error(error));
    // A handle for poking at the live scene from the browser console.
    if (import.meta.env.DEV) (window as unknown as { __stage: unknown }).__stage = stage;
    return () => {
      director.dispose();
      stage.dispose();
    };
  }, []);

  const canThrow = phase.kind === 'ready';

  const track = (event: React.PointerEvent<HTMLElement>) => {
    const now = event.timeStamp || performance.now();
    /*
     * Browsers batch pointer moves to one per frame and keep the rest, which for
     * a flick is most of the stroke. Without them a fast flick arrives as two or
     * three points and its pace is a guess.
     */
    const coalesced = event.nativeEvent.getCoalescedEvents?.() ?? [];
    const points = coalesced.length > 0 ? coalesced : [event.nativeEvent];
    for (const point of points) {
      stroke.current.push({ x: point.clientX, y: point.clientY, t: point.timeStamp || now });
    }
    stroke.current = stroke.current.filter((s) => now - s.t <= STROKE_MEMORY);
  };

  const viewportHeight = (element: HTMLElement) => element.clientHeight || 1;

  const onPointerDown = (event: React.PointerEvent<HTMLElement>) => {
    if (!canThrow) return;
    event.currentTarget.setPointerCapture?.(event.pointerId);
    stroke.current = [];
    track(event);
    anchor.current = stroke.current[stroke.current.length - 1] ?? null;
  };

  const onPointerMove = (event: React.PointerEvent<HTMLElement>) => {
    if (!canThrow || stroke.current.length === 0) return;
    track(event);
    const height = viewportHeight(event.currentTarget);
    const reading = readSwing(stroke.current, height);
    setSwing(reading);
    const latest = stroke.current[stroke.current.length - 1];
    if (anchor.current && latest) {
      arm.current = armSwing(anchor.current, latest, reading, height, game.config);
    }
  };

  const onPointerUp = (event: React.PointerEvent<HTMLElement>) => {
    if (stroke.current.length === 0) return;
    track(event);
    const reading = readSwing(stroke.current, viewportHeight(event.currentTarget));
    stroke.current = [];
    anchor.current = null;
    arm.current = READY_SWING;
    release(reading);
  };

  return (
    <div
      className="stage"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
    >
      <canvas ref={canvas} />
    </div>
  );
};

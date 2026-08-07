import { useEffect, useRef, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import type { SandboxState } from '../state/useSandbox.js';
import { ARENA_RADIUS } from '../state/useSandbox.js';
import { colorOf } from '../ui/theme.js';
import { Arena, CutLine } from './Arena.js';
import { AimPreview, HeldKnife } from './AimPreview.js';
import { CameraRig } from './CameraRig.js';
import { FallenKnife, FlyingKnife, StuckKnife } from './FlyingKnife.js';
import { PLAYFIELD_TILT } from './coords.js';
import { readSwing, type Sample } from './gesture.js';

/** How much of the stroke to remember. Older than this cannot be part of a throw. */
const STROKE_MEMORY = 400;

export const Sandbox = ({ game }: { game: SandboxState }) => {
  const { phase, setSwing, release } = game;
  const stroke = useRef<Sample[]>([]);
  const [cutProgress, setCutProgress] = useState(0);

  const canThrow = phase.kind === 'ready';

  /**
   * Throw by throwing.
   *
   * The stroke is recorded as it happens and read at the moment the hand lets
   * go — its pace becomes distance, and how sharply it was turning becomes
   * tumble. Neither is a slider standing in for a hand; they are the two things
   * a hand actually does, and they are independent, which is what lets a player
   * reach any distance instead of the two the old power dial allowed.
   *
   * Samples are kept in a ref, not state. A whole flick can happen inside one
   * frame, and a throw assembled from state React has not re-rendered yet would
   * be a throw that never moved.
   */
  const track = (event: React.PointerEvent<HTMLDivElement>) => {
    const now = event.timeStamp || performance.now();
    stroke.current.push({ x: event.clientX, y: event.clientY, t: now });
    stroke.current = stroke.current.filter((s) => now - s.t <= STROKE_MEMORY);
  };

  const viewportHeight = (element: HTMLElement) => element.clientHeight || 1;

  const onPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!canThrow) return;
    event.currentTarget.setPointerCapture?.(event.pointerId);
    stroke.current = [];
    track(event);
  };

  const onPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!canThrow || stroke.current.length === 0) return;
    track(event);
    setSwing(readSwing(stroke.current, viewportHeight(event.currentTarget)));
  };

  const onPointerUp = (event: React.PointerEvent<HTMLDivElement>) => {
    if (stroke.current.length === 0) return;
    track(event);
    const reading = readSwing(stroke.current, viewportHeight(event.currentTarget));
    stroke.current = [];
    release(reading);
  };

  /*
   * Nudge the canvas into measuring itself.
   *
   * R3F sizes its renderer from a ResizeObserver on the container and renders
   * nothing until that reports a non-zero box. If the first callback lands
   * before layout has settled — or never arrives, which happens in embedded
   * browser views — it stays at zero and the scene simply never starts: a black
   * screen that fixes itself the moment the window is resized. One synthetic
   * resize after mount guarantees a real measurement.
   */
  useEffect(() => {
    const frame = requestAnimationFrame(() => window.dispatchEvent(new Event('resize')));
    return () => cancelAnimationFrame(frame);
  }, []);

  // The cut draws itself across the ground once the knife is in.
  useEffect(() => {
    if (phase.kind !== 'cutting') {
      setCutProgress(phase.kind === 'resting' ? 1 : 0);
      return;
    }
    setCutProgress(0);
    let frame = 0;
    const started = performance.now();
    const step = () => {
      const elapsed = (performance.now() - started) / 550;
      setCutProgress(Math.min(1, elapsed));
      if (elapsed < 1) frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [phase.kind]);

  const landed = phase.kind === 'cutting' || phase.kind === 'resting';
  // The knife and its cut stay put after the animation ends, so the throw can be
  // studied rather than glimpsed. Only aiming the next one clears them.
  const swinging = game.swing !== null;
  const settled =
    landed ? phase.attempt : phase.kind === 'ready' && !swinging ? game.lastAttempt : null;
  const shownCut = settled?.outcome?.kind === 'claimed' ? settled.outcome.cut : null;

  return (
    <div
      className="stage"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
    >
      <Canvas shadows dpr={[1, 2]} camera={{ fov: 50, position: [0, 20, 34] }}>
        <color attach="background" args={['#12100d']} />
        <fog attach="fog" args={['#12100d', 34, 68]} />

        <hemisphereLight intensity={0.55} groundColor="#2a2119" color="#cfd8e6" />
        <directionalLight
          position={[9, 18, 11]}
          intensity={1.5}
          castShadow
          shadow-mapSize={[1024, 1024]}
          shadow-camera-left={-16}
          shadow-camera-right={16}
          shadow-camera-top={16}
          shadow-camera-bottom={-16}
        />

        <CameraRig stand={game.stand} overhead={landed} arenaRadius={ARENA_RADIUS} />

        <group rotation={PLAYFIELD_TILT}>
          <Arena board={game.match.board} fields={game.fields} alive={game.alive} />

          {shownCut && <CutLine cut={shownCut} progress={cutProgress} />}

          {phase.kind === 'ready' && game.previewFlight && (
            <AimPreview flight={game.previewFlight} color={colorOf(game.currentPlayer)} />
          )}

          {phase.kind === 'ready' && !settled && (
            <HeldKnife
              at={[game.stand[0], game.stand[1], game.config.style.releaseHeight]}
              heading={game.previewFlight?.impact.heading ?? game.restHeading}
              bladeAngle={game.config.style.startingBladeAngle}
              spec={game.config.knife}
            />
          )}

          {phase.kind === 'flying' && (
            <FlyingKnife
              flight={phase.attempt.flight}
              playbackScale={game.playbackScale}
              heading={phase.attempt.flight.impact.heading}
              spec={game.config.knife}
            />
          )}

          {settled &&
            (settled.verdict.stuck ? (
              <StuckKnife
                flight={settled.flight}
                quality={settled.verdict.quality}
                depth={settled.verdict.depth}
                spec={game.config.knife}
              />
            ) : (
              <FallenKnife flight={settled.flight} spec={game.config.knife} />
            ))}
        </group>
      </Canvas>
    </div>
  );
};

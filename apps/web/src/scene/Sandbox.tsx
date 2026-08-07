import { useCallback, useEffect, useRef, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import type { SandboxState } from '../state/useSandbox.js';
import { ARENA_RADIUS } from '../state/useSandbox.js';
import { colorOf } from '../ui/theme.js';
import { Arena, CutLine } from './Arena.js';
import { AimPreview, HeldKnife } from './AimPreview.js';
import { CameraRig } from './CameraRig.js';
import { FallenKnife, FlyingKnife, StuckKnife } from './FlyingKnife.js';
import { PLAYFIELD_TILT } from './coords.js';

/**
 * How far the finger must travel for full power, as a fraction of the viewport's
 * shorter side. Scaled rather than fixed so the gesture feels the same on a
 * phone as on a desktop.
 */
const PULL_FOR_FULL_POWER = 0.34;
/**
 * Radians of aim per fraction of viewport dragged sideways.
 *
 * Generous on purpose: a player has to be able to aim right across the circle,
 * and at a narrower ratio the far edges of it are simply unreachable.
 */
const SWING_PER_PULL = 2.2;

export const Sandbox = ({ game }: { game: SandboxState }) => {
  const { phase, aim, setAim, release } = game;
  const anchor = useRef<{ x: number; y: number } | null>(null);
  const [cutProgress, setCutProgress] = useState(0);

  const canThrow = phase.kind === 'ready';

  /**
   * Pull back to throw.
   *
   * Read against the camera rather than the world: the view sits behind the
   * thrower looking down the throwing line, so dragging *down* the screen pulls
   * the arm back, and dragging sideways swings the aim the way it looks like it
   * should. Neither maps to a world axis, which is why the gesture is measured
   * in screen space and only then turned into a heading.
   */
  const updateAim = useCallback(
    (clientX: number, clientY: number, element: HTMLElement) => {
      const start = anchor.current;
      if (!start) return;
      const scale = Math.min(element.clientWidth, element.clientHeight);
      const pullBack = (clientY - start.y) / scale;
      const pullAcross = (clientX - start.x) / scale;

      setAim({
        heading: game.restHeading - pullAcross * SWING_PER_PULL,
        power: Math.min(1, Math.max(0, pullBack / PULL_FOR_FULL_POWER)),
      });
    },
    [game.restHeading, setAim],
  );

  const onPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!canThrow) return;
    event.currentTarget.setPointerCapture?.(event.pointerId);
    anchor.current = { x: event.clientX, y: event.clientY };
    setAim({ heading: game.restHeading, power: 0 });
  };

  const onPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!canThrow || !anchor.current) return;
    updateAim(event.clientX, event.clientY, event.currentTarget);
  };

  const onPointerUp = () => {
    if (!anchor.current) return;
    anchor.current = null;
    release();
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
  const settled = landed ? phase.attempt : phase.kind === 'ready' && !aim ? game.lastAttempt : null;
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

          {phase.kind === 'ready' && aim && game.previewFlight && (
            <>
              <AimPreview flight={game.previewFlight} color={colorOf(game.currentPlayer)} />
              <HeldKnife
                at={[game.stand[0], game.stand[1], game.config.style.releaseHeight]}
                heading={aim.heading}
                power={aim.power}
                spec={game.config.knife}
              />
            </>
          )}

          {phase.kind === 'ready' && !aim && !settled && (
            <HeldKnife
              at={[game.stand[0], game.stand[1], game.config.style.releaseHeight]}
              heading={game.restHeading}
              power={0}
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

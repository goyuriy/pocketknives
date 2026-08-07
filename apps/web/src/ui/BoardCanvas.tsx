import { useCallback, useEffect, useRef } from 'react';
import type { Board, FieldOutline, Throw, ThrowOutcome, Vec2 } from '@pocketknives/core';
import { createViewport } from './viewport.js';
import { drawFrame } from './draw.js';

type Props = {
  board: Board;
  alive: readonly string[];
  fields: readonly FieldOutline[];
  radius: number;
  draft: Throw | null;
  preview: ThrowOutcome | null;
  currentPlayer: string;
  locked: boolean;
  onAim: (attempt: Throw | null) => void;
  onCommit: (attempt: Throw) => void;
};

const DEFAULT_HEADING: Vec2 = [1, 0];

/**
 * The playfield, and the gesture that aims a throw.
 *
 * Press picks where the blade bites in; dragging away from that point turns the
 * blade; release commits. In M1 the same two values — a point and a heading —
 * will come out of a 3D flight simulation instead of a finger, and nothing
 * downstream of here changes.
 */
export const BoardCanvas = ({
  board,
  alive,
  fields,
  radius,
  draft,
  preview,
  currentPlayer,
  locked,
  onAim,
  onCommit,
}: Props) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const anchorRef = useRef<Vec2 | null>(null);
  const pendingAimRef = useRef<Throw | null>(null);
  const frameRef = useRef<number | null>(null);

  /**
   * Coalesces pointer moves to one aim update per frame.
   *
   * Each update resolves the throw against the rules to preview it, which costs
   * real work. A trackpad or touchscreen emits moves faster than that can run,
   * and without this the queue outruns the renderer and the drag locks up.
   */
  const scheduleAim = useCallback(
    (attempt: Throw) => {
      pendingAimRef.current = attempt;
      if (frameRef.current !== null) return;
      frameRef.current = requestAnimationFrame(() => {
        frameRef.current = null;
        if (pendingAimRef.current) onAim(pendingAimRef.current);
      });
    },
    [onAim],
  );

  useEffect(
    () => () => {
      if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
    },
    [],
  );

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const paint = () => {
      const parent = canvas.parentElement;
      if (!parent) return;
      const dpr = window.devicePixelRatio || 1;
      const { clientWidth: w, clientHeight: h } = parent;
      if (canvas.width !== w * dpr || canvas.height !== h * dpr) {
        canvas.width = w * dpr;
        canvas.height = h * dpr;
      }
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);
      drawFrame(
        ctx,
        board,
        createViewport(w, h, radius),
        alive,
        fields,
        draft,
        preview,
        currentPlayer,
      );
    };

    paint();
    const observer = new ResizeObserver(paint);
    if (canvas.parentElement) observer.observe(canvas.parentElement);
    return () => observer.disconnect();
  }, [board, radius, alive, fields, draft, preview, currentPlayer]);

  const pointerToWorld = useCallback(
    (event: React.PointerEvent<HTMLCanvasElement>): Vec2 => {
      const rect = event.currentTarget.getBoundingClientRect();
      const view = createViewport(rect.width, rect.height, radius);
      return view.toWorld([event.clientX - rect.left, event.clientY - rect.top]);
    },
    [radius],
  );

  const handleDown = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (locked) return;
    // Capture keeps the drag alive when the finger leaves the canvas. It throws
    // if the pointer is already gone, which must not abort the throw.
    try {
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch {
      /* pointer already released — the drag still resolves from its anchor */
    }
    const point = pointerToWorld(event);
    const attempt: Throw = { point, direction: DEFAULT_HEADING };
    anchorRef.current = point;
    pendingAimRef.current = attempt;
    onAim(attempt);
  };

  const handleMove = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const anchor = anchorRef.current;
    if (locked || !anchor) return;
    const cursor = pointerToWorld(event);
    const direction: Vec2 = [cursor[0] - anchor[0], cursor[1] - anchor[1]];
    const dragged = Math.hypot(direction[0], direction[1]) > radius * 0.02;
    scheduleAim({ point: anchor, direction: dragged ? direction : DEFAULT_HEADING });
  };

  const handleUp = () => {
    if (locked || !anchorRef.current) return;
    // The committed throw is the last aim taken, not whatever the throttled
    // preview happened to render — a fast release must not drop the final move.
    const attempt = pendingAimRef.current;
    if (frameRef.current !== null) {
      cancelAnimationFrame(frameRef.current);
      frameRef.current = null;
    }
    anchorRef.current = null;
    pendingAimRef.current = null;
    if (attempt) onCommit(attempt);
  };

  return (
    <canvas
      ref={canvasRef}
      onPointerDown={handleDown}
      onPointerMove={handleMove}
      onPointerUp={handleUp}
      onPointerCancel={handleUp}
    />
  );
};

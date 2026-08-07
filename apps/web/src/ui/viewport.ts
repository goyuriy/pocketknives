import type { Vec2 } from '@pocketknives/core';

/**
 * Maps between game space (origin at the arena centre, y upward, units of
 * arena radius) and canvas space (origin top-left, y downward, pixels).
 *
 * Isolating this here keeps every other file free of pixel arithmetic — the
 * rules never learn that a screen exists, and swapping this for a 3D camera in
 * M1 touches nothing else.
 */
export type Viewport = {
  readonly toScreen: (p: Vec2) => Vec2;
  readonly toWorld: (p: Vec2) => Vec2;
  readonly scale: number;
};

export const createViewport = (
  width: number,
  height: number,
  radius: number,
  padding = 24,
): Viewport => {
  const scale = (Math.min(width, height) / 2 - padding) / radius;
  const cx = width / 2;
  const cy = height / 2;

  return {
    scale,
    toScreen: ([x, y]) => [cx + x * scale, cy - y * scale],
    toWorld: ([x, y]) => [(x - cx) / scale, (cy - y) / scale],
  };
};

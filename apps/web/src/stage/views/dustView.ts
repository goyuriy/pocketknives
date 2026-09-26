import type { Scene } from '@babylonjs/core/scene';
import type { Mesh } from '@babylonjs/core/Meshes/mesh';
import type { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import { CreateSphere } from '@babylonjs/core/Meshes/Builders/sphereBuilder';
import type { Vec3 } from '@pocketknives/core';
import { dustPuffs, MOST_PUFFS, puffAt, type Puff } from '../math/dust.js';
import { paint } from './materials.js';

/** The most puffs alive at once. One impact at a time is all the game ever has. */
const POOL = MOST_PUFFS;
const DUST = '#8a7057';

export type DustView = {
  /** Kicks up dirt at `origin`, sprayed along `heading`, as of `now` (seconds). */
  readonly burst: (origin: Vec3, heading: number, weight: number, pace: number, seed: number, now: number) => void;
  /** Moves every puff on to `now` (seconds). */
  readonly update: (now: number) => void;
  readonly dispose: () => void;
};

/**
 * Dirt kicked up by an impact: a fixed pool of soft, low-poly balls, faded by
 * each mesh's own visibility so one material serves them all. Where each puff
 * is comes from `puffAt`; this only draws it.
 */
export const createDustView = (scene: Scene, playfield: TransformNode): DustView => {
  const material = paint(scene, 'dust', DUST, { shine: 0 });
  const meshes: Mesh[] = Array.from({ length: POOL }, (_, i) => {
    const puff = CreateSphere(`dust-${i}`, { diameter: 2, segments: 5 }, scene);
    puff.material = material;
    puff.parent = playfield;
    puff.isPickable = false;
    puff.setEnabled(false);
    return puff;
  });

  let live: { origin: Vec3; startedAt: number; puffs: readonly Puff[] } | null = null;

  return {
    burst: (origin, heading, weight, pace, seed, now) => {
      live = { origin, startedAt: now, puffs: dustPuffs(heading, weight, pace, seed).slice(0, POOL) };
    },
    update: (now) => {
      meshes.forEach((mesh, i) => {
        const puff = live?.puffs[i];
        const state = puff && live ? puffAt(puff, live.origin, now - live.startedAt) : null;
        mesh.setEnabled(state !== null);
        if (!state) return;
        mesh.position.set(...state.position);
        mesh.scaling.setAll(state.radius);
        mesh.visibility = state.opacity;
      });
    },
    dispose: () => {
      meshes.forEach((mesh) => mesh.dispose());
      material.dispose();
    },
  };
};

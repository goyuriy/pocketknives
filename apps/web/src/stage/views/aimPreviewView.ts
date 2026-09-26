import type { Scene } from '@babylonjs/core/scene';
import type { Mesh } from '@babylonjs/core/Meshes/mesh';
import type { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import { CreateSphere } from '@babylonjs/core/Meshes/Builders/sphereBuilder';
import { CreateTorus } from '@babylonjs/core/Meshes/Builders/torusBuilder';
import type { Flight } from '@pocketknives/core';
import { paint, repaint } from './materials.js';

const BEADS = 14;

export type AimPreviewView = {
  /** Shows the arc of `flight` in `color`, or hides it for null. */
  readonly show: (flight: Flight | null, color: string) => void;
  readonly dispose: () => void;
};

/**
 * The arc the knife will follow, and where it will come down.
 *
 * Drawn from the throw the hand is making, without the wobble it is about to
 * add. It shows what the player is aiming at, which is theirs to know; whether
 * their hand stays steady enough to stick it there is not.
 */
export const createAimPreviewView = (scene: Scene, playfield: TransformNode): AimPreviewView => {
  const beadMaterials = Array.from({ length: BEADS }, (_, i) =>
    paint(scene, `bead-${i}`, '#ffffff', { unlit: true, alpha: 0.85 - (i / BEADS) * 0.5 }),
  );
  const beads: Mesh[] = beadMaterials.map((material, i) => {
    const bead = CreateSphere(`bead-${i}`, { diameter: 0.15, segments: 8 }, scene);
    bead.parent = playfield;
    bead.material = material;
    return bead;
  });

  const ringMaterial = paint(scene, 'landing', '#ffffff', { unlit: true, alpha: 0.9 });
  const ring = CreateTorus('landing', { diameter: 0.8, thickness: 0.1, tessellation: 28 }, scene);
  ring.parent = playfield;
  // Built lying in the engine's ground plane; the playfield's ground is x–y.
  ring.rotation.x = Math.PI / 2;
  ring.material = ringMaterial;

  let shown: Flight | null = null;
  let shownColor = '';

  const setVisible = (visible: boolean) => {
    beads.forEach((bead) => bead.setEnabled(visible));
    ring.setEnabled(visible);
  };
  setVisible(false);

  return {
    show: (flight, color) => {
      if (flight === shown && color === shownColor) return;
      shown = flight;
      if (color !== shownColor) {
        shownColor = color;
        [...beadMaterials, ringMaterial].forEach((material) => repaint(material, color));
      }
      setVisible(flight !== null);
      if (!flight) return;

      const { samples, impact } = flight;
      beads.forEach((bead, i) => {
        const sample = samples[Math.floor(((i + 1) / (BEADS + 1)) * (samples.length - 1))]!;
        bead.position.set(...sample.position);
      });
      ring.position.set(impact.point[0], impact.point[1], 0.05);
    },
    dispose: () => {
      [...beads, ring].forEach((mesh) => mesh.dispose());
      [...beadMaterials, ringMaterial].forEach((material) => material.dispose());
    },
  };
};

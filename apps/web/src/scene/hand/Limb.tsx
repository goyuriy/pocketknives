import { forwardRef } from 'react';
import { Quaternion, Vector3, type Mesh } from 'three';
import type { Vec3 } from '@pocketknives/core';

/** An arm: a unit-tall cylinder, stretched and turned each frame to span two points. */
export const Limb = forwardRef<Mesh, { color: string }>(({ color }, ref) => (
  <mesh ref={ref} castShadow>
    <cylinderGeometry args={[0.075, 0.09, 1, 12]} />
    <meshStandardMaterial color={color} roughness={0.8} />
  </mesh>
));
Limb.displayName = 'Limb';

const UP = new Vector3(0, 1, 0);
const scratch = new Vector3();
const turn = new Quaternion();

/**
 * Lays a `Limb` from one point to another.
 *
 * Mutates the mesh in place rather than going through React, because it runs
 * every frame of a swing and a re-render per frame would be the whole scene.
 */
export const span = (limb: Mesh, from: Vec3, to: Vec3): void => {
  scratch.set(to[0] - from[0], to[1] - from[1], to[2] - from[2]);
  const length = scratch.length();
  limb.position.set((from[0] + to[0]) / 2, (from[1] + to[1]) / 2, (from[2] + to[2]) / 2);
  limb.quaternion.copy(turn.setFromUnitVectors(UP, scratch.normalize()));
  limb.scale.set(1, Math.max(length, 1e-3), 1);
};

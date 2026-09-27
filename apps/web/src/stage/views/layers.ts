import type { Scene } from '@babylonjs/core/scene';
import type { AbstractMesh } from '@babylonjs/core/Meshes/abstractMesh';
import type { TransformNode } from '@babylonjs/core/Meshes/transformNode';

/**
 * What is drawn over what.
 *
 * Everything is drawn in the world's group except, seen from the thrower's own
 * eyes, their arms and the knife in their hand: those are drawn after it, with
 * the depth buffer cleared first, so they are always in front — an arm can
 * never poke into the ground or a knife standing in it, however close. The
 * standard first-person trick; it needs no tiny near plane, so distant ground
 * keeps its depth precision.
 */
export const WORLD_GROUP = 0;
export const OWN_ARMS_GROUP = 1;

/** Sets the scene up to clear depth before drawing the thrower's own arms. Effectful. */
export const layerScene = (scene: Scene): void => {
  scene.setRenderingAutoClearDepthStencil(OWN_ARMS_GROUP, true, true, true);
};

/** Draws these meshes, and every mesh under these nodes, over the world or in it. Effectful. */
export const drawOnTop = (nodes: readonly (TransformNode | AbstractMesh)[], onTop: boolean): void => {
  const group = onTop ? OWN_ARMS_GROUP : WORLD_GROUP;
  for (const node of nodes) {
    if ('renderingGroupId' in node) (node as AbstractMesh).renderingGroupId = group;
    for (const mesh of node.getChildMeshes(false)) mesh.renderingGroupId = group;
  }
};

import type { Scene } from '@babylonjs/core/scene';
import type { Mesh } from '@babylonjs/core/Meshes/mesh';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import { Quaternion } from '@babylonjs/core/Maths/math.vector';
import type { ShadowGenerator } from '@babylonjs/core/Lights/Shadows/shadowGenerator';
import type { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import type { KnifeSpec } from '@pocketknives/core';
import { bladeQuaternion, leanedBladeQuaternion } from '../math/coords.js';
import { knifeShape } from '../math/knifeShape.js';
import type { Placement } from '../math/knifePlacement.js';
import { slab } from '../math/meshData.js';
import { meshFromData } from './meshFromData.js';
import { paint, repaint } from './materials.js';

const STEEL = { bright: '#e4e8ec', dull: '#7d8590' };
const WOOD = { bright: '#5a3d2b', dull: '#3a2b22' };
const BRASS = { bright: '#a08a5c', dull: '#5d5446' };

export type KnifeModel = {
  readonly root: TransformNode;
  /** Greys it out — a knife that failed to stick. */
  readonly setDimmed: (dimmed: boolean) => void;
  readonly dispose: () => void;
};

/**
 * A knife, built from its spec around its balance point, nose along local `+x`.
 *
 * Flat slabs rather than anything rounder: the whole throw is read by watching
 * the knife turn, and a slab looks unmistakably different edge-on and flat-on.
 */
export const createKnifeModel = (
  scene: Scene,
  name: string,
  spec: KnifeSpec,
  shadows: ShadowGenerator,
): KnifeModel => {
  const root = new TransformNode(name, scene);
  root.rotationQuaternion = Quaternion.Identity();
  const shape = knifeShape(spec);

  const parts: { mesh: Mesh; material: StandardMaterial; colors: { bright: string; dull: string } }[] = [];
  const addPart = (part: string, outline: typeof shape.blade, colors: typeof STEEL, shine: number) => {
    const material = paint(scene, `${name}-${part}`, colors.bright, { shine });
    const mesh = meshFromData(scene, `${name}-${part}`, slab(outline.outline, outline.thickness), material, root);
    shadows.addShadowCaster(mesh);
    parts.push({ mesh, material, colors });
  };

  addPart('blade', shape.blade, STEEL, 0.8);
  addPart('handle', shape.handle, WOOD, 0.05);
  if (shape.guard) addPart('guard', shape.guard, BRASS, 0.5);

  let dimmedNow = false;
  return {
    root,
    setDimmed: (dimmed) => {
      if (dimmed === dimmedNow) return;
      dimmedNow = dimmed;
      parts.forEach(({ material, colors }) => repaint(material, dimmed ? colors.dull : colors.bright));
    },
    dispose: () => {
      parts.forEach(({ mesh, material }) => {
        shadows.removeShadowCaster(mesh);
        material.dispose();
      });
      root.dispose();
    },
  };
};

/** Puts a node where a placement says, pointing the way it says. */
export const place = (node: TransformNode, { position, heading, bladeAngle, lean = 0 }: Placement): void => {
  node.position.set(...position);
  const [x, y, z, w] = lean === 0 ? bladeQuaternion(heading, bladeAngle) : leanedBladeQuaternion(heading, bladeAngle, lean);
  (node.rotationQuaternion ??= Quaternion.Identity()).set(x, y, z, w);
};

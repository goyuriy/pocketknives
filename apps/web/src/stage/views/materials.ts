import type { Scene } from '@babylonjs/core/scene';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { Color3 } from '@babylonjs/core/Maths/math.color';

export type Finish = {
  /** 0 matte, 1 polished steel. */
  readonly shine?: number;
  readonly alpha?: number;
  /** Ignore the lights entirely — for chalk lines and markers that must always read. */
  readonly unlit?: boolean;
};

/**
 * A flat-coloured material in the chunky cartoon look: soft and matte unless
 * asked to shine.
 *
 * Both faces are drawn. The game's own meshes are built from outlines that may
 * wind either way, and a ground piece that vanishes when seen from one side is
 * a far worse bug than the few extra pixels this costs.
 */
export const paint = (scene: Scene, name: string, hex: string, finish: Finish = {}): StandardMaterial => {
  const material = new StandardMaterial(name, scene);
  const color = Color3.FromHexString(hex);
  const shine = finish.shine ?? 0;
  material.backFaceCulling = false;
  material.diffuseColor = color;
  material.specularColor = new Color3(shine, shine, shine);
  material.specularPower = 16 + shine * 80;
  if (finish.alpha !== undefined) material.alpha = finish.alpha;
  if (finish.unlit) {
    material.disableLighting = true;
    material.emissiveColor = color;
  }
  return material;
};

/** Changes a material's colour in place — cheaper than rebuilding it every time a player changes. */
export const repaint = (material: StandardMaterial, hex: string): void => {
  const color = Color3.FromHexString(hex);
  material.diffuseColor = color;
  if (material.disableLighting) material.emissiveColor = color;
};

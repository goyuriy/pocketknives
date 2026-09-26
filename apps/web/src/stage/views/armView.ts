import type { Scene } from '@babylonjs/core/scene';
import type { Mesh } from '@babylonjs/core/Meshes/mesh';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import { Quaternion } from '@babylonjs/core/Maths/math.vector';
import { CreateSphere } from '@babylonjs/core/Meshes/Builders/sphereBuilder';
import { CreateCapsule } from '@babylonjs/core/Meshes/Builders/capsuleBuilder';
import { CreateCylinder } from '@babylonjs/core/Meshes/Builders/cylinderBuilder';
import type { ShadowGenerator } from '@babylonjs/core/Lights/Shadows/shadowGenerator';
import type { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import type { KnifeSpec, Vec3 } from '@pocketknives/core';
import { alignUp } from '../math/coords.js';
import { armPose, type ArmSetup } from '../math/armPose.js';
import { createKnifeModel, place, type KnifeModel } from './knifeModel.js';
import { paint, repaint } from './materials.js';

const SKIN = '#e9b48c';
/**
 * Chunky on purpose. The camera watches from behind the thrower, and a hand of
 * true size would be a few pixels — the player has to be able to see their own
 * hand, or there is nothing on screen they are controlling.
 */
const FIST_SCALE = 1.35;

export type ArmView = {
  /** Poses the arm at `swing` (-1 drawn back … 0 release … 1 followed through). */
  readonly pose: (setup: ArmSetup, swing: number, holding: boolean, sleeve: string) => void;
  readonly dispose: () => void;
};

/**
 * The player's hand — or both of them, for a sword.
 *
 * This is what the player controls. The finger never touches the knife: it moves
 * the arm, and the arm lets go. The pose itself is worked out in `armPose`; this
 * only builds the fists, sleeves and held knife and moves them where it says.
 * Rebuilt only when the grip changes — a new knife, or one hand to two.
 */
export const createArmView = (scene: Scene, playfield: TransformNode, shadows: ShadowGenerator): ArmView => {
  const skin = paint(scene, 'skin', SKIN, { shine: 0.1 });
  const sleeve = paint(scene, 'sleeve', '#c24d3f', { shine: 0.05 });

  let built: { spec: KnifeSpec; hands: number } | null = null;
  let sleeveShown = '';
  let fists: TransformNode[] = [];
  let limbs: Mesh[] = [];
  let knife: KnifeModel | null = null;

  const teardown = () => {
    [...fists, ...limbs].forEach((node) => {
      node.getChildMeshes(false).forEach((mesh) => shadows.removeShadowCaster(mesh));
      node.dispose();
    });
    fists = [];
    limbs = [];
    knife?.dispose();
    knife = null;
  };

  const build = (spec: KnifeSpec, hands: number) => {
    teardown();
    built = { spec, hands };
    knife = createKnifeModel(scene, 'held-knife', spec, shadows);
    knife.root.parent = playfield;
    for (let i = 0; i < hands; i++) {
      fists.push(fist(scene, `fist-${i}`, skin, playfield, shadows));
      limbs.push(limb(scene, `limb-${i}`, sleeve, playfield, shadows));
    }
  };

  return {
    pose: (setup, swing, holding, sleeveColor) => {
      if (built?.spec !== setup.spec || built.hands !== setup.hands) build(setup.spec, setup.hands);
      if (sleeveColor !== sleeveShown) {
        sleeveShown = sleeveColor;
        repaint(sleeve, sleeveColor);
      }

      const pose = armPose(setup, swing);
      if (knife) {
        knife.root.setEnabled(holding);
        place(knife.root, { position: pose.knifeAt, heading: setup.heading, bladeAngle: pose.bladeAngle });
      }
      pose.fists.forEach((at, i) => {
        const hand = fists[i];
        if (hand) place(hand, { position: at, heading: setup.heading, bladeAngle: pose.bladeAngle });
        const arm = limbs[i];
        if (arm) span(arm, pose.shoulders[i]!, at);
      });
    },
    dispose: () => {
      teardown();
      skin.dispose();
      sleeve.dispose();
    },
  };
};

/** A closed fist around a handle running along its local `+x`: a squashed ball and a thumb. */
const fist = (
  scene: Scene,
  name: string,
  skin: StandardMaterial,
  parent: TransformNode,
  shadows: ShadowGenerator,
): TransformNode => {
  const root = new TransformNode(name, scene);
  root.parent = parent;
  root.rotationQuaternion = Quaternion.Identity();

  const palm = CreateSphere(`${name}-palm`, { diameter: 1, segments: 12 }, scene);
  palm.scaling.set(0.22 * FIST_SCALE, 0.19 * FIST_SCALE, 0.21 * FIST_SCALE);
  palm.material = skin;
  palm.parent = root;

  // Laid along the handle, over the fingers.
  const thumb = CreateCapsule(`${name}-thumb`, { radius: 0.036 * FIST_SCALE, height: 0.16 * FIST_SCALE }, scene);
  thumb.rotation.z = Math.PI / 2;
  thumb.position.set(0.04 * FIST_SCALE, 0.095 * FIST_SCALE, 0.03 * FIST_SCALE);
  thumb.material = skin;
  thumb.parent = root;

  shadows.addShadowCaster(palm);
  shadows.addShadowCaster(thumb);
  return root;
};

/** A sleeve: a unit-tall cylinder, stretched and turned each frame to span shoulder to fist. */
const limb = (
  scene: Scene,
  name: string,
  material: StandardMaterial,
  parent: TransformNode,
  shadows: ShadowGenerator,
): Mesh => {
  const mesh = CreateCylinder(name, { height: 1, diameterTop: 0.15, diameterBottom: 0.18, tessellation: 12 }, scene);
  mesh.material = material;
  mesh.parent = parent;
  mesh.rotationQuaternion = Quaternion.Identity();
  shadows.addShadowCaster(mesh);
  return mesh;
};

const span = (mesh: Mesh, from: Vec3, to: Vec3): void => {
  const along: Vec3 = [to[0] - from[0], to[1] - from[1], to[2] - from[2]];
  mesh.position.set((from[0] + to[0]) / 2, (from[1] + to[1]) / 2, (from[2] + to[2]) / 2);
  const [x, y, z, w] = alignUp(along);
  mesh.rotationQuaternion!.set(x, y, z, w);
  mesh.scaling.y = Math.max(Math.hypot(...along), 1e-3);
};

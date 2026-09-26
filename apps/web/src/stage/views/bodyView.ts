import type { Scene } from '@babylonjs/core/scene';
import type { Mesh } from '@babylonjs/core/Meshes/mesh';
import type { AbstractMesh } from '@babylonjs/core/Meshes/abstractMesh';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import { Quaternion } from '@babylonjs/core/Maths/math.vector';
import { CreateSphere } from '@babylonjs/core/Meshes/Builders/sphereBuilder';
import { CreateCapsule } from '@babylonjs/core/Meshes/Builders/capsuleBuilder';
import { CreateCylinder } from '@babylonjs/core/Meshes/Builders/cylinderBuilder';
import type { ShadowGenerator } from '@babylonjs/core/Lights/Shadows/shadowGenerator';
import type { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import type { KnifeSpec, Vec3 } from '@pocketknives/core';
import { alignUp, bladeQuaternion } from '../math/coords.js';
import type { BodyPose } from '../math/bodyPose.js';
import type { Limb } from '../math/twoBoneIk.js';
import { createKnifeModel, place, type KnifeModel } from './knifeModel.js';
import { paint, repaint } from './materials.js';

const SKIN = '#e9b48c';
/**
 * A touch bigger than life — cartoon hands that read at a glance — but no
 * more: at eye level a hand is half a metre from the lens, and anything chunkier
 * fills the screen.
 */
const FIST_SCALE = 0.65;

export type BodyLook = {
  readonly spec: KnifeSpec;
  readonly hands: 1 | 2;
  /** Which way the body faces, for turning the fists. */
  readonly heading: number;
  /** Shirt colour — the player's own. */
  readonly sleeve: string;
};

/**
 * The thrower as the player sees them: their own two arms.
 *
 * The contract a character has to meet, kept small on purpose. Today it is
 * drawn from primitives; a rigged model from a character library can take its
 * place by solving the same `BodyPose` onto its bones (Babylon's
 * `BoneIKController` does exactly the two-bone solve `bodyPose` already has),
 * and nothing that drives it needs to change.
 */
export type BodyView = {
  readonly show: (pose: BodyPose, look: BodyLook, holding: boolean) => void;
  readonly dispose: () => void;
};

type Arm = {
  readonly upper: Mesh;
  readonly lower: Mesh;
  readonly elbow: Mesh;
  readonly fist: TransformNode;
  readonly finger: Mesh | null;
};

/**
 * Builds the arms from simple shapes: a sleeve, a bare forearm, a round elbow,
 * a fist. Rebuilt only when the grip changes — a new knife, or one hand to two.
 */
export const createBodyView = (scene: Scene, playfield: TransformNode, shadows: ShadowGenerator): BodyView => {
  const skin = paint(scene, 'skin', SKIN, { shine: 0.1 });
  const sleeve = paint(scene, 'sleeve', '#c24d3f', { shine: 0.05 });

  let built: { spec: KnifeSpec; hands: number } | null = null;
  let sleeveShown = '';
  let arms: Arm[] = [];
  let knife: KnifeModel | null = null;

  const casters = (arm: Arm): AbstractMesh[] =>
    [arm.upper, arm.lower, arm.elbow, ...arm.fist.getChildMeshes(), ...(arm.finger ? [arm.finger] : [])];

  const teardown = () => {
    arms.forEach((arm) => {
      casters(arm).forEach((mesh) => shadows.removeShadowCaster(mesh));
      [arm.upper, arm.lower, arm.elbow, arm.fist].forEach((node) => node.dispose());
    });
    arms = [];
    knife?.dispose();
    knife = null;
  };

  const build = (spec: KnifeSpec, hands: number) => {
    teardown();
    built = { spec, hands };
    knife = createKnifeModel(scene, 'held-knife', spec, shadows);
    knife.root.parent = playfield;
    const make = (name: string, pointer: boolean): Arm => {
      const arm: Arm = {
        upper: limb(scene, `${name}-upper`, sleeve, playfield, 0.14, 0.12),
        lower: limb(scene, `${name}-lower`, skin, playfield, 0.1, 0.085),
        elbow: joint(scene, `${name}-elbow`, sleeve, playfield, 0.13),
        fist: fist(scene, `${name}-fist`, skin, playfield),
        finger: null,
      };
      const finger = pointer ? pointingFinger(scene, `${name}-finger`, skin, arm.fist) : null;
      const complete = { ...arm, finger };
      casters(complete).forEach((mesh) => shadows.addShadowCaster(mesh));
      return complete;
    };
    // The other hand only ever points when it is not needed on the grip.
    arms = [make('throwing', false), make('other', hands === 1)];
  };

  return {
    show: (pose, look, holding) => {
      if (built?.spec !== look.spec || built.hands !== look.hands) build(look.spec, look.hands);
      if (look.sleeve !== sleeveShown) {
        sleeveShown = look.sleeve;
        repaint(sleeve, look.sleeve);
      }

      if (knife) {
        knife.root.setEnabled(holding);
        place(knife.root, { position: pose.knifeAt, heading: look.heading, bladeAngle: pose.bladeAngle });
      }

      const [throwing, other] = arms;
      if (throwing) posed(throwing, pose.throwingArm, bladeQuaternion(look.heading, pose.bladeAngle));
      if (other) {
        const turned = pose.pointing
          ? bladeQuaternion(pose.pointHeading, pose.pointTilt)
          : bladeQuaternion(look.heading, pose.bladeAngle);
        posed(other, pose.otherArm, turned);
        other.finger?.setEnabled(pose.pointing);
      }
    },
    dispose: () => {
      teardown();
      skin.dispose();
      sleeve.dispose();
    },
  };
};

const posed = (arm: Arm, solved: Limb, turned: readonly [number, number, number, number]): void => {
  span(arm.upper, solved.root, solved.joint);
  span(arm.lower, solved.joint, solved.end);
  arm.elbow.position.set(...solved.joint);
  arm.fist.position.set(...solved.end);
  arm.fist.rotationQuaternion!.set(...turned);
};

/** A closed fist around a handle running along its local `+x`: a squashed ball and a thumb. */
const fist = (scene: Scene, name: string, skin: StandardMaterial, parent: TransformNode): TransformNode => {
  const root = new TransformNode(name, scene);
  root.parent = parent;
  root.rotationQuaternion = Quaternion.Identity();

  const palm = CreateSphere(`${name}-palm`, { diameter: 1, segments: 12 }, scene);
  palm.scaling.set(0.22 * FIST_SCALE, 0.19 * FIST_SCALE, 0.21 * FIST_SCALE);
  palm.material = skin;
  palm.parent = root;

  const thumb = CreateCapsule(`${name}-thumb`, { radius: 0.036 * FIST_SCALE, height: 0.16 * FIST_SCALE }, scene);
  thumb.rotation.z = Math.PI / 2;
  thumb.position.set(0.04 * FIST_SCALE, 0.095 * FIST_SCALE, 0.03 * FIST_SCALE);
  thumb.material = skin;
  thumb.parent = root;
  return root;
};

/** An index finger stuck out along the fist's `+x` — the pointing hand. */
const pointingFinger = (scene: Scene, name: string, skin: StandardMaterial, fistNode: TransformNode): Mesh => {
  const finger = CreateCapsule(name, { radius: 0.036 * FIST_SCALE, height: 0.34 * FIST_SCALE }, scene);
  finger.rotation.z = Math.PI / 2;
  finger.position.set(0.22 * FIST_SCALE, 0, 0.04 * FIST_SCALE);
  finger.material = skin;
  finger.parent = fistNode;
  return finger;
};

const joint = (scene: Scene, name: string, material: StandardMaterial, parent: TransformNode, diameter: number): Mesh => {
  const ball = CreateSphere(name, { diameter, segments: 10 }, scene);
  ball.material = material;
  ball.parent = parent;
  return ball;
};

/** A unit-tall tapered cylinder, stretched and turned each frame to span two joints. */
const limb = (
  scene: Scene,
  name: string,
  material: StandardMaterial,
  parent: TransformNode,
  top: number,
  bottom: number,
): Mesh => {
  const mesh = CreateCylinder(name, { height: 1, diameterTop: bottom, diameterBottom: top, tessellation: 14 }, scene);
  mesh.material = material;
  mesh.parent = parent;
  mesh.rotationQuaternion = Quaternion.Identity();
  return mesh;
};

const span = (mesh: Mesh, from: Vec3, to: Vec3): void => {
  const along: Vec3 = [to[0] - from[0], to[1] - from[1], to[2] - from[2]];
  mesh.position.set((from[0] + to[0]) / 2, (from[1] + to[1]) / 2, (from[2] + to[2]) / 2);
  mesh.rotationQuaternion!.set(...alignUp(along));
  mesh.scaling.y = Math.max(Math.hypot(...along), 1e-3);
};

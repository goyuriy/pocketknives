import type { Scene } from '@babylonjs/core/scene';
import type { Mesh } from '@babylonjs/core/Meshes/mesh';
import type { AbstractMesh } from '@babylonjs/core/Meshes/abstractMesh';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import { Quaternion } from '@babylonjs/core/Maths/math.vector';
import { CreateSphere } from '@babylonjs/core/Meshes/Builders/sphereBuilder';
import { CreateCapsule } from '@babylonjs/core/Meshes/Builders/capsuleBuilder';
import { CreateCylinder } from '@babylonjs/core/Meshes/Builders/cylinderBuilder';
import { CreateBox } from '@babylonjs/core/Meshes/Builders/boxBuilder';
import type { ShadowGenerator } from '@babylonjs/core/Lights/Shadows/shadowGenerator';
import type { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import type { KnifeSpec, Vec3 } from '@pocketknives/core';
import { alignUp, axisAngle, bladeQuaternion, compose, rotate } from '../math/coords.js';
import type { BodyPose, Figure } from '../math/bodyPose.js';
import type { Limb } from '../math/twoBoneIk.js';
import { createKnifeModel, place, type KnifeModel } from './knifeModel.js';
import { paint, repaint } from './materials.js';

const SKIN = '#e9b48c';
const TROUSERS = '#3a3f4b';
const SHOES = '#2b221c';
const HAIR = '#3b2a1e';
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
  /**
   * Whether the head is drawn. Not from the thrower's own eyes, which are
   * inside it; yes from anywhere else.
   */
  readonly head: boolean;
  /**
   * Whether the drawn body is shown at all. Off while a rigged character
   * stands in for it; the knife is drawn either way.
   */
  readonly drawn: boolean;
};

/**
 * The thrower: their own two arms, and the body and legs they hang from.
 *
 * From the thrower's own eyes only the arms are in view, and the body's shadow
 * on the ground; the rest is there for every other camera.
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

  const trousers = paint(scene, 'trousers', TROUSERS, { shine: 0.05 });
  const shoes = paint(scene, 'shoes', SHOES, { shine: 0.2 });
  const hair = paint(scene, 'hair', HAIR);
  const trunk = createTrunk(scene, playfield, { shirt: sleeve, skin, trousers, shoes, hair });
  trunk.meshes.forEach((mesh) => shadows.addShadowCaster(mesh));

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

      trunk.show(pose.figure, look.heading, look.head);
      trunk.meshes.forEach((mesh) => mesh.setEnabled(look.drawn));
      trunk.head.setEnabled(look.drawn && look.head);
      arms.forEach((arm) => [arm.upper, arm.lower, arm.elbow, arm.fist].forEach((node) => node.setEnabled(look.drawn)));

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
      trunk.meshes.forEach((mesh) => {
        shadows.removeShadowCaster(mesh);
        mesh.dispose();
      });
      trunk.head.dispose();
      [skin, sleeve, trousers, shoes, hair].forEach((material) => material.dispose());
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

type Wardrobe = {
  readonly shirt: StandardMaterial;
  readonly skin: StandardMaterial;
  readonly trousers: StandardMaterial;
  readonly shoes: StandardMaterial;
  readonly hair: StandardMaterial;
};

type Trunk = {
  readonly show: (figure: Figure, heading: number, head: boolean) => void;
  readonly meshes: readonly Mesh[];
  readonly head: TransformNode;
};

type LegMeshes = { readonly thigh: Mesh; readonly shin: Mesh; readonly knee: Mesh; readonly shoe: Mesh };

/**
 * Chest, hips, head and legs, from the same simple shapes as the arms: a
 * squashed capsule for the chest in the player's colour, trousers and shoes,
 * and a round head with hair and a nose, so which way it faces reads from
 * behind and from above.
 */
const createTrunk = (scene: Scene, parent: TransformNode, wear: Wardrobe): Trunk => {
  const chest = CreateCapsule('chest', { radius: 0.5, height: 1.6, tessellation: 16 }, scene);
  chest.material = wear.shirt;
  chest.parent = parent;
  chest.rotationQuaternion = Quaternion.Identity();

  const pelvis = CreateSphere('pelvis', { diameter: 1, segments: 12 }, scene);
  pelvis.scaling.set(0.26, 0.2, 0.36);
  pelvis.material = wear.trousers;
  pelvis.parent = parent;
  pelvis.rotationQuaternion = Quaternion.Identity();

  const neck = limb(scene, 'neck', wear.skin, parent, 0.11, 0.1);

  const head = new TransformNode('head', scene);
  head.parent = parent;
  head.rotationQuaternion = Quaternion.Identity();
  const skull = CreateSphere('skull', { diameter: 0.3, segments: 16 }, scene);
  skull.material = wear.skin;
  skull.parent = head;
  const cap = CreateSphere('hair', { diameter: 0.32, segments: 16, slice: 0.55 }, scene);
  cap.material = wear.hair;
  cap.parent = head;
  // Built round +y, which is game up once the head is placed.
  cap.rotationQuaternion = Quaternion.FromArray([...alignUp([0, 0, 1])]);
  cap.position.set(-0.02, 0, 0.02);
  const nose = CreateSphere('nose', { diameter: 0.06, segments: 8 }, scene);
  nose.material = wear.skin;
  nose.parent = head;
  nose.position.set(0.15, 0, -0.01);

  const leg = (name: string): LegMeshes => {
    const shoe = CreateBox(`${name}-shoe`, { width: 0.26, height: 0.08, depth: 0.12 }, scene);
    shoe.material = wear.shoes;
    shoe.parent = parent;
    shoe.rotationQuaternion = Quaternion.Identity();
    return {
      thigh: limb(scene, `${name}-thigh`, wear.trousers, parent, 0.17, 0.13),
      shin: limb(scene, `${name}-shin`, wear.trousers, parent, 0.12, 0.1),
      knee: joint(scene, `${name}-knee`, wear.trousers, parent, 0.13),
      shoe,
    };
  };
  const legs = [leg('throwing-leg'), leg('other-leg')] as const;

  return {
    meshes: [chest, pelvis, neck, skull, cap, nose, ...legs.flatMap((l) => [l.thigh, l.shin, l.knee, l.shoe])],
    head,
    show: (figure, heading, showHead) => {
      const turned = axisAngle([0, 0, 1], heading);
      // From a little below the hips to the base of the neck, flatter front to back than side to side.
      const bottom: Vec3 = [figure.hips[0], figure.hips[1], figure.hips[2] - 0.05];
      upright(chest, bottom, figure.neck, heading);
      chest.scaling.set(0.27, Math.hypot(...sub(figure.neck, bottom)) / 1.6 + 0.02, 0.5);
      pelvis.position.set(...figure.hips);
      pelvis.rotationQuaternion!.set(...turned);
      span(neck, figure.neck, [figure.neck[0], figure.neck[1], figure.neck[2] + 0.1]);

      head.setEnabled(showHead);
      head.position.set(...figure.head);
      head.rotationQuaternion!.set(...turned);

      [figure.throwingLeg, figure.otherLeg].forEach((solved, i) => {
        const meshes = legs[i]!;
        span(meshes.thigh, solved.root, solved.joint);
        span(meshes.shin, solved.joint, solved.end);
        meshes.knee.position.set(...solved.joint);
        // The shoe's toe a little ahead of the ankle, its sole on the ground under it.
        const toe = rotate(turned, [0.06, 0, 0]);
        meshes.shoe.position.set(solved.end[0] + toe[0], solved.end[1] + toe[1], solved.end[2] - 0.03);
        meshes.shoe.rotationQuaternion!.set(...turned);
      });
    },
  };
};

const sub = (a: Vec3, b: Vec3): Vec3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];

/**
 * Stands a mesh built along `+y` between two points, with its own `+x` facing
 * `heading` — so a flattened chest is flat front to back, not at some angle
 * the shortest-arc turn happened to leave it at.
 */
const upright = (mesh: Mesh, from: Vec3, to: Vec3, heading: number): void => {
  const along = rotate(axisAngle([0, 0, 1], -heading), sub(to, from));
  mesh.position.set((from[0] + to[0]) / 2, (from[1] + to[1]) / 2, (from[2] + to[2]) / 2);
  mesh.rotationQuaternion!.set(...compose(axisAngle([0, 0, 1], heading), alignUp(along)));
};

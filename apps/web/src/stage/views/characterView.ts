import type { Scene } from '@babylonjs/core/scene';
import type { AnimationGroup } from '@babylonjs/core/Animations/animationGroup';
import type { AbstractMesh } from '@babylonjs/core/Meshes/abstractMesh';
import type { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import type { ShadowGenerator } from '@babylonjs/core/Lights/Shadows/shadowGenerator';
import type { PBRMaterial } from '@babylonjs/core/Materials/PBR/pbrMaterial';
import { Color3 } from '@babylonjs/core/Maths/math.color';
import { Mesh } from '@babylonjs/core/Meshes/mesh';
import { SubMesh } from '@babylonjs/core/Meshes/subMesh';
import { VertexBuffer } from '@babylonjs/core/Buffers/buffer';
import { MultiMaterial } from '@babylonjs/core/Materials/multiMaterial';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { Quaternion, Vector3 } from '@babylonjs/core/Maths/math.vector';
import type { Vec2, Vec3 } from '@pocketknives/core';
import type { BodyPose } from '../math/bodyPose.js';
import { bladeDirection, toWorld } from '../math/coords.js';
import { mixHex } from '../math/color.js';
import { locomotion, type ClipSpeeds } from '../math/locomotion.js';
import { armsFirst, isArmBoneName, isArmJointBoneName } from '../math/armsOnly.js';
import type { Limb } from '../math/twoBoneIk.js';
import { reachArm, type ArmBones } from './boneAim.js';
import { closeOnHandle, HAND_SCALE, measureHand, type HandShape } from './handGrip.js';

/** The character shipped with the game: Mixamo's X Bot, with Mixamo's idle, walk and run. */
export const CHARACTER_URL = `${import.meta.env.BASE_URL}characters/xbot.glb`;

/**
 * Mixamo characters are made in metres, as the game is; X Bot is 1.8 m, and
 * this brings it to the thrower's 1.75, eyes where the camera's are.
 */
const SCALE = 0.97;

/**
 * The ground speed each of X Bot's clips was made for, measured off the clips
 * themselves (how fast a planted foot slides back in the in-place walk and
 * run: 1.66 and 3.62 m/s), at the scale shown. Another character's clips need
 * measuring again.
 */
const CLIPS: ClipSpeeds = { walk: 1.66 * SCALE, run: 3.62 * SCALE };

export type CharacterFrame = {
  readonly feet: Vec2;
  /** Which way the body faces. */
  readonly heading: number;
  /** How fast the body is moving across the ground, and whether backwards. */
  readonly speed: number;
  readonly backwards: boolean;
  /** Where the drawn arms would be; the character's reach for the same places. */
  readonly pose: BodyPose;
  readonly hands: 1 | 2;
  /** The player's colour, for the character's body. */
  readonly color: string;
  readonly visible: boolean;
  /**
   * Seen from its own eyes. Only the arms are drawn then, as in any
   * first-person game — a whole body seen from inside its own head is
   * shoulders, chest and knees crowding the bottom of the view. Every other
   * camera, and every other player, sees all of it.
   */
  readonly firstPerson: boolean;
};

export type CharacterView = {
  /** Resolves true once the character is loaded, false if it could not be. */
  readonly loaded: Promise<boolean>;
  readonly ready: () => boolean;
  /**
   * Poses the character for this frame. Returns where the middle of the grip
   * sits in its throwing hand, in game coordinates, so the knife can be put
   * there; null while it is not shown.
   */
  readonly show: (frame: CharacterFrame) => Vec3 | null;
  readonly dispose: () => void;
};

type Rig = {
  readonly root: TransformNode;
  readonly meshes: readonly AbstractMesh[];
  readonly groups: readonly AnimationGroup[];
  readonly idle: AnimationGroup | null;
  readonly walk: AnimationGroup | null;
  readonly run: AnimationGroup | null;
  readonly throwingArm: ArmBones;
  readonly otherArm: ArmBones;
  readonly throwingHand: HandShape;
  readonly otherHand: HandShape;
  readonly head: TransformNode;
  readonly tinted: readonly { material: PBRMaterial; share: number }[];
  /** Draws the whole character, or its arms alone — see `splitOffArms`. */
  readonly showBody: (body: boolean) => void;
};

/** A bone's own name, whatever the exporter prefixed it with (`mixamorig:`, `mixamorig1:`, …). */
const boneName = (name: string): string => name.replace(/^.*:/, '').replace(/^mixamorig\d*/, '');

/**
 * The thrower as a rigged character, seen from every camera, their own eyes
 * included (with the head folded away, see `firstPerson`).
 *
 * Loaded after the first frame, like physics: the circle must be on screen
 * before a three-megabyte character is. Until it arrives — or if it never does
 * — the drawn body stands in.
 *
 * The legs and body play the character's own clips (idle, walk, run, blended by
 * pace); the arms are then turned to reach for where the drawn arms would be,
 * scaled to the character's shorter reach, because the throw is decided by the
 * hand and no clip knows where the hand has to be.
 *
 * Effectful: fetches the model and adds it to the scene.
 */
export const createCharacterView = (
  scene: Scene,
  shadows: ShadowGenerator | null,
  source: string = CHARACTER_URL,
): CharacterView => {
  let rig: Rig | null = null;
  let disposed = false;
  let tint = '';

  const loaded = load(scene, source)
    .then((loadedRig) => {
      if (disposed) {
        loadedRig.meshes.forEach((mesh) => mesh.dispose());
        return false;
      }
      rig = loadedRig;
      rig.meshes.forEach((mesh) => shadows?.addShadowCaster(mesh));
      rig.root.setEnabled(false);
      return true;
    })
    .catch(() => false);

  return {
    loaded,
    ready: () => rig !== null,
    show: (frame) => {
      if (!rig) return null;
      rig.root.setEnabled(frame.visible);
      if (!frame.visible) return null;

      if (frame.color !== tint) {
        tint = frame.color;
        for (const { material, share } of rig.tinted) {
          material.albedoColor = Color3.FromHexString(mixHex(frame.color, '#1c1a18', share));
        }
      }

      const blend = locomotion(frame.speed, frame.backwards, CLIPS);
      setWeight(rig.idle, blend.idle, 1);
      setWeight(rig.walk, blend.walk, blend.rate);
      setWeight(rig.run, blend.run, blend.rate);

      rig.root.position.set(...toWorld([frame.feet[0], frame.feet[1], 0]));
      // Mixamo faces +z; this turns it to face `heading` on the ground.
      rig.root.rotationQuaternion = Quaternion.RotationAxis(Vector3.Up(), frame.heading + Math.PI / 2);
      rig.root.scaling.setAll(SCALE);
      // After the clips, which set the head's scale every frame like every bone's.
      rig.head.scaling.setAll(frame.firstPerson ? HIDDEN : 1);
      rig.showBody(!frame.firstPerson);
      // Every bone's place in the world follows from the root just moved: bring
      // them all up to date now, parents first, or the arms would reach from
      // where the shoulders were last frame — a knife trailing the hand as it walks.
      rig.root.computeWorldMatrix(true);
      for (const node of rig.root.getDescendants(false)) (node as TransformNode).computeWorldMatrix?.(true);

      const handle = new Vector3(...toWorld(bladeDirection(frame.heading, frame.pose.bladeAngle)));
      // The thrower's right: the throw's plane is square to it, and so are the palms.
      const across = new Vector3(...toWorld([Math.sin(frame.heading), -Math.cos(frame.heading), 0]));
      const throwing = reachFor(rig.throwingArm, frame.pose.throwingArm);
      reachArm(rig.throwingArm, throwing.target, throwing.pole);
      let grip = closeOnHandle(rig.throwingHand, handle, across);
      if (frame.hands === 1) {
        const other = reachFor(rig.otherArm, frame.pose.otherArm);
        reachArm(rig.otherArm, other.target, other.pole);
        // The free hand keeps the clip's own fingers, at the same cartoon size.
        rig.otherHand.hand.scaling.setAll(HAND_SCALE);
        return [grip.x, -grip.z, grip.y];
      }

      // Two hands side by side, the handle's middle between them. The drawn
      // arms are longer than the rig's, and the drawn hands are often at full
      // stretch, so first the grip comes in until both hands can reach it.
      const apart = handle.normalizeToNew().scale(handSize(rig.otherHand) * HANDS_APART);
      reachArm(rig.throwingArm, withinBothReaches(rig, throwing.target, apart), throwing.pole);
      grip = closeOnHandle(rig.throwingHand, handle, across);
      holdToo(rig, frame.pose, grip.add(apart), handle, across);
      const middle = grip.add(apart.scale(0.5));
      return [middle.x, -middle.z, middle.y];
    },
    dispose: () => {
      disposed = true;
      if (!rig) return;
      rig.groups.forEach((group) => group.dispose());
      rig.meshes.forEach((mesh) => {
        shadows?.removeShadowCaster(mesh);
        mesh.dispose(false, true);
      });
    },
  };
};

/**
 * Where a rigged arm should reach for the drawn arm's hand, measured from the
 * rig's own shoulder and scaled to the rig's own reach: the same direction,
 * the same share of a full stretch, the elbow the same way out.
 */
const reachFor = (arm: ArmBones, drawn: Limb): { target: Vector3; pole: Vector3 } => {
  arm.upper.computeWorldMatrix(true);
  const shoulder = arm.upper.getAbsolutePosition().clone();
  const theirs =
    Vector3.Distance(shoulder, arm.lower.getAbsolutePosition()) +
    Vector3.Distance(arm.lower.getAbsolutePosition(), arm.hand.getAbsolutePosition());
  const ours = length(sub(drawn.joint, drawn.root)) + length(sub(drawn.end, drawn.joint));
  const out = new Vector3(...toWorld(sub(drawn.end, drawn.root))).scale(theirs / Math.max(ours, 1e-6));
  const middle: Vec3 = [
    (drawn.root[0] + drawn.end[0]) / 2,
    (drawn.root[1] + drawn.end[1]) / 2,
    (drawn.root[2] + drawn.end[2]) / 2,
  ];
  return { target: shoulder.add(out), pole: new Vector3(...toWorld(sub(drawn.joint, middle))) };
};

/** How small the head is folded when seen from inside it: nothing, without a zero scale's degenerate matrix. */
const HIDDEN = 1e-4;

/** Times the second hand is re-aimed to bring its palm, not its wrist, onto the handle. */
const SETTLING = 3;

/** How far apart two hands on one handle are, in hand lengths, palm to palm. */
const HANDS_APART = 1.1;

/** How far a hand is from wrist to knuckles, in the world. */
const handSize = (shape: HandShape): number => {
  shape.hand.computeWorldMatrix(true);
  shape.knuckle.computeWorldMatrix(true);
  return Vector3.Distance(shape.hand.getAbsolutePosition(), shape.knuckle.getAbsolutePosition());
};

/** The most of an arm's full stretch a two-handed grip is held at: short of locked straight. */
const HELD_STRETCH = 0.85;

const armLength = (arm: ArmBones): number => {
  [arm.upper, arm.lower, arm.hand].forEach((node) => node.computeWorldMatrix(true));
  return (
    Vector3.Distance(arm.upper.getAbsolutePosition(), arm.lower.getAbsolutePosition()) +
    Vector3.Distance(arm.lower.getAbsolutePosition(), arm.hand.getAbsolutePosition())
  );
};

/** `point`, pulled in towards `centre` if it is further than `radius` from it. */
const within = (point: Vector3, centre: Vector3, radius: number): Vector3 => {
  const out = point.subtract(centre);
  const length = out.length();
  return length <= radius ? point : centre.add(out.scale(radius / length));
};

/**
 * Where the throwing hand can be with the other hand `apart` from it and both
 * within reach: pulled in towards whichever shoulder cannot reach, a few times
 * over, since pulling in for one can take it out of reach of the other.
 */
const withinBothReaches = (rig: Rig, wanted: Vector3, apart: Vector3): Vector3 => {
  const throwingShoulder = rig.throwingArm.upper.getAbsolutePosition().clone();
  const otherShoulder = rig.otherArm.upper.getAbsolutePosition().clone();
  const throwingReach = armLength(rig.throwingArm) * HELD_STRETCH;
  const otherReach = armLength(rig.otherArm) * HELD_STRETCH;
  let hand = wanted.clone();
  for (let i = 0; i < 4; i++) {
    hand = within(hand, throwingShoulder, throwingReach);
    hand = within(hand.add(apart), otherShoulder, otherReach).subtract(apart);
  }
  return hand;
};

/**
 * Puts the free hand on the handle too, for a two-handed weapon, at `wanted`
 * — right up against the throwing hand, on the blade's side — closed round it
 * the same way. The arm reaches for a wrist but the handle has to be in the
 * palm, so the reach is corrected by however far the palm lands off it.
 */
const holdToo = (rig: Rig, pose: BodyPose, wanted: Vector3, handle: Vector3, across: Vector3): void => {
  const middle: Vec3 = [
    (pose.otherArm.root[0] + pose.otherArm.end[0]) / 2,
    (pose.otherArm.root[1] + pose.otherArm.end[1]) / 2,
    (pose.otherArm.root[2] + pose.otherArm.end[2]) / 2,
  ];
  const pole = new Vector3(...toWorld(sub(pose.otherArm.joint, middle)));
  let wrist = wanted.clone();
  for (let i = 0; i < SETTLING; i++) {
    reachArm(rig.otherArm, wrist, pole);
    const palm = closeOnHandle(rig.otherHand, handle, across);
    wrist = wrist.add(wanted.subtract(palm));
  }
};

const sub = (a: Vec3, b: Vec3): Vec3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const length = (a: Vec3): number => Math.hypot(a[0], a[1], a[2]);

const setWeight = (group: AnimationGroup | null, weight: number, rate: number) => {
  if (!group) return;
  group.weight = weight;
  group.speedRatio = rate;
};

const load = async (scene: Scene, source: string): Promise<Rig> => {
  const [{ LoadAssetContainerAsync }] = await Promise.all([
    import('@babylonjs/core/Loading/sceneLoader'),
    import('@babylonjs/loaders/glTF/2.0/index.js'),
  ]);
  const container = await LoadAssetContainerAsync(source, scene, { pluginExtension: '.glb' });
  container.addAllToScene();
  const root = (container.meshes.find((mesh) => mesh.name === '__root__') ?? container.meshes[0]) as TransformNode;
  if (!root) throw new Error('character has no meshes');

  const bone = (name: string): TransformNode => {
    const node = container.transformNodes.find((candidate) => boneName(candidate.name) === name);
    if (!node) throw new Error(`character has no ${name} bone`);
    return node;
  };
  const arm = (side: 'Right' | 'Left'): ArmBones => ({
    upper: bone(`${side}Arm`),
    lower: bone(`${side}ForeArm`),
    hand: bone(`${side}Hand`),
  });

  // Before any clip has moved it: the hands are measured in the bind pose.
  const findBone = (name: string) => container.transformNodes.find((candidate) => boneName(candidate.name) === name);
  const throwingHand = measureHand(findBone, 'Right');
  const otherHand = measureHand(findBone, 'Left');

  const clip = (pattern: RegExp) => container.animationGroups.find((group) => pattern.test(group.name)) ?? null;
  const groups = container.animationGroups;
  groups.forEach((group) => group.stop());
  const idle = clip(/idle/i);
  const walk = clip(/walk/i);
  const run = clip(/run/i);
  for (const group of [idle, walk, run]) {
    if (!group) continue;
    group.start(true);
    group.weight = group === idle ? 1 : 0;
  }

  // Plain-coloured materials take the player's colour; textured ones are left as made.
  const tinted = container.materials
    .filter((material): material is PBRMaterial => material.getClassName() === 'PBRMaterial')
    .filter((material) => !material.albedoTexture)
    .map((material) => ({ material, share: /joint/i.test(material.name) ? 0.7 : 0.15 }));

  const shadowOnly = shadowOnlyMaterial(scene);
  const bodies = container.meshes.flatMap((mesh) => {
    const split = mesh instanceof Mesh ? splitOffArms(mesh, shadowOnly) : null;
    return split ? [split] : [];
  });
  let bodyShown = true;
  const showBody = (body: boolean) => {
    if (body === bodyShown) return;
    bodyShown = body;
    bodies.forEach((show) => show(body));
  };

  return {
    root,
    meshes: container.meshes,
    groups,
    idle,
    walk,
    run,
    throwingArm: arm('Right'),
    otherArm: arm('Left'),
    throwingHand,
    otherHand,
    head: bone('Head'),
    tinted,
    showBody,
  };
};

/**
 * A material that draws nothing on screen, for a part that should still cast
 * its shadow. Shadow maps are drawn with a shader of their own, which does not
 * ask the material whether to write colour, so the part's shadow falls as
 * before while the part itself is gone.
 */
const shadowOnlyMaterial = (scene: Scene): StandardMaterial => {
  const material = new StandardMaterial('shadow-only', scene);
  material.disableColorWrite = true;
  material.disableDepthWrite = true;
  return material;
};

/**
 * Splits a skinned mesh into two parts drawn from one set of vertices — its
 * arms, and the rest — and returns a switch that shows both, or the arms
 * alone. Hidden, the rest still casts its shadow (`shadowOnly`): a thrower in
 * first person sees only their arms, and the whole of their shadow. Null for
 * a mesh that is not skinned or already has parts of its own, which is left
 * whole.
 *
 * Effectful: reorders the mesh's triangles (`armsFirst`), replaces its parts
 * and its material. Both parts are always drawn when on screen rather than
 * culled separately: each part's bounds are measured in the bind pose, a
 * T-pose, and an arm reaching forward is nowhere near where its T-pose bounds
 * say.
 */
const splitOffArms = (mesh: Mesh, shadowOnly: StandardMaterial): ((body: boolean) => void) | null => {
  const indices = mesh.getIndices();
  const influences = mesh.getVerticesData(VertexBuffer.MatricesIndicesKind);
  const weights = mesh.getVerticesData(VertexBuffer.MatricesWeightsKind);
  if (!mesh.skeleton || mesh.subMeshes?.length !== 1 || !indices || !influences || !weights) return null;

  // X Bot is a mannequin: closed limb pieces, with a ball at every joint.
  const drawn = /joint/i.test(mesh.material?.name ?? '') ? isArmJointBoneName : isArmBoneName;
  const armBones = mesh.skeleton.bones.map((bone) => drawn(boneName(bone.name)));
  const sorted = armsFirst(indices, influences, weights, (index) => armBones[index] ?? false);
  const own = mesh.material;
  if (!own) return null;
  const vertices = mesh.getTotalVertices();
  mesh.setIndices(sorted.indices);
  mesh.releaseSubMeshes();
  new SubMesh(0, 0, vertices, 0, sorted.arms, mesh);
  new SubMesh(1, 0, vertices, sorted.arms, sorted.indices.length - sorted.arms, mesh);
  mesh.alwaysSelectAsActiveMesh = true;

  const partsOf = (name: string, rest: typeof own): MultiMaterial => {
    const parts = new MultiMaterial(`${mesh.name}-${name}`, mesh.getScene());
    parts.subMaterials = [own, rest];
    return parts;
  };
  const whole = partsOf('whole', own);
  const armsOnly = partsOf('arms-only', shadowOnly);
  mesh.material = whole;
  // Swapped whole rather than edited: setting a mesh's material clears the
  // shaders it had compiled for the old one.
  return (body) => {
    mesh.material = body ? whole : armsOnly;
  };
};

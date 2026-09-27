import type { Scene } from '@babylonjs/core/scene';
import type { AnimationGroup } from '@babylonjs/core/Animations/animationGroup';
import type { AbstractMesh } from '@babylonjs/core/Meshes/abstractMesh';
import type { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import type { ShadowGenerator } from '@babylonjs/core/Lights/Shadows/shadowGenerator';
import type { PBRMaterial } from '@babylonjs/core/Materials/PBR/pbrMaterial';
import { Color3 } from '@babylonjs/core/Maths/math.color';
import { Quaternion, Vector3 } from '@babylonjs/core/Maths/math.vector';
import type { Vec2, Vec3 } from '@pocketknives/core';
import type { BodyPose } from '../math/bodyPose.js';
import { toWorld } from '../math/coords.js';
import { mixHex } from '../math/color.js';
import { locomotion, type ClipSpeeds } from '../math/locomotion.js';
import type { Limb } from '../math/twoBoneIk.js';
import { reachArm, type ArmBones } from './boneAim.js';

/** The character shipped with the game: Mixamo's X Bot, with Mixamo's idle, walk and run. */
export const CHARACTER_URL = `${import.meta.env.BASE_URL}characters/xbot.glb`;

/**
 * Mixamo characters are made in metres at human height; this brings one to
 * the thrower's size here, head where the eyes are.
 */
const SCALE = 0.94;

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
};

export type CharacterView = {
  /** Resolves true once the character is loaded, false if it could not be. */
  readonly loaded: Promise<boolean>;
  readonly ready: () => boolean;
  /**
   * Poses the character for this frame. Returns where its throwing hand ended
   * up, in game coordinates, so the knife can be put in it; null while it is
   * not shown.
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
  readonly tinted: readonly { material: PBRMaterial; share: number }[];
};

/** A bone's own name, whatever the exporter prefixed it with (`mixamorig:`, `mixamorig1:`, …). */
const boneName = (name: string): string => name.replace(/^.*:/, '').replace(/^mixamorig\d*/, '');

/**
 * The thrower as a rigged character, for every camera but their own eyes.
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
      rig.root.computeWorldMatrix(true);

      reach(rig.throwingArm, frame.pose.throwingArm);
      reach(rig.otherArm, frame.pose.otherArm);
      const hand = rig.throwingArm.hand.getAbsolutePosition();
      return [hand.x, -hand.z, hand.y];
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
 * Reaches a rigged arm for where the drawn arm's hand is, measured from the
 * rig's own shoulder and scaled to the rig's own reach: the same direction,
 * the same share of a full stretch, the elbow the same way out.
 */
const reach = (arm: ArmBones, drawn: Limb): void => {
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
  reachArm(arm, shoulder.add(out), new Vector3(...toWorld(sub(drawn.joint, middle))));
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

  return {
    root,
    meshes: container.meshes,
    groups,
    idle,
    walk,
    run,
    throwingArm: arm('Right'),
    otherArm: arm('Left'),
    tinted,
  };
};

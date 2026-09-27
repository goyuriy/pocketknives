import type { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import { Quaternion, Vector3 } from '@babylonjs/core/Maths/math.vector';
import { shortestArc } from './boneAim.js';

/**
 * How a rigged hand closes round a handle.
 *
 * Measured off the rig in its bind pose rather than read from its bones' own
 * axes, which differ from exporter to exporter: where the fingers point, which
 * way the palm faces, which side the thumb is on. Mixamo binds its characters
 * in a T-pose with the palms down, and that is the one thing assumed.
 */
export type HandShape = {
  readonly hand: TransformNode;
  /** The bone the fingers start from, for how big the palm is. */
  readonly knuckle: TransformNode;
  /** In the hand's own frame: wrist towards the knuckles, the palm's facing, the thumb's side. */
  readonly fingers: Vector3;
  readonly palm: Vector3;
  readonly thumb: Vector3;
  readonly curls: readonly Curl[];
};

type Curl = {
  readonly bone: TransformNode;
  /** The bone's rotation in the bind pose, which the curl is added to. */
  readonly rest: Quaternion;
  /** The axis it bends about towards the palm, in its own frame. */
  readonly axis: Vector3;
  readonly angle: number;
};

/**
 * How big the hands are drawn against life. Life size: the knives are real
 * size, with a handle a real hand closes round.
 */
export const HAND_SCALE = 1;

/**
 * The angle between the handle and the line from wrist to knuckles, radians.
 *
 * A hammer grip does not hold the handle square across the palm, the way a
 * hammer is held to strike: the handle lies diagonally, from the heel of the
 * hand under the little finger up to the root of the index finger, so the
 * knife leaves the fist between thumb and index pointing up the line of the
 * forearm rather than out to the side of it.
 */
const HANDLE_ACROSS_PALM = (55 * Math.PI) / 180;

/** How far each finger joint closes round the handle, knuckle first, radians. */
const FINGER_CURL = [1.2, 1.35, 0.95];
/**
 * And the thumb, which in a throwing grip is not wrapped over the fingers but
 * rests along the side of the handle, pointing towards the blade.
 */
const THUMB_CURL = [-0.35, -0.25, -0.15];
const FINGERS = ['Index', 'Middle', 'Ring', 'Pinky'];

const worldRotation = (node: TransformNode): Quaternion => {
  node.computeWorldMatrix(true);
  return node.absoluteRotationQuaternion.clone();
};

const intoFrame = (node: TransformNode, world: Vector3): Vector3 =>
  world.applyRotationQuaternion(Quaternion.Inverse(worldRotation(node))).normalize();

/**
 * Measures a hand, which must be in its bind pose: call this straight after
 * loading, before any clip has moved it.
 *
 * @param bone finds a bone by its Mixamo name (`RightHand`, `RightHandIndex1`, …)
 */
export const measureHand = (bone: (name: string) => TransformNode | undefined, side: 'Right' | 'Left'): HandShape => {
  const need = (name: string): TransformNode => {
    const found = bone(name);
    if (!found) throw new Error(`character has no ${name} bone`);
    found.computeWorldMatrix(true);
    return found;
  };
  const hand = need(`${side}Hand`);
  const knuckle = need(`${side}HandMiddle1`);
  const thumbBase = need(`${side}HandThumb1`);
  const at = hand.getAbsolutePosition();

  const fingersWorld = knuckle.getAbsolutePosition().subtract(at).normalize();
  // Palms down in the T-pose: straight down, squared off against the fingers.
  const down = new Vector3(0, -1, 0);
  const palmWorld = down.subtract(fingersWorld.scale(Vector3.Dot(down, fingersWorld))).normalize();
  const thumbWorld = thumbBase.getAbsolutePosition().subtract(at).normalize();

  const curls: Curl[] = [];
  const bend = (name: string, towards: Vector3, angles: readonly number[]) => {
    const axisWorld = Vector3.Cross(towards, palmWorld).normalize();
    angles.forEach((angle, i) => {
      const joint = bone(`${side}Hand${name}${i + 1}`);
      if (!joint) return;
      joint.computeWorldMatrix(true);
      curls.push({
        bone: joint,
        rest: (joint.rotationQuaternion ?? Quaternion.Identity()).clone(),
        axis: intoFrame(joint, axisWorld),
        angle,
      });
    });
  };
  FINGERS.forEach((finger) => bend(finger, fingersWorld, FINGER_CURL));
  bend('Thumb', thumbWorld, THUMB_CURL);

  return {
    hand,
    knuckle,
    fingers: intoFrame(hand, fingersWorld),
    palm: intoFrame(hand, palmWorld),
    thumb: intoFrame(hand, thumbWorld),
    curls,
  };
};

/**
 * Closes the hand on a handle running along `handle` (world space, towards the
 * blade), and says where in the palm the handle sits.
 *
 * A hammer grip, the first grip every thrower learns: the handle lies
 * diagonally across the palm (`HANDLE_ACROSS_PALM`), the fingers closed round
 * it, the thumb along its side on the blade's end. Of all the ways the hand
 * could sit round the handle like that, it takes the one that bends the wrist
 * least off the forearm. Then every finger closes round it.
 *
 * Call after the arm has been posed, since the hand turns from where the
 * forearm left it.
 */
export const closeOnHandle = (shape: HandShape, forearm: TransformNode, handle: Vector3): Vector3 => {
  const { hand } = shape;
  forearm.computeWorldMatrix(true);
  hand.computeWorldMatrix(true);
  const along = handle.normalizeToNew();
  const reach = hand.getAbsolutePosition().subtract(forearm.getAbsolutePosition()).normalize();
  // The wrist-to-knuckles line at the grip's angle to the handle, turned about
  // the handle to lie as near the forearm's line as it can.
  let square = reach.subtract(along.scale(Vector3.Dot(reach, along)));
  if (square.lengthSquared() < 1e-8) square = Vector3.Cross(along, Vector3.Up());
  square.normalize();
  const fingers = along
    .scale(Math.cos(HANDLE_ACROSS_PALM))
    .add(square.scale(Math.sin(HANDLE_ACROSS_PALM)))
    .normalize();

  const facing = (sign: number): Quaternion => {
    const palm = Vector3.Cross(fingers, along).scale(sign).normalize();
    const first = shortestArc(shape.fingers, fingers);
    const second = shortestArc(shape.palm.applyRotationQuaternion(first), palm);
    return second.multiply(first);
  };
  // Whichever way round puts the thumb towards the blade.
  let turned = facing(1);
  if (Vector3.Dot(shape.thumb.applyRotationQuaternion(turned), along) < 0) turned = facing(-1);

  const parent = (hand.parent as TransformNode | null)?.absoluteRotationQuaternion ?? Quaternion.Identity();
  hand.rotationQuaternion = Quaternion.Inverse(parent).multiply(turned).normalize();
  hand.scaling.setAll(HAND_SCALE);
  for (const curl of shape.curls) {
    curl.bone.rotationQuaternion = curl.rest.multiply(Quaternion.RotationAxis(curl.axis, curl.angle));
  }
  hand.computeWorldMatrix(true);
  shape.knuckle.computeWorldMatrix(true);

  // The handle crosses the middle of the palm, in off it by about the
  // thickness of the curled fingers.
  const at = hand.getAbsolutePosition();
  const size = Vector3.Distance(at, shape.knuckle.getAbsolutePosition());
  const palm = shape.palm.applyRotationQuaternion(turned);
  return at.add(shape.fingers.applyRotationQuaternion(turned).scale(size * 0.6)).add(palm.scale(size * 0.35));
};

import type { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import { Quaternion, Vector3 } from '@babylonjs/core/Maths/math.vector';
import type { Vec3 } from '@pocketknives/core';
import { twoBoneIk } from '../math/twoBoneIk.js';

/**
 * Turns `node` so that `child`, which hangs from it, lies in the direction of
 * `target` — all in world space. The shortest turn that does it, so the bone
 * keeps as much of its own twist as it can.
 *
 * A bone's world rotation is its parent's with its own applied first
 * (`world = parent · local`, which is how Babylon composes them), so a turn
 * `q` in the world is a new local rotation of `parent⁻¹ · q · world`.
 */
export const aimBone = (node: TransformNode, child: TransformNode, target: Vector3): void => {
  node.computeWorldMatrix(true);
  child.computeWorldMatrix(true);
  const from = node.getAbsolutePosition();
  const now = child.getAbsolutePosition().subtract(from);
  const wanted = target.subtract(from);
  if (now.lengthSquared() < 1e-12 || wanted.lengthSquared() < 1e-12) return;
  const turn = shortestArc(now.normalize(), wanted.normalize());

  const world = node.absoluteRotationQuaternion.clone();
  const parent = node.parent ? (node.parent as TransformNode).absoluteRotationQuaternion ?? Quaternion.Identity() : Quaternion.Identity();
  const local = Quaternion.Inverse(parent).multiply(turn).multiply(world);
  node.rotationQuaternion = local.normalize();
  node.computeWorldMatrix(true);
  child.computeWorldMatrix(true);
};

/** The rotation carrying unit `a` onto unit `b` the short way round. */
export const shortestArc = (a: Vector3, b: Vector3): Quaternion => {
  const dot = Vector3.Dot(a, b);
  if (dot < -1 + 1e-9) {
    // Opposite: any axis square to `a` will do.
    const axis = Math.abs(a.x) < 0.9 ? Vector3.Cross(a, Vector3.Right()) : Vector3.Cross(a, Vector3.Up());
    return Quaternion.RotationAxis(axis.normalize(), Math.PI);
  }
  const axis = Vector3.Cross(a, b);
  return new Quaternion(axis.x, axis.y, axis.z, 1 + dot).normalize();
};

export type ArmBones = {
  readonly upper: TransformNode;
  readonly lower: TransformNode;
  readonly hand: TransformNode;
};

const asVec3 = (v: Vector3): Vec3 => [v.x, v.y, v.z];

/**
 * Reaches an arm's hand for `target` (world space), the elbow bending towards
 * `pole`: the same two-bone solve the drawn arms use, on the rig's own bone
 * lengths, then each bone turned to lie along its half.
 */
export const reachArm = (arm: ArmBones, target: Vector3, pole: Vector3): void => {
  [arm.upper, arm.lower, arm.hand].forEach((node) => node.computeWorldMatrix(true));
  const shoulder = arm.upper.getAbsolutePosition().clone();
  const upper = Vector3.Distance(shoulder, arm.lower.getAbsolutePosition());
  const lower = Vector3.Distance(arm.lower.getAbsolutePosition(), arm.hand.getAbsolutePosition());
  const solved = twoBoneIk(asVec3(shoulder), asVec3(target), upper, lower, asVec3(pole));
  aimBone(arm.upper, arm.lower, new Vector3(...solved.joint));
  aimBone(arm.lower, arm.hand, new Vector3(...solved.end));
};

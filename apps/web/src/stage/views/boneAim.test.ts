import { describe, expect, it } from 'vitest';
import { NullEngine } from '@babylonjs/core/Engines/nullEngine';
import { Scene } from '@babylonjs/core/scene';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import { Quaternion, Vector3 } from '@babylonjs/core/Maths/math.vector';
import { aimBone, reachArm } from './boneAim.js';

const chain = () => {
  const scene = new Scene(new NullEngine());
  const root = new TransformNode('root', scene);
  root.rotationQuaternion = Quaternion.RotationAxis(new Vector3(0.3, 1, 0.2).normalize(), 0.9);
  root.position.set(1, 2, 3);
  const upper = new TransformNode('upper', scene);
  upper.parent = root;
  upper.rotationQuaternion = Quaternion.RotationAxis(Vector3.Forward(), 0.4);
  const lower = new TransformNode('lower', scene);
  lower.parent = upper;
  lower.position.set(0, 0.3, 0);
  lower.rotationQuaternion = Quaternion.Identity();
  const hand = new TransformNode('hand', scene);
  hand.parent = lower;
  hand.position.set(0, 0.28, 0);
  return { upper, lower, hand };
};

describe('aimBone', () => {
  it('turns a bone so its child lies towards the target, however its parents are turned', () => {
    const { upper, lower } = chain();
    const target = new Vector3(4, -1, 2);
    aimBone(upper, lower, target);
    const from = upper.getAbsolutePosition();
    const pointing = lower.getAbsolutePosition().subtract(from).normalize();
    const wanted = target.subtract(from).normalize();
    expect(Vector3.Dot(pointing, wanted)).toBeCloseTo(1, 6);
  });
});

describe('reachArm', () => {
  it('puts the hand on a target within reach, the elbow bent towards the pole', () => {
    const arm = chain();
    arm.upper.computeWorldMatrix(true);
    const shoulder = arm.upper.getAbsolutePosition().clone();
    const target = shoulder.add(new Vector3(0.35, 0.1, 0.2));
    reachArm(arm, target, new Vector3(0, -1, 0));
    expect(Vector3.Distance(arm.hand.getAbsolutePosition(), target)).toBeLessThan(1e-4);
    const middle = shoulder.add(target).scale(0.5);
    expect(arm.lower.getAbsolutePosition().y).toBeLessThan(middle.y);
  });
});

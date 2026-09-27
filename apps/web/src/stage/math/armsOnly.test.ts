import { describe, expect, it } from 'vitest';
import { armsFirst, isArmBoneName, isArmJointBoneName } from './armsOnly.js';

// Bone 0 is the chest, bone 1 an arm. Vertices 0–2 ride the arm, 3–5 the chest,
// and vertex 6 is on the shoulder, mostly chest.
const influences = [1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0];
const weights = [1, 0, 0, 0, 0.9, 0.1, 0, 0, 0.7, 0.3, 0, 0, 0.8, 0.2, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 0.4, 0.6, 0, 0];
const isArm = (bone: number) => bone === 1;

describe('armsFirst', () => {
  it('puts the arm triangles first and counts them', () => {
    const body = [3, 4, 5];
    const arm = [0, 1, 2];
    const sorted = armsFirst([...body, ...arm], influences, weights, isArm);
    expect(sorted.arms).toBe(3);
    expect(sorted.indices).toEqual([...arm, ...body]);
  });

  it('leaves a triangle that reaches onto the shoulder with the body', () => {
    const sorted = armsFirst([0, 1, 6], influences, weights, isArm);
    expect(sorted.arms).toBe(0);
    expect(sorted.indices).toEqual([0, 1, 6]);
  });

  it('keeps every triangle, only reordered', () => {
    const all = [3, 4, 5, 0, 1, 2, 0, 1, 6];
    expect(armsFirst(all, influences, weights, isArm).indices.slice().sort()).toEqual(all.slice().sort());
  });
});

describe('isArmBoneName', () => {
  it('draws the whole arm, elbow and all, but not the shoulder or the rest', () => {
    for (const name of ['RightArm', 'LeftForeArm', 'RightHand', 'RightHandIndex2']) expect(isArmBoneName(name)).toBe(true);
    for (const name of ['RightShoulder', 'Spine2', 'Head', 'LeftUpLeg']) expect(isArmBoneName(name)).toBe(false);
  });
});

describe('isArmJointBoneName', () => {
  it('keeps the elbow ball and drops the shoulder ball', () => {
    expect(isArmJointBoneName('RightForeArm')).toBe(true);
    expect(isArmJointBoneName('LeftHand')).toBe(true);
    expect(isArmJointBoneName('RightArm')).toBe(false);
  });
});

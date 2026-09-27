import { describe, expect, it } from 'vitest';
import { NullEngine } from '@babylonjs/core/Engines/nullEngine';
import { Scene } from '@babylonjs/core/scene';
import { knifeById, type Vec3 } from '@pocketknives/core';
import { bodyPose, READY_SWING } from '../math/bodyPose.js';
import { bladeDirection } from '../math/coords.js';
import { createCharacterView } from './characterView.js';
import { readFileSync } from 'node:fs';


// The very file the game ships, handed to the loader as data.
const glb = readFileSync(new URL('../../../public/characters/xbot.glb', import.meta.url));
const source = `data:model/gltf-binary;base64,${glb.toString('base64')}`;

const loadCharacter = async () => {
  const scene = new Scene(new NullEngine());
  scene.useRightHandedSystem = true;
  const character = createCharacterView(scene, null, source);
  expect(await character.loaded).toBe(true);
  return { scene, character };
};

const knife = knifeById('thrower');
// Stood at the south, facing north.
const heading = Math.PI / 2;
const pose = bodyPose(
  { release: [0.2, -7.15, 1.4], heading, releaseBladeAngle: 0.8, spec: knife.spec, hands: 1, loft: 0, raised: 1 },
  READY_SWING,
);
const frame = { feet: [0, -8] as const, heading, speed: 0, backwards: false, pose, hands: 1 as const, color: '#c24d3f', visible: true };
const worldToGame = (p: { x: number; y: number; z: number }): Vec3 => [p.x, -p.z, p.y];

describe('the character', () => {
  it('stands where the thrower stands, head at eye height, facing the way they face', async () => {
    const { scene, character } = await loadCharacter();
    character.show(frame);
    const node = (name: string) => {
      const found = scene.transformNodes.find((t) => t.name === `mixamorig:${name}`)!;
      found.computeWorldMatrix(true);
      return worldToGame(found.getAbsolutePosition());
    };
    const head = node('Head');
    expect(head[2]).toBeGreaterThan(1.35);
    expect(head[2]).toBeLessThan(1.6);
    expect(Math.hypot(head[0] - 0, head[1] + 8)).toBeLessThan(0.2);
    // Facing north: its right side is to the east.
    expect(node('RightUpLeg')[0]).toBeGreaterThan(node('LeftUpLeg')[0]);
  });

  it('reaches its throwing hand out where the drawn hand is, right of the body and in front', async () => {
    const { scene, character } = await loadCharacter();
    const grip = character.show(frame)!;
    const wrist = scene.transformNodes.find((t) => t.name === 'mixamorig:RightHand')!;
    wrist.computeWorldMatrix(true);
    expect(grip[1]).toBeGreaterThan(-8 + 0.2); // in front
    expect(grip[2]).toBeGreaterThan(0.9); // up, not hanging
    expect(worldToGame(wrist.getAbsolutePosition())[0]).toBeGreaterThan(0); // on the throwing side
  });

  it('closes its hand round the handle: fingers across it, thumb on the blade side, the grip in the palm', async () => {
    const { scene, character } = await loadCharacter();
    const grip = character.show(frame)!;
    const at = (name: string): Vec3 => {
      const found = scene.transformNodes.find((t) => t.name === `mixamorig:${name}`)!;
      found.computeWorldMatrix(true);
      return worldToGame(found.getAbsolutePosition());
    };
    const minus = (a: Vec3, b: Vec3): Vec3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
    const dot = (a: Vec3, b: Vec3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
    const unit = (a: Vec3): Vec3 => {
      const l = Math.hypot(...a);
      return [a[0] / l, a[1] / l, a[2] / l];
    };
    const along = bladeDirection(heading, pose.bladeAngle);
    const hand = at('RightHand');

    expect(Math.abs(dot(unit(minus(at('RightHandMiddle1'), hand)), along))).toBeLessThan(0.05);
    expect(dot(minus(at('RightHandThumb1'), hand), along)).toBeGreaterThan(0);
    expect(Math.hypot(...minus(grip, hand))).toBeLessThan(0.15);

    // Every fingertip comes back round close to the handle's line: curled, not splayed.
    const offLine = (p: Vec3) => {
      const d = minus(p, grip);
      const lengthwise = dot(d, along);
      return Math.hypot(d[0] - along[0] * lengthwise, d[1] - along[1] * lengthwise, d[2] - along[2] * lengthwise);
    };
    for (const finger of ['Index', 'Middle', 'Ring', 'Pinky']) {
      expect(offLine(at(`RightHand${finger}4`)), finger).toBeLessThan(offLine(at(`RightHand${finger}1`)) + 0.01);
      expect(offLine(at(`RightHand${finger}4`)), finger).toBeLessThan(0.07);
    }
  });

  it('holds a two-handed weapon with both hands on the handle', async () => {
    const { scene, character } = await loadCharacter();
    const sword = knifeById('greatsword');
    const both = bodyPose(
      { release: [0.2, -7.15, 1.4], heading, releaseBladeAngle: 0.8, spec: sword.spec, hands: 2, loft: 0, raised: 1 },
      READY_SWING,
    );
    const grip = character.show({ ...frame, pose: both, hands: 2 })!;
    const left = scene.transformNodes.find((t) => t.name === 'mixamorig:LeftHand')!;
    left.computeWorldMatrix(true);
    const along = bladeDirection(heading, both.bladeAngle);
    const d = worldToGame(left.getAbsolutePosition());
    const off = [d[0] - grip[0], d[1] - grip[1], d[2] - grip[2]] as Vec3;
    const lengthwise = off[0] * along[0] + off[1] * along[1] + off[2] * along[2];
    // Up the handle from the throwing hand, towards the blade, and close in to it.
    const right = scene.transformNodes.find((t) => t.name === 'mixamorig:RightHand')!;
    right.computeWorldMatrix(true);
    const r = worldToGame(right.getAbsolutePosition());
    const rightwise = (r[0] - grip[0]) * along[0] + (r[1] - grip[1]) * along[1] + (r[2] - grip[2]) * along[2];
    expect(lengthwise).toBeGreaterThan(rightwise + 0.05);
    expect(Math.hypot(off[0] - along[0] * lengthwise, off[1] - along[1] * lengthwise, off[2] - along[2] * lengthwise)).toBeLessThan(0.15);
  });

  it('hides when asked, and says so', async () => {
    const { character } = await loadCharacter();
    expect(character.show({ ...frame, visible: false })).toBeNull();
  });
});

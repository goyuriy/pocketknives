import { describe, expect, it } from 'vitest';
import { NullEngine } from '@babylonjs/core/Engines/nullEngine';
import { Scene } from '@babylonjs/core/scene';
import { knifeById, type Vec3 } from '@pocketknives/core';
import { bodyPose, READY_SWING } from '../math/bodyPose.js';
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
    const { character } = await loadCharacter();
    const hand = character.show(frame)!;
    expect(hand[1]).toBeGreaterThan(-8 + 0.2); // in front
    expect(hand[0]).toBeGreaterThan(0); // on the throwing side
    expect(hand[2]).toBeGreaterThan(0.9); // up, not hanging
  });

  it('hides when asked, and says so', async () => {
    const { character } = await loadCharacter();
    expect(character.show({ ...frame, visible: false })).toBeNull();
  });
});

import { describe, expect, it } from 'vitest';
import type { Vec3 } from '@pocketknives/core';
import { alignUp, bladeDirection, bladeQuaternion, rotate, toWorld } from './coords.js';

const close = (a: Vec3, b: Vec3) => a.forEach((value, i) => expect(value).toBeCloseTo(b[i]!, 9));

describe('bladeQuaternion', () => {
  it('points the model’s nose where the blade points', () => {
    for (const heading of [0, 0.7, Math.PI / 2, -2.4]) {
      for (const bladeAngle of [0, 0.8, -1.2, 3]) {
        close(rotate(bladeQuaternion(heading, bladeAngle), [1, 0, 0]), bladeDirection(heading, bladeAngle));
      }
    }
  });

  it('keeps the blade’s flat facing across the throw, so it tumbles edge-on to the camera behind', () => {
    // The knife's thickness runs along its local y. Whatever the tumble, that
    // must stay horizontal and square to the heading.
    const side = rotate(bladeQuaternion(Math.PI / 2, 1.1), [0, 1, 0]);
    close(side, [-1, 0, 0]);
  });
});

describe('alignUp', () => {
  it('stands a +y cylinder along any direction', () => {
    const directions: Vec3[] = [[1, 0, 0], [0, 0, 1], [0.3, -0.5, 0.8], [0, -1, 0], [0, 1, 0]];
    for (const d of directions) {
      const length = Math.hypot(...d);
      close(rotate(alignUp(d), [0, 1, 0]), [d[0] / length, d[1] / length, d[2] / length]);
    }
  });
});

describe('toWorld', () => {
  it('stands the rules’ sky up as the engine’s', () => {
    expect(toWorld([0, 0, 5])).toEqual([0, 5, -0]);
    expect(toWorld([3, 4, 0])).toEqual([3, 0, -4]);
  });
});

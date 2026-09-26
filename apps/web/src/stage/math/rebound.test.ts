import { describe, expect, it } from 'vitest';
import { simulateFlight, standingPoint, swingLaunch } from '@pocketknives/core';
import { rebound } from './rebound.js';
import { bladeQuaternion, compose, axisAngle, rotate } from './coords.js';

const heading = Math.PI / 3;
const flight = simulateFlight(
  swingLaunch(standingPoint(heading + Math.PI, 10), heading, { aim: 0, pitch: 0.35, draw: 0.6, drift: 0 }),
);

describe('rebound', () => {
  it('skids on along the line it was thrown, and pops up off the ground', () => {
    const { linear } = rebound(flight);
    const along = Math.atan2(linear[1], linear[0]);
    expect(along).toBeCloseTo(heading, 9);
    expect(linear[2]).toBeGreaterThan(0);
  });

  it('keeps tumbling forward — the same way it turned in the air', () => {
    // Turn the knife a little by the rebound's spin and check its blade angle fell.
    const { angular } = rebound(flight);
    const rate = Math.hypot(...angular);
    const axis = angular.map((v) => v / rate) as [number, number, number];
    const before = bladeQuaternion(heading, 0);
    const after = compose(axisAngle(axis, 0.1), before);
    const nose = rotate(after, [1, 0, 0]);
    expect(nose[2]).toBeLessThan(0); // tip went down: forward tumble
  });
});

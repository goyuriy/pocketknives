import { describe, expect, it } from 'vitest';
import { KNIVES, knifeById, type Vec3 } from '@pocketknives/core';
import {
  bodyPose,
  eyeAt,
  EYE_HEIGHT,
  gripOffset,
  READY_SWING,
  releasePointFor,
  STEP_LENGTH,
  strideAfter,
  swingForDraw,
  type BodySetup,
} from './bodyPose.js';
import { bladeDirection } from './coords.js';

const setup = (id: string, heading = Math.PI / 2): BodySetup => {
  const knife = knifeById(id);
  return { release: [0, -12, 1.4], heading, releaseBladeAngle: 0.8, spec: knife.spec, hands: knife.hands, loft: 0, raised: 1 };
};

const distance = (a: Vec3, b: Vec3) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);

describe('bodyPose', () => {
  it('hands the knife to the flight exactly where and how it begins', () => {
    // Any gap here is a visible jump the instant the knife leaves the hand.
    for (const knife of KNIVES) {
      const pose = bodyPose(setup(knife.id), 0);
      expect(distance(pose.knifeAt, [0, -12, 1.4]), knife.id).toBeLessThan(1e-9);
      expect(pose.bladeAngle).toBeCloseTo(0.8, 9);
    }
  });

  it('holds the knife by its grip, with the hand actually there', () => {
    for (const swing of [-1, READY_SWING, 0, 0.5, 1]) {
      const pose = bodyPose(setup('thrower'), swing);
      const along = bladeDirection(Math.PI / 2, pose.bladeAngle);
      const grip = gripOffset(knifeById('thrower').spec);
      const expected: Vec3 = [
        pose.knifeAt[0] + along[0] * grip,
        pose.knifeAt[1] + along[1] * grip,
        pose.knifeAt[2] + along[2] * grip,
      ];
      // The arm must reach every keyframe, or the fist floats off the knife.
      expect(distance(pose.throwingArm.end, expected), `swing ${swing}`).toBeLessThan(1e-6);
    }
  });

  it('draws the knife up by the ear, and follows through down in front', () => {
    const held = bodyPose(setup('thrower'), READY_SWING);
    const back = bodyPose(setup('thrower'), -1);
    const through = bodyPose(setup('thrower'), 1);
    // Throwing north, so "back" is south.
    expect(back.throwingArm.end[1]).toBeLessThan(held.throwingArm.end[1]);
    expect(back.throwingArm.end[2]).toBeGreaterThan(held.throwingArm.end[2]);
    expect(through.throwingArm.end[2]).toBeLessThan(1.2); // down below the shoulder
  });

  it('throws over the top: the arm goes up over the head and comes down in front, never back past the chest', () => {
    const start = bodyPose(setup('thrower'), -1);
    const path = Array.from({ length: 21 }, (_, i) => bodyPose({ ...setup('thrower'), throwFrom: -1 }, -1 + i / 20));
    const heights = path.map((pose) => pose.throwingArm.end[2]);
    const release = bodyPose(setup('thrower'), 0).throwingArm.end[2];
    // Straight up over the head, near a full arm above the shoulder.
    expect(Math.max(...heights)).toBeGreaterThan(1.42 + 0.5);
    expect(Math.min(...heights)).toBeGreaterThan(Math.min(start.throwingArm.end[2], release) - 0.01);
    // It still ends exactly where the flight begins.
    expect(distance(path.at(-1)!.knifeAt, [0, -12, 1.4])).toBeLessThan(1e-9);
  });

  it('holds the knife standing up out of the top of the fist, leaning back over the shoulder', () => {
    const held = bodyPose(setup('thrower'), READY_SWING);
    expect(held.bladeAngle).toBeGreaterThan(Math.PI / 2);
    expect(held.bladeAngle).toBeLessThan(Math.PI / 2 + 0.5);
  });

  it('raises the hands and the pointing arm for a lob, and lowers them for a flat throw', () => {
    const lob = bodyPose({ ...setup('thrower'), loft: 0.4 }, READY_SWING);
    const flat = bodyPose({ ...setup('thrower'), loft: -0.25 }, READY_SWING);
    expect(lob.throwingArm.end[2]).toBeGreaterThan(flat.throwingArm.end[2]);
    expect(lob.pointTilt - flat.pointTilt).toBeCloseTo(0.65, 9);
    expect(lob.otherArm.end[2]).toBeGreaterThan(flat.otherArm.end[2]);
  });

  it('keeps the knife standing up out of the fist when the throw is aimed straight down', () => {
    // Straight down is a loft of about −1.9 from the resting angle the poses are drawn for.
    const down = bodyPose({ ...setup('thrower'), loft: -1.9 }, READY_SWING);
    const drawn = bodyPose({ ...setup('thrower'), loft: -1.9 }, -1);
    expect(down.bladeAngle).toBeGreaterThan(0.3);
    expect(drawn.bladeAngle).toBeGreaterThan(0.3);
  });

  it('leaves the release where the flight begins, however steep the throw', () => {
    const lob = bodyPose({ ...setup('thrower'), loft: 0.45 }, 0);
    expect(distance(lob.knifeAt, [0, -12, 1.4])).toBeLessThan(1e-9);
  });

  it('points the other hand out along the throw, angled in towards its line', () => {
    const heading = Math.PI / 2 - 0.4;
    const aiming = bodyPose(setup('thrower', heading), READY_SWING);
    const reach = Math.atan2(
      aiming.otherArm.end[1] - aiming.otherArm.root[1],
      aiming.otherArm.end[0] - aiming.otherArm.root[0],
    );
    // The left arm points a little to the right of straight ahead — in, at the line.
    expect(reach).toBeLessThan(heading);
    expect(reach).toBeGreaterThan(heading - 0.2);
    expect(aiming.pointHeading).toBeCloseTo(reach, 6);
    expect(aiming.pointing).toBe(true);
  });

  it('lets the free arm hang at the side until the button is held', () => {
    const idle = bodyPose({ ...setup('thrower'), raised: 0 }, READY_SWING);
    const gripped = bodyPose({ ...setup('thrower'), raised: 1 }, READY_SWING);
    expect(idle.pointing).toBe(false);
    expect(gripped.pointing).toBe(true);
    // Down by the hip, well under the shoulder; raised, it is up at shoulder height.
    expect(idle.otherArm.end[2]).toBeLessThan(idle.otherArm.root[2] - 0.5);
    expect(gripped.otherArm.end[2]).toBeGreaterThan(gripped.otherArm.root[2]);
  });

  it('tucks the pointing hand in once the throw follows through', () => {
    expect(bodyPose(setup('thrower'), 1).pointing).toBe(false);
  });

  it('bends the elbows down, not up', () => {
    const pose = bodyPose(setup('thrower'), READY_SWING);
    const midway = (pose.throwingArm.root[2] + pose.throwingArm.end[2]) / 2;
    expect(pose.throwingArm.joint[2]).toBeLessThan(midway);
  });

  it('puts both hands on a sword’s grip instead of pointing', () => {
    const pose = bodyPose(setup('greatsword'), 0);
    expect(pose.pointing).toBe(false);
    expect(distance(pose.throwingArm.end, pose.otherArm.end)).toBeGreaterThan(0.05);
    expect(distance(pose.throwingArm.end, pose.otherArm.end)).toBeLessThan(0.2);
  });

  it('puts the eye at eye height, behind the release', () => {
    const eye = eyeAt([0, -12, 1.4], Math.PI / 2);
    expect(eye[2]).toBe(EYE_HEIGHT);
    expect(eye[1]).toBeLessThan(-12);
  });
});

describe('the rest of the body', () => {
  const standing = bodyPose(setup('thrower'), READY_SWING).figure;
  const feet = eyeAt([0, -12, 1.4], Math.PI / 2);

  it('stands on the ground under the eye, head where the eyes are', () => {
    for (const leg of [standing.throwingLeg, standing.otherLeg]) {
      expect(leg.end[2]).toBeGreaterThan(0);
      expect(leg.end[2]).toBeLessThan(0.1);
    }
    expect(standing.hips[2]).toBeLessThan(standing.neck[2]);
    expect(standing.head[2]).toBeCloseTo(EYE_HEIGHT, 9);
    expect(Math.hypot(standing.hips[0] - feet[0], standing.hips[1] - feet[1])).toBeLessThan(0.05);
  });

  it('stands like a thrower: the free foot forward, the throwing foot back', () => {
    // Throwing north: forward is +y, and the throwing side is the right, +x.
    expect(standing.otherLeg.end[1]).toBeGreaterThan(standing.throwingLeg.end[1]);
    expect(standing.throwingLeg.end[0]).toBeGreaterThan(standing.otherLeg.end[0]);
  });

  it('bends the knees forward', () => {
    for (const leg of [standing.throwingLeg, standing.otherLeg]) {
      const midway = (leg.root[1] + leg.end[1]) / 2;
      expect(leg.joint[1]).toBeGreaterThan(midway);
    }
  });

  it('walks by swinging the feet in turn along the way it is going, lifting the one coming forward', () => {
    const walking = (phase: number) =>
      bodyPose({ ...setup('thrower'), stride: { phase, amount: 1, along: [1, 0] } }, READY_SWING).figure;
    const mid = walking(Math.PI / 2);
    // Free foot out in front, throwing foot behind, half a step later the other way round.
    expect(mid.otherLeg.end[1]).toBeGreaterThan(standing.otherLeg.end[1] + 0.2);
    expect(mid.throwingLeg.end[1]).toBeLessThan(standing.throwingLeg.end[1] - 0.2);
    const later = walking(Math.PI / 2 + Math.PI);
    expect(later.otherLeg.end[1]).toBeLessThan(standing.otherLeg.end[1] - 0.2);
    // The foot on its way forward is off the ground; the one pushing back is on it.
    const passing = walking(0);
    expect(passing.otherLeg.end[2]).toBeGreaterThan(passing.throwingLeg.end[2] + 0.05);
  });

  it('sidesteps with the feet swinging sideways', () => {
    const side = bodyPose({ ...setup('thrower'), stride: { phase: Math.PI / 2, amount: 1, along: [0, 1] } }, READY_SWING).figure;
    expect(side.otherLeg.end[0]).toBeGreaterThan(standing.otherLeg.end[0] + 0.2);
    expect(side.otherLeg.end[1]).toBeCloseTo(standing.otherLeg.end[1], 6);
  });

  it('takes a step every step length walked', () => {
    expect(strideAfter(0, STEP_LENGTH)).toBeCloseTo(Math.PI, 9);
  });

  it('leans back to draw and forward into the throw', () => {
    const back = bodyPose(setup('thrower'), -1).figure;
    const through = bodyPose(setup('thrower'), 1).figure;
    expect(through.neck[1]).toBeGreaterThan(back.neck[1] + 0.1);
  });
});

describe('swingForDraw', () => {
  it('rests when nothing is drawn, and is fully back at a full draw', () => {
    expect(swingForDraw(0)).toBe(READY_SWING);
    expect(swingForDraw(1)).toBe(-1);
    expect(swingForDraw(3)).toBe(-1);
  });

  it('lifts to the release pose as the hand comes up past the grip', () => {
    expect(swingForDraw(-1)).toBe(-0);
    expect(swingForDraw(-0.05)).toBeGreaterThan(READY_SWING);
  });
});

describe('releasePointFor', () => {
  it('puts the release out in front of the feet, and brings the eye back over them', () => {
    const feet: [number, number] = [2, -8];
    const heading = 1.2;
    const [x, y] = releasePointFor(feet, heading);
    const eye = eyeAt([x, y, 1.4], heading);
    // The eye sits right above the feet — the round trip closes.
    expect(eye[0]).toBeCloseTo(feet[0], 9);
    expect(eye[1]).toBeCloseTo(feet[1], 9);
    // And the release is ahead of them along the heading.
    expect((x - feet[0]) * Math.cos(heading) + (y - feet[1]) * Math.sin(heading)).toBeGreaterThan(0.5);
  });
});

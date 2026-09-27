import { describe, expect, it } from 'vitest';
import {
  CAMERA_VIEWS,
  cameraPose,
  easeHeading,
  EYE_LOCK_DISTANCE,
  eyeDip,
  eyeLocks,
  fieldOfView,
  isCameraView,
} from './cameraPose.js';
import { EYE_HEIGHT } from './bodyPose.js';

describe('cameraPose', () => {
  it('looks out from right above the feet, a little down, the way the hand points', () => {
    // Stood in the south, pointing a little right of north.
    const pose = cameraPose([0, -8], false, 10, Math.PI / 2 - 0.4);
    expect(pose.eye).toEqual([0, -8, EYE_HEIGHT]);
    expect(pose.focus[0]).toBeGreaterThan(pose.eye[0]); // pointing right, looking right
    expect(pose.focus[2]).toBeLessThan(pose.eye[2]);
  });

  it('watches from behind and above when asked, looking out the way the thrower faces', () => {
    const pose = cameraPose([0, -8], false, 10, Math.PI / 2, undefined, 'behind');
    expect(pose.eye[1]).toBeLessThan(-10); // behind, to the south
    expect(pose.eye[2]).toBeGreaterThan(EYE_HEIGHT); // over the head
    expect(pose.focus[1]).toBeGreaterThan(-8); // at the ground ahead
  });

  it('holds each debug view on the thrower, through a throw too, and never inside them', () => {
    const feet: [number, number] = [0, -8];
    const hand: [number, number, number] = [0.2, -7.5, 1.4];
    for (const view of CAMERA_VIEWS.filter((v) => v !== 'eyes' && v !== 'arena')) {
      const pose = cameraPose(feet, true, 10, Math.PI / 2, undefined, view, hand);
      // Looks at the thrower (or their hand), not the circle's middle.
      const subject: readonly number[] = view === 'hand' ? hand : [feet[0], feet[1], pose.focus[2]];
      expect(Math.hypot(pose.focus[0] - subject[0]!, pose.focus[1] - subject[1]!), view).toBeLessThan(2.1);
      // From outside the body.
      expect(Math.hypot(pose.eye[0] - feet[0], pose.eye[1] - feet[1], pose.eye[2] - 1) > 0.4, view).toBe(true);
    }
    expect(cameraPose(feet, false, 10, Math.PI / 2, undefined, 'side').eye[0]).toBeGreaterThan(2); // the throwing side, east
    expect(cameraPose(feet, false, 10, Math.PI / 2, undefined, 'front').eye[1]).toBeGreaterThan(-6); // ahead, north
    expect(cameraPose(feet, false, 10, Math.PI / 2, undefined, 'arena')).toEqual(cameraPose(feet, true, 10, Math.PI / 2));
    expect(isCameraView('side')).toBe(true);
    expect(isCameraView('sideways')).toBe(false);
  });

  it('lifts over the circle once the knife has landed', () => {
    const pose = cameraPose([0, -8], true, 10, Math.PI / 2);
    expect(pose.eye[2]).toBeGreaterThan(20);
    expect(pose.focus).toEqual([0, 0, 0]);
  });
});

describe('easeHeading', () => {
  it('goes the short way round', () => {
    const next = easeHeading(3.1, -3.1, 5, 0.1);
    expect(next).toBeGreaterThan(3.1);
  });

  it('arrives in the end', () => {
    expect(easeHeading(0, 1, 5, 10)).toBeCloseTo(1, 6);
  });
});

describe('eyeLocks', () => {
  it('locks the eye to the head at eye level, so walking never leaves the hands behind', () => {
    expect(eyeLocks(false, 0.05)).toBe(true);
  });

  it('eases the big moves — overhead, and on the way back down', () => {
    expect(eyeLocks(true, 0.05)).toBe(false);
    expect(eyeLocks(false, EYE_LOCK_DISTANCE * 5)).toBe(false);
  });
});

describe('fieldOfView', () => {
  it('holds the angle up the screen on a wide screen', () => {
    expect(fieldOfView(16 / 9).held).toBe('vertical');
    expect(fieldOfView(1).held).toBe('vertical');
  });

  it('holds the angle across on a phone held upright, so both hands and the circle fit', () => {
    const phone = fieldOfView(375 / 700);
    expect(phone.held).toBe('horizontal');
    expect((phone.radians * 180) / Math.PI).toBeCloseTo(64, 6);
  });
});

describe('eyeDip', () => {
  it('looks further down on a tall screen, so the extra height is ground, not sky', () => {
    expect(eyeDip(375 / 650)).toBeGreaterThan(eyeDip(16 / 9));
    expect(eyeDip(16 / 9)).toBe(eyeDip(1));
  });

  it('looks further down the further down the throw is aimed', () => {
    expect(eyeDip(16 / 9, -Math.PI / 2)).toBeGreaterThan(eyeDip(16 / 9, -0.75));
    expect(eyeDip(16 / 9, -0.75)).toBeGreaterThan(eyeDip(16 / 9, 0.6));
    expect(eyeDip(16 / 9, 0.8)).toBeGreaterThan(0);
  });
});

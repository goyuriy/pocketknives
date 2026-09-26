import { describe, expect, it } from 'vitest';
import { cameraPose, easeHeading, EYE_LOCK_DISTANCE, eyeDip, eyeLocks, fieldOfView } from './cameraPose.js';
import { EYE_HEIGHT } from './bodyPose.js';

describe('cameraPose', () => {
  it('looks out from right above the feet, a little down, the way the hand points', () => {
    // Stood in the south, pointing a little right of north.
    const pose = cameraPose([0, -8], false, 10, Math.PI / 2 - 0.4);
    expect(pose.eye).toEqual([0, -8, EYE_HEIGHT]);
    expect(pose.focus[0]).toBeGreaterThan(pose.eye[0]); // pointing right, looking right
    expect(pose.focus[2]).toBeLessThan(pose.eye[2]);
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
    expect((phone.radians * 180) / Math.PI).toBeCloseTo(56, 6);
  });
});

describe('eyeDip', () => {
  it('looks further down on a tall screen, so the extra height is ground, not sky', () => {
    expect(eyeDip(375 / 650)).toBeGreaterThan(eyeDip(16 / 9));
    expect(eyeDip(16 / 9)).toBe(eyeDip(1));
  });
});

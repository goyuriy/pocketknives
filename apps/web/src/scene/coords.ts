import type { Vec2, Vec3 } from '@pocketknives/core';

/**
 * The rules describe a flat world with `z` pointing at the sky. Three.js expects
 * `y` to point at the sky. Rather than translate at every call site, the whole
 * playfield lives inside one group carrying `PLAYFIELD_TILT`, which stands the
 * rules' ground plane up into Three's world.
 *
 * Everything drawn inside that group is authored in game coordinates, unchanged.
 * The only things needing conversion are those that live outside it — chiefly
 * the camera — and `toWorld` is for them.
 */
export const PLAYFIELD_TILT: [number, number, number] = [-Math.PI / 2, 0, 0];

/** Game coordinates to Three's world coordinates: the same tilt, applied by hand. */
export const toWorld = ([x, y, z]: Vec3): [number, number, number] => [x, z, -y];

export const onGround = ([x, y]: Vec2, height = 0): Vec3 => [x, y, height];

/**
 * The knife's orientation, given where it is pointing.
 *
 * A thrown knife turns in one plane — the vertical plane it was thrown along —
 * so two angles place it completely. `heading` swings that plane around the
 * compass, `bladeAngle` is how far through its tumble the knife has turned
 * within it. Applied in `ZYX` order, the model's nose starts along `+x`, tips up
 * by the tumble, then swings onto the throwing line.
 */
export const bladeRotation = (
  heading: number,
  bladeAngle: number,
): [number, number, number, 'ZYX'] => [0, -bladeAngle, heading, 'ZYX'];

/** Unit vector the blade points along, in game coordinates. */
export const bladeDirection = (heading: number, bladeAngle: number): Vec3 => [
  Math.cos(heading) * Math.cos(bladeAngle),
  Math.sin(heading) * Math.cos(bladeAngle),
  Math.sin(bladeAngle),
];

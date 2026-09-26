import type { Vec3 } from '@pocketknives/core';

/**
 * The rules describe a flat world with `z` pointing at the sky; the engine
 * expects `y` to. Rather than translate at every call site, the whole playfield
 * lives under one node carrying `PLAYFIELD_TILT`, which stands the rules' ground
 * plane up into the engine's world.
 *
 * Everything under that node is authored in game coordinates, unchanged. The
 * only things needing conversion are those outside it — chiefly the camera —
 * and `toWorld` is for them. The stage runs the engine right-handed, so this is
 * a plain rotation and not a mirror.
 */
export const PLAYFIELD_TILT = -Math.PI / 2;

/** Game coordinates to world coordinates: the same tilt, applied by hand. */
export const toWorld = ([x, y, z]: Vec3): Vec3 => [x, z, -y];

/** A rotation as `[x, y, z, w]`, the component order every engine accepts. */
export type Quat = readonly [number, number, number, number];

export const IDENTITY: Quat = [0, 0, 0, 1];

export const axisAngle = ([ax, ay, az]: Vec3, angle: number): Quat => {
  const s = Math.sin(angle / 2);
  return [ax * s, ay * s, az * s, Math.cos(angle / 2)];
};

/** `a` then applied after `b`: rotating by the result is rotating by `b`, then by `a`. */
export const compose = ([ax, ay, az, aw]: Quat, [bx, by, bz, bw]: Quat): Quat => [
  aw * bx + ax * bw + ay * bz - az * by,
  aw * by - ax * bz + ay * bw + az * bx,
  aw * bz + ax * by - ay * bx + az * bw,
  aw * bw - ax * bx - ay * by - az * bz,
];

export const rotate = (q: Quat, [vx, vy, vz]: Vec3): Vec3 => {
  const [x, y, z, w] = q;
  // v + 2w(q×v) + 2q×(q×v), the standard expansion of q·v·q⁻¹.
  const tx = 2 * (y * vz - z * vy);
  const ty = 2 * (z * vx - x * vz);
  const tz = 2 * (x * vy - y * vx);
  return [
    vx + w * tx + (y * tz - z * ty),
    vy + w * ty + (z * tx - x * tz),
    vz + w * tz + (x * ty - y * tx),
  ];
};

/**
 * The knife's orientation, given where it is pointing.
 *
 * A thrown knife turns in one plane — the vertical plane it was thrown along —
 * so two angles place it completely. The model's nose starts along `+x`; it is
 * tipped up by the tumble, then swung onto the throwing line by the heading.
 */
export const bladeQuaternion = (heading: number, bladeAngle: number): Quat =>
  compose(axisAngle([0, 0, 1], heading), axisAngle([0, 1, 0], -bladeAngle));

/** Unit vector the blade points along, in game coordinates. */
export const bladeDirection = (heading: number, bladeAngle: number): Vec3 => [
  Math.cos(heading) * Math.cos(bladeAngle),
  Math.sin(heading) * Math.cos(bladeAngle),
  Math.sin(bladeAngle),
];

/**
 * The rotation carrying `+y` onto `direction` by the shortest arc.
 *
 * Cylinders and capsules are built standing along `+y`; this is what lays one
 * between two points.
 */
export const alignUp = (direction: Vec3): Quat => {
  const length = Math.hypot(...direction);
  if (length < 1e-9) return IDENTITY;
  const [dx, dy, dz] = [direction[0] / length, direction[1] / length, direction[2] / length];
  // Half-way quaternion: axis y×d, angle between them.
  if (dy < -1 + 1e-9) return [1, 0, 0, 0];
  const w = 1 + dy;
  const norm = Math.hypot(dz, 0, -dx, w);
  return [dz / norm, 0, -dx / norm, w / norm];
};

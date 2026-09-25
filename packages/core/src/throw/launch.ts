import type { Vec2, Vec3 } from '../types.js';
import type { Launch } from './types.js';
import { DEFAULT_CONFIG, launchSpeed, spinRate, type ThrowConfig } from './config.js';
import { jitter, seededRandom } from './random.js';

/**
 * Turns an aim and a power into a knife in the air, at the knife's natural
 * tumble with no wrist correction.
 *
 * The raw physics, without the automatic wrist of `swingLaunch` — which makes
 * it the right tool for measuring what the knife and the ground do on their own.
 *
 * `seed` is what makes the scatter replayable. Record it alongside the aim and
 * the power and the throw can be reproduced exactly; omit it and the throw is
 * perfectly obedient, which is the right setting while tuning.
 */
export const aimedLaunch = (
  from: Vec2,
  heading: number,
  power: number,
  config: ThrowConfig = DEFAULT_CONFIG,
  seed?: number,
): Launch => {
  const { style } = config;
  const clean: Launch = {
    origin: [from[0], from[1], style.releaseHeight] as Vec3,
    heading,
    pitch: style.pitch,
    speed: launchSpeed(config, power),
    spin: spinRate(config),
    bladeAngle: style.startingBladeAngle,
  };

  return seed === undefined ? clean : scatterLaunch(clean, config, seed);
};

/**
 * Nudges a throw off what was aimed, reproducibly.
 *
 * Power is scattered as a fraction of the whole range rather than of the chosen
 * power, so a gentle throw is no more precise than a hard one — the hand is as
 * steady either way.
 */
export const scatterLaunch = (launch: Launch, config: ThrowConfig, seed: number): Launch => {
  const { scatter, style } = config;
  const next = seededRandom(seed);
  const speedRange = style.maxSpeed - style.minSpeed;

  return {
    ...launch,
    heading: launch.heading + jitter(next, scatter.heading),
    speed: Math.max(0, launch.speed + jitter(next, scatter.power * speedRange)),
    spin: launch.spin + jitter(next, scatter.spin),
    bladeAngle: launch.bladeAngle + jitter(next, scatter.startingBladeAngle),
  };
};

/**
 * Where a player stands to throw: outside the rim, on the bearing of their own
 * ground. Nobody is drawn there — the circle is what you watch — but the throw
 * has to start somewhere, and starting it from a player's own side is what makes
 * position matter.
 */
export const standingPoint = (bearing: number, arenaRadius: number, standOff = 2): Vec2 => [
  Math.cos(bearing) * (arenaRadius + standOff),
  Math.sin(bearing) * (arenaRadius + standOff),
];

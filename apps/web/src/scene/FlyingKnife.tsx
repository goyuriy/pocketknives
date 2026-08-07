import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import type { Group } from 'three';
import type { Flight, FlightSample, KnifeSpec } from '@pocketknives/core';
import { Knife } from './Knife.js';
import { bladeDirection, bladeRotation } from './coords.js';

/**
 * Reads the flight at a moment in time.
 *
 * Samples are dense, but the playback clock does not land on them, so this
 * interpolates. Blade angle is interpolated raw rather than wrapped: it climbs
 * without bound through the tumble, and that is exactly what makes it safe to
 * blend between two samples.
 */
const sampleAt = (flight: Flight, time: number): FlightSample => {
  const { samples } = flight;
  const last = samples[samples.length - 1]!;
  if (time >= last.time) return last;

  const step = samples[1]!.time - samples[0]!.time;
  const index = Math.min(Math.floor(time / step), samples.length - 2);
  const from = samples[index]!;
  const to = samples[index + 1]!;
  const t = Math.min(1, Math.max(0, (time - from.time) / (to.time - from.time)));

  return {
    time,
    position: [
      from.position[0] + (to.position[0] - from.position[0]) * t,
      from.position[1] + (to.position[1] - from.position[1]) * t,
      from.position[2] + (to.position[2] - from.position[2]) * t,
    ],
    bladeAngle: from.bladeAngle + (to.bladeAngle - from.bladeAngle) * t,
  };
};

/**
 * The knife in the air.
 *
 * Driven by a clock rather than by physics: the flight was solved the moment the
 * throw was released, so this only has to show it. Playback runs slower than
 * real time on purpose — the player is being asked to read the tumble, and at
 * true speed a knife turning twenty-four radians a second is a blur.
 */
export const FlyingKnife = ({
  flight,
  playbackScale,
  heading,
  spec,
}: {
  flight: Flight;
  playbackScale: number;
  heading: number;
  spec: KnifeSpec;
}) => {
  const group = useRef<Group>(null);
  const elapsed = useRef(0);

  useFrame((_, delta) => {
    if (!group.current) return;
    elapsed.current += delta * playbackScale;

    const sample = sampleAt(flight, elapsed.current);
    group.current.position.set(...sample.position);
    group.current.rotation.set(...bladeRotation(heading, sample.bladeAngle));
  });

  return (
    <group ref={group}>
      <Knife spec={spec} />
    </group>
  );
};

/**
 * A knife at rest in the ground, sunk along its own line.
 *
 * How deep it went is not decoration — it comes from the impact and the knife's
 * own mass and edge, so a heavy blade thrown hard is buried to the handle and a
 * light one thrown softly stands proud. Cleanliness of the strike shades it
 * further: a scrappy stick leans out of the dirt.
 */
export const StuckKnife = ({
  flight,
  quality,
  depth: bite,
  spec,
}: {
  flight: Flight;
  quality: number;
  depth: number;
  spec: KnifeSpec;
}) => {
  const { impact } = flight;
  const along = bladeDirection(impact.heading, impact.bladeAngle);
  const depth = bite * (0.5 + 0.5 * quality);

  return (
    <group
      position={[
        impact.point[0] - along[0] * depth,
        impact.point[1] - along[1] * depth,
        -along[2] * depth,
      ]}
      rotation={bladeRotation(impact.heading, impact.bladeAngle)}
    >
      <Knife spec={spec} />
    </group>
  );
};

/**
 * A knife that failed, lying flat where it skidded to a stop.
 *
 * Thrown down along its heading past the point of impact, because that is where
 * a blade that landed on its side ends up — and seeing it lie there, rather than
 * simply vanish, is what tells the player the throw was wrong rather than the
 * aim.
 */
export const FallenKnife = ({ flight, spec }: { flight: Flight; spec: KnifeSpec }) => {
  const { impact } = flight;
  const skid = 0.9;

  return (
    <group
      position={[
        impact.point[0] + Math.cos(impact.heading) * skid,
        impact.point[1] + Math.sin(impact.heading) * skid,
        0.03,
      ]}
      rotation={bladeRotation(impact.heading, 0)}
    >
      <Knife spec={spec} dimmed />
    </group>
  );
};

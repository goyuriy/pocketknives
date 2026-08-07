import { useMemo } from 'react';
import { DoubleSide } from 'three';
import type { Flight, KnifeSpec } from '@pocketknives/core';
import { Knife } from './Knife.js';
import { bladeRotation } from './coords.js';

/**
 * The arc the knife will follow, and where it will come down.
 *
 * The arc is shown; whether the knife will *stick* is not. That line is drawn
 * deliberately. Where it lands is a matter of aim, and hiding it would just be
 * unfair — but whether it arrives blade-first is the skill the game is about,
 * and handing that over would leave nothing to learn.
 */
export const AimPreview = ({ flight, color }: { flight: Flight; color: string }) => {
  const beads = useMemo(() => {
    const { samples } = flight;
    const count = 14;
    return Array.from({ length: count }, (_, i) => {
      const sample = samples[Math.floor(((i + 1) / (count + 1)) * (samples.length - 1))]!;
      return { position: sample.position, fade: 0.85 - (i / count) * 0.5 };
    });
  }, [flight]);

  return (
    <group>
      {beads.map((bead, i) => (
        <mesh key={i} position={[...bead.position]}>
          <sphereGeometry args={[0.075, 8, 8]} />
          <meshBasicMaterial color={color} transparent opacity={bead.fade} />
        </mesh>
      ))}

      <mesh position={[flight.impact.point[0], flight.impact.point[1], 0.05]}>
        <ringGeometry args={[0.34, 0.46, 28]} />
        <meshBasicMaterial color={color} transparent opacity={0.9} side={DoubleSide} />
      </mesh>
    </group>
  );
};

/**
 * The knife waiting in the hand.
 *
 * Held at exactly the angle the throw begins from, so the knife carries on
 * turning from where it was rather than snapping to a new pose the instant it
 * leaves. The pace of the swing is shown on the meter; it does not need saying
 * twice, and saying it here cost a visible jump at release.
 */
export const HeldKnife = ({
  at,
  heading,
  bladeAngle,
  spec,
}: {
  at: readonly [number, number, number];
  heading: number;
  bladeAngle: number;
  spec: KnifeSpec;
}) => (
  <group position={[...at]} rotation={bladeRotation(heading, bladeAngle)}>
    <Knife spec={spec} />
  </group>
);

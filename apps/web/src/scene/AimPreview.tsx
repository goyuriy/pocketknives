import { useMemo } from 'react';
import { DoubleSide } from 'three';
import type { Flight } from '@pocketknives/core';

/**
 * The arc the knife will follow, and where it will come down.
 *
 * Drawn from the throw the hand is making, without the wobble it is about to
 * add. It shows what the player is aiming at, which is theirs to know; whether
 * their hand stays steady enough to stick it there is not.
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

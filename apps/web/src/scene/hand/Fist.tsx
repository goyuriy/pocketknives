import { forwardRef } from 'react';
import { RoundedBox } from '@react-three/drei';
import type { Group } from 'three';

export const SKIN = '#e9b48c';

/**
 * A closed fist, built to sit around a handle running along its local `+x`.
 *
 * Chunky on purpose. The camera watches from well behind the thrower, and at
 * that distance a hand of true size is a few pixels — the player has to be able
 * to see their own hand, or there is nothing on screen they are controlling.
 */
export const Fist = forwardRef<Group>((_, ref) => (
  <group ref={ref}>
    <group scale={1.35}>
      <RoundedBox args={[0.2, 0.17, 0.2]} radius={0.06} smoothness={3} castShadow>
        <meshStandardMaterial color={SKIN} roughness={0.7} />
      </RoundedBox>
      {/* The thumb, laid along the handle over the fingers. */}
      <mesh position={[0.04, 0.095, 0.03]} rotation={[0, 0, Math.PI / 2]} castShadow>
        <capsuleGeometry args={[0.036, 0.08, 4, 8]} />
        <meshStandardMaterial color={SKIN} roughness={0.7} />
      </mesh>
    </group>
  </group>
));
Fist.displayName = 'Fist';

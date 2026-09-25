import { useMemo, useRef, type MutableRefObject } from 'react';
import { useFrame } from '@react-three/fiber';
import type { Group, Mesh } from 'three';
import type { Vec3 } from '@pocketknives/core';
import { Knife } from '../Knife.js';
import { bladeRotation } from '../coords.js';
import { Fist } from './Fist.js';
import { Limb, span } from './Limb.js';
import { armPose, READY_SWING, type ArmSetup } from './armPose.js';

/** How briskly the arm answers the finger, and how briskly it follows through. */
const TRACKING_RATE = 20;
const FOLLOW_THROUGH_RATE = 11;
const RECOVERY_RATE = 5;

/**
 * The player's hand — or both of them, for a sword.
 *
 * This is what the player controls. The finger never touches the knife: it moves
 * the arm, and the arm lets go. Drawing the finger down pulls the arm back,
 * flicking it up swings it forward, and on release the arm carries through while
 * the knife flies on without it.
 *
 * The swing position arrives through a ref rather than a prop. It changes on
 * every pointer move, and routing that through React state would re-render the
 * scene at the pointer's rate; the arm reads it once a frame instead, and eases
 * towards it so a sparse stream of events still draws a smooth arm.
 */
export const ThrowingArm = ({
  setup,
  swing,
  released,
  color,
}: {
  setup: ArmSetup;
  /** Where the finger has put the arm, -1 drawn back to 0 at release. */
  swing: MutableRefObject<number>;
  /** True from the moment the knife leaves until the next throw is ready. */
  released: boolean;
  color: string;
}) => {
  const knife = useRef<Group>(null);
  const fists = useRef<(Group | null)[]>([]);
  const limbs = useRef<(Mesh | null)[]>([]);
  const shown = useRef(READY_SWING);
  const recovering = useRef(false);
  const slots = useMemo(() => Array.from({ length: setup.hands }, (_, i) => i), [setup.hands]);

  useFrame((_, delta) => {
    const target = released ? 1 : swing.current;
    // Coming back from a follow-through is a reset, not a throw, and should
    // look unhurried; everything else is the player's hand and must be quick.
    if (released) recovering.current = true;
    else if (Math.abs(shown.current - target) < 0.02) recovering.current = false;
    const rate = released ? FOLLOW_THROUGH_RATE : recovering.current ? RECOVERY_RATE : TRACKING_RATE;
    shown.current += (target - shown.current) * (1 - Math.exp(-delta * rate));

    const pose = armPose(setup, shown.current);
    const rotation = bladeRotation(setup.heading, pose.bladeAngle);

    if (knife.current) {
      knife.current.position.set(...pose.knifeAt);
      knife.current.rotation.set(...rotation);
    }
    pose.fists.forEach((at: Vec3, i) => {
      fists.current[i]?.position.set(...at);
      fists.current[i]?.rotation.set(...rotation);
      const limb = limbs.current[i];
      if (limb) span(limb, pose.shoulders[i]!, at);
    });
  });

  return (
    <group>
      <group ref={knife} visible={!released}>
        <Knife spec={setup.spec} />
      </group>
      {slots.map((i) => (
        <group key={i}>
          <Fist ref={(node) => (fists.current[i] = node)} />
          <Limb ref={(node) => (limbs.current[i] = node)} color={color} />
        </group>
      ))}
    </group>
  );
};

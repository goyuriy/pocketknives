import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import {
  CharacterSupportedState,
  PhysicsCharacterController,
} from '@babylonjs/core/Physics/v2/characterController';
import type { Vec2 } from '@pocketknives/core';
import type { Stage } from '../engine/createStage.js';

/** The thrower's body as physics sees it: a capsule the size of a person, in metres. */
const HEIGHT = 1.75;
const RADIUS = 0.22;

export type Walker = {
  /**
   * Moves the body towards `wanted` over `seconds`, stopping against anything
   * solid on the way — a knife standing in the ground — and returns where the
   * feet ended up.
   */
  readonly step: (from: Vec2, wanted: Vec2, seconds: number) => Vec2;
  /** Puts the body somewhere outright: a new turn, or a correction. */
  readonly place: (feet: Vec2) => void;
  readonly dispose: () => void;
};

/**
 * The thrower's body in the physics world.
 *
 * Havok's character controller — a capsule that walks, falls and slides along
 * whatever it meets, rather than a rigid body that would tumble over. It only
 * knows about solid things; which ground the player may stand on is a rule,
 * and the caller applies it after each step.
 *
 * Effectful. Physics loads after the first frame, and until it does the body
 * simply goes where it is asked — the rule still keeps it on its own land.
 *
 * Coordinates: game ground is x–y with z up; the physics world is y up. The
 * capsule is positioned by its centre, half its height above the feet.
 */
export const createWalker = (stage: Stage, gravity: number): Walker => {
  let controller: PhysicsCharacterController | null = null;
  let disposed = false;
  let lastFeet: Vec2 = [0, 0];
  const pull = new Vector3(0, -gravity, 0);
  const down = new Vector3(0, -1, 0);
  const toCentre = (feet: Vec2) => new Vector3(feet[0], HEIGHT / 2, -feet[1]);

  void stage.physics.then(() => {
    if (disposed) return;
    controller = new PhysicsCharacterController(
      toCentre(lastFeet),
      { capsuleHeight: HEIGHT, capsuleRadius: RADIUS },
      stage.scene,
    );
  });

  return {
    step: (from, wanted, seconds) => {
      lastFeet = wanted;
      if (!controller || seconds <= 0) return wanted;
      const support = controller.checkSupport(seconds, down);
      const across = new Vector3((wanted[0] - from[0]) / seconds, 0, -(wanted[1] - from[1]) / seconds);
      const fall =
        support.supportedState === CharacterSupportedState.SUPPORTED ? 0 : controller.getVelocity().y - gravity * seconds;
      controller.setVelocity(new Vector3(across.x, fall, across.z));
      controller.integrate(seconds, support, pull);
      const at = controller.getPosition();
      lastFeet = [at.x, -at.z];
      return lastFeet;
    },
    place: (feet) => {
      lastFeet = feet;
      controller?.setPosition(toCentre(feet));
      controller?.setVelocity(Vector3.Zero());
    },
    dispose: () => {
      disposed = true;
      controller?.dispose();
    },
  };
};

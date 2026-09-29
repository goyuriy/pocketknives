import type { Engine } from '@babylonjs/core/Engines/engine';
import type { Scene } from '@babylonjs/core/scene';
import type { Vec3 } from '@pocketknives/core';
import { cameraEaseRate, cameraPose, easeHeading, eyeDip, eyeLocks, LOOK_FOLLOW_RATE } from '../math/cameraPose.js';
import { createCameraRig } from '../views/cameraRig.js';
import type { System } from './system.js';
import type { ThrowerOut } from './throwerSystem.js';

/**
 * The eye: through the thrower's eyes while aiming, lifting over the circle
 * once the knife lands, or held in a debug view — knocked by the impact's jolt.
 */
export const createCameraSystem = (scene: Scene, engine: Engine): System<void, { thrower: ThrowerOut; jolt: Vec3 | undefined }> => {
  const camera = createCameraRig(scene);
  // Where the view points; it follows the hand a beat behind, like a body-worn camera.
  let look: number | null = null;

  return {
    update: (frame, { thrower, jolt }) => {
      look = look === null ? thrower.heading : easeHeading(look, thrower.heading, LOOK_FOLLOW_RATE, frame.seconds);
      camera.follow(
        cameraPose(
          thrower.feet,
          frame.overhead,
          frame.state.arenaRadius,
          look,
          eyeDip(engine.getRenderWidth() / Math.max(1, engine.getRenderHeight())),
          frame.view,
          thrower.hand,
        ),
        cameraEaseRate(frame.lifted),
        frame.seconds,
        (distance) => eyeLocks(frame.lifted, distance),
        jolt,
      );
    },
    dispose: () => camera.dispose(),
  };
};

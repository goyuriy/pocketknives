import type { Engine } from '@babylonjs/core/Engines/engine';
import type { Scene } from '@babylonjs/core/scene';
import { easeToward } from '../math/armMotion.js';
import { cameraEaseRate, cameraPose, eyeDip, eyeLocks, LOOK_FOLLOW_RATE } from '../math/cameraPose.js';
import type { ImpactFeel } from '../math/impactFeel.js';
import { addTrauma, decayTrauma, impactTrauma, shakeAngles, type ShakeAngles } from '../math/shake.js';
import { createCameraRig } from '../views/cameraRig.js';
import type { System } from './system.js';
import type { ThrowerOut } from './throwerSystem.js';

export type CameraInputs = {
  readonly thrower: ThrowerOut;
  /** How the knife that hit the ground this very frame felt; null on every other frame. */
  readonly impact: ImpactFeel | null;
};

/**
 * The eye: through the thrower's eyes while aiming, lifting over the circle
 * once the knife lands, or held in a debug view — shaken by impacts.
 *
 * The view turns with the player exactly, with no easing — the view is the
 * mouse — and looks up and down where a free look points it, or follows the
 * throw down to the ground it is meant for. A hit adds trauma, which turns the
 * view by a noisy little angle and wears off (`shake.ts`); how much of it is
 * felt, and how wide the view is, are the player's comfort settings.
 */
export const createCameraSystem = (scene: Scene, engine: Engine): System<void, CameraInputs> => {
  const camera = createCameraRig(scene);
  let dip: number | null = null;
  // How shaken the camera is, 0 to 1.
  let trauma = 0;

  return {
    update: (frame, { thrower, impact }) => {
      const { world, seconds } = frame;
      const { comfort } = frame.state;
      trauma = decayTrauma(trauma, world.seconds);
      if (impact) trauma = addTrauma(trauma, impactTrauma(impact.kind, impact.weight, impact.pace));

      // A free look is the mouse, exactly; the throw-following view eases,
      // since a finger or a cursor can set a new angle in one jump.
      const wanted =
        thrower.look === undefined
          ? eyeDip(engine.getRenderWidth() / Math.max(1, engine.getRenderHeight()), thrower.pitch)
          : -thrower.look;
      dip = dip === null || thrower.look !== undefined ? wanted : easeToward(dip, wanted, LOOK_FOLLOW_RATE, seconds);

      const [yaw, tilt, roll] = shakeAngles(world.holding ? 0 : trauma, world.now / 1000);
      const shake: ShakeAngles = [yaw * comfort.shake, tilt * comfort.shake, roll * comfort.shake];
      camera.setViewScale(comfort.view);
      camera.follow(
        cameraPose(thrower.feet, frame.overhead, frame.state.arenaRadius, thrower.viewHeading, dip, frame.view, thrower.hand),
        cameraEaseRate(frame.lifted),
        seconds,
        (distance) => eyeLocks(frame.lifted, distance),
        shake,
      );
    },
    dispose: () => camera.dispose(),
  };
};

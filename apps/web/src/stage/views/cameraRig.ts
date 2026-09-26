import type { Scene } from '@babylonjs/core/scene';
import { FreeCamera } from '@babylonjs/core/Cameras/freeCamera';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import type { Vec3 } from '@pocketknives/core';
import { Camera } from '@babylonjs/core/Cameras/camera';
import { fieldOfView, type CameraPose } from '../math/cameraPose.js';
import { toWorld } from '../math/coords.js';

export type CameraRig = {
  /**
   * Eases towards `pose` over `seconds` at `rate` — or locks straight on when
   * `lockOn` says so for the remaining distance — then knocks it by `shake`
   * (game units) for this frame only. The first call places it outright.
   */
  readonly follow: (
    pose: CameraPose,
    rate: number,
    seconds: number,
    lockOn: (distance: number) => boolean,
    shake?: Vec3,
  ) => void;
  readonly dispose: () => void;
};

/**
 * The player's eye. Nobody steers it directly; it goes where the moment wants.
 *
 * The first frame places it rather than easing: swooping in from whatever pose
 * the camera was constructed with is a transition nobody asked for, and on a
 * slow first frame it is just a lurch.
 */
export const createCameraRig = (scene: Scene): CameraRig => {
  const camera = new FreeCamera('eye', new Vector3(0, 20, 34), scene);
  // Driven by the director alone; keyboard and mouse must not nudge it.
  camera.inputs.clear();
  camera.minZ = 0.05;
  camera.maxZ = 200;
  scene.activeCamera = camera;

  let placed = false;
  const eye = new Vector3();
  const focus = new Vector3();
  // Where the camera would be without shake. Kept apart so a shake is a
  // momentary knock and never drifts into the eased pose.
  const steady = new Vector3();
  const knock = new Vector3();

  return {
    follow: (pose, rate, seconds, lockOn, shake = [0, 0, 0]) => {
      // Wide enough to see your own hands and the circle beyond them at once,
      // whichever way up the screen is.
      const view = fieldOfView(scene.getEngine().getAspectRatio(camera));
      camera.fovMode = view.held === 'vertical' ? Camera.FOVMODE_VERTICAL_FIXED : Camera.FOVMODE_HORIZONTAL_FIXED;
      camera.fov = view.radians;

      eye.set(...toWorld(pose.eye));
      focus.set(...toWorld(pose.focus));
      if (placed && !lockOn(Vector3.Distance(steady, eye))) {
        Vector3.LerpToRef(steady, eye, 1 - Math.exp(-seconds * rate), steady);
      } else {
        steady.copyFrom(eye);
        placed = true;
      }
      knock.set(...toWorld(shake));
      camera.position.copyFrom(steady).addInPlace(knock);
      camera.setTarget(focus.addInPlace(knock));
    },
    dispose: () => camera.dispose(),
  };
};

import type { Scene } from '@babylonjs/core/scene';
import { FreeCamera } from '@babylonjs/core/Cameras/freeCamera';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import type { CameraPose } from '../math/cameraPose.js';
import { toWorld } from '../math/coords.js';

export type CameraRig = {
  /** Eases towards `pose` over `seconds` at `rate`. The first call places it outright. */
  readonly follow: (pose: CameraPose, rate: number, seconds: number) => void;
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
  camera.fov = (50 * Math.PI) / 180;
  camera.minZ = 0.1;
  camera.maxZ = 200;
  scene.activeCamera = camera;

  let placed = false;
  const eye = new Vector3();
  const focus = new Vector3();

  return {
    follow: (pose, rate, seconds) => {
      eye.set(...toWorld(pose.eye));
      focus.set(...toWorld(pose.focus));
      if (placed) {
        Vector3.LerpToRef(camera.position, eye, 1 - Math.exp(-seconds * rate), camera.position);
      } else {
        camera.position.copyFrom(eye);
        placed = true;
      }
      camera.setTarget(focus);
    },
    dispose: () => camera.dispose(),
  };
};

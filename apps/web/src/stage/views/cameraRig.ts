import type { Scene } from '@babylonjs/core/scene';
import { FreeCamera } from '@babylonjs/core/Cameras/freeCamera';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { Camera } from '@babylonjs/core/Cameras/camera';
import { fieldOfView, type CameraPose } from '../math/cameraPose.js';
import { toWorld } from '../math/coords.js';
import { STILL, type ShakeAngles } from '../math/shake.js';

export type CameraRig = {
  /**
   * Eases towards `pose` over `seconds` at `rate` — or locks straight on when
   * `lockOn` says so for the remaining distance — then turns it by `shake`
   * for this frame only. The first call places it outright.
   */
  readonly follow: (
    pose: CameraPose,
    rate: number,
    seconds: number,
    lockOn: (distance: number) => boolean,
    shake?: ShakeAngles,
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
  // Where the camera is, eased. A shake turns the camera and never moves it,
  // so it can never drift into this.
  const steady = new Vector3();

  return {
    follow: (pose, rate, seconds, lockOn, shake = STILL) => {
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
      camera.position.copyFrom(steady);
      camera.setTarget(focus);
      // Turned after aiming: the head takes the blow and comes back.
      const [yaw, pitch, roll] = shake;
      camera.rotation.x += pitch;
      camera.rotation.y += yaw;
      camera.rotation.z += roll;
    },
    dispose: () => camera.dispose(),
  };
};

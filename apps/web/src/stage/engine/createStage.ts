import { Engine } from '@babylonjs/core/Engines/engine';
import { Scene } from '@babylonjs/core/scene';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { Color3, Color4 } from '@babylonjs/core/Maths/math.color';
import { HemisphericLight } from '@babylonjs/core/Lights/hemisphericLight';
import { DirectionalLight } from '@babylonjs/core/Lights/directionalLight';
import { ShadowGenerator } from '@babylonjs/core/Lights/Shadows/shadowGenerator';
import '@babylonjs/core/Lights/Shadows/shadowGeneratorSceneComponent';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import { CreateBox } from '@babylonjs/core/Meshes/Builders/boxBuilder';
import { PhysicsAggregate } from '@babylonjs/core/Physics/v2/physicsAggregate';
import { PhysicsShapeType } from '@babylonjs/core/Physics/v2/IPhysicsEnginePlugin';
// Babylon registers features as side effects of importing them, and a missing
// one is not an error: `enablePhysics` quietly does nothing. The scene-level
// half of physics and the node-level half are separate imports; both are needed.
import '@babylonjs/core/Physics/joinedPhysicsEngineComponent';
import '@babylonjs/core/Physics/v2/physicsEngineComponent';
import { PLAYFIELD_TILT } from '../math/coords.js';
import { layerScene } from '../views/layers.js';
import { SetMissingSideEffectWarningsEnabled } from '@babylonjs/core/Misc/devTools';

// Every feature is its own import, and forgetting one fails silently. In
// development, make it say so.
if (import.meta.env.DEV) SetMissingSideEffectWarningsEnabled(true);

const BACKDROP = Color3.FromHexString('#12100d');
/** Half the width of the square the sun casts shadows over — the arena and the throwers around it. */
const SHADOW_REACH = 18;

/**
 * Everything the views draw into.
 *
 * `playfield` is the node to hang game-space things from: its children are
 * authored in the rules' coordinates (z up) and the node stands them up into the
 * engine's world (y up). Only the camera lives outside it.
 */
export type Stage = {
  readonly engine: Engine;
  readonly scene: Scene;
  readonly playfield: TransformNode;
  readonly shadows: ShadowGenerator;
  /**
   * Resolves once the physics engine is running. The scene draws and plays
   * without it; only cosmetic physics has to wait.
   */
  readonly physics: Promise<void>;
  readonly dispose: () => void;
};

export type StageOptions = {
  /** Gravity for the cosmetic physics, world units per second², matching the flight's. */
  readonly gravity: number;
};

/**
 * Builds the engine, the scene and its light, and starts rendering; then brings
 * up the physics world in the background.
 *
 * Physics is deliberately not waited for. Havok is the heaviest thing the game
 * downloads — several times the size of everything else — and a game that
 * spreads by link lives or dies on how fast the first frame appears. Nothing
 * the rules decide depends on it, so the circle is on screen and throwable
 * while it loads.
 *
 * Effectful from top to bottom — it takes over the canvas, fetches the physics
 * binary, and runs a render loop until `dispose`. It knows nothing about the
 * game; the director drives what is in the scene.
 *
 * The scene runs right-handed, the convention the rules and every piece of
 * maths in `stage/math` were written in. Babylon defaults to left-handed, and
 * mixing the two is a mirror image waiting to happen.
 */
export const createStage = (canvas: HTMLCanvasElement, options: StageOptions): Stage => {
  // Physics, and walking with it, runs in fixed steps of 1/60 s — as many a
  // frame as the time since the last one needs, up to four — so the body moves
  // and collides the same on a 60 Hz screen as on a 144 Hz one. The director
  // hooks walking onto `scene.onBeforeStepObservable`.
  const engine = new Engine(
    canvas,
    true,
    { stencil: true, preserveDrawingBuffer: false, deterministicLockstep: true, lockstepMaxSteps: 4, timeStep: 1 / 60 },
    false,
  );
  // Sharp on high-density screens, but never past 2× — beyond that a phone
  // spends its battery on pixels nobody can see.
  engine.setHardwareScalingLevel(1 / Math.min(window.devicePixelRatio || 1, 2));

  const scene = new Scene(engine);
  scene.useRightHandedSystem = true;
  layerScene(scene);
  scene.clearColor = Color4.FromColor3(BACKDROP, 1);
  scene.fogMode = Scene.FOGMODE_LINEAR;
  scene.fogColor = BACKDROP;
  scene.fogStart = 34;
  scene.fogEnd = 68;

  const sky = new HemisphericLight('sky', new Vector3(0, 1, 0), scene);
  sky.intensity = 0.55;
  sky.diffuse = Color3.FromHexString('#cfd8e6');
  sky.groundColor = Color3.FromHexString('#2a2119');
  sky.specular = Color3.Black();

  const sun = new DirectionalLight('sun', new Vector3(-9, -18, -11).normalize(), scene);
  sun.position = new Vector3(9, 18, 11).scale(1.4);
  sun.intensity = 0.9;
  /*
   * A fixed shadow box over the whole arena. Left to fit itself, the sun sizes
   * its box to the shadow casters — here just an arm and a knife — and ground
   * outside that box reads as "behind the far plane", i.e. in shadow: a dark
   * wedge across the circle that follows the arm around.
   */
  sun.autoUpdateExtends = false;
  sun.orthoLeft = -SHADOW_REACH;
  sun.orthoRight = SHADOW_REACH;
  sun.orthoTop = SHADOW_REACH;
  sun.orthoBottom = -SHADOW_REACH;
  sun.shadowMinZ = 1;
  sun.shadowMaxZ = 80;

  const shadows = new ShadowGenerator(1024, sun);
  shadows.usePercentageCloserFiltering = true;
  shadows.bias = 0.002;

  const playfield = new TransformNode('playfield', scene);
  playfield.rotation.x = PLAYFIELD_TILT;

  let disposed = false;
  let floorBody: PhysicsAggregate | null = null;
  const physics = import('./havok.js')
    .then(({ loadHavok }) => loadHavok())
    .then((plugin) => {
      if (disposed) return;
      if (!scene.enablePhysics(new Vector3(0, -options.gravity, 0), plugin)) {
        throw new Error('Havok physics failed to start');
      }
      // The ground, as far as physics is concerned: a slab just under the
      // circle for knives to bounce on and the thrower to stand on — far wider
      // than the circle, so a knife that bounces a long way still has ground
      // to settle on.
      const floor = CreateBox('floor', { width: 400, depth: 400, height: 1 }, scene);
      floor.position.y = -0.5;
      floor.isVisible = false;
      floorBody = new PhysicsAggregate(floor, PhysicsShapeType.BOX, { mass: 0, friction: 0.8 }, scene);
    });

  const resize = () => engine.resize();
  const observer = new ResizeObserver(resize);
  observer.observe(canvas);
  window.addEventListener('resize', resize);

  engine.runRenderLoop(() => scene.render());

  return {
    engine,
    scene,
    playfield,
    shadows,
    physics,
    dispose: () => {
      disposed = true;
      observer.disconnect();
      window.removeEventListener('resize', resize);
      engine.stopRenderLoop();
      floorBody?.dispose();
      scene.dispose();
      engine.dispose();
    },
  };
};

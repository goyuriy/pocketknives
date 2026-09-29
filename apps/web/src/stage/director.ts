import type { MutableRefObject } from 'react';
import type { Stance } from '@pocketknives/core';
import type { WalkInput } from '../input/walk.js';
import type { ImpactSound } from '../audio/impactSound.js';
import type { Stage } from './engine/createStage.js';
import { frameOf } from './frame.js';
import type { HandInput, StageSnapshot } from './snapshot.js';
import { createArenaSystem } from './systems/arenaSystem.js';
import { createCameraSystem } from './systems/cameraSystem.js';
import { createKnivesSystem } from './systems/knivesSystem.js';
import { createThrowerSystem } from './systems/throwerSystem.js';

export type Director = { readonly dispose: () => void };

export type DirectorInputs = {
  /** The latest game state; called once per frame. */
  readonly read: () => StageSnapshot;
  /** Where the pointer has put the hand right now. */
  readonly hand: () => HandInput;
  /** Which way the player is asking to walk right now. */
  readonly walk: () => WalkInput;
  /** Where the thrower stands and faces. The thrower system moves the feet; the controls turn the facing. */
  readonly stance: MutableRefObject<Stance>;
  /** Where impacts are heard. */
  readonly sound: ImpactSound;
};

/**
 * Turns the game's state into what is on screen, once a frame.
 *
 * The game is resolved the instant the hand lets go — flight, stick and cut are
 * pure functions — so nothing here decides anything. Each frame it works out
 * the frame's facts once (`frameOf`: where the playback is, whether the knife
 * has left the hand, where the camera is), then runs the systems in order,
 * each posing the views it owns and handing on what the next needs. That is
 * what lets the scene be a plain function of state and time: drop a frame, or
 * reload mid-throw, and the next frame is simply correct.
 *
 * Effectful: owns the systems and registers itself on the render loop.
 */
export const createDirector = (stage: Stage, { read, hand, walk, stance, sound }: DirectorInputs): Director => {
  const { scene, playfield, shadows, engine } = stage;
  const first = read();

  const arena = createArenaSystem(scene, playfield, first.arenaRadius);
  const knives = createKnivesSystem(scene, playfield, shadows, sound);
  const thrower = createThrowerSystem(stage, first.config.flight.gravity, { hand, walk, stance });
  const camera = createCameraSystem(scene, engine);

  const observer = scene.onBeforeRenderObservable.add(() => {
    const frame = frameOf(read(), performance.now(), engine.getDeltaTime() / 1000);
    arena.update(frame);
    const jolt = knives.update(frame);
    const where = thrower.update(frame);
    camera.update(frame, { thrower: where, jolt });
  });

  return {
    dispose: () => {
      scene.onBeforeRenderObservable.remove(observer);
      [arena, knives, thrower, camera].forEach((system) => system.dispose());
    },
  };
};

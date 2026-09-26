import type { KnifeSpec, Vec3 } from '@pocketknives/core';
import { CUT_DURATION } from '../state/useSandbox.js';
import type { Stage } from './engine/createStage.js';
import type { HandInput, StageSnapshot } from './snapshot.js';
import { handSway } from '../input/handSway.js';
import { bodyPose, READY_SWING, swingForDraw } from './math/bodyPose.js';
import { RESTING_ARM, stepArm } from './math/armMotion.js';
import { cameraEaseRate, cameraPose, easeHeading, LOOK_FOLLOW_RATE } from './math/cameraPose.js';
import { fallenPlacement, flyingPlacement, stuckPlacement } from './math/knifePlacement.js';
import { createArenaView } from './views/arenaView.js';
import { createBodyView } from './views/bodyView.js';
import { createCameraRig } from './views/cameraRig.js';
import { createKnifeModel, place, type KnifeModel } from './views/knifeModel.js';

/** The longest step a frame may take. A tab left in the background must not wake up to a leap. */
const LONGEST_FRAME = 0.1;

export type Director = { readonly dispose: () => void };

/**
 * Turns the game's state into what is on screen, once a frame.
 *
 * The game is resolved the instant the hand lets go — flight, stick and cut are
 * pure functions — so nothing here decides anything. It reads a snapshot, works
 * out how far into the current phase we are, and poses every view to match.
 * That is what lets the scene be a plain function of state and time: drop a
 * frame, or reload mid-throw, and the next frame is simply correct.
 *
 * Effectful: owns the views and registers itself on the render loop.
 *
 * @param read the latest game state; called once per frame
 * @param hand where the pointer has put the hand right now
 */
export const createDirector = (
  stage: Stage,
  read: () => StageSnapshot,
  hand: () => HandInput,
): Director => {
  const { scene, playfield, shadows, engine } = stage;
  const first = read();

  const arena = createArenaView(scene, playfield, first.arenaRadius);
  const body = createBodyView(scene, playfield, shadows);
  const camera = createCameraRig(scene);

  let knives: { spec: KnifeSpec; flying: KnifeModel; landed: KnifeModel } | null = null;
  const knivesFor = (spec: KnifeSpec) => {
    if (knives?.spec === spec) return knives;
    knives?.flying.dispose();
    knives?.landed.dispose();
    const flying = createKnifeModel(scene, 'flying-knife', spec, shadows);
    const landed = createKnifeModel(scene, 'landed-knife', spec, shadows);
    flying.root.parent = playfield;
    landed.root.parent = playfield;
    knives = { spec, flying, landed };
    return knives;
  };

  let motion = RESTING_ARM;
  let look: number | null = null;
  let phaseSeen = first.phase;
  let phaseStartedAt = performance.now();

  const frame = () => {
    const now = performance.now();
    const seconds = Math.min(engine.getDeltaTime() / 1000, LONGEST_FRAME);
    const state = read();
    const { phase } = state;

    if (phase !== phaseSeen) {
      phaseSeen = phase;
      phaseStartedAt = now;
    }
    const intoPhase = (now - phaseStartedAt) / 1000;

    const landed = phase.kind === 'cutting' || phase.kind === 'resting';
    // The knife and its cut stay put after the animation ends, so the throw can
    // be studied rather than glimpsed. Only aiming the next one clears them.
    const settled = landed
      ? phase.attempt
      : phase.kind === 'ready' && !state.swinging
        ? state.lastAttempt
        : null;

    arena.showFields(state.fields, state.alive);
    arena.showCut(
      settled?.outcome?.kind === 'claimed' ? settled.outcome.cut : null,
      phase.kind === 'cutting' ? Math.min(1, intoPhase / CUT_DURATION) : 1,
    );

    const { flying, landed: resting } = knivesFor(state.knife);
    flying.root.setEnabled(phase.kind === 'flying');
    if (phase.kind === 'flying') {
      // Slower than real time on purpose: the knife's turn is worth watching.
      place(flying.root, flyingPlacement(phase.attempt.flight, intoPhase * state.playbackScale));
    }
    resting.root.setEnabled(settled !== null);
    if (settled) {
      const { flight, verdict } = settled;
      place(
        resting.root,
        verdict.stuck ? stuckPlacement(flight, verdict.quality, verdict.depth) : fallenPlacement(flight),
      );
      resting.setDimmed(!verdict.stuck);
    }

    const released = phase.kind !== 'ready';
    const { aim, pitch, draw } = hand();
    // The hand's own waver is drawn as well as thrown: what the player sees is
    // exactly the line the knife would leave on.
    const heading =
      phase.kind === 'ready'
        ? state.restHeading - (aim + handSway(now / 1000))
        : phase.attempt.flight.impact.heading;

    motion = stepArm(motion, draw === null ? READY_SWING : swingForDraw(draw), released, seconds);
    const release: Vec3 = [state.stand[0], state.stand[1], state.config.style.releaseHeight];
    const pose = bodyPose(
      {
        release,
        heading,
        releaseBladeAngle: state.config.style.startingBladeAngle,
        loft: pitch - state.config.style.pitch,
        spec: state.knife,
        hands: state.hands,
      },
      motion.shown,
    );
    body.show(pose, { spec: state.knife, hands: state.hands, heading, sleeve: state.playerColor }, !released);

    look = look === null ? heading : easeHeading(look, heading, LOOK_FOLLOW_RATE, seconds);
    camera.follow(cameraPose(release, landed, state.arenaRadius, look), cameraEaseRate(landed), seconds);
  };

  const observer = scene.onBeforeRenderObservable.add(frame);

  return {
    dispose: () => {
      scene.onBeforeRenderObservable.remove(observer);
      arena.dispose();
      body.dispose();
      camera.dispose();
      knives?.flying.dispose();
      knives?.landed.dispose();
    },
  };
};

import type { KnifeSpec, Vec3 } from '@pocketknives/core';
import { CUT_DURATION, IMPACT_BEAT, type Attempt } from '../state/useSandbox.js';
import type { ImpactSound } from '../audio/impactSound.js';
import { impactFeel, type ImpactFeel } from './math/impactFeel.js';
import { shakeAmplitude, shakeOffset } from './math/shake.js';
import { createDustView } from './views/dustView.js';
import type { Stage } from './engine/createStage.js';
import type { HandInput, StageSnapshot } from './snapshot.js';
import { handSway } from '../input/handSway.js';
import { bodyPose, READY_SWING, swingForDraw } from './math/bodyPose.js';
import { easeToward, RESTING_ARM, stepArm } from './math/armMotion.js';
import { flightTimeAt, rateAt, RELEASE_SLOW_MOTION } from '../playback/releaseTimeline.js';
import { cameraEaseRate, cameraPose, easeHeading, LOOK_FOLLOW_RATE } from './math/cameraPose.js';
import {
  bouncingPlacement,
  flyingPlacement,
  quiveringPlacement,
  quiverLean,
} from './math/knifePlacement.js';
import { createArenaView } from './views/arenaView.js';
import { createBodyView } from './views/bodyView.js';
import { createCameraRig } from './views/cameraRig.js';
import { createKnifeModel, place, type KnifeModel } from './views/knifeModel.js';

/** How briskly the free arm rises to point, and drops again, per second. */
const FREE_ARM_RATE = 9;

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
 * @param read  the latest game state; called once per frame
 * @param hand  where the pointer has put the hand right now
 * @param sound where impacts are heard
 */
export const createDirector = (
  stage: Stage,
  read: () => StageSnapshot,
  hand: () => HandInput,
  sound: ImpactSound,
): Director => {
  const { scene, playfield, shadows, engine } = stage;
  const first = read();

  const arena = createArenaView(scene, playfield, first.arenaRadius);
  const body = createBodyView(scene, playfield, shadows);
  const camera = createCameraRig(scene);
  const dust = createDustView(scene, playfield);

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
  let raised = 0;
  // Where the arm was when the hand let go: the hand-off swings it from here.
  let swingAtRelease = 0;
  let look: number | null = null;
  let phaseSeen = first.phase;
  let phaseStartedAt = performance.now();
  // The last knife to hit the ground, and when: everything that happens on
  // impact — dust, sound, shake, quiver, bounce — is timed from this.
  let impact: { attempt: Attempt; at: number; feel: ImpactFeel } | null = null;

  const frame = () => {
    const now = performance.now();
    const seconds = Math.min(engine.getDeltaTime() / 1000, LONGEST_FRAME);
    const state = read();
    const { phase } = state;

    if (phase !== phaseSeen) {
      phaseSeen = phase;
      phaseStartedAt = now;
      if (phase.kind === 'flying') swingAtRelease = motion.shown;
      if (phase.kind === 'cutting') {
        // The flight's playback has just reached the ground.
        const { flight, verdict, seed } = phase.attempt;
        const feel = impactFeel(verdict, flight.impact, state.knife);
        impact = { attempt: phase.attempt, at: now, feel };
        dust.burst([flight.impact.point[0], flight.impact.point[1], 0.02], flight.impact.heading, feel.strength, seed, now / 1000);
        sound.play(feel);
      }
    }
    const intoPhase = (now - phaseStartedAt) / 1000;
    const { handOff } = RELEASE_SLOW_MOTION;
    // Still in the fist: the arm is swinging through to let go.
    const handingOff = phase.kind === 'flying' && intoPhase < handOff;
    const intoFlight = Math.max(0, intoPhase - handOff);

    const landed = phase.kind === 'cutting' || phase.kind === 'resting';
    // Lift over the circle only once the impact has had its moment at eye level.
    const overhead = phase.kind === 'resting' || (phase.kind === 'cutting' && intoPhase >= IMPACT_BEAT);
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
      phase.kind === 'cutting' ? Math.min(1, Math.max(0, (intoPhase - IMPACT_BEAT) / CUT_DURATION)) : 1,
    );

    const { flying, landed: resting } = knivesFor(state.knife);
    flying.root.setEnabled(phase.kind === 'flying' && !handingOff);
    if (phase.kind === 'flying' && !handingOff) {
      // Off the fingers at a crawl, then up to the cruising pace — which is
      // itself slower than real time, because the knife's turn is worth watching.
      const flightTime = flightTimeAt(intoFlight, state.playbackScale);
      place(flying.root, flyingPlacement(phase.attempt.flight, flightTime));
    }
    resting.root.setEnabled(settled !== null);
    // Seconds since this knife hit; long ago for a throw from before a reload.
    const sinceImpact = impact && impact.attempt === settled ? (now - impact.at) / 1000 : Infinity;
    if (settled) {
      const { flight, verdict } = settled;
      const feel = impact?.feel ?? impactFeel(verdict, flight.impact, state.knife);
      place(
        resting.root,
        verdict.stuck
          ? quiveringPlacement(flight, verdict.quality, verdict.depth, quiverLean(sinceImpact, feel.strength, feel.clean))
          : bouncingPlacement(flight, sinceImpact, feel.strength),
      );
      resting.setDimmed(!verdict.stuck);
    }
    dust.update(now / 1000);

    const released = phase.kind !== 'ready';
    const { aim, pitch, draw } = hand();
    // The hand's own waver is drawn as well as thrown: what the player sees is
    // exactly the line the knife would leave on.
    const heading =
      phase.kind === 'ready'
        ? state.restHeading - (aim + handSway(now / 1000))
        : phase.attempt.flight.impact.heading;

    if (handingOff) {
      // A fixed swing, not an eased one: the flight starts on a schedule, and
      // the hand must arrive at the release exactly when it does.
      const t = intoPhase / handOff;
      motion = { shown: swingAtRelease + (0 - swingAtRelease) * t * t, recovering: true };
    } else {
      // Through the follow-through the arm lives on the world's clock, so it
      // moves in slow motion with the knife it just let go of.
      const worldSeconds =
        phase.kind === 'flying' ? seconds * rateAt(intoFlight, state.playbackScale) : seconds;
      motion = stepArm(motion, draw === null ? READY_SWING : swingForDraw(draw), released, worldSeconds);
    }
    // The free arm comes up to point only while the button is held.
    raised = easeToward(raised, draw !== null && !released ? 1 : 0, FREE_ARM_RATE, seconds);
    const release: Vec3 = [state.stand[0], state.stand[1], state.config.style.releaseHeight];
    const pose = bodyPose(
      {
        release,
        heading,
        releaseBladeAngle: state.config.style.startingBladeAngle,
        loft: pitch - state.config.style.pitch,
        raised,
        spec: state.knife,
        hands: state.hands,
      },
      motion.shown,
    );
    body.show(
      pose,
      { spec: state.knife, hands: state.hands, heading, sleeve: state.playerColor },
      !released || handingOff,
    );

    look = look === null ? heading : easeHeading(look, heading, LOOK_FOLLOW_RATE, seconds);
    const jolt = impact && Number.isFinite(sinceImpact)
      ? shakeOffset(sinceImpact, shakeAmplitude(impact.feel.kind, impact.feel.strength))
      : undefined;
    camera.follow(cameraPose(release, overhead, state.arenaRadius, look), cameraEaseRate(overhead), seconds, jolt);
  };

  const observer = scene.onBeforeRenderObservable.add(frame);

  return {
    dispose: () => {
      scene.onBeforeRenderObservable.remove(observer);
      arena.dispose();
      body.dispose();
      camera.dispose();
      dust.dispose();
      knives?.flying.dispose();
      knives?.landed.dispose();
    },
  };
};

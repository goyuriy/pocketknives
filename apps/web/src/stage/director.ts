import { homeSpot, isOnOwnLand, keepOnOwnLand, type KnifeSpec, type Vec2, type Vec3 } from '@pocketknives/core';
import type { MutableRefObject } from 'react';
import { CUT_DURATION, IMPACT_BEAT, type Attempt, type Stance } from '../state/useSandbox.js';
import { walkStep, type WalkInput } from '../input/walk.js';
import type { ImpactSound } from '../audio/impactSound.js';
import { impactFeel, type ImpactFeel } from './math/impactFeel.js';
import { shakeAmplitude, shakeDuration, shakeOffset } from './math/shake.js';
import { createDustView } from './views/dustView.js';
import type { Stage } from './engine/createStage.js';
import type { HandInput, StageSnapshot } from './snapshot.js';
import { handSway } from '../input/handSway.js';
import { bodyPose, READY_SWING, releasePointFor, strideAfter, swingForDraw, type Stride } from './math/bodyPose.js';
import { easeToward, RESTING_ARM, stepArm } from './math/armMotion.js';
import { flightTimeAt, rateAt, RELEASE_SLOW_MOTION } from '../playback/releaseTimeline.js';
import { cameraEaseRate, cameraPose, easeHeading, eyeDip, eyeLocks, LOOK_FOLLOW_RATE } from './math/cameraPose.js';
import { flyingPlacement } from './math/knifePlacement.js';
import { reachDots } from './math/reachLine.js';
import { createArenaView } from './views/arenaView.js';
import { createBodyView } from './views/bodyView.js';
import { createCameraRig } from './views/cameraRig.js';
import { createKnifeModel, place, type KnifeModel } from './views/knifeModel.js';
import { createGroundKnives, type Landing } from './views/groundKnives.js';
import { createWalker } from './views/walker.js';

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
 * The one thing it does move is the thrower: walking is simulated here, a
 * frame at a time, because it is the one input that has to meet the physics
 * world — knives standing in the ground are solid. Where the thrower ends up is
 * written back to `stance`, which is what a throw is thrown from.
 *
 * Effectful: owns the views and registers itself on the render loop.
 */
export type DirectorInputs = {
  /** The latest game state; called once per frame. */
  readonly read: () => StageSnapshot;
  /** Where the pointer has put the hand right now. */
  readonly hand: () => HandInput;
  /** Which way the player is asking to walk right now. */
  readonly walk: () => WalkInput;
  /** Where the thrower stands and faces. The director moves the feet; the controls turn the facing. */
  readonly stance: MutableRefObject<Stance>;
  /** Where impacts are heard. */
  readonly sound: ImpactSound;
};

export const createDirector = (stage: Stage, { read, hand, walk, stance, sound }: DirectorInputs): Director => {
  const { scene, playfield, shadows, engine } = stage;
  const first = read();

  const arena = createArenaView(scene, playfield, first.arenaRadius);
  const body = createBodyView(scene, playfield, shadows);
  const camera = createCameraRig(scene);
  const dust = createDustView(scene, playfield);
  const ground = createGroundKnives(scene, shadows);
  const walker = createWalker(stage, first.config.flight.gravity);

  let flying: { spec: KnifeSpec; model: KnifeModel } | null = null;
  const flyingKnife = (spec: KnifeSpec) => {
    if (flying?.spec === spec) return flying.model;
    flying?.model.dispose();
    const model = createKnifeModel(scene, 'flying-knife', spec, shadows);
    model.root.parent = playfield;
    flying = { spec, model };
    return model;
  };
  // When each knife hit the ground, and how hard.
  const landings = new Map<Attempt, Landing>();
  // The chalked edge of the thrower's reach, kept until their ground or the reach changes.
  let reach: { fields: unknown; playerId: string; reach: number; dots: readonly Vec2[] } | null = null;
  const reachOf = (state: StageSnapshot): readonly Vec2[] => {
    if (reach?.fields !== state.fields || reach.playerId !== state.playerId || reach.reach !== state.reach) {
      const own = state.fields.filter((field) => field.ownerId === state.playerId);
      reach = { fields: state.fields, playerId: state.playerId, reach: state.reach, dots: reachDots(own, state.reach, state.arenaRadius) };
    }
    return reach.dots;
  };
  // Whose ground the thrower was last put on — a new turn puts them on their own.
  let placedFor: string | null = null;

  /** Puts the thrower in the middle of their own ground, facing the centre of the circle. */
  const placeAtHome = (state: StageSnapshot) => {
    const feet = homeSpot(state.board, state.playerId) ?? stance.current.feet;
    const facing = Math.hypot(feet[0], feet[1]) > 1e-6 ? Math.atan2(-feet[1], -feet[0]) : stance.current.facing;
    stance.current = { feet, facing };
    walker.place(feet);
    placedFor = state.playerId;
  };
  // The legs' walk: where in the stride they are, eased in and out with the pace.
  let stride: Stride = { phase: 0, amount: 0, along: [1, 0] };
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
        const { flight, verdict, seed, knife } = phase.attempt;
        const feel = impactFeel(verdict, flight.impact, knife);
        impact = { attempt: phase.attempt, at: now, feel };
        landings.set(phase.attempt, { at: now, feel });
        const ground: Vec3 = [flight.impact.point[0], flight.impact.point[1], 0.02];
        dust.burst(ground, flight.impact.heading, feel.weight, feel.pace, seed, now / 1000);
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
    arena.showReach(state.showReach ? reachOf(state) : null, state.playerColor);
    arena.showCut(
      settled?.outcome?.kind === 'claimed' ? settled.outcome.cut : null,
      phase.kind === 'cutting' ? Math.min(1, Math.max(0, (intoPhase - IMPACT_BEAT) / CUT_DURATION)) : 1,
    );

    const inAir = phase.kind === 'flying' ? flyingKnife(phase.attempt.knife) : null;
    flying?.model.root.setEnabled(inAir !== null && !handingOff);
    if (inAir && phase.kind === 'flying' && !handingOff) {
      // Off the fingers at a crawl, then up to the cruising pace — which is
      // itself slower than real time, because the knife's turn is worth watching.
      const flightTime = flightTimeAt(intoFlight, state.playbackScale);
      place(inAir.root, flyingPlacement(phase.attempt.flight, flightTime));
    }
    // Forget landings for knives that have been picked up.
    for (const attempt of landings.keys()) if (!state.thrown.includes(attempt)) landings.delete(attempt);
    ground.show(state.thrown, landings, now);
    const sinceImpact = impact && landings.has(impact.attempt) ? (now - impact.at) / 1000 : Infinity;
    dust.update(now / 1000);

    const released = phase.kind !== 'ready';
    // Where the feet went this frame; nowhere, unless walking.
    let stepped: [Vec2, Vec2] = [stance.current.feet, stance.current.feet];
    const { aim, pitch, draw } = hand();

    // A new turn, or ground taken from under the thrower's feet: back home.
    if (phase.kind === 'ready' && draw === null) {
      if (placedFor !== state.playerId || !isOnOwnLand(state.board, state.playerId, stance.current.feet)) {
        placeAtHome(state);
      }
      // Walking: wherever the player asks, as far as solid things allow, and
      // never off their own ground. Feet stay planted through a throw.
      const { feet, facing } = stance.current;
      const walked = walker.step(feet, walkStep(feet, walk(), facing, seconds), seconds);
      const allowed = keepOnOwnLand(state.board, state.playerId, feet, walked);
      if (allowed[0] !== walked[0] || allowed[1] !== walked[1]) walker.place(allowed);
      stance.current = { ...stance.current, feet: allowed };
      stepped = [feet, allowed];
    }
    const feet: Vec2 = stance.current.feet;
    // The hand's own waver is drawn as well as thrown: what the player sees is
    // exactly the line the knife would leave on.
    const heading =
      phase.kind === 'ready'
        ? stance.current.facing - (aim + handSway(now / 1000))
        : phase.attempt.flight.impact.heading;

    // Swung along the way the feet went, in the terms of the way the body faces.
    stride = strideFor(stride, stepped[0], stepped[1], heading, seconds);

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
    // Out in front of the feet while aiming; once thrown, exactly where the flight began.
    const release: Vec3 =
      phase.kind === 'ready'
        ? [...releasePointFor(feet, heading), state.config.style.releaseHeight]
        : phase.attempt.flight.samples[0]!.position;
    const pose = bodyPose(
      {
        release,
        heading,
        releaseBladeAngle: state.config.style.startingBladeAngle,
        loft: pitch - state.config.style.pitch,
        raised,
        spec: phase.kind === 'ready' ? state.knife : phase.attempt.knife,
        hands: state.hands,
        stride,
      },
      motion.shown,
    );
    body.show(
      pose,
      {
        spec: phase.kind === 'ready' ? state.knife : phase.attempt.knife,
        hands: state.hands,
        heading,
        sleeve: state.playerColor,
        head: overhead || state.thirdPerson,
      },
      !released || handingOff,
    );

    look = look === null ? heading : easeHeading(look, heading, LOOK_FOLLOW_RATE, seconds);
    const jolt = impact && Number.isFinite(sinceImpact)
      ? shakeOffset(
          sinceImpact,
          shakeAmplitude(impact.feel.kind, impact.feel.weight, impact.feel.pace),
          shakeDuration(impact.feel.weight),
        )
      : undefined;
    camera.follow(
      cameraPose(
        feet,
        overhead,
        state.arenaRadius,
        look,
        eyeDip(engine.getRenderWidth() / Math.max(1, engine.getRenderHeight())),
        state.thirdPerson,
      ),
      cameraEaseRate(overhead),
      seconds,
      (distance) => eyeLocks(overhead, distance),
      jolt,
    );
  };

  const observer = scene.onBeforeRenderObservable.add(frame);

  return {
    dispose: () => {
      scene.onBeforeRenderObservable.remove(observer);
      arena.dispose();
      body.dispose();
      camera.dispose();
      dust.dispose();
      ground.dispose();
      walker.dispose();
      flying?.model.dispose();
    },
  };
};

/** Below this pace, units per second, the legs are standing, not walking. */
const WALKING_PACE = 0.3;
/** How quickly the legs fall into and out of a walk, per second. */
const STRIDE_EASE = 8;

/**
 * The legs after moving from `from` to `to` in `seconds`, facing `facing`: the
 * stride advances by the distance walked, swings along the way it went, and
 * eases in and out so starting and stopping is not a snap.
 */
const strideFor = (stride: Stride, from: Vec2, to: Vec2, facing: number, seconds: number): Stride => {
  const [dx, dy] = [to[0] - from[0], to[1] - from[1]];
  const distance = Math.hypot(dx, dy);
  const walking = seconds > 0 && distance / seconds > WALKING_PACE;
  const along: Stride['along'] = walking
    ? [dx * Math.cos(facing) + dy * Math.sin(facing), dx * Math.sin(facing) - dy * Math.cos(facing)]
    : stride.along;
  return {
    phase: strideAfter(stride.phase, distance),
    amount: easeToward(stride.amount, walking ? 1 : 0, STRIDE_EASE, seconds),
    along,
  };
};

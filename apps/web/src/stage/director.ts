import {
  homeSpot,
  isOnOwnLand,
  keepOnOwnLand,
  releaseBladeAngle,
  type KnifeSpec,
  type Vec2,
  type Vec3,
} from '@pocketknives/core';
import type { MutableRefObject } from 'react';
import { CUT_DURATION, IMPACT_BEAT, type Attempt, type Stance } from '../state/useSandbox.js';
import { walkStep, type WalkInput } from '../input/walk.js';
import { turnedFacing } from '../input/turn.js';
import type { ImpactSound } from '../audio/impactSound.js';
import { impactFeel } from './math/impactFeel.js';
import { addTrauma, decayTrauma, hitstopFor, impactTrauma, shakeAngles } from './math/shake.js';
import { createDustView } from './views/dustView.js';
import type { Stage } from './engine/createStage.js';
import type { HandInput, StageSnapshot } from './snapshot.js';
import { handSway } from '../input/handSway.js';
import {
  bodyPose,
  gripOffset,
  READY_SWING,
  releasePointFor,
  strideAfter,
  swingForDraw,
  type Stride,
} from './math/bodyPose.js';
import { bladeDirection } from './math/coords.js';
import { easeToward, RESTING_ARM, stepArm } from './math/armMotion.js';
import { flightTimeAt, rateAt, RELEASE_SLOW_MOTION } from '../playback/releaseTimeline.js';
import { cameraEaseRate, cameraPose, eyeDip, eyeLocks, LOOK_FOLLOW_RATE } from './math/cameraPose.js';
import { flyingPlacement } from './math/knifePlacement.js';
import { reachDots } from './math/reachLine.js';
import { createArenaView } from './views/arenaView.js';
import { createBodyView } from './views/bodyView.js';
import { createCameraRig } from './views/cameraRig.js';
import { createKnifeModel, place, type KnifeModel } from './views/knifeModel.js';
import { createGroundKnives, type Landing } from './views/groundKnives.js';
import { createWalker } from './views/walker.js';
import { springAt, stepHeadingSpring, stepSpring, type Spring, type SpringTuning } from './math/spring.js';
import { createCharacterView } from './views/characterView.js';

/** How briskly the free arm rises to point, and drops again, per second. */
const FREE_ARM_RATE = 9;

/**
 * How the hand trails the view: brisk, with a touch of overshoot. The view
 * follows the mouse exactly — any lag there feels floaty — and the weight goes
 * on the hand instead, which swings round after a quick turn and settles.
 */
const HAND_LAG: SpringTuning = { frequency: 3.5, damping: 0.6 };

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
  /** How hard the player is asking to turn right now, -1 to 1, positive right. */
  readonly turn: () => number;
  /** Where the thrower stands and faces. The director moves the feet; the controls turn the facing. */
  readonly stance: MutableRefObject<Stance>;
  /** Where impacts are heard. */
  readonly sound: ImpactSound;
};

export const createDirector = (stage: Stage, { read, hand, walk, turn, stance, sound }: DirectorInputs): Director => {
  const { scene, playfield, shadows, engine } = stage;
  const first = read();

  const arena = createArenaView(scene, playfield, first.arenaRadius);
  const body = createBodyView(scene, playfield, shadows);
  const camera = createCameraRig(scene);
  const dust = createDustView(scene, playfield);
  const ground = createGroundKnives(scene, shadows);
  const walker = createWalker(stage, first.config.flight.gravity);
  const character = createCharacterView(scene, shadows);

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
  // How fast the feet are going, eased so one uneven frame does not jolt the clips.
  let pace = 0;
  let motion = RESTING_ARM;
  let raised = 0;
  // Where the arm was when the hand let go: the hand-off swings it from here.
  let swingAtRelease = 0;
  let handHeading: Spring | null = null;
  let handPitch: Spring | null = null;
  let dip: number | null = null;
  let phaseSeen = first.phase;
  let phaseStartedAt = performance.now();
  // The world's clock, milliseconds — everything that happens on impact
  // (dust, quiver, bounce, shake) is timed on it: real time, except that it
  // stands still for the few frames of hitstop when a knife hits (`hitstopFor`).
  let worldNow = 0;
  let holdUntil = -Infinity;
  // How shaken the camera is, 0 to 1 (see `shake.ts`).
  let trauma = 0;

  const frame = () => {
    const now = performance.now();
    const seconds = Math.min(engine.getDeltaTime() / 1000, LONGEST_FRAME);
    const holding = now < holdUntil;
    const worldSeconds = holding ? 0 : seconds;
    worldNow += worldSeconds * 1000;
    trauma = decayTrauma(trauma, worldSeconds);
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
        landings.set(phase.attempt, { at: worldNow, feel });
        const ground: Vec3 = [flight.impact.point[0], flight.impact.point[1], 0.02];
        dust.burst(ground, flight.impact.heading, feel.weight, feel.pace, seed, worldNow / 1000);
        sound.play(feel);
        // The blow lands: the world holds still for a few frames, then the view shakes.
        holdUntil = now + hitstopFor(feel.kind, feel.weight) * 1000;
        trauma = addTrauma(trauma, impactTrauma(feel.kind, feel.weight, feel.pace));
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
    ground.show(state.thrown, landings, worldNow);
    dust.update(worldNow / 1000);

    const released = phase.kind !== 'ready';
    // Where the feet went this frame; nowhere, unless walking.
    let stepped: [Vec2, Vec2] = [stance.current.feet, stance.current.feet];
    const { aim, pitch, draw, look: gaze, viewFollowsAim } = hand();

    // A new turn, or ground taken from under the thrower's feet: back home.
    if (phase.kind === 'ready' && draw === null) {
      if (placedFor !== state.playerId || !isOnOwnLand(state.board, state.playerId, stance.current.feet)) {
        placeAtHome(state);
      }
      // Turning, for when nothing captures the mouse: the keys, or a cursor
      // held out at the edge of the screen pulling the body round after it.
      const facing = turnedFacing(stance.current.facing, turn(), seconds);
      // Walking: wherever the player asks, as far as solid things allow, and
      // never off their own ground. Feet stay planted through a throw.
      const { feet } = stance.current;
      const walked = walker.step(feet, walkStep(feet, walk(), facing, seconds), seconds);
      const allowed = keepOnOwnLand(state.board, state.playerId, feet, walked);
      if (allowed[0] !== walked[0] || allowed[1] !== walked[1]) walker.place(allowed);
      stance.current = { feet: allowed, facing };
      stepped = [feet, allowed];
    }
    const feet: Vec2 = stance.current.feet;
    // Where the eyes look across the ground: exactly where the player turned,
    // this frame, with no easing — the view is the mouse.
    const viewHeading = stance.current.facing - (viewFollowsAim ? aim : 0);
    // Where the hand points: the aim, with its own waver, which is thrown as
    // well as drawn — what the player sees is the line the knife would leave on.
    // Once thrown, the line it did leave on. The hand gets there on a spring,
    // trailing a quick turn of the view and settling.
    const handTarget =
      phase.kind === 'ready'
        ? stance.current.facing - (aim + handSway(now / 1000))
        : phase.attempt.flight.impact.heading;
    handHeading = handHeading ? stepHeadingSpring(handHeading, handTarget, seconds, HAND_LAG) : springAt(handTarget);
    handPitch = handPitch ? stepSpring(handPitch, pitch, seconds, HAND_LAG) : springAt(pitch);
    const heading = handHeading.value;

    // Swung along the way the feet went, in the terms of the way the body faces.
    stride = strideFor(stride, stepped[0], stepped[1], heading, seconds);
    const stepSpeed = seconds > 0 ? Math.hypot(stepped[1][0] - stepped[0][0], stepped[1][1] - stepped[0][1]) / seconds : 0;
    pace = easeToward(pace, stepSpeed, PACE_EASE, seconds);

    if (handingOff) {
      // A fixed swing, not an eased one: the flight starts on a schedule, and
      // the hand must arrive at the release exactly when it does.
      const t = intoPhase / handOff;
      motion = { shown: swingAtRelease + (0 - swingAtRelease) * t * t, recovering: true };
    } else {
      // Through the follow-through the arm lives on the world's clock, so it
      // moves in slow motion with the knife it just let go of, and holds still
      // through the hitstop.
      const armSeconds =
        phase.kind === 'flying' ? worldSeconds * rateAt(intoFlight, state.playbackScale) : worldSeconds;
      motion = stepArm(motion, draw === null ? READY_SWING : swingForDraw(draw), released, armSeconds);
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
        releaseBladeAngle:
          phase.kind === 'ready'
            ? releaseBladeAngle(state.config)
            : phase.attempt.flight.samples[0]!.bladeAngle,
        loft: handPitch.value - state.config.style.pitch,
        raised,
        spec: phase.kind === 'ready' ? state.knife : phase.attempt.knife,
        hands: state.hands,
        stride,
        // Over the top from wherever the draw left the arm.
        ...(handingOff ? { throwFrom: swingAtRelease } : {}),
      },
      motion.shown,
    );
    // The rigged character is the thrower in every view once it has loaded —
    // through their own eyes too, head folded away — and the knife goes in its
    // hand. Until then the drawn body stands in.
    const view = state.cameraView;
    // The game's own camera lifts over the circle after a throw; debug views hold still.
    const lifted = view === 'eyes' ? overhead : view === 'arena';
    const outside = lifted || view !== 'eyes';
    const inHand = character.show({
      feet,
      heading,
      speed: pace,
      backwards: stride.along[0] < -0.5,
      pose,
      hands: state.hands,
      color: state.playerColor,
      visible: true,
      firstPerson: !outside,
    });
    // The knife's grip in the character's palm, pointing the way the drawn one does.
    const heldSpec = phase.kind === 'ready' ? state.knife : phase.attempt.knife;
    const along = bladeDirection(heading, pose.bladeAngle);
    const toGrip = gripOffset(heldSpec);
    const held = inHand
      ? {
          ...pose,
          knifeAt: [inHand[0] - along[0] * toGrip, inHand[1] - along[1] * toGrip, inHand[2] - along[2] * toGrip] as Vec3,
        }
      : pose;
    body.show(
      held,
      {
        spec: phase.kind === 'ready' ? state.knife : phase.attempt.knife,
        hands: state.hands,
        heading,
        sleeve: state.playerColor,
        head: outside,
        drawn: inHand === null,
      },
      !released || handingOff,
    );


    // The eyes go down with the throw: at the ground the knife is meant for.
    // With a free look the eyes go where the player looks, up to the sky and
    // down to the feet; otherwise they follow the throw down to the ground.
    const wantedDip =
      gaze === undefined ? eyeDip(engine.getRenderWidth() / Math.max(1, engine.getRenderHeight()), pitch) : -gaze;
    // A free look is the mouse, exactly; the throw-following view eases, since
    // a finger or a cursor can set a new angle in one jump.
    dip = dip === null || gaze !== undefined ? wantedDip : easeToward(dip, wantedDip, LOOK_FOLLOW_RATE, seconds);
    const jolt = shakeAngles(holding ? 0 : trauma, worldNow / 1000);
    camera.follow(
      cameraPose(
        feet,
        overhead,
        state.arenaRadius,
        viewHeading,
        dip,
        view,
        inHand ?? pose.throwingArm.end,
      ),
      cameraEaseRate(lifted),
      seconds,
      (distance) => eyeLocks(lifted, distance),
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
      character.dispose();
      flying?.model.dispose();
    },
  };
};

/** How quickly the character's pace follows the feet, per second. */
const PACE_EASE = 10;
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

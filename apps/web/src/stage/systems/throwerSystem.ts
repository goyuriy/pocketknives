import type { MutableRefObject } from 'react';
import {
  homeSpot,
  isOnOwnLand,
  keepOnOwnLand,
  releaseBladeAngle,
  type Board,
  type PlayerId,
  type Stance,
  type Vec2,
  type Vec3,
} from '@pocketknives/core';
import { handSway } from '../../input/handSway.js';
import { turnedFacing } from '../../input/turn.js';
import { walkStep, type WalkInput } from '../../input/walk.js';
import { rateAt, RELEASE_SLOW_MOTION } from '../../playback/releaseTimeline.js';
import type { Stage } from '../engine/createStage.js';
import { easeToward, RESTING_ARM, stepArm } from '../math/armMotion.js';
import { bodyPose, gripOffset, READY_SWING, releasePointFor, STANDING, swingForDraw, type BodyPose, type Stride } from '../math/bodyPose.js';
import { bladeDirection } from '../math/coords.js';
import { springAt, stepHeadingSpring, stepSpring, type Spring, type SpringTuning } from '../math/spring.js';
import { paceFor, strideFor } from '../math/stride.js';
import type { HandInput } from '../snapshot.js';
import { createBodyView } from '../views/bodyView.js';
import { createCharacterView } from '../views/characterView.js';
import { createWalker } from '../views/walker.js';
import type { System } from './system.js';

/** How briskly the free arm rises to point, and drops again, per second. */
const FREE_ARM_RATE = 9;

/**
 * How the hand trails the view: brisk, with a touch of overshoot. The view
 * follows the mouse exactly — any lag there feels floaty — and the weight goes
 * on the hand instead, which swings round after a quick turn and settles.
 */
const HAND_LAG: SpringTuning = { frequency: 3.5, damping: 0.6 };

/** Where the thrower is this frame, for the camera to follow. */
export type ThrowerOut = {
  readonly feet: Vec2;
  /** The line the body faces and the knife points along — the hand's, trailing the view on its spring. */
  readonly heading: number;
  /** The throwing hand, in game coordinates. */
  readonly hand: Vec3;
  /** Where the eyes look across the ground: exactly where the player turned, this frame. */
  readonly viewHeading: number;
  /** How steeply the hand is set to throw, radians above level. */
  readonly pitch: number;
  /** Where the eyes look, radians above level, when the player has a free look; absent when the view follows the throw. */
  readonly look: number | undefined;
};

export type ThrowerInputs = {
  /** Where the pointer has put the hand right now. */
  readonly hand: () => HandInput;
  /** Which way the player is asking to walk right now. */
  readonly walk: () => WalkInput;
  /** How hard the player is asking to turn right now, -1 to 1, positive right. */
  readonly turn: () => number;
  /** Where the thrower stands and faces. This system moves the feet and turns the body; the controls turn the facing too. */
  readonly stance: MutableRefObject<Stance>;
};

/**
 * The thrower: walking their ground, drawing and throwing, as the rigged
 * character (the drawn body standing in until it loads) with the knife in its
 * hand.
 *
 * Walking is simulated here because it is the one input that meets the
 * physics world — knives standing in the ground are solid — so it runs in the
 * physics' own fixed steps (the engine's 1/60 s time step), not once a frame:
 * a variable step makes the body move and collide a little differently at 60
 * frames a second than at 144. Where the feet end up is written back to
 * `stance`, which is what a throw is thrown from. It never decides a throw:
 * that is the game's, from the stance and the intent it is sent.
 *
 * Effectful: owns the thrower's views and registers the walk on the physics step.
 */
export const createThrowerSystem = (
  stage: Stage,
  gravity: number,
  { hand, walk, turn, stance }: ThrowerInputs,
): System<ThrowerOut> => {
  const { scene, playfield, shadows, engine } = stage;
  const body = createBodyView(scene, playfield, shadows);
  const character = createCharacterView(scene, shadows);
  const walker = createWalker(stage, gravity);

  // Whose ground the thrower was last put on — a new turn puts them on their own.
  let placedFor: string | null = null;
  // The ground the feet may walk this instant; null while they stay planted.
  let walkable: { readonly board: Board; readonly playerId: PlayerId } | null = null;
  // Where the feet were when last drawn, for how far they walked since.
  let feetShown: Vec2 = stance.current.feet;
  let stride: Stride = STANDING;
  let pace = 0;
  let motion = RESTING_ARM;
  let raised = 0;
  // Where the arm was when the hand let go: the hand-off swings it from here.
  let swingAtRelease = 0;
  let released: number | null = null;
  let handHeading: Spring | null = null;
  let handPitch: Spring | null = null;

  /**
   * One fixed physics step of walking: wherever the player asks, as far as
   * solid things allow, and never off their own ground.
   */
  const walkOneStep = () => {
    if (!walkable || hand().draw !== null) return;
    const seconds = engine.getTimeStep() / 1000;
    const { feet, facing } = stance.current;
    const walked = walker.step(feet, walkStep(feet, walk(), facing, seconds), seconds);
    const allowed = keepOnOwnLand(walkable.board, walkable.playerId, feet, walked);
    if (allowed[0] !== walked[0] || allowed[1] !== walked[1]) walker.place(allowed);
    stance.current = { ...stance.current, feet: allowed };
  };
  const stepObserver = scene.onBeforeStepObservable.add(walkOneStep);

  return {
    update: (frame) => {
      const { state, phase, seconds, now, world } = frame;
      const { aim, pitch, draw, look, viewFollowsAim } = hand();

      // Feet stay planted through a throw, and while the hand holds one.
      const planted = phase.kind !== 'ready' || draw !== null;
      if (!planted) {
        // A new turn, or ground taken from under the thrower's feet: back home,
        // in the middle of their ground, facing the centre of the circle.
        if (placedFor !== state.playerId || !isOnOwnLand(state.board, state.playerId, stance.current.feet)) {
          const feet = homeSpot(state.board, state.playerId) ?? stance.current.feet;
          const facing = Math.hypot(feet[0], feet[1]) > 1e-6 ? Math.atan2(-feet[1], -feet[0]) : stance.current.facing;
          stance.current = { feet, facing };
          walker.place(feet);
          placedFor = state.playerId;
          feetShown = feet;
        }
        // Turning, for when nothing captures the mouse: the keys, or a cursor
        // held out at the edge of the screen pulling the body round after it.
        stance.current = { ...stance.current, facing: turnedFacing(stance.current.facing, turn(), seconds) };
      }
      walkable = planted ? null : { board: state.board, playerId: state.playerId };

      // Where the feet went since the last frame — walking happens in the
      // fixed physics steps before it, however many there were.
      const stepped: [Vec2, Vec2] = [feetShown, stance.current.feet];
      feetShown = stance.current.feet;
      const feet = stance.current.feet;
      const viewHeading = stance.current.facing - (viewFollowsAim ? aim : 0);
      // Where the hand points: the aim, with its own waver, which is thrown as
      // well as drawn — what the player sees is the line the knife would leave
      // on. Once thrown, the line it did leave on. The hand gets there on a
      // spring, trailing a quick turn of the view and settling.
      const handTarget =
        phase.kind === 'ready' ? stance.current.facing - (aim + handSway(now / 1000)) : phase.attempt.flight.impact.heading;
      handHeading = handHeading ? stepHeadingSpring(handHeading, handTarget, seconds, HAND_LAG) : springAt(handTarget);
      handPitch = handPitch ? stepSpring(handPitch, pitch, seconds, HAND_LAG) : springAt(pitch);
      const heading = handHeading.value;
      // Swung along the way the feet went, in the terms of the way the body faces.
      stride = strideFor(stride, stepped[0], stepped[1], heading, seconds);
      pace = paceFor(pace, stepped[0], stepped[1], seconds);

      // The arm: the moment a throw starts playing, the swing it was at is where the hand-off begins.
      const playingIndex = phase.kind === 'ready' ? null : phase.attempt.record.index;
      if (playingIndex !== null && playingIndex !== released) swingAtRelease = motion.shown;
      released = playingIndex;
      if (frame.handingOff) {
        // A fixed swing, not an eased one: the flight starts on a schedule, and
        // the hand must arrive at the release exactly when it does.
        const t = frame.into / RELEASE_SLOW_MOTION.handOff;
        motion = { shown: swingAtRelease * (1 - Math.min(1, t) ** 2), recovering: true };
      } else {
        // Through the follow-through the arm lives on the world's clock, so it
        // moves in slow motion with the knife it just let go of, and holds
        // still through the hitstop.
        const armSeconds = phase.kind === 'flying' ? world.seconds * rateAt(frame.intoFlight, frame.playbackScale) : world.seconds;
        motion = stepArm(motion, draw === null ? READY_SWING : swingForDraw(draw), frame.released, armSeconds);
      }
      // The free arm comes up to point only while the button is held.
      raised = easeToward(raised, draw !== null && !frame.released ? 1 : 0, FREE_ARM_RATE, seconds);

      const spec = phase.kind === 'ready' ? state.knife : phase.attempt.knife;
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
            phase.kind === 'ready' ? releaseBladeAngle(state.config) : phase.attempt.flight.samples[0]!.bladeAngle,
          loft: handPitch.value - state.config.style.pitch,
          raised,
          spec,
          hands: state.hands,
          stride,
          // Over the top from wherever the draw left the arm.
          ...(frame.handingOff ? { throwFrom: swingAtRelease } : {}),
        },
        motion.shown,
      );

      // The rigged character is the thrower in every view once it has loaded —
      // through their own eyes, only the arms — and the knife goes in its
      // hand. Until then the drawn body stands in.
      const inHand = character.show({
        feet,
        heading,
        speed: pace,
        backwards: stride.along[0] < -0.5,
        pose,
        hands: state.hands,
        color: state.playerColor,
        visible: true,
        firstPerson: !frame.outside,
      });
      body.show(held(pose, inHand, heading, gripOffset(spec)), {
        spec,
        hands: state.hands,
        heading,
        sleeve: state.playerColor,
        head: frame.outside,
        drawn: inHand === null,
      }, !frame.released || frame.handingOff);

      return { feet, heading, hand: inHand ?? pose.throwingArm.end, viewHeading, pitch, look };
    },
    dispose: () => {
      scene.onBeforeStepObservable.remove(stepObserver);
      body.dispose();
      character.dispose();
      walker.dispose();
    },
  };
};

/** The pose with the knife's grip in the character's palm, pointing the way the drawn one does. */
const held = (pose: BodyPose, inHand: Vec3 | null, heading: number, toGrip: number): BodyPose => {
  if (!inHand) return pose;
  const along = bladeDirection(heading, pose.bladeAngle);
  return {
    ...pose,
    knifeAt: [inHand[0] - along[0] * toGrip, inHand[1] - along[1] * toGrip, inHand[2] - along[2] * toGrip],
  };
};

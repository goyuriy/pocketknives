import type { MutableRefObject } from 'react';
import { homeSpot, isOnOwnLand, keepOnOwnLand, type Stance, type Vec2, type Vec3 } from '@pocketknives/core';
import { handSway } from '../../input/handSway.js';
import { walkStep, type WalkInput } from '../../input/walk.js';
import { rateAt, RELEASE_SLOW_MOTION } from '../../playback/releaseTimeline.js';
import type { Stage } from '../engine/createStage.js';
import { easeToward, RESTING_ARM, stepArm } from '../math/armMotion.js';
import { bodyPose, gripOffset, READY_SWING, releasePointFor, STANDING, swingForDraw, type BodyPose, type Stride } from '../math/bodyPose.js';
import { bladeDirection } from '../math/coords.js';
import { paceFor, strideFor } from '../math/stride.js';
import type { HandInput } from '../snapshot.js';
import { createBodyView } from '../views/bodyView.js';
import { createCharacterView } from '../views/characterView.js';
import { createWalker } from '../views/walker.js';
import type { System } from './system.js';

/** How briskly the free arm rises to point, and drops again, per second. */
const FREE_ARM_RATE = 9;

/** Where the thrower is this frame, for the camera to follow. */
export type ThrowerOut = {
  readonly feet: Vec2;
  /** The line the body faces and the knife points along. */
  readonly heading: number;
  /** The throwing hand, in game coordinates. */
  readonly hand: Vec3;
};

export type ThrowerInputs = {
  /** Where the pointer has put the hand right now. */
  readonly hand: () => HandInput;
  /** Which way the player is asking to walk right now. */
  readonly walk: () => WalkInput;
  /** Where the thrower stands and faces. This system moves the feet; the controls turn the facing. */
  readonly stance: MutableRefObject<Stance>;
};

/**
 * The thrower: walking their ground, drawing and throwing, as the rigged
 * character (the drawn body standing in until it loads) with the knife in its
 * hand.
 *
 * Walking is simulated here, a frame at a time, because it is the one input
 * that meets the physics world — knives standing in the ground are solid —
 * and where the feet end up is written back to `stance`, which is what a
 * throw is thrown from. It never decides a throw: that is the game's, from
 * the stance and the intent it is sent.
 */
export const createThrowerSystem = (stage: Stage, gravity: number, { hand, walk, stance }: ThrowerInputs): System<ThrowerOut> => {
  const { scene, playfield, shadows } = stage;
  const body = createBodyView(scene, playfield, shadows);
  const character = createCharacterView(scene, shadows);
  const walker = createWalker(stage, gravity);

  // Whose ground the thrower was last put on — a new turn puts them on their own.
  let placedFor: string | null = null;
  let stride: Stride = STANDING;
  let pace = 0;
  let motion = RESTING_ARM;
  let raised = 0;
  // Where the arm was when the hand let go: the hand-off swings it from here.
  let swingAtRelease = 0;
  let released: number | null = null;

  return {
    update: (frame) => {
      const { state, phase, seconds, now } = frame;
      const { aim, pitch, draw } = hand();

      // Where the feet went this frame; nowhere, unless walking.
      let stepped: [Vec2, Vec2] = [stance.current.feet, stance.current.feet];
      if (phase.kind === 'ready' && draw === null) {
        // A new turn, or ground taken from under the thrower's feet: back home,
        // in the middle of their ground, facing the centre of the circle.
        if (placedFor !== state.playerId || !isOnOwnLand(state.board, state.playerId, stance.current.feet)) {
          const feet = homeSpot(state.board, state.playerId) ?? stance.current.feet;
          const facing = Math.hypot(feet[0], feet[1]) > 1e-6 ? Math.atan2(-feet[1], -feet[0]) : stance.current.facing;
          stance.current = { feet, facing };
          walker.place(feet);
          placedFor = state.playerId;
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
      const feet = stance.current.feet;
      // The hand's own waver is drawn as well as thrown: what the player sees is
      // exactly the line the knife would leave on.
      const heading =
        phase.kind === 'ready' ? stance.current.facing - (aim + handSway(now / 1000)) : phase.attempt.flight.impact.heading;
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
        // moves in slow motion with the knife it just let go of.
        const worldSeconds = phase.kind === 'flying' ? seconds * rateAt(frame.intoFlight, frame.playbackScale) : seconds;
        motion = stepArm(motion, draw === null ? READY_SWING : swingForDraw(draw), frame.released, worldSeconds);
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
          releaseBladeAngle: state.config.style.startingBladeAngle,
          loft: pitch - state.config.style.pitch,
          raised,
          spec,
          hands: state.hands,
          stride,
        },
        motion.shown,
      );

      // The rigged character is the thrower in every view once it has loaded —
      // through their own eyes too, head folded away — and the knife goes in
      // its hand. Until then the drawn body stands in.
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

      return { feet, heading, hand: inHand ?? pose.throwingArm.end };
    },
    dispose: () => {
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

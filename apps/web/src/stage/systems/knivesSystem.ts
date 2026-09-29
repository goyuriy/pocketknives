import type { Scene } from '@babylonjs/core/scene';
import type { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import type { ShadowGenerator } from '@babylonjs/core/Lights/Shadows/shadowGenerator';
import type { KnifeSpec, Vec3 } from '@pocketknives/core';
import type { Attempt } from '../../state/attempts.js';
import type { ImpactSound } from '../../audio/impactSound.js';
import { flightTimeAt } from '../../playback/releaseTimeline.js';
import { impactFeel, type ImpactFeel } from '../math/impactFeel.js';
import { flyingPlacement } from '../math/knifePlacement.js';
import { shakeAmplitude, shakeDuration, shakeOffset } from '../math/shake.js';
import { createDustView } from '../views/dustView.js';
import { createGroundKnives, type Landing } from '../views/groundKnives.js';
import { createKnifeModel, place, type KnifeModel } from '../views/knifeModel.js';
import type { System } from './system.js';

/** Milliseconds before now that a knife found already on the ground is taken to have landed. */
const LONG_AGO = 60_000;

/**
 * Every thrown knife: the one in the air, and those lying where they fell.
 *
 * The moment a knife reaches the ground — the frame that crosses from flying
 * into landed — is this system's: the dust, the thunk, the knife starting to
 * quiver or bounce. It hands on the camera's jolt from that impact.
 */
export const createKnivesSystem = (
  scene: Scene,
  playfield: TransformNode,
  shadows: ShadowGenerator,
  sound: ImpactSound,
): System<Vec3 | undefined> => {
  const dust = createDustView(scene, playfield);
  const ground = createGroundKnives(scene, shadows);
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
  // The last knife to hit the ground, and when: everything that happens on
  // impact — dust, sound, shake, quiver, bounce — is timed from this.
  let impact: { attempt: Attempt; at: number; feel: ImpactFeel } | null = null;

  return {
    update: (frame) => {
      const { phase, now, state } = frame;

      if (phase.kind !== 'ready' && frame.landed && !landings.has(phase.attempt)) {
        // The flight's playback has just reached the ground.
        const { flight, verdict, seed, knife } = phase.attempt;
        const feel = impactFeel(verdict, flight.impact, knife);
        impact = { attempt: phase.attempt, at: now, feel };
        landings.set(phase.attempt, { at: now, feel });
        const where: Vec3 = [flight.impact.point[0], flight.impact.point[1], 0.02];
        dust.burst(where, flight.impact.heading, feel.weight, feel.pace, seed, now / 1000);
        sound.play(feel);
      }

      const inAir = phase.kind === 'flying' ? flyingKnife(phase.attempt.knife) : null;
      flying?.model.root.setEnabled(inAir !== null && !frame.handingOff);
      if (inAir && phase.kind === 'flying' && !frame.handingOff) {
        // Off the fingers at a crawl, then up to the cruising pace — which is
        // itself slower than real time, because the knife's turn is worth watching.
        place(inAir.root, flyingPlacement(phase.attempt.flight, flightTimeAt(frame.intoFlight, frame.playbackScale)));
      }

      // Forget knives that have been picked up. Knives already on the ground
      // when this screen first saw them — a reload, or joining a room
      // mid-match — landed long ago, and lie still.
      for (const attempt of landings.keys()) if (!state.thrown.includes(attempt)) landings.delete(attempt);
      for (const attempt of state.thrown) {
        const inPlay = phase.kind !== 'ready' && phase.attempt === attempt;
        if (!inPlay && !landings.has(attempt)) {
          landings.set(attempt, { at: now - LONG_AGO, feel: impactFeel(attempt.verdict, attempt.flight.impact, attempt.knife) });
        }
      }
      ground.show(state.thrown, landings, now);
      dust.update(now / 1000);

      const since = impact && landings.has(impact.attempt) ? (now - impact.at) / 1000 : Infinity;
      return impact && Number.isFinite(since)
        ? shakeOffset(since, shakeAmplitude(impact.feel.kind, impact.feel.weight, impact.feel.pace), shakeDuration(impact.feel.weight))
        : undefined;
    },
    dispose: () => {
      dust.dispose();
      ground.dispose();
      flying?.model.dispose();
    },
  };
};

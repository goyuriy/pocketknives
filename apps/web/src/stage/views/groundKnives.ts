import type { Scene } from '@babylonjs/core/scene';
import type { Mesh } from '@babylonjs/core/Meshes/mesh';
import { CreateBox } from '@babylonjs/core/Meshes/Builders/boxBuilder';
import { Quaternion, Vector3 } from '@babylonjs/core/Maths/math.vector';
import type { ShadowGenerator } from '@babylonjs/core/Lights/Shadows/shadowGenerator';
import { PhysicsAggregate } from '@babylonjs/core/Physics/v2/physicsAggregate';
import { PhysicsShapeType } from '@babylonjs/core/Physics/v2/IPhysicsEnginePlugin';
import { knifeLength, type KnifeSpec } from '@pocketknives/core';
import type { Attempt } from '../../state/useGame.js';
import { toWorld } from '../math/coords.js';
import type { ImpactFeel } from '../math/impactFeel.js';
import { bouncingPlacement, quiveringPlacement, quiverLean, stuckPlacement } from '../math/knifePlacement.js';
import { rebound } from '../math/rebound.js';
import { createKnifeModel, placeInWorld, type KnifeModel } from './knifeModel.js';

/** When a knife hit the ground, and how hard — what its settling is timed and scaled from. */
export type Landing = { readonly at: number; readonly feel: ImpactFeel };

export type GroundKnives = {
  /**
   * Brings the knives on the ground in line with `thrown`: knives that have
   * landed are shown, knives no longer listed are picked up. `landings` says
   * which have landed and when (performance time, ms).
   */
  readonly show: (thrown: readonly Attempt[], landings: ReadonlyMap<Attempt, Landing>, now: number) => void;
  readonly dispose: () => void;
};

type Lying = {
  readonly model: KnifeModel;
  /** A stuck knife's solid stand-in, for walking into. */
  collider: Mesh | null;
  collision: PhysicsAggregate | null;
  /** A knife that did not stick, being bounced by the physics engine. */
  body: PhysicsAggregate | null;
};

/**
 * Every knife thrown this match, left where it fell.
 *
 * A stuck knife stands in the ground, quivering and then still, and is solid:
 * the thrower walks round it, not through it. A knife that did not stick is
 * handed to the physics engine the moment it lands — kicked off the ground the
 * way it arrived (`rebound`) and bounced to rest for real — and can be kicked
 * about afterwards. None of this decides anything; a knife that did not stick
 * claimed nothing, and one that stuck has already cut.
 *
 * A knife that went in but lies too low to be grabbed by the handle stands
 * where it went in, like any stuck knife — it is dimmed, because it does not
 * count, but it is not knocked flat, because it did not skip.
 *
 * Before physics has loaded, knives settle on a scripted bounce instead, and
 * nothing is solid.
 */
export const createGroundKnives = (scene: Scene, shadows: ShadowGenerator): GroundKnives => {
  const lying = new Map<Attempt, Lying>();
  const physicsOn = () => scene.getPhysicsEngine() !== null;

  const pickUp = (attempt: Attempt, knife: Lying) => {
    knife.body?.dispose();
    knife.collision?.dispose();
    knife.collider?.dispose();
    knife.model.dispose();
    lying.delete(attempt);
  };

  const layDown = (attempt: Attempt, landing: Landing): Lying => {
    const model = createKnifeModel(scene, `ground-knife-${lying.size}`, attempt.knife, shadows);
    model.setDimmed(!attempt.verdict.stuck);
    const knife: Lying = { model, collider: null, collision: null, body: null };
    if (!attempt.verdict.planted && physicsOn()) {
      placeInWorld(model.root, { ...attempt.flight.samples.at(-1)!, heading: attempt.flight.impact.heading });
      knife.body = tumble(model, attempt, landing);
    }
    return knife;
  };

  return {
    show: (thrown, landings, now) => {
      for (const [attempt, knife] of lying) if (!thrown.includes(attempt)) pickUp(attempt, knife);

      for (const attempt of thrown) {
        const landing = landings.get(attempt);
        if (!landing) continue; // still in the air
        const knife = lying.get(attempt) ?? lying.set(attempt, layDown(attempt, landing)).get(attempt)!;
        const since = (now - landing.at) / 1000;
        const { flight, verdict } = attempt;

        if (verdict.planted) {
          placeInWorld(
            knife.model.root,
            quiveringPlacement(flight, verdict.depth, quiverLean(since, landing.feel.strength, landing.feel.clean)),
          );
          if (!knife.collision && physicsOn()) solidify(scene, knife, attempt);
        } else if (!knife.body) {
          placeInWorld(knife.model.root, bouncingPlacement(flight, since, landing.feel.strength));
        }
      }
    },
    dispose: () => {
      for (const [attempt, knife] of lying) pickUp(attempt, knife);
    },
  };
};

/** The box a knife fills, in its own frame: along the blade, through its thickness, across its width. */
const extentsOf = (spec: KnifeSpec): Vector3 => new Vector3(knifeLength(spec), 0.02, 0.045);
/** The box's middle, measured from the balance point the model is built around. */
const centreOf = (spec: KnifeSpec): Vector3 => new Vector3(knifeLength(spec) * (0.5 - spec.balance), 0, 0);

/** Hands a knife that did not stick to the physics engine, already moving the way it bounced off. */
const tumble = (model: KnifeModel, attempt: Attempt, landing: Landing): PhysicsAggregate => {
  const body = new PhysicsAggregate(
    model.root,
    PhysicsShapeType.BOX,
    {
      mass: attempt.knife.mass,
      extents: extentsOf(attempt.knife),
      center: centreOf(attempt.knife),
      friction: 0.7,
      restitution: 0.25 + 0.15 * landing.feel.pace,
    },
    model.root.getScene(),
  );
  const { linear, angular } = rebound(attempt.flight);
  body.body.setLinearVelocity(new Vector3(...toWorld(linear)));
  body.body.setAngularVelocity(new Vector3(...toWorld(angular)));
  return body;
};

/**
 * Gives a stuck knife something solid to walk into: an invisible box where it
 * stands at rest. Kept apart from the knife itself, which goes on quivering —
 * a wall that wobbled would shove the walker about.
 */
const solidify = (scene: Scene, knife: Lying, attempt: Attempt) => {
  const { flight, verdict, knife: spec } = attempt;
  const box = CreateBox('stuck-knife-collider', { size: 1 }, scene);
  box.isVisible = false;
  box.isPickable = false;
  box.scaling = extentsOf(spec);
  placeInWorld(box, stuckPlacement(flight, verdict.depth));
  // The model's box is centred off its balance point; shift the stand-in to match.
  box.position.addInPlace(centreOf(spec).applyRotationQuaternion(box.rotationQuaternion ?? Quaternion.Identity()));
  knife.collider = box;
  knife.collision = new PhysicsAggregate(box, PhysicsShapeType.BOX, { mass: 0 }, scene);
};

import type { Scene } from '@babylonjs/core/scene';
import type { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import type { Vec2 } from '@pocketknives/core';
import { CUT_DURATION, IMPACT_BEAT } from '../../playback/throwPlayback.js';
import { reachDots } from '../math/reachLine.js';
import { createArenaView } from '../views/arenaView.js';
import type { Frame } from '../frame.js';
import type { System } from './system.js';

/**
 * The ground: who holds what, the chalked edge of the thrower's reach, and the
 * cut the last knife made, drawn out from where it landed.
 */
export const createArenaSystem = (scene: Scene, playfield: TransformNode, radius: number): System<void> => {
  const arena = createArenaView(scene, playfield, radius);
  // The chalked reach, kept until the thrower's ground or reach changes.
  let reach: { fields: unknown; playerId: string; reach: number; dots: readonly Vec2[] } | null = null;
  const reachOf = ({ state }: Frame): readonly Vec2[] => {
    if (reach?.fields !== state.fields || reach.playerId !== state.playerId || reach.reach !== state.reach) {
      const own = state.fields.filter((field) => field.ownerId === state.playerId);
      reach = { fields: state.fields, playerId: state.playerId, reach: state.reach, dots: reachDots(own, state.reach, state.arenaRadius) };
    }
    return reach.dots;
  };

  return {
    update: (frame) => {
      const { state, phase, settled } = frame;
      arena.showFields(state.fields, state.alive);
      arena.showReach(state.showReach ? reachOf(frame) : null, state.playerColor);
      arena.showCut(
        settled?.outcome?.kind === 'claimed' ? settled.outcome.cut : null,
        phase.kind === 'cutting' ? Math.min(1, Math.max(0, (frame.into - IMPACT_BEAT) / CUT_DURATION)) : 1,
      );
    },
    dispose: () => arena.dispose(),
  };
};

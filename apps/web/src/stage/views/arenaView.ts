import type { Scene } from '@babylonjs/core/scene';
import type { Mesh } from '@babylonjs/core/Meshes/mesh';
import type { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import { CreateDisc } from '@babylonjs/core/Meshes/Builders/discBuilder';
import type { FieldOutline, PlayerId, Vec2 } from '@pocketknives/core';
import { colorOf } from '../../ui/theme.js';
import { flatPolygon, merge, ribbon } from '../math/meshData.js';
import { mixHex } from '../math/color.js';
import { meshFromData } from './meshFromData.js';
import { paint } from './materials.js';

const SURROUND_COLOR = '#2a2119';
const DIRT_COLOR = '#453425';
/** How much dirt shows through a player's colour — more once they are out. */
const DIRT_SHOWING = { alive: 0.3, out: 0.75 };

/** Heights are in game units and tiny — this is chalk on dirt, not terrain. */
const DIRT = 0.006;
const TERRITORY = 0.012;
const BORDER = 0.03;
const CUT = 0.045;
const REACH = 0.02;
/** Chalk dots marking the edge of the thrower's reach. */
const REACH_DOT = 0.07;

export type ArenaView = {
  /** Redraws who holds what. Cheap to call every frame: it only rebuilds when `fields` is a new value. */
  readonly showFields: (fields: readonly FieldOutline[], alive: readonly PlayerId[]) => void;
  /** The line the blade laid down, grown to `progress` (0–1) from its middle. Null hides it. */
  readonly showCut: (cut: readonly [Vec2, Vec2] | null, progress: number) => void;
  /**
   * Chalks the edge of how far the thrower can reach from their ground, in
   * their colour. Cheap to call every frame: it only rebuilds when `dots` is a
   * new value. Null hides it.
   */
  readonly showReach: (dots: readonly Vec2[] | null, color: string) => void;
  readonly dispose: () => void;
};

/**
 * The circle, and the ground each player holds within it.
 *
 * A field is drawn as one mesh however many pieces it is made of — a field is
 * what the player sees, and drawing its parts separately would show seams across
 * ground that is in fact whole. Borders are drawn only where they are real
 * frontiers, so the opening wedge lines vanish once one player holds both sides.
 */
export const createArenaView = (scene: Scene, playfield: TransformNode, radius: number): ArenaView => {
  const surround = CreateDisc('surround', { radius: radius * 1.35, tessellation: 96 }, scene);
  surround.parent = playfield;
  surround.material = paint(scene, 'surround', SURROUND_COLOR);
  surround.receiveShadows = true;

  const dirt = CreateDisc('dirt', { radius, tessellation: 180 }, scene);
  dirt.parent = playfield;
  dirt.position.z = DIRT;
  dirt.material = paint(scene, 'dirt', DIRT_COLOR);
  dirt.receiveShadows = true;

  let shownFields: readonly FieldOutline[] | null = null;
  let shownAlive: readonly PlayerId[] | null = null;
  let fieldMeshes: Mesh[] = [];
  let cutMesh: Mesh | null = null;
  let shownCut: string | null = null;
  let reachMesh: Mesh | null = null;
  let shownReach: readonly Vec2[] | null = null;

  const clearFields = () => {
    fieldMeshes.forEach((mesh) => {
      mesh.material?.dispose();
      mesh.dispose();
    });
    fieldMeshes = [];
  };

  const showFields = (fields: readonly FieldOutline[], alive: readonly PlayerId[]) => {
    if (fields === shownFields && alive === shownAlive) return;
    shownFields = fields;
    shownAlive = alive;
    clearFields();

    fields.forEach((field, index) => {
      const color = colorOf(field.ownerId);
      const ground = meshFromData(
        scene,
        `field-${index}`,
        merge(field.rings.map((ring) => flatPolygon(ring, TERRITORY))),
        paint(
          scene,
          `field-${index}`,
          mixHex(color, DIRT_COLOR, alive.includes(field.ownerId) ? DIRT_SHOWING.alive : DIRT_SHOWING.out),
        ),
        playfield,
      );
      ground.receiveShadows = true;

      const border = meshFromData(
        scene,
        `border-${index}`,
        merge(field.segments.map(([a, b]) => ribbon(a, b, 0.075, BORDER))),
        paint(scene, `border-${index}`, color, { unlit: true }),
        playfield,
      );
      fieldMeshes.push(ground, border);
    });
  };

  const showCut = (cut: readonly [Vec2, Vec2] | null, progress: number) => {
    const key = cut ? `${cut.flat().join(',')}@${progress.toFixed(3)}` : null;
    if (key === shownCut) return;
    shownCut = key;
    cutMesh?.material?.dispose();
    cutMesh?.dispose();
    cutMesh = null;
    if (!cut || progress <= 0) return;

    // Grows outward from the middle, the way a crack runs from where it started.
    const [from, to] = cut;
    const middle: Vec2 = [(from[0] + to[0]) / 2, (from[1] + to[1]) / 2];
    const reach = (end: Vec2): Vec2 => [
      middle[0] + (end[0] - middle[0]) * progress,
      middle[1] + (end[1] - middle[1]) * progress,
    ];
    cutMesh = meshFromData(
      scene,
      'cut',
      ribbon(reach(from), reach(to), 0.11, CUT),
      paint(scene, 'cut', '#fff6e0', { unlit: true }),
      playfield,
    );
  };

  const showReach = (dots: readonly Vec2[] | null, color: string) => {
    if (dots === shownReach) return;
    shownReach = dots;
    reachMesh?.material?.dispose();
    reachMesh?.dispose();
    reachMesh = null;
    if (!dots || dots.length === 0) return;
    const dot = (centre: Vec2) =>
      flatPolygon(
        Array.from({ length: 6 }, (_, i): Vec2 => [
          centre[0] + Math.cos((i * Math.PI) / 3) * REACH_DOT,
          centre[1] + Math.sin((i * Math.PI) / 3) * REACH_DOT,
        ]),
        REACH,
      );
    reachMesh = meshFromData(
      scene,
      'reach',
      merge(dots.map(dot)),
      paint(scene, 'reach', mixHex(color, '#fff6e0', 0.45), { unlit: true }),
      playfield,
    );
  };

  return {
    showFields,
    showCut,
    showReach,
    dispose: () => {
      clearFields();
      cutMesh?.dispose();
      reachMesh?.material?.dispose();
      reachMesh?.dispose();
      surround.dispose(false, true);
      dirt.dispose(false, true);
    },
  };
};

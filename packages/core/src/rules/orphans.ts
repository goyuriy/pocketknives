import type { Board, PlayerId, Ring, Territory } from '../types.js';
import { area, sharedBorderLength } from '../geometry/ring.js';
import { clusterTerritories } from '../geometry/cluster.js';

export type Absorption = {
  readonly board: Board;
  /** Ground that changed hands this way, grouped by its new owner. */
  readonly transferred: ReadonlyMap<PlayerId, readonly Ring[]>;
};

/**
 * Hands over land that a cut stranded behind enemy lines.
 *
 * No islands: a player's holdings are one connected field or they are not
 * theirs. A cut can sever that field — take the stretch of border that was
 * joining two of someone's pieces and the far piece is left landlocked, with no
 * way home. Ground you cannot walk to from your own land is ground you have
 * lost, and it falls to whoever surrounds it.
 *
 * Only the victim can be stranded by a throw: the thrower's claim has to touch
 * their own land, so their field stays whole, and nobody else's ground moves.
 * Checking just the victim keeps this cheap enough to run inside the live
 * preview, where every frame resolves a full throw.
 */
export const absorbOrphans = (
  board: Board,
  victimId: PlayerId,
  minSharedBorder: number,
  tolerance: number,
): Absorption => {
  let territories = board.territories;
  const transferred = new Map<PlayerId, Ring[]>();

  // Each pass strands at most one field; a cut through a junction can sever
  // more than one, so keep going until the victim is down to a single field.
  for (let pass = 0; pass < board.territories.length; pass++) {
    const fields = clusterTerritories(
      territories.filter((t) => t.ownerId === victimId),
      minSharedBorder,
      tolerance,
    );
    if (fields.length < 2) break;

    const stranded = smallestField(fields);
    const heir = dominantNeighbour(territories, stranded, victimId, tolerance);
    if (!heir) break;

    const strandedIds = new Set(stranded.map((t) => t.id));
    territories = territories.map((t) =>
      strandedIds.has(t.id) ? { ...t, ownerId: heir } : t,
    );
    transferred.set(heir, [...(transferred.get(heir) ?? []), ...stranded.map((t) => t.ring)]);
  }

  return {
    board: territories === board.territories ? board : { ...board, territories },
    transferred,
  };
};

/** The main body is the roomiest field; everything else is stranded. */
const smallestField = (fields: readonly Territory[][]): Territory[] => {
  const sized = fields.map((field) => ({
    field,
    size: field.reduce((sum, t) => sum + area(t.ring), 0),
  }));
  return sized.reduce((best, candidate) => (candidate.size < best.size ? candidate : best)).field;
};

/**
 * Who inherits stranded ground: the neighbour holding the longest border with
 * it. Usually the thrower, whose cut did the stranding, but not always — a
 * pocket wedged against a third player goes to them instead.
 */
const dominantNeighbour = (
  territories: readonly Territory[],
  stranded: readonly Territory[],
  victimId: PlayerId,
  tolerance: number,
): PlayerId | null => {
  const strandedIds = new Set(stranded.map((t) => t.id));
  const borderByOwner = new Map<PlayerId, number>();

  for (const neighbour of territories) {
    if (neighbour.ownerId === victimId || strandedIds.has(neighbour.id)) continue;
    const shared = stranded.reduce(
      (sum, piece) => sum + sharedBorderLength(piece.ring, neighbour.ring, tolerance),
      0,
    );
    if (shared <= tolerance) continue;
    borderByOwner.set(neighbour.ownerId, (borderByOwner.get(neighbour.ownerId) ?? 0) + shared);
  }

  // Sorted by name first so an exact tie always resolves the same way, on any
  // machine — a server and a client replaying the move must not disagree.
  let heir: PlayerId | null = null;
  let longest = 0;
  for (const [ownerId, length] of [...borderByOwner].sort(([a], [b]) => (a < b ? -1 : 1))) {
    if (length > longest) {
      heir = ownerId;
      longest = length;
    }
  }
  return heir;
};

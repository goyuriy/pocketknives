import type { Board, PlayerId, Ring, Territory, Vec2 } from '../types.js';

/**
 * A circle, as a polygon. Every shape in the game is a polygon, so the arena
 * gets no special treatment and the cut logic never needs an arc case.
 */
export const circleRing = (radius: number, segments: number): Ring => {
  const ring: Vec2[] = [];
  for (let i = 0; i < segments; i++) {
    const angle = (2 * Math.PI * i) / segments;
    ring.push([radius * Math.cos(angle), radius * Math.sin(angle)]);
  }
  return ring;
};

/** Rounds `preferred` to a segment count every player's wedge can divide evenly. */
const segmentsFor = (playerCount: number, preferred: number): number =>
  Math.max(playerCount, Math.round(preferred / playerCount) * playerCount);

/**
 * The opening position: one equal wedge per player, cut like a pie.
 *
 * Wedges are built from the arena's own vertices rather than freshly computed
 * ones, so neighbouring borders share coordinates exactly. Adjacency tests later
 * depend on that — two pieces are neighbours because their outlines genuinely
 * coincide, not because they happen to land within a tolerance of each other.
 */
export const createBoard = (
  playerIds: readonly PlayerId[],
  radius = 10,
  preferredSegments = 180,
): Board => {
  if (playerIds.length < 2) throw new Error('Pocket Knives needs at least two players');

  const segments = segmentsFor(playerIds.length, preferredSegments);
  const arena = circleRing(radius, segments);
  const perWedge = segments / playerIds.length;
  const centre: Vec2 = [0, 0];

  const territories = playerIds.map((ownerId, index): Territory => {
    const ring: Vec2[] = [centre];
    for (let step = 0; step <= perWedge; step++) {
      ring.push(arena[(index * perWedge + step) % segments]!);
    }
    return { id: `t${index}`, ownerId, ring };
  });

  return { arena, radius, territories, nextTerritoryId: territories.length };
};

export const territoriesOf = (board: Board, ownerId: PlayerId): readonly Territory[] =>
  board.territories.filter((t) => t.ownerId === ownerId);

export const ownersOf = (board: Board): readonly PlayerId[] => [
  ...new Set(board.territories.map((t) => t.ownerId)),
];

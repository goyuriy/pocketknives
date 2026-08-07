/**
 * Domain vocabulary for Pocket Knives.
 *
 * Everything here is plain data — no classes, no methods, no references to the
 * renderer or the network. The whole game is a pure function over these values,
 * which is what lets the same code run in the browser (preview) and on an
 * authoritative server (truth) without modification.
 */

/** A point on the playfield plane. The playfield is 2D; the 3D view is presentation only. */
export type Vec2 = readonly [x: number, y: number];

/**
 * A point in the air above the playfield, `z` upward, ground at `z = 0`.
 *
 * Used only by the flight of a knife. The moment it lands, the third dimension
 * is spent: everything the rules care about happens back on the plane.
 */
export type Vec3 = readonly [x: number, y: number, z: number];

/**
 * A closed simple polygon, counter-clockwise, with the closing edge implied
 * (the last vertex connects back to the first). No holes: every shape in this
 * game is produced by cutting a disc with straight chords, which can never
 * create one.
 */
export type Ring = readonly Vec2[];

export type PlayerId = string;

/**
 * One contiguous piece of ground owned by one player. A player may hold several
 * pieces at once — conquering across the circle can leave their holdings split.
 */
export type Territory = {
  readonly id: string;
  readonly ownerId: PlayerId;
  readonly ring: Ring;
};

/** The full playfield: the outer circle plus every piece of ground inside it. */
export type Board = {
  /** The arena boundary, as a polygon. A circle is just a polygon with enough sides. */
  readonly arena: Ring;
  readonly radius: number;
  readonly territories: readonly Territory[];
  /**
   * Counter behind territory ids. Kept in the board rather than a module-level
   * variable so that resolving a throw stays a pure function — identical inputs
   * must always yield an identical board, or a server and a client replaying the
   * same move would disagree.
   */
  readonly nextTerritoryId: number;
};

/**
 * What a player commits to when they throw: where the blade bit into the ground,
 * and which way it was facing. The cut line runs along `direction`, both ways,
 * until it meets a boundary.
 *
 * `direction` need not be normalised.
 */
export type Throw = {
  readonly point: Vec2;
  readonly direction: Vec2;
};

/** Tunable rules, kept out of the geometry so they can be balanced without touching it. */
export type RuleSet = {
  /**
   * A player is eliminated when no piece they own can still contain a circle of
   * this radius — the computational stand-in for "you can no longer stand in
   * your own land".
   */
  readonly standRadius: number;
  /**
   * Ignore claimed pieces whose shared border with the thrower is shorter than
   * this. Guards against a claim resolving on a single touching corner.
   */
  readonly minSharedBorder: number;
};

/**
 * Why a throw produced nothing. Each of these ends the turn — this game has no
 * re-throws; a miss costs you the turn, which is what makes precision matter.
 */
export type MissReason =
  | 'outside_arena'
  | 'own_territory'
  | 'degenerate_cut'
  | 'no_connection';

/**
 * The result of resolving one throw against a board.
 *
 * `claimed` carries the next board; every other variant leaves the board
 * untouched and simply passes the turn.
 */
export type ThrowOutcome =
  | {
      readonly kind: 'claimed';
      readonly board: Board;
      readonly victimId: PlayerId;
      /** Everything the thrower gained: the cut piece plus any land it stranded. */
      readonly gainedArea: number;
      /** The piece the blade cut off, for highlighting and animation. */
      readonly claimedRing: Ring;
      /**
       * Ground that fell to the thrower because the cut left it landlocked,
       * with no route back to its owner's remaining land.
       */
      readonly absorbedRings: readonly Ring[];
      /** The cut segment, for drawing and replays. */
      readonly cut: readonly [Vec2, Vec2];
    }
  | {
      readonly kind: 'miss';
      readonly reason: MissReason;
      readonly cut: readonly [Vec2, Vec2] | null;
    };

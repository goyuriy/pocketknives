/** How far the hand wanders either side, radians. About a degree: felt, not fought. */
const SWAY = 0.02;

/**
 * The hand's own unsteadiness, at a moment in time.
 *
 * A held hand is never quite still, and a throw lets go of wherever it happened
 * to be. The sway is visible — the knife drifts on screen — so a player can wait
 * for it to come back to centre, the way a darts player waits out a waver. That
 * is a small skill on top of aiming, which is the point: without it, aiming is
 * just pointing.
 *
 * Two slow waves at unrelated rates, so it never settles into a rhythm that can
 * be counted. A pure function of time, so what is drawn and what is thrown are
 * always the same hand.
 */
export const handSway = (seconds: number): number =>
  SWAY * (0.7 * Math.sin(1.1 * seconds) + 0.3 * Math.sin(2.3 * seconds + 1.7));

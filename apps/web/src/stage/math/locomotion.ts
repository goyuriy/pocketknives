/**
 * How much of each basic movement clip to play, and how fast, for a body
 * moving at `speed` (units per second).
 *
 * Clips made in place — Mixamo's, with "in place" ticked — walk on the spot,
 * and the feet only look planted when the clip plays at the pace the body is
 * really moving. So each clip is given the ground speed it was made for, and
 * the blend plays at whatever rate brings the feet to the body's pace: idle
 * fading into a walk from a standstill, the walk handing over to the run as the
 * pace passes the walk's own.
 */
export type ClipSpeeds = {
  /** Ground speed the walk clip was made for, units per second at the scale it is shown. */
  readonly walk: number;
  readonly run: number;
};

export type Locomotion = {
  /** Blend weights, summing to one. */
  readonly idle: number;
  readonly walk: number;
  readonly run: number;
  /** Playback rate for the walk and the run: negative plays them backwards, for walking backwards. */
  readonly rate: number;
};

/** The slowest a walk clip is ever played, as a fraction of its own pace: slower reads as slow motion. */
const LEAST_RATE = 0.45;

const clamp01 = (value: number): number => Math.min(1, Math.max(0, value));

/**
 * @param speed     how fast the body is moving across the ground
 * @param backwards whether it is moving backwards relative to the way it faces
 */
export const locomotion = (speed: number, backwards: boolean, clips: ClipSpeeds): Locomotion => {
  const pace = Math.max(0, speed);
  const moving = clamp01(pace / (clips.walk * 0.5));
  const running = clamp01((pace - clips.walk) / Math.max(1e-6, clips.run - clips.walk));
  // The pace the blend of the two clips was made for, so the feet match the ground.
  const blended = clips.walk + (clips.run - clips.walk) * running;
  const rate = Math.max(LEAST_RATE, pace / blended) * (backwards ? -1 : 1);
  return {
    idle: 1 - moving,
    walk: moving * (1 - running),
    run: moving * running,
    rate,
  };
};

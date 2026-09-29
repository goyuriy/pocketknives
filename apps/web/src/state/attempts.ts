import {
  knifeById,
  simulateFlight,
  type Flight,
  type KnifeSpec,
  type PlayerId,
  type StickVerdict,
  type ThrowIntent,
  type ThrowOutcome,
  type ThrowRecord,
} from '@pocketknives/core';

/**
 * A throw as the screen needs it: the authority's record with its flight
 * redrawn and its knife looked up.
 *
 * A record carries only where the flight began; the arc is closed-form, so the
 * client draws it again exactly. Each record gets one of these, made once and
 * kept, so the views can tell knives apart by identity.
 */
export type Attempt = {
  readonly record: ThrowRecord;
  readonly playerId: PlayerId;
  readonly flight: Flight;
  readonly verdict: StickVerdict;
  readonly outcome: ThrowOutcome | null;
  readonly seed: number;
  readonly intent: ThrowIntent;
  readonly knife: KnifeSpec;
};

const made = new WeakMap<ThrowRecord, Attempt>();

export const attemptOf = (record: ThrowRecord): Attempt => {
  const known = made.get(record);
  if (known) return known;
  const attempt: Attempt = {
    record,
    playerId: record.playerId,
    flight: simulateFlight(record.launch, record.flight),
    verdict: record.verdict,
    outcome: record.outcome,
    seed: record.seed,
    intent: record.intent,
    knife: knifeById(record.knifeId).spec,
  };
  made.set(record, attempt);
  return attempt;
};

/** How many thrown knives stay lying about the circle. The oldest is picked up first. */
export const KNIVES_LEFT_OUT = 16;

/** The knives lying on the ground: the last few thrown this match. */
export const knivesOut = (throws: readonly ThrowRecord[]): readonly Attempt[] =>
  throws.slice(-KNIVES_LEFT_OUT).map(attemptOf);

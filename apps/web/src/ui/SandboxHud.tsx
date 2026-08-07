import { area, type MissReason, type StickOutcome } from '@pocketknives/core';
import type { Attempt, SandboxState } from '../state/useSandbox.js';
import { colorOf } from './theme.js';
import { SwingMeter } from './SwingMeter.js';
import { KnifePicker } from './KnifePicker.js';

const MISS_TEXT: Record<MissReason, string> = {
  outside_arena: 'Outside the circle.',
  own_territory: 'That was your own ground.',
  degenerate_cut: 'No clean cut there.',
  no_connection: "Doesn't reach your land.",
};

/**
 * Why a knife that never stuck never stuck — in terms of the hand that threw it.
 *
 * The point of reading the hand is that a miss can now be blamed on something a
 * player can change. Under-rotation and over-rotation are opposite ends of the
 * same turn and want opposite corrections, so they are never merged into one
 * message.
 */
const notStuck = (attempt: Attempt): string => {
  const { neededSpin, spin } = attempt;

  /*
   * The failure mode says what the knife did; only the needed tumble says which
   * way to correct. Rotation is cyclic, so a handle-first landing is just as
   * likely to be a wrist that carried on past the window as one that never
   * reached it — naming the mode "under-rotated" was wrong half the time, and
   * contradicted the advice sitting next to it.
   */
  const advice =
    neededSpin === null
      ? ''
      : neededSpin > spin
        ? ' Flick sharper.'
        : ' Softer wrist — straighten the stroke.';

  const reasons: Record<Exclude<StickOutcome, 'stuck'>, string> = {
    handle_first: 'Landed handle-first.',
    flat: 'Landed flat and skipped.',
    too_slow: 'No pace left in it to bite.',
  };
  const outcome = attempt.verdict.outcome as Exclude<StickOutcome, 'stuck'>;
  // Too slow is a fault of pace, not of the wrist, so the wrist advice is wrong.
  return outcome === 'too_slow'
    ? `${reasons.too_slow} Swing faster.`
    : reasons[outcome] + advice;
};

/**
 * Sticking and claiming are separate questions and are reported separately: a
 * clean stick that wins nothing is a fault of aim, not of the throw, and reading
 * it as a bad throw sends the player off correcting the wrong thing.
 */
const describe = (attempt: Attempt, arenaArea: number): string => {
  if (!attempt.verdict.stuck) return notStuck(attempt);
  if (!attempt.outcome || attempt.outcome.kind === 'miss') {
    return `Stuck. ${attempt.outcome ? MISS_TEXT[attempt.outcome.reason] : ''}`.trim();
  }
  const share = ((attempt.outcome.gainedArea / arenaArea) * 100).toFixed(1);
  return `Stuck — took ${share}% from ${attempt.outcome.victimId}.`;
};

export const SandboxHud = ({ game }: { game: SandboxState }) => {
  const arenaArea = area(game.match.board.arena);
  const attempt = game.phase.kind === 'ready' ? game.lastAttempt : game.phase.attempt;
  const throwing = game.swing !== null;

  const holdings = game.match.players.map((id) => ({
    id,
    share:
      game.match.board.territories
        .filter((t) => t.ownerId === id)
        .reduce((sum, t) => sum + area(t.ring), 0) / arenaArea,
    alive: game.alive.includes(id),
  }));

  return (
    <div className="hud">
      <div className="turn">
        <span className="swatch" style={{ background: colorOf(game.currentPlayer) }} />
        {game.currentPlayer} to throw
        <KnifePicker chosen={game.knifeId} onChoose={game.setKnifeId} />
      </div>

      <SwingMeter
        reading={throwing ? game.swing : (attempt?.reading ?? null)}
        config={game.config}
        spin={throwing ? null : (attempt?.spin ?? null)}
        neededSpin={throwing ? null : (attempt?.neededSpin ?? null)}
        color={colorOf(game.currentPlayer)}
      />

      <div className="message">
        {throwing ? 'Swing and let go.' : attempt ? describe(attempt, arenaArea) : 'Swing to throw.'}
      </div>

      <div className="standings">
        {holdings.map((h) => (
          <button
            key={h.id}
            type="button"
            className={h.alive ? 'standing' : 'standing out'}
            onClick={() => game.selectPlayer(game.match.players.indexOf(h.id))}
          >
            <span className="swatch" style={{ background: colorOf(h.id) }} />
            {h.id} {(h.share * 100).toFixed(1)}%
          </button>
        ))}
      </div>

      <div className="controls">
        <button type="button" onClick={() => game.reset(game.playerCount)}>
          Reset
        </button>
        <select
          value={game.playerCount}
          onChange={(event) => game.reset(Number(event.target.value))}
          aria-label="Number of players"
        >
          {[2, 3, 4].map((n) => (
            <option key={n} value={n}>
              {n} players
            </option>
          ))}
        </select>
        <label className="toggle">
          <input
            type="checkbox"
            checked={game.stayOnPlayer}
            onChange={(event) => game.setStayOnPlayer(event.target.checked)}
          />
          stay
        </label>
        <label className="toggle">
          slow
          <input
            type="range"
            min={0.25}
            max={1}
            step={0.05}
            value={game.playbackScale}
            onChange={(event) => game.setPlaybackScale(Number(event.target.value))}
          />
        </label>
      </div>
    </div>
  );
};

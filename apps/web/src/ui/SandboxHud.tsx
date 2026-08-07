import { area, type MissReason, type StickOutcome } from '@pocketknives/core';
import type { Attempt, SandboxState } from '../state/useSandbox.js';
import { colorOf } from './theme.js';
import { PowerMeter } from './PowerMeter.js';

const MISS_TEXT: Record<MissReason, string> = {
  outside_arena: 'Outside the circle.',
  own_territory: 'That was your own ground.',
  degenerate_cut: 'No clean cut there.',
  no_connection: "Doesn't reach your land.",
};

/**
 * Why a knife that never stuck never stuck.
 *
 * A failed throw has to explain itself or there is nothing to learn from it, and
 * these fail for different reasons that call for different fixes. Landing flat
 * or handle-first are both faults of *power*, because power sets where in its
 * tumble the knife arrives — but they are opposite ends of the same rotation,
 * and saying which one it was tells the player which way to move.
 */
const NOT_STUCK: Record<Exclude<StickOutcome, 'stuck'>, string> = {
  flat: 'Landed flat and skipped. Change the power, not the aim.',
  handle_first: 'Came down handle-first — under-rotated. Throw a little harder.',
  too_slow: 'Nothing left in it to bite. Throw harder.',
};

/**
 * Says why a throw did what it did.
 *
 * Sticking and claiming are separate questions and are reported separately: a
 * clean stick that wins nothing is a fault of aim, and reading it as a bad throw
 * would send the player off tuning the wrong thing.
 */
const describe = (attempt: Attempt, arenaArea: number): string => {
  if (!attempt.verdict.stuck) {
    return NOT_STUCK[attempt.verdict.outcome as Exclude<StickOutcome, 'stuck'>];
  }
  if (!attempt.outcome || attempt.outcome.kind === 'miss') {
    return `Stuck clean. ${attempt.outcome ? MISS_TEXT[attempt.outcome.reason] : ''}`.trim();
  }
  const share = ((attempt.outcome.gainedArea / arenaArea) * 100).toFixed(1);
  return `Stuck — took ${share}% from ${attempt.outcome.victimId}.`;
};

export const SandboxHud = ({ game }: { game: SandboxState }) => {
  const arenaArea = area(game.match.board.arena);
  const attempt = game.phase.kind === 'ready' ? game.lastAttempt : game.phase.attempt;

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
      </div>

      <PowerMeter
        power={game.aim?.power ?? null}
        bands={game.bands}
        color={colorOf(game.currentPlayer)}
        showBands
      />

      <div className="message">{attempt ? describe(attempt, arenaArea) : ''}</div>

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

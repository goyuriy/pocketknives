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
 * Why a knife that never stuck never stuck.
 *
 * With the wrist automatic, a clean throw always sticks, so a failure is the
 * hand wobbling — and the only lever a player has on that is how far they
 * reach. Saying so turns bad luck into a choice they can make differently.
 */
const NOT_STUCK: Record<Exclude<StickOutcome, 'stuck'>, string> = {
  handle_first: 'Wobbled — landed handle-first. Far throws are the shaky ones.',
  flat: 'Wobbled — landed flat and skipped. Far throws are the shaky ones.',
  too_slow: 'No pace left in it to bite. Throw harder.',
};

/**
 * Sticking and claiming are separate questions and are reported separately: a
 * clean stick that wins nothing is a fault of aim, not of the throw, and reading
 * it as a bad throw sends the player off correcting the wrong thing.
 */
const describe = (attempt: Attempt, arenaArea: number): string => {
  if (!attempt.verdict.stuck) return NOT_STUCK[attempt.verdict.outcome as Exclude<StickOutcome, 'stuck'>];
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
        color={colorOf(game.currentPlayer)}
      />

      <div className="message">
        {throwing ? 'Flick up and let go.' : attempt ? describe(attempt, arenaArea) : 'Pull back, then flick towards the circle.'}
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

      {/*
        Where to stand, along whatever rim this player still holds. Its own row
        because it is a decision taken before the throw, not a setting.
      */}
      <label className="stand">
        <span>stand</span>
        <input
          type="range"
          min={0}
          max={1}
          step={0.01}
          value={game.standPosition}
          onChange={(event) => game.setStandPosition(Number(event.target.value))}
          aria-label="Where to stand along your own edge"
        />
      </label>

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

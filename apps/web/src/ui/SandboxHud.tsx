import { area, type MissReason, type StickOutcome } from '@pocketknives/core';
import type { Attempt, SandboxState } from '../state/useSandbox.js';
import { colorOf } from './theme.js';
import { DrawMeter } from './DrawMeter.js';
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
  handle_low: "Wobbled — went in too flat to get your fingers under the handle. Doesn't count.",
};

/**
 * Sticking and claiming are separate questions and are reported separately: a
 * clean stick that wins nothing is a fault of aim, not of the throw, and reading
 * it as a bad throw sends the player off correcting the wrong thing.
 */
const result = (attempt: Attempt, arenaArea: number): string => {
  if (!attempt.verdict.stuck) return NOT_STUCK[attempt.verdict.outcome as Exclude<StickOutcome, 'stuck'>];
  if (!attempt.outcome || attempt.outcome.kind === 'miss') {
    return `Stuck. ${attempt.outcome ? MISS_TEXT[attempt.outcome.reason] : ''}`.trim();
  }
  const share = ((attempt.outcome.gainedArea / arenaArea) * 100).toFixed(1);
  return `Stuck — took ${share}% from ${attempt.outcome.victimId}.`;
};

/** A push this far off straight is worth mentioning — below it, it is just a hand. */
const NOTICEABLE_DRIFT = 0.12;

/**
 * Says so when the push went crooked.
 *
 * Drift is an error the player made rather than one the dice made, which is
 * only fair if they are told: a knife that lands left of where it pointed, with
 * no explanation, reads as the game cheating.
 */
const driftNote = (drift: number): string =>
  Math.abs(drift) < NOTICEABLE_DRIFT
    ? ''
    : ` Your push wandered ${drift > 0 ? 'right' : 'left'} and pulled the knife with it.`;

const describe = (attempt: Attempt, arenaArea: number): string =>
  result(attempt, arenaArea) + driftNote(attempt.intent.drift);

/**
 * @param debug       whether to show the sandbox controls — reset, player count,
 *                    stay, slow motion — alongside the game's own HUD
 * @param onHideDebug hides them, and the tuning panel with them
 */
export const SandboxHud = ({
  game,
  debug,
  onHideDebug,
}: {
  game: SandboxState;
  debug: boolean;
  onHideDebug: () => void;
}) => {
  const arenaArea = area(game.match.board.arena);
  const attempt = game.phase.kind === 'ready' ? game.lastAttempt : game.phase.attempt;
  const throwing = game.draw !== null;

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

      <DrawMeter
        draw={throwing ? game.draw : (attempt?.intent.draw ?? null)}
        pitch={game.pitch}
        config={game.config}
        color={colorOf(game.currentPlayer)}
      />

      <div className="message">
        {throwing
          ? 'Pull back for distance, then push forward and let go. Let go still to call it off.'
          : attempt
            ? describe(attempt, arenaArea)
            : 'Walk your own ground. Look to aim — up to lob, down for flat. Hold, pull back, push through.'}
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

      {debug && (
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
          <button type="button" onClick={onHideDebug}>
            Hide debug
          </button>
        </div>
      )}
    </div>
  );
};

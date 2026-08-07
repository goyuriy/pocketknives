import type { Board, MissReason, PlayerId, ThrowOutcome } from '@pocketknives/core';
import { area } from '@pocketknives/core';
import { colorOf } from './theme.js';

const MISS_TEXT: Record<MissReason, string> = {
  outside_arena: 'Landed outside the circle. Turn lost.',
  own_territory: 'That is your own ground. Turn lost.',
  degenerate_cut: 'No clean cut there. Turn lost.',
  no_connection: "The piece doesn't touch your land. Turn lost.",
};

const describe = (outcome: ThrowOutcome | null, share: (a: number) => number): string => {
  if (!outcome) return 'Press inside an opponent’s ground, drag to turn the blade, release to cut.';
  return outcome.kind === 'claimed'
    ? `Took ${(share(outcome.gainedArea) * 100).toFixed(1)}% of the circle from ${outcome.victimId}.`
    : MISS_TEXT[outcome.reason];
};

type Props = {
  board: Board;
  players: readonly PlayerId[];
  alive: readonly PlayerId[];
  currentPlayer: PlayerId;
  champion: PlayerId | null;
  lastOutcome: ThrowOutcome | null;
  playerCount: number;
  onReset: (playerCount: number) => void;
};

export const HUD = ({
  board,
  players,
  alive,
  currentPlayer,
  champion,
  lastOutcome,
  playerCount,
  onReset,
}: Props) => {
  const arenaArea = area(board.arena);
  const share = (value: number) => value / arenaArea;

  const holdings = players.map((id) => ({
    id,
    share: share(
      board.territories
        .filter((t) => t.ownerId === id)
        .reduce((sum, t) => sum + area(t.ring), 0),
    ),
    alive: alive.includes(id),
  }));

  return (
    <div className="hud">
      <div className="turn">
        <span className="swatch" style={{ background: colorOf(champion ?? currentPlayer) }} />
        {champion ? `${champion} wins the circle` : `${currentPlayer} to throw`}
      </div>

      <div className="message">{champion ? '' : describe(lastOutcome, share)}</div>

      <div className="standings">
        {holdings.map((h) => (
          <span key={h.id} className={h.alive ? 'standing' : 'standing out'}>
            <span className="swatch" style={{ background: colorOf(h.id) }} />
            {h.id} {(h.share * 100).toFixed(1)}%
          </span>
        ))}
      </div>

      <div className="controls">
        <button type="button" onClick={() => onReset(playerCount)}>
          Restart
        </button>
        <select
          value={playerCount}
          onChange={(event) => onReset(Number(event.target.value))}
          aria-label="Number of players"
        >
          {[2, 3, 4].map((n) => (
            <option key={n} value={n}>
              {n} players
            </option>
          ))}
        </select>
        <span className="hint">M0 — geometry only, no physics yet</span>
      </div>
    </div>
  );
};

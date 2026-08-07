import type { PowerBand } from '@pocketknives/core';

/**
 * The pull, with the sticking bands marked on it.
 *
 * Showing the bands is a sandbox decision, not a game one. Here they are the
 * instrument: retuning the throw moves them, and seeing where they land is how
 * you tell whether the change left the game playable. In the real game they are
 * almost certainly hidden — finding them by throwing is the thing to learn.
 */
export const PowerMeter = ({
  power,
  bands,
  color,
  showBands,
}: {
  power: number | null;
  bands: readonly PowerBand[];
  color: string;
  showBands: boolean;
}) => (
  <div className="meter" aria-hidden>
    <div className="meter-track">
      {showBands &&
        bands.map((band, index) => (
          <span
            key={index}
            className="meter-band"
            style={{ left: `${band.from * 100}%`, width: `${(band.to - band.from) * 100}%` }}
          />
        ))}
      {power !== null && (
        <span className="meter-needle" style={{ left: `${power * 100}%`, background: color }} />
      )}
    </div>
    <span className="meter-label">
      {power === null ? 'pull back to throw' : `${Math.round(power * 100)}%`}
    </span>
  </div>
);

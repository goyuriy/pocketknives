import { KNIVES } from '@pocketknives/core';

/**
 * The one decision made before the match rather than during it.
 *
 * Each knife is a different way to play, not a better one: what changes is how
 * much wrist it takes to turn and how much the ground forgives when it arrives.
 * The character line is the whole pitch — a player should be able to choose
 * without reading a stat block, and find the stats bear it out.
 */
export const KnifePicker = ({
  chosen,
  onChoose,
}: {
  chosen: string;
  onChoose: (id: string) => void;
}) => (
  <div className="knives">
    {KNIVES.map((knife) => (
      <button
        key={knife.id}
        type="button"
        className={knife.id === chosen ? 'knife chosen' : 'knife'}
        onClick={() => onChoose(knife.id)}
        title={knife.character}
      >
        {knife.name}
      </button>
    ))}
  </div>
);

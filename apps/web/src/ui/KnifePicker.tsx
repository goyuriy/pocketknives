import { isUnlocked, KNIVES } from '@pocketknives/core';

/**
 * The one decision made before the match rather than during it.
 *
 * Each knife is a different way to play, not a better one: what changes is how
 * far it reaches and how much of a shaky throw it forgives.
 * The character line is the whole pitch — a player should be able to choose
 * without reading a stat block, and find the stats bear it out.
 *
 * Knives held back for later still show, locked, with the level they open at:
 * something to look forward to is worth seeing.
 */
export const KnifePicker = ({
  chosen,
  level,
  onChoose,
}: {
  chosen: string;
  /** The character's level, which decides what is in the rack. */
  level: number;
  onChoose: (id: string) => void;
}) => (
  <div className="knives">
    {KNIVES.map((knife) => {
      const open = isUnlocked(knife, level);
      return (
        <button
          key={knife.id}
          type="button"
          className={knife.id === chosen ? 'knife chosen' : open ? 'knife' : 'knife locked'}
          onClick={() => open && onChoose(knife.id)}
          disabled={!open}
          title={open ? knife.character : `Opens at level ${knife.unlocksAt}. ${knife.character}`}
        >
          {open ? knife.name : `🔒 ${knife.name}`}
        </button>
      );
    })}
  </div>
);

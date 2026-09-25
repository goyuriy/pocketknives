import { isThrow, swingPower, type SwingReading, type ThrowConfig } from '@pocketknives/core';

/**
 * How hard the hand is throwing.
 *
 * One bar, because the hand supplies one thing a player needs to read back:
 * pace, which becomes distance. Direction is already on screen as the arc.
 * Winding up is not throwing, so pulling back reads as no pace at all.
 */
export const SwingMeter = ({
  reading,
  config,
  color,
}: {
  reading: SwingReading | null;
  config: ThrowConfig;
  color: string;
}) => {
  const pace = reading && isThrow(reading, config) ? swingPower(reading, config) : 0;

  return (
    <div className="swing">
      <div className="swing-row">
        <span className="swing-label">pace</span>
        <span className="swing-track">
          <span className="swing-fill" style={{ width: `${pace * 100}%`, background: color }} />
        </span>
      </div>
    </div>
  );
};

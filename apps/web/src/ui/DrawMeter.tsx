import { drawPower, type ThrowConfig } from '@pocketknives/core';

/**
 * How far the arm is drawn — which is how far the knife will fly.
 *
 * One bar, because distance is the one thing the player sets that the scene
 * does not already show: the aim is the knife itself, pointing. A notch marks
 * the least draw that throws at all.
 */
export const DrawMeter = ({
  draw,
  config,
  color,
}: {
  /** Fraction of a full draw, or null for nothing drawn. */
  draw: number | null;
  config: ThrowConfig;
  color: string;
}) => {
  const fill = draw === null ? 0 : Math.min(1, Math.max(0, draw));
  const power = draw === null ? 0 : drawPower({ aim: 0, draw, drift: 0 }, config);

  return (
    <div className="swing">
      <div className="swing-row">
        <span className="swing-label">draw</span>
        <span className="swing-track">
          <span
            className="swing-fill"
            style={{ width: `${fill * 100}%`, background: color, opacity: power > 0 ? 1 : 0.4 }}
          />
          <span className="swing-mark" style={{ left: `${config.gesture.minDraw * 100}%` }} />
        </span>
      </div>
    </div>
  );
};

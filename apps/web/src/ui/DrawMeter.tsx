import { drawPower, type ThrowConfig } from '@pocketknives/core';

/**
 * How far the arm is drawn — which is how far the knife will fly.
 *
 * Distance and angle are the two things the player sets that the scene does
 * not show precisely — the aim is the knife itself, pointing, but "a bit
 * steeper" is hard to judge from an arm. So the draw is a bar, with a notch at
 * the least draw that throws at all, and the angle is a number.
 */
export const DrawMeter = ({
  draw,
  pitch,
  config,
  color,
}: {
  /** Fraction of a full draw, or null for nothing drawn. */
  draw: number | null;
  /** The launch angle, radians. */
  pitch: number;
  config: ThrowConfig;
  color: string;
}) => {
  const fill = draw === null ? 0 : Math.min(1, Math.max(0, draw));
  const power = draw === null ? 0 : drawPower({ aim: 0, pitch: 0, draw, drift: 0 }, config);

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
        <span className="swing-angle">{Math.round((pitch * 180) / Math.PI)}°</span>
      </div>
    </div>
  );
};

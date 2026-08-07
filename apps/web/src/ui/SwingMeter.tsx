import type { SwingReading, ThrowConfig } from '@pocketknives/core';

/**
 * What the game read out of your hand.
 *
 * Two bars, because the hand supplies two independent things and a player has to
 * be able to tell which one let them down. Pace becomes distance; how sharply
 * the stroke turned becomes tumble. A throw that fell short and a throw that
 * landed flat are different mistakes, and one bar could not say which happened.
 *
 * After a throw the tumble bar also carries a mark at the rate that *would* have
 * stuck it. Being told only "it didn't stick" teaches nothing; being shown you
 * spun it 18 when it wanted 26 tells you to flick harder.
 */
export const SwingMeter = ({
  reading,
  config,
  spin,
  neededSpin,
  color,
}: {
  reading: SwingReading | null;
  config: ThrowConfig;
  spin: number | null;
  neededSpin: number | null;
  color: string;
}) => {
  const fullSpin = config.gesture.referenceCurl * 3;
  const pace = reading
    ? Math.min(1, Math.max(0, reading.speed / config.gesture.fullPowerSwipe))
    : 0;
  const shownSpin = spin ?? (reading ? Math.abs(reading.curl) * spinPerCurl(config) : 0);

  return (
    <div className="swing">
      <Bar label="pace" fill={pace} color={color} />
      <Bar
        label="tumble"
        fill={Math.min(1, Math.abs(shownSpin) / fullSpin)}
        color={color}
        mark={neededSpin === null ? undefined : Math.min(1, neededSpin / fullSpin)}
      />
    </div>
  );
};

/** Tumble the knife gets per unit of wrist turn, given its resistance to turning. */
const spinPerCurl = (config: ThrowConfig): number => {
  const { knife, style, gesture } = config;
  const length = knife.bladeLength + knife.handleLength;
  const offset = (knife.balance - 0.5) * length;
  const inertia = knife.mass * ((length * length) / 12 + offset * offset);
  return style.spinImpulse / gesture.referenceCurl / inertia;
};

const Bar = ({
  label,
  fill,
  color,
  mark,
}: {
  label: string;
  fill: number;
  color: string;
  mark?: number;
}) => (
  <div className="swing-row">
    <span className="swing-label">{label}</span>
    <span className="swing-track">
      <span className="swing-fill" style={{ width: `${fill * 100}%`, background: color }} />
      {mark !== undefined && <span className="swing-mark" style={{ left: `${mark * 100}%` }} />}
    </span>
  </div>
);

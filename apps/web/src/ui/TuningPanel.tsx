import { useState } from 'react';
import {
  DEFAULT_CONFIG,
  knifeLength,
  minStickSpeed,
  momentOfInertia,
  spinRate,
  stickWindow,
  weightFactor,
  type ThrowConfig,
} from '@pocketknives/core';

type Group = keyof ThrowConfig;

type Dial = {
  readonly group: Group;
  readonly key: string;
  readonly label: string;
  readonly min: number;
  readonly max: number;
  readonly step: number;
  readonly hint?: string;
};

/**
 * Everything worth turning while the mechanic is being found.
 *
 * Grouped the way the config is, because the grouping is the argument: the knife
 * is a physical object, the style is how a player throws it, the scatter is how
 * badly, and the ground decides what happens when it arrives.
 */
const DIALS: readonly Dial[] = [
  { group: 'knife', key: 'bladeLength', label: 'blade', min: 0.15, max: 1.2, step: 0.01, hint: 'longer forgives more' },
  { group: 'knife', key: 'handleLength', label: 'handle', min: 0.1, max: 1, step: 0.01 },
  { group: 'knife', key: 'mass', label: 'mass', min: 0.05, max: 0.8, step: 0.01, hint: 'heavier tumbles slower' },
  { group: 'knife', key: 'balance', label: 'balance', min: 0.2, max: 0.8, step: 0.01, hint: '0 butt, 1 tip' },
  { group: 'knife', key: 'edgeWidth', label: 'edge', min: 0.005, max: 0.09, step: 0.001, hint: 'finer bites deeper' },

  { group: 'style', key: 'pitch', label: 'pitch', min: 0, max: 1.2, step: 0.01 },
  { group: 'style', key: 'spinImpulse', label: 'natural spin', min: 0, max: 1.2, step: 0.005, hint: 'how many turns a throw makes' },
  { group: 'style', key: 'startingBladeAngle', label: 'start angle', min: -3.14, max: 3.14, step: 0.02 },
  { group: 'style', key: 'releaseHeight', label: 'release height', min: 0.3, max: 3, step: 0.05 },
  { group: 'style', key: 'minSpeed', label: 'min power', min: 2, max: 20, step: 0.5 },
  { group: 'style', key: 'maxSpeed', label: 'max power', min: 10, max: 45, step: 0.5 },
  { group: 'style', key: 'weightPenalty', label: 'weight drag', min: 0, max: 0.6, step: 0.01, hint: 'how much heavy knives lose reach' },

  { group: 'scatter', key: 'heading', label: 'aim wobble', min: 0, max: 0.2, step: 0.005 },
  { group: 'scatter', key: 'power', label: 'power wobble', min: 0, max: 0.25, step: 0.005 },
  { group: 'scatter', key: 'spin', label: 'spin wobble', min: 0, max: 5, step: 0.05, hint: 'the main source of misses' },
  { group: 'scatter', key: 'startingBladeAngle', label: 'grip wobble', min: 0, max: 1, step: 0.02 },

  { group: 'stick', key: 'baseMisalignment', label: 'stick window', min: 0.05, max: 1.2, step: 0.01 },
  { group: 'stick', key: 'minMomentum', label: 'min momentum', min: 0, max: 6, step: 0.1 },
  { group: 'stick', key: 'soilResistance', label: 'ground hardness', min: 2, max: 40, step: 0.5 },

  { group: 'gesture', key: 'fullDraw', label: 'full draw', min: 0.08, max: 0.6, step: 0.01, hint: 'screen-heights of pull for max range' },
  { group: 'gesture', key: 'minDraw', label: 'least draw', min: 0, max: 0.3, step: 0.01 },
  { group: 'gesture', key: 'fullWhip', label: 'full whip', min: 1, max: 10, step: 0.1, hint: 'push speed that spins the knife hardest' },
  { group: 'gesture', key: 'minPushSpeed', label: 'push speed', min: 0.1, max: 3, step: 0.05, hint: 'slower than this eases off instead of throwing' },
  { group: 'gesture', key: 'maxAim', label: 'aim reach', min: 0.2, max: 1.5, step: 0.01, hint: 'radians either side, screen edge to edge' },
  { group: 'gesture', key: 'minPitch', label: 'flattest', min: 0, max: 0.6, step: 0.01, hint: 'launch angle with the hand low, radians' },
  { group: 'gesture', key: 'maxPitch', label: 'steepest', min: 0.3, max: 1.3, step: 0.01, hint: 'launch angle with the hand high, radians' },
  { group: 'gesture', key: 'driftGain', label: 'drift pull', min: 0, max: 1.5, step: 0.05, hint: 'how much a crooked push bends the throw' },

  { group: 'flight', key: 'gravity', label: 'gravity', min: 5, max: 60, step: 0.5 },
];

const GROUP_LABELS: Record<string, string> = {
  knife: 'Knife',
  style: 'Throw',
  gesture: 'Hand',
  scatter: 'Wobble',
  stick: 'Ground',
  flight: 'World',
};

export const TuningPanel = ({
  config,
  onChange,
}: {
  config: ThrowConfig;
  onChange: (config: ThrowConfig) => void;
}) => {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const set = (dial: Dial, value: number) =>
    onChange({
      ...config,
      [dial.group]: { ...(config[dial.group] as object), [dial.key]: value },
    } as ThrowConfig);

  const read = (dial: Dial): number =>
    (config[dial.group] as unknown as Record<string, number>)[dial.key] ?? 0;

  const copy = async () => {
    await navigator.clipboard?.writeText(JSON.stringify(config, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 1400);
  };

  if (!open) {
    return (
      <button type="button" className="tuning-toggle" onClick={() => setOpen(true)}>
        Tune ▸
      </button>
    );
  }

  return (
    <div className="tuning">
      <div className="tuning-head">
        <strong>Throw tuning</strong>
        <button type="button" onClick={() => onChange(DEFAULT_CONFIG)}>
          Defaults
        </button>
        <button type="button" onClick={copy}>
          {copied ? 'Copied' : 'Copy JSON'}
        </button>
        <button type="button" onClick={() => setOpen(false)}>
          ✕
        </button>
      </div>

      {/*
        What the dials add up to. Tuning by feel alone is slow because the
        interesting quantities are all derived — nobody can see that a heavier
        knife has moved the sticking bands until the bands are on screen.
      */}
      <dl className="derived">
        <div><dt>tumble</dt><dd>{spinRate(config).toFixed(1)} rad/s</dd></div>
        <div><dt>window</dt><dd>±{((stickWindow(config) * 180) / Math.PI).toFixed(0)}°</dd></div>
        <div><dt>inertia</dt><dd>{momentOfInertia(config.knife).toFixed(4)}</dd></div>
        <div><dt>length</dt><dd>{knifeLength(config.knife).toFixed(2)}</dd></div>
        <div><dt>min speed</dt><dd>{minStickSpeed(config).toFixed(1)}</dd></div>
        <div><dt>reach</dt><dd>×{weightFactor(config).toFixed(2)}</dd></div>
      </dl>

      <div className="dials">
        {(Object.keys(GROUP_LABELS) as Group[]).map((group) => (
          <section key={group}>
            <h4>{GROUP_LABELS[group]}</h4>
            {DIALS.filter((d) => d.group === group).map((dial) => (
              <label key={`${dial.group}.${dial.key}`} className="dial" title={dial.hint}>
                <span className="dial-name">{dial.label}</span>
                <input
                  type="range"
                  min={dial.min}
                  max={dial.max}
                  step={dial.step}
                  value={read(dial)}
                  onChange={(event) => set(dial, Number(event.target.value))}
                />
                <span className="dial-value">{read(dial).toFixed(3)}</span>
              </label>
            ))}
          </section>
        ))}
      </div>
    </div>
  );
};

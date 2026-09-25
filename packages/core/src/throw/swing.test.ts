import { describe, expect, it } from 'vitest';
import { DEFAULT_CONFIG, spinRate, weightFactor, type ThrowConfig } from './config.js';
import { simulateFlight, wrapAngle } from './flight.js';
import { stickVerdict } from './stick.js';
import { standingPoint } from './launch.js';
import { KNIVES, knifeById } from './knives.js';
import {
  isThrow,
  nearestStickingSpin,
  swingLaunch,
  swingPower,
  sweetSpotAngle,
  type SwingReading,
} from './swing.js';

const stand = standingPoint(-Math.PI / 2, 10);
const rest = Math.PI / 2;

const swing = (changes: Partial<SwingReading> = {}): SwingReading => ({
  speed: 1.4,
  aimOffset: 0,
  ...changes,
});

const withKnife = (id: string): ThrowConfig => ({ ...DEFAULT_CONFIG, knife: knifeById(id).spec });

const landing = (reading: SwingReading, config: ThrowConfig = DEFAULT_CONFIG, seed?: number) =>
  simulateFlight(swingLaunch(stand, rest, reading, config, seed), config.flight).impact;

/** How often a throw sticks across many hands, at one pace. */
const stickRate = (speed: number, config: ThrowConfig = DEFAULT_CONFIG): number => {
  let stuck = 0;
  for (let seed = 1; seed <= 400; seed++) {
    if (stickVerdict(landing(swing({ speed }), config, seed), config).stuck) stuck++;
  }
  return stuck / 400;
};

describe('the player chooses only direction and pace', () => {
  it('throws further the faster the hand moves', () => {
    const reach = (speed: number) => landing(swing({ speed })).point[1] + 12;
    expect(reach(2.6)).toBeGreaterThan(reach(1.4));
    expect(reach(1.4)).toBeGreaterThan(reach(0.5));
  });

  it('follows through — a stroke to the right sends it right', () => {
    const right = swingLaunch(stand, rest, swing({ aimOffset: 0.4 })).heading;
    const left = swingLaunch(stand, rest, swing({ aimOffset: -0.4 })).heading;
    expect(right).toBeLessThan(rest);
    expect(left).toBeGreaterThan(rest);
  });

  it('reads pace as power from the least swing to the full one', () => {
    const { minSwipe, fullPowerSwipe } = DEFAULT_CONFIG.gesture;
    expect(swingPower(swing({ speed: minSwipe }))).toBe(0);
    expect(swingPower(swing({ speed: fullPowerSwipe * 2 }))).toBe(1);
  });

  it('ignores a hand that was resting rather than throwing', () => {
    expect(isThrow(swing({ speed: 0.05 }))).toBe(false);
    expect(isThrow(swing({ speed: 1.4 }))).toBe(true);
  });

  it('ignores a hand drawn back to wind up, however fast', () => {
    expect(isThrow(swing({ speed: 2, aimOffset: Math.PI }))).toBe(false);
    expect(isThrow(swing({ speed: 2, aimOffset: -2.2 }))).toBe(false);
  });
});

describe('the wrist is automatic', () => {
  it('sticks a clean throw at every pace the hand can manage, with every knife', () => {
    for (const knife of KNIVES) {
      const config = withKnife(knife.id);
      for (let speed = 0.3; speed <= 3; speed += 0.05) {
        const verdict = stickVerdict(landing(swing({ speed }), config), config);
        expect(verdict.stuck, `${knife.id} at ${speed.toFixed(2)}`).toBe(true);
      }
    }
  });

  it('lands the knife in the middle of what sticks, not on the edge of it', () => {
    const impact = landing(swing());
    const target = sweetSpotAngle(impact.descentAngle);
    expect(wrapAngle(impact.bladeAngle - target)).toBeCloseTo(0, 6);
  });

  it('keeps each knife’s character — a heavy one turns lazily, a light one whirls', () => {
    const turns = (id: string) => {
      const config = withKnife(id);
      const launch = swingLaunch(stand, rest, swing(), config);
      return launch.spin * simulateFlight(launch, config.flight).impact.time;
    };
    expect(turns('needle')).toBeGreaterThan(turns('thrower') * 1.8);
    expect(turns('cleaver')).toBeLessThan(turns('thrower'));
    expect(turns('greatsword')).toBeLessThan(Math.PI);
  });

  it('picks the sticking tumble nearest the knife’s natural one', () => {
    const launch = swingLaunch(stand, rest, swing());
    const { time } = simulateFlight(launch).impact;
    const oneTurn = (2 * Math.PI) / time;
    expect(Math.abs(launch.spin - spinRate(DEFAULT_CONFIG))).toBeLessThanOrEqual(oneTurn / 2 + 1e-9);
  });

  it('finds no forward tumble when the knife would have to turn backwards', () => {
    expect(nearestStickingSpin(10, 0, -0.5)).toBeNull();
  });
});

describe('what still goes wrong is the hand', () => {
  it('sticks a short throw all but always', () => {
    expect(stickRate(0.8)).toBeGreaterThan(0.95);
  });

  it('makes reaching far a risk', () => {
    const far = stickRate(2.6);
    expect(far).toBeLessThan(stickRate(0.8) - 0.1);
    expect(far).toBeGreaterThan(0.6);
  });

  it('never wobbles the aim — where it goes is the player’s decision', () => {
    for (let seed = 1; seed <= 50; seed++) {
      const launch = swingLaunch(stand, rest, swing({ aimOffset: 0.3 }), DEFAULT_CONFIG, seed);
      expect(launch.heading).toBeCloseTo(swingLaunch(stand, rest, swing({ aimOffset: 0.3 })).heading, 9);
    }
  });
});

describe('the knives on offer', () => {
  it('are all genuinely different objects', () => {
    const shapes = KNIVES.map((k) => JSON.stringify(k.spec));
    expect(new Set(shapes).size).toBe(KNIVES.length);
  });

  it('trade reach against forgiveness', () => {
    const reach = (id: string) => landing(swing({ speed: 2.6 }), withKnife(id)).point[1] + 12;
    expect(reach('needle')).toBeGreaterThan(reach('thrower'));
    expect(reach('greatsword')).toBeLessThan(reach('thrower') * 0.6);

    expect(stickRate(2.6, withKnife('greatsword'))).toBeGreaterThan(stickRate(2.6));
    expect(stickRate(2.6, withKnife('needle'))).toBeLessThan(stickRate(2.6));
  });

  it('holds the arm back more the heavier the knife', () => {
    expect(weightFactor(withKnife('thrower'))).toBeCloseTo(1, 9);
    expect(weightFactor(withKnife('greatsword'))).toBeLessThan(weightFactor(withKnife('cleaver')));
    expect(weightFactor(withKnife('needle'))).toBeGreaterThan(1);
  });

  it('takes two hands only for the sword', () => {
    expect(KNIVES.filter((k) => k.hands === 2).map((k) => k.id)).toEqual(['greatsword']);
  });

  it('falls back to a sane knife when asked for one that does not exist', () => {
    expect(knifeById('nonesuch').id).toBe('thrower');
  });
});

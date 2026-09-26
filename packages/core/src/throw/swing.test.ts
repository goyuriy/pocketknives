import { describe, expect, it } from 'vitest';
import { DEFAULT_CONFIG, spinRate, weightFactor, type ThrowConfig } from './config.js';
import { simulateFlight, wrapAngle } from './flight.js';
import { stickVerdict } from './stick.js';
import { standingPoint } from './launch.js';
import { KNIVES, knifeById } from './knives.js';
import {
  drawPower,
  isThrow,
  nearestStickingSpin,
  swingLaunch,
  sweetSpotAngle,
  thrownHeading,
  type ThrowIntent,
} from './swing.js';

const stand = standingPoint(-Math.PI / 2, 10);
const rest = Math.PI / 2;

const swing = (changes: Partial<ThrowIntent> = {}): ThrowIntent => ({
  draw: 0.5,
  aim: 0,
  pitch: DEFAULT_CONFIG.style.pitch,
  drift: 0,
  ...changes,
});

const withKnife = (id: string): ThrowConfig => ({ ...DEFAULT_CONFIG, knife: knifeById(id).spec });

const landing = (reading: ThrowIntent, config: ThrowConfig = DEFAULT_CONFIG, seed?: number) =>
  simulateFlight(swingLaunch(stand, rest, reading, config, seed), config.flight).impact;

/** How often a throw sticks across many hands, at one pace. */
const stickRate = (draw: number, config: ThrowConfig = DEFAULT_CONFIG): number => {
  let stuck = 0;
  for (let seed = 1; seed <= 400; seed++) {
    if (stickVerdict(landing(swing({ draw }), config, seed), config).stuck) stuck++;
  }
  return stuck / 400;
};

describe('the player chooses where, how far, and how cleanly', () => {
  it('throws further the further the arm is drawn back', () => {
    const reach = (draw: number) => landing(swing({ draw })).point[1] + 12;
    expect(reach(1)).toBeGreaterThan(reach(0.5));
    expect(reach(0.5)).toBeGreaterThan(reach(0.1));
  });

  it('points where the hand points — right is right', () => {
    const right = swingLaunch(stand, rest, swing({ aim: 0.4 })).heading;
    const left = swingLaunch(stand, rest, swing({ aim: -0.4 })).heading;
    expect(right).toBeLessThan(rest);
    expect(left).toBeGreaterThan(rest);
  });

  it('pulls a crooked push off line, the way it wandered', () => {
    const straight = thrownHeading(rest, swing());
    const toTheRight = thrownHeading(rest, swing({ drift: 0.3 }));
    expect(toTheRight).toBeLessThan(straight);
    expect(straight - toTheRight).toBeCloseTo(0.3 * DEFAULT_CONFIG.gesture.driftGain, 9);
  });

  it('throws a lob higher and longer in the air than a flat throw', () => {
    const flat = simulateFlight(swingLaunch(stand, rest, swing({ pitch: 0.12 })));
    const lob = simulateFlight(swingLaunch(stand, rest, swing({ pitch: 0.75 })));
    const peak = (flight: typeof flat) => Math.max(...flight.samples.map((s) => s.position[2]));
    expect(peak(lob)).toBeGreaterThan(peak(flat) * 2);
    expect(lob.impact.time).toBeGreaterThan(flat.impact.time);
    expect(lob.impact.descentAngle).toBeGreaterThan(flat.impact.descentAngle);
  });

  it('keeps the angle within what an arm can throw', () => {
    const { minPitch, maxPitch } = DEFAULT_CONFIG.gesture;
    expect(swingLaunch(stand, rest, swing({ pitch: 3 })).pitch).toBe(maxPitch);
    expect(swingLaunch(stand, rest, swing({ pitch: -1 })).pitch).toBe(minPitch);
  });

  it('reads draw as power from the least draw to a full one', () => {
    expect(drawPower(swing({ draw: DEFAULT_CONFIG.gesture.minDraw }))).toBe(0);
    expect(drawPower(swing({ draw: 1 }))).toBe(1);
  });

  it('ignores an arm that was hardly drawn back', () => {
    expect(isThrow(swing({ draw: 0.01 }))).toBe(false);
    expect(isThrow(swing({ draw: 0.5 }))).toBe(true);
  });
});

describe('the wrist is automatic', () => {
  it('sticks a clean throw at every draw and every angle, with every knife', () => {
    const { minPitch, maxPitch } = DEFAULT_CONFIG.gesture;
    for (const knife of KNIVES) {
      const config = withKnife(knife.id);
      for (const pitch of [minPitch, (minPitch + maxPitch) / 2, maxPitch]) {
        for (let draw = 0.06; draw <= 1; draw += 0.02) {
          const verdict = stickVerdict(landing(swing({ draw, pitch }), config), config);
          expect(verdict.stuck, `${knife.id} at draw ${draw.toFixed(2)}, pitch ${pitch}`).toBe(true);
        }
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
    expect(stickRate(0.25)).toBeGreaterThan(0.95);
  });

  it('makes reaching far a risk', () => {
    const far = stickRate(1);
    expect(far).toBeLessThan(stickRate(0.25) - 0.1);
    expect(far).toBeGreaterThan(0.6);
  });

  it('never wobbles the aim — where it goes is the player’s decision', () => {
    for (let seed = 1; seed <= 50; seed++) {
      const launch = swingLaunch(stand, rest, swing({ aim: 0.3 }), DEFAULT_CONFIG, seed);
      expect(launch.heading).toBeCloseTo(swingLaunch(stand, rest, swing({ aim: 0.3 })).heading, 9);
    }
  });
});

describe('the knives on offer', () => {
  it('are all genuinely different objects', () => {
    const shapes = KNIVES.map((k) => JSON.stringify(k.spec));
    expect(new Set(shapes).size).toBe(KNIVES.length);
  });

  it('trade reach against forgiveness', () => {
    const reach = (id: string) => landing(swing({ draw: 1 }), withKnife(id)).point[1] + 12;
    expect(reach('needle')).toBeGreaterThan(reach('thrower'));
    expect(reach('greatsword')).toBeLessThan(reach('thrower') * 0.6);

    expect(stickRate(1, withKnife('greatsword'))).toBeGreaterThan(stickRate(1));
    expect(stickRate(1, withKnife('needle'))).toBeLessThan(stickRate(1));
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

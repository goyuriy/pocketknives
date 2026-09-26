import type { ImpactFeel } from '../stage/math/impactFeel.js';
import { impactVoice, type Noise, type Ring, type Thump } from './impactVoice.js';

export type ImpactSound = {
  /**
   * Lets sound play. Browsers keep audio silent until the player has done
   * something; call this from inside a pointer or key handler.
   */
  readonly unlock: () => void;
  /** Plays the sound of an impact, now. Silent until unlocked. */
  readonly play: (feel: ImpactFeel) => void;
  readonly dispose: () => void;
};

/**
 * The speakers, for impacts.
 *
 * Effectful: owns a Web Audio context and builds a handful of short-lived
 * oscillators and filters per impact. What to play is decided by
 * `impactVoice`; this only makes it audible. Fails quiet — a browser with no
 * audio simply gets no sound.
 */
export const createImpactSound = (): ImpactSound => {
  let context: AudioContext | null = null;
  let noise: AudioBuffer | null = null;

  const ready = (): AudioContext | null => {
    if (context) return context;
    const Context = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Context) return null;
    context = new Context();
    noise = whiteNoise(context);
    return context;
  };

  return {
    unlock: () => {
      const audio = ready();
      if (audio && audio.state === 'suspended') void audio.resume();
    },
    play: (feel) => {
      const audio = context;
      if (!audio || audio.state !== 'running' || !noise) return;
      const voice = impactVoice(feel);
      const master = audio.createGain();
      master.gain.value = 0.8;
      master.connect(audio.destination);
      const now = audio.currentTime;
      if (voice.thump) thump(audio, master, voice.thump, now);
      voice.noises.forEach((burst) => noiseBurst(audio, master, noise!, burst, now));
      if (voice.ring) ring(audio, master, voice.ring, now);
    },
    dispose: () => {
      void context?.close();
      context = null;
    },
  };
};

/** A gain that jumps in almost at once and dies away exponentially — the shape of a knock. */
const envelope = (audio: AudioContext, into: AudioNode, gain: number, start: number, seconds: number): GainNode => {
  const node = audio.createGain();
  node.gain.setValueAtTime(0.0001, start);
  node.gain.exponentialRampToValueAtTime(Math.max(gain, 0.0002), start + 0.004);
  node.gain.exponentialRampToValueAtTime(0.0001, start + seconds);
  node.connect(into);
  return node;
};

const thump = (audio: AudioContext, into: AudioNode, { from, to, gain, seconds }: Thump, now: number) => {
  const tone = audio.createOscillator();
  tone.type = 'sine';
  tone.frequency.setValueAtTime(from, now);
  tone.frequency.exponentialRampToValueAtTime(to, now + seconds);
  tone.connect(envelope(audio, into, gain, now, seconds));
  tone.start(now);
  tone.stop(now + seconds + 0.02);
};

const noiseBurst = (audio: AudioContext, into: AudioNode, buffer: AudioBuffer, burst: Noise, now: number) => {
  const start = now + burst.at;
  const source = audio.createBufferSource();
  source.buffer = buffer;
  const band = audio.createBiquadFilter();
  band.type = 'bandpass';
  band.frequency.value = burst.centre;
  band.Q.value = 1 / burst.width;
  source.connect(band);
  band.connect(envelope(audio, into, burst.gain, start, burst.seconds));
  source.start(start);
  source.stop(start + burst.seconds + 0.02);
};

const ring = (audio: AudioContext, into: AudioNode, { frequency, gain, seconds }: Ring, now: number) => {
  const tone = audio.createOscillator();
  tone.type = 'triangle';
  tone.frequency.setValueAtTime(frequency, now);
  // A blade wobbling in the ground wavers slightly in pitch as it rings down.
  const wobble = audio.createOscillator();
  wobble.frequency.value = 11;
  const depth = audio.createGain();
  depth.gain.value = frequency * 0.01;
  wobble.connect(depth);
  depth.connect(tone.frequency);
  tone.connect(envelope(audio, into, gain, now + 0.01, seconds));
  tone.start(now);
  wobble.start(now);
  tone.stop(now + seconds + 0.05);
  wobble.stop(now + seconds + 0.05);
};

/** A quarter-second of white noise, reused as the raw material for every burst. */
const whiteNoise = (audio: AudioContext): AudioBuffer => {
  const buffer = audio.createBuffer(1, Math.floor(audio.sampleRate * 0.25), audio.sampleRate);
  const samples = buffer.getChannelData(0);
  for (let i = 0; i < samples.length; i++) samples[i] = Math.random() * 2 - 1;
  return buffer;
};

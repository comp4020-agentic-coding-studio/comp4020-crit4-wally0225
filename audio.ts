// Ten short percussive sounds, synthesised live with the Web Audio API — no
// sample files, so nothing here is "played back."
const NOTE_KEYS = ["q", "w", "e", "r", "t", "y", "u", "i", "o", "p"] as const;
export type NoteKey = (typeof NOTE_KEYS)[number];

export function isNoteKey(key: string): key is NoteKey {
  return (NOTE_KEYS as readonly string[]).includes(key);
}

interface NoiseOptions {
  filterType?: BiquadFilterType;
  frequency?: number;
  q?: number;
  duration?: number;
  gain?: number;
}

interface ToneOptions {
  type?: OscillatorType;
  startFreq?: number;
  endFreq?: number;
  duration?: number;
  gain?: number;
}

export class SoundEngine {
  readonly ctx: AudioContext;
  private readonly noiseBuffer: AudioBuffer;

  constructor() {
    this.ctx = new AudioContext();
    this.noiseBuffer = this.makeNoiseBuffer(1);
  }

  resume(): void {
    if (this.ctx.state === "suspended") void this.ctx.resume();
  }

  private makeNoiseBuffer(seconds: number): AudioBuffer {
    const length = Math.floor(this.ctx.sampleRate * seconds);
    const buffer = this.ctx.createBuffer(1, length, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i++) data[i] = Math.random() * 2 - 1;
    return buffer;
  }

  private noiseBurst(when: number, options: NoiseOptions = {}): void {
    const {
      filterType = "bandpass",
      frequency = 1500,
      q = 1,
      duration = 0.1,
      gain = 0.5,
    } = options;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    const filter = this.ctx.createBiquadFilter();
    filter.type = filterType;
    filter.frequency.value = frequency;
    filter.Q.value = q;
    const env = this.ctx.createGain();
    env.gain.setValueAtTime(0, when);
    env.gain.linearRampToValueAtTime(gain, when + 0.005);
    env.gain.exponentialRampToValueAtTime(0.001, when + duration);
    src.connect(filter).connect(env).connect(this.ctx.destination);
    src.start(when);
    src.stop(when + duration + 0.02);
  }

  private tone(when: number, options: ToneOptions = {}): void {
    const { type = "sine", startFreq = 600, duration = 0.15, gain = 0.4 } = options;
    const endFreq = options.endFreq ?? startFreq;
    const osc = this.ctx.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(startFreq, when);
    osc.frequency.exponentialRampToValueAtTime(Math.max(endFreq, 1), when + duration);
    const env = this.ctx.createGain();
    env.gain.setValueAtTime(0, when);
    env.gain.linearRampToValueAtTime(gain, when + 0.005);
    env.gain.exponentialRampToValueAtTime(0.001, when + duration);
    osc.connect(env).connect(this.ctx.destination);
    osc.start(when);
    osc.stop(when + duration + 0.02);
  }

  play(key: NoteKey, when: number = this.ctx.currentTime): void {
    switch (key) {
      case "q": // bubble pop
        this.tone(when, { type: "sine", startFreq: 1200, endFreq: 300, duration: 0.09, gain: 0.35 });
        break;
      case "w": // water drop
        this.tone(when, { type: "sine", startFreq: 1800, endFreq: 500, duration: 0.18, gain: 0.3 });
        break;
      case "e": // wood tap
        this.noiseBurst(when, { filterType: "bandpass", frequency: 1800, q: 6, duration: 0.05, gain: 0.5 });
        break;
      case "r": // small metal hit
        this.noiseBurst(when, { filterType: "highpass", frequency: 3500, q: 8, duration: 0.12, gain: 0.35 });
        this.tone(when, { type: "sine", startFreq: 4200, endFreq: 4200, duration: 0.15, gain: 0.08 });
        break;
      case "t": // paper rubbing
        this.noiseBurst(when, { filterType: "bandpass", frequency: 2500, q: 0.6, duration: 0.22, gain: 0.22 });
        break;
      case "y": // zipper
        for (let i = 0; i < 5; i++) {
          this.noiseBurst(when + i * 0.025, {
            filterType: "bandpass",
            frequency: 2000 + i * 300,
            q: 4,
            duration: 0.03,
            gain: 0.25,
          });
        }
        break;
      case "u": // spring / boing
        this.tone(when, { type: "triangle", startFreq: 220, endFreq: 60, duration: 0.35, gain: 0.3 });
        break;
      case "i": // small object drop, double thump
        this.noiseBurst(when, { filterType: "lowpass", frequency: 400, q: 1, duration: 0.09, gain: 0.5 });
        this.noiseBurst(when + 0.09, { filterType: "lowpass", frequency: 400, q: 1, duration: 0.05, gain: 0.25 });
        break;
      case "o": // chopsticks on glass
        this.noiseBurst(when, { filterType: "bandpass", frequency: 5000, q: 10, duration: 0.04, gain: 0.3 });
        this.tone(when, { type: "sine", startFreq: 5200, endFreq: 5200, duration: 0.08, gain: 0.15 });
        break;
      case "p": // sharp snap
        this.noiseBurst(when, { filterType: "highpass", frequency: 2000, q: 1, duration: 0.02, gain: 0.55 });
        break;
    }
  }
}

type SfxName =
  | 'click'
  | 'fire'
  | 'boom'
  | 'jump'
  | 'bounce'
  | 'hurt'
  | 'death'
  | 'splash'
  | 'turn'
  | 'victory';

/** Tiny synthesized sound kit: no audio files to download, no licensing. */
export class SoundKit {
  private ctx: AudioContext | null = null;
  private noise: AudioBuffer | null = null;
  enabled: boolean;

  constructor(enabled: boolean) {
    this.enabled = enabled;
  }

  private ensure(): AudioContext | null {
    if (!this.enabled) return null;
    if (!this.ctx) {
      const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) return null;
      this.ctx = new Ctor();
    }
    if (this.ctx.state === 'suspended') void this.ctx.resume();
    return this.ctx;
  }

  private noiseBuffer(ctx: AudioContext): AudioBuffer {
    if (this.noise) return this.noise;
    const length = Math.floor(ctx.sampleRate * 1.2);
    const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i += 1) data[i] = Math.random() * 2 - 1;
    this.noise = buffer;
    return buffer;
  }

  play(name: SfxName): void {
    const ctx = this.ensure();
    if (!ctx) return;
    const now = ctx.currentTime;
    const master = ctx.createGain();
    master.gain.value = 0.35;
    master.connect(ctx.destination);

    const tone = (freq: number, endFreq: number, duration: number, type: OscillatorType, gain = 0.5) => {
      const osc = ctx.createOscillator();
      const env = ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, now);
      osc.frequency.exponentialRampToValueAtTime(Math.max(20, endFreq), now + duration);
      env.gain.setValueAtTime(gain, now);
      env.gain.exponentialRampToValueAtTime(0.001, now + duration);
      osc.connect(env).connect(master);
      osc.start(now);
      osc.stop(now + duration + 0.02);
    };

    const noiseBurst = (duration: number, filterFreq: number, gain = 0.7) => {
      const src = ctx.createBufferSource();
      src.buffer = this.noiseBuffer(ctx);
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(filterFreq, now);
      filter.frequency.exponentialRampToValueAtTime(180, now + duration);
      const env = ctx.createGain();
      env.gain.setValueAtTime(gain, now);
      env.gain.exponentialRampToValueAtTime(0.001, now + duration);
      src.connect(filter).connect(env).connect(master);
      src.start(now);
      src.stop(now + Math.min(duration, 1.1));
    };

    switch (name) {
      case 'click':
        tone(520, 320, 0.06, 'square', 0.14);
        break;
      case 'fire':
        noiseBurst(0.22, 1800, 0.35);
        tone(220, 60, 0.25, 'sawtooth', 0.18);
        break;
      case 'boom':
        noiseBurst(0.75, 1100, 0.9);
        tone(96, 32, 0.6, 'sine', 0.6);
        break;
      case 'jump':
        tone(240, 480, 0.14, 'triangle', 0.2);
        break;
      case 'bounce':
        tone(380, 220, 0.07, 'square', 0.12);
        break;
      case 'hurt':
        tone(180, 90, 0.16, 'sawtooth', 0.25);
        break;
      case 'death':
        tone(320, 60, 0.7, 'triangle', 0.3);
        break;
      case 'splash':
        noiseBurst(0.4, 900, 0.3);
        break;
      case 'turn':
        tone(440, 660, 0.12, 'sine', 0.2);
        break;
      case 'victory':
        [523, 659, 784, 1047].forEach((f, i) => {
          const osc = ctx.createOscillator();
          const env = ctx.createGain();
          osc.type = 'triangle';
          osc.frequency.value = f;
          const start = now + i * 0.12;
          env.gain.setValueAtTime(0.0001, start);
          env.gain.exponentialRampToValueAtTime(0.3, start + 0.02);
          env.gain.exponentialRampToValueAtTime(0.0001, start + 0.32);
          osc.connect(env).connect(master);
          osc.start(start);
          osc.stop(start + 0.35);
        });
        break;
      default:
        break;
    }
  }

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    if (enabled) this.ensure();
  }
}

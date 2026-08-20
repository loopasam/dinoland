import type { DinoSpecies } from '../game/DinoSpecies';
import type { DinoNeed } from '../game/GameModel';

type Wave = OscillatorType;

const MUSIC_STEP_MS = 720;
const MUSIC_VOLUME = 0.028;
const MEADOW_MELODY = [392, 0, 523, 0, 587, 523, 440, 0, 392, 440, 523, 0, 330, 0, 392, 0];

export class SoundGarden {
  private context?: AudioContext;
  private effectsBus?: GainNode;
  private musicBus?: GainNode;
  private musicTimer?: number;
  private musicStep = 0;
  private muted = false;

  setMuted(muted: boolean): void {
    this.muted = muted;
    if (muted) this.stopSoundtrack();
    else this.unlock();
    this.applyBusVolumes();
  }

  get isMuted(): boolean {
    return this.muted;
  }

  get isSoundtrackPlaying(): boolean {
    return this.musicTimer !== undefined && !this.muted;
  }

  unlock(): void {
    if (!this.context) this.createAudioGraph();
    const context = this.context;
    if (!context) return;
    if (context.state === 'suspended') {
      void context.resume()
        .then(() => this.startSoundtrack())
        .catch(() => undefined);
    } else {
      this.startSoundtrack();
    }
  }

  egg(stage: number): void {
    if (stage === 1) this.tone(180, 0.09, 'sine', 0.06, 220);
    if (stage === 2) this.noise(0.12, 0.045, 900);
    if (stage === 3) {
      this.tone(130, 0.08, 'triangle', 0.08, 95);
      this.later(120, () => this.tone(230, 0.1, 'sine', 0.06, 280));
    }
  }

  hatch(): void {
    [262, 330, 392, 523].forEach((frequency, index) => {
      this.later(index * 85, () => this.tone(frequency, 0.24, 'triangle', 0.075, frequency * 1.06));
    });
    this.noise(0.28, 0.035, 1500);
  }

  chirp(pitch = 1): void {
    this.tone(480 * pitch, 0.12, 'sine', 0.055, 720 * pitch);
  }

  stomp(): void {
    this.tone(78, 0.13, 'sine', 0.09, 48);
    this.noise(0.08, 0.04, 220);
  }

  flowerLaunch(power: number, boosted: boolean): void {
    const strength = Math.min(1, Math.max(0.15, power));
    this.tone(112, 0.28, 'sine', 0.1 + strength * 0.045, 42);
    this.noise(0.15, 0.042 + strength * 0.025, 620);
    this.later(75, () => this.tone(310, 0.1, 'triangle', 0.04, 470));
    this.later(145, () => this.tone(520, 0.16, 'sine', 0.032, 760));
    if (boosted) {
      this.later(210, () => this.tone(880, 0.2, 'sine', 0.045, 1320));
    }
  }

  bounce(): void {
    this.tone(230, 0.09, 'sine', 0.045, 165);
  }

  eat(): void {
    [210, 175, 225].forEach((frequency, index) => {
      this.later(index * 85, () => this.tone(frequency, 0.07, 'triangle', 0.04, frequency * 0.82));
    });
  }

  dinoHit(species: DinoSpecies, intensity = 0.7): void {
    const level = Math.min(1, Math.max(0.3, intensity));
    if (species === 'triceratops') {
      this.tone(185, 0.14, 'triangle', 0.065 * level, 105);
      this.later(65, () => this.tone(260, 0.1, 'sine', 0.045 * level, 190));
      this.noise(0.06, 0.02 * level, 520);
      return;
    }
    if (species === 'trex') {
      this.tone(125, 0.22, 'sawtooth', 0.035 * level, 68);
      this.tone(82, 0.2, 'sine', 0.055 * level, 54);
      this.noise(0.13, 0.026 * level, 430);
      return;
    }
    this.tone(285, 0.2, 'sine', 0.055 * level, 480);
    this.later(105, () => this.tone(430, 0.16, 'triangle', 0.036 * level, 330));
  }

  dinoCare(species: DinoSpecies, need: DinoNeed): void {
    this.playCareCue(need);
    if (species === 'triceratops') {
      [430, 560, 690].forEach((frequency, index) => {
        this.later(90 + index * 80, () => this.tone(frequency, 0.1, 'sine', 0.045, frequency * 1.05));
      });
      return;
    }
    if (species === 'trex') {
      [175, 235, 205].forEach((frequency, index) => {
        this.later(90 + index * 95, () => this.tone(frequency, 0.12, 'triangle', 0.055, frequency * 0.88));
      });
      return;
    }
    [330, 440, 587].forEach((frequency, index) => {
      this.later(90 + index * 115, () => this.tone(frequency, 0.18, 'sine', 0.048, frequency * 1.08));
    });
  }

  private createAudioGraph(): void {
    this.context = new AudioContext();
    this.effectsBus = this.context.createGain();
    this.musicBus = this.context.createGain();
    this.effectsBus.connect(this.context.destination);
    this.musicBus.connect(this.context.destination);
    this.applyBusVolumes();
  }

  private applyBusVolumes(): void {
    const context = this.context;
    if (!context) return;
    this.effectsBus?.gain.setTargetAtTime(this.muted ? 0 : 1, context.currentTime, 0.025);
    this.musicBus?.gain.setTargetAtTime(this.muted ? 0 : MUSIC_VOLUME, context.currentTime, 0.08);
  }

  private startSoundtrack(): void {
    if (this.muted || this.musicTimer !== undefined || this.context?.state !== 'running') return;
    this.playMusicStep();
    this.musicTimer = window.setInterval(() => this.playMusicStep(), MUSIC_STEP_MS);
  }

  private stopSoundtrack(): void {
    if (this.musicTimer === undefined) return;
    window.clearInterval(this.musicTimer);
    this.musicTimer = undefined;
  }

  private playMusicStep(): void {
    const note = MEADOW_MELODY[this.musicStep % MEADOW_MELODY.length];
    const step = this.musicStep;
    this.musicStep += 1;
    if (note) this.musicTone(note, 0.34, 0.16);
    if (step % 8 === 0) this.musicTone(note ? note / 2 : 196, 0.52, 0.1);
  }

  private musicTone(frequency: number, duration: number, volume: number): void {
    const context = this.context;
    const output = this.musicBus;
    if (this.muted || !context || context.state !== 'running' || !output) return;
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    const start = context.currentTime;
    oscillator.type = 'triangle';
    oscillator.frequency.setValueAtTime(frequency, start);
    oscillator.frequency.exponentialRampToValueAtTime(frequency * 0.995, start + duration);
    gain.gain.setValueAtTime(0.001, start);
    gain.gain.exponentialRampToValueAtTime(volume, start + 0.018);
    gain.gain.exponentialRampToValueAtTime(0.001, start + duration);
    oscillator.connect(gain).connect(output);
    oscillator.start(start);
    oscillator.stop(start + duration + 0.01);
  }

  private playCareCue(need: DinoNeed): void {
    if (need === 'hunger') {
      this.eat();
      return;
    }
    if (need === 'play') {
      this.tone(260, 0.12, 'sine', 0.05, 410);
      this.later(100, () => this.tone(360, 0.1, 'sine', 0.04, 530));
      return;
    }
    if (need === 'thirst') {
      [720, 880, 1040].forEach((frequency, index) => {
        this.later(index * 65, () => this.tone(frequency, 0.07, 'sine', 0.032, frequency * 0.82));
      });
      return;
    }
    if (need === 'music') {
      [392, 523, 659, 784].forEach((frequency, index) => {
        this.later(index * 70, () => this.tone(frequency, 0.13, 'triangle', 0.036, frequency * 1.02));
      });
      return;
    }
    this.tone(620, 0.09, 'sine', 0.04, 930);
    this.later(80, () => this.tone(830, 0.18, 'sine', 0.035, 1240));
  }

  private tone(
    frequency: number,
    duration: number,
    wave: Wave,
    volume: number,
    endFrequency = frequency,
  ): void {
    if (this.muted) return;
    if (!this.context) this.createAudioGraph();
    const context = this.context;
    const output = this.effectsBus;
    if (!context || context.state !== 'running' || !output) return;
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    const start = context.currentTime;
    oscillator.type = wave;
    oscillator.frequency.setValueAtTime(Math.max(1, frequency), start);
    oscillator.frequency.exponentialRampToValueAtTime(Math.max(1, endFrequency), start + duration);
    gain.gain.setValueAtTime(0.001, start);
    gain.gain.exponentialRampToValueAtTime(Math.max(0.001, volume), start + Math.min(0.012, duration * 0.2));
    gain.gain.exponentialRampToValueAtTime(0.001, start + duration);
    oscillator.connect(gain).connect(output);
    oscillator.start(start);
    oscillator.stop(start + duration + 0.01);
  }

  private noise(duration: number, volume: number, cutoff: number): void {
    if (this.muted) return;
    if (!this.context) this.createAudioGraph();
    const context = this.context;
    const output = this.effectsBus;
    if (!context || context.state !== 'running' || !output) return;
    const length = Math.max(1, Math.floor(context.sampleRate * duration));
    const buffer = context.createBuffer(1, length, context.sampleRate);
    const data = buffer.getChannelData(0);
    for (let index = 0; index < length; index += 1) data[index] = (Math.random() * 2 - 1) * (1 - index / length);
    const source = context.createBufferSource();
    const filter = context.createBiquadFilter();
    const gain = context.createGain();
    source.buffer = buffer;
    filter.type = 'lowpass';
    filter.frequency.value = cutoff;
    gain.gain.value = volume;
    source.connect(filter).connect(gain).connect(output);
    source.start();
  }

  private later(delay: number, callback: () => void): void {
    window.setTimeout(callback, delay);
  }
}

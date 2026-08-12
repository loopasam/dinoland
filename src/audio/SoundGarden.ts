type Wave = OscillatorType;

export class SoundGarden {
  private context?: AudioContext;
  private muted = false;

  setMuted(muted: boolean): void {
    this.muted = muted;
  }

  get isMuted(): boolean {
    return this.muted;
  }

  unlock(): void {
    if (!this.context) this.context = new AudioContext();
    if (this.context.state === 'suspended') void this.context.resume();
  }

  egg(stage: number): void {
    if (stage === 1) this.tone(180, 0.09, 'sine', 0.06, 220);
    if (stage === 2) this.noise(0.12, 0.045, 900);
    if (stage === 3) {
      this.tone(130, 0.08, 'triangle', 0.08, 95);
      window.setTimeout(() => this.tone(230, 0.1, 'sine', 0.06, 280), 120);
    }
  }

  hatch(): void {
    [262, 330, 392, 523].forEach((frequency, index) => {
      window.setTimeout(() => this.tone(frequency, 0.24, 'triangle', 0.075, frequency * 1.06), index * 85);
    });
    this.noise(0.28, 0.035, 1500);
  }

  chirp(pitch = 1): void {
    this.tone(480 * pitch, 0.12, 'sine', 0.055, 720 * pitch);
  }

  giggle(): void {
    [520, 680, 570].forEach((frequency, index) => {
      window.setTimeout(() => this.tone(frequency, 0.08, 'sine', 0.045, frequency * 1.12), index * 85);
    });
  }

  stomp(): void {
    this.tone(78, 0.13, 'sine', 0.09, 48);
    this.noise(0.08, 0.04, 220);
  }

  bounce(): void {
    this.tone(230, 0.09, 'sine', 0.045, 165);
  }

  bubble(variant = 0): void {
    this.tone(560 + variant * 90, 0.07, 'sine', 0.035, 860 + variant * 70);
  }

  splash(): void {
    this.noise(0.22, 0.05, 2200);
    this.tone(190, 0.12, 'sine', 0.025, 290);
  }

  flower(): void {
    [392, 494, 587].forEach((frequency, index) => {
      window.setTimeout(() => this.tone(frequency, 0.16, 'sine', 0.035), index * 90);
    });
  }

  private tone(frequency: number, duration: number, wave: Wave, volume: number, endFrequency = frequency): void {
    if (this.muted) return;
    this.unlock();
    const context = this.context;
    if (!context) return;
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = wave;
    oscillator.frequency.setValueAtTime(frequency, context.currentTime);
    oscillator.frequency.exponentialRampToValueAtTime(Math.max(1, endFrequency), context.currentTime + duration);
    gain.gain.setValueAtTime(volume, context.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, context.currentTime + duration);
    oscillator.connect(gain).connect(context.destination);
    oscillator.start();
    oscillator.stop(context.currentTime + duration);
  }

  private noise(duration: number, volume: number, cutoff: number): void {
    if (this.muted) return;
    this.unlock();
    const context = this.context;
    if (!context) return;
    const length = Math.max(1, Math.floor(context.sampleRate * duration));
    const buffer = context.createBuffer(1, length, context.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / length);
    const source = context.createBufferSource();
    const filter = context.createBiquadFilter();
    const gain = context.createGain();
    source.buffer = buffer;
    filter.type = 'lowpass';
    filter.frequency.value = cutoff;
    gain.gain.value = volume;
    source.connect(filter).connect(gain).connect(context.destination);
    source.start();
  }
}

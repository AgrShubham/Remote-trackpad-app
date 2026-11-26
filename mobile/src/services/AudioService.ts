import Sound from 'react-native-sound';

Sound.setCategory('Ambient', true);

class SoundVoicePool {
  private voices: Sound[] = [];
  private index: number = 0;

  constructor(filename: string, poolSize: number = 3) {
    for (let i = 0; i < poolSize; i++) {
      const snd = new Sound(filename, Sound.MAIN_BUNDLE, (err) => {
        if (err && i === 0) {
          console.warn(`Failed to load ${filename} sound`, err);
        }
      });
      this.voices.push(snd);
    }
  }

  public playInstant() {
    if (this.voices.length === 0) return;
    const voice = this.voices[this.index];
    this.index = (this.index + 1) % this.voices.length;
    try {
      voice.setCurrentTime(0);
      voice.play();
    } catch (_) {
      // Ignore transient playback errors
    }
  }
}

class AudioService {
  private enabled: boolean = true;
  private poolStandard: SoundVoicePool | null = null;
  private poolSpacebar: SoundVoicePool | null = null;
  private poolEnter: SoundVoicePool | null = null;
  private poolHaptic: SoundVoicePool | null = null;

  constructor() {
    this.initSounds();
  }

  private initSounds() {
    try {
      this.poolStandard = new SoundVoicePool('key_standard', 4);
      this.poolSpacebar = new SoundVoicePool('key_spacebar', 2);
      this.poolEnter = new SoundVoicePool('key_enter', 2);
      this.poolHaptic = new SoundVoicePool('click_haptic', 3);
    } catch (e) {
      console.warn('AudioService init error:', e);
    }
  }

  public setEnabled(val: boolean) {
    this.enabled = val;
  }

  public isEnabled(): boolean {
    return this.enabled;
  }

  public toggle(): boolean {
    this.enabled = !this.enabled;
    return this.enabled;
  }

  public playKey(type: 'standard' | 'spacebar' | 'enter' = 'standard') {
    if (!this.enabled) return;

    if (type === 'spacebar') {
      this.poolSpacebar?.playInstant();
    } else if (type === 'enter') {
      this.poolEnter?.playInstant();
    } else {
      this.poolStandard?.playInstant();
    }
  }

  public playHapticClick() {
    if (!this.enabled) return;
    this.poolHaptic?.playInstant();
  }
}

export const audioService = new AudioService();

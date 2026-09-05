import Sound from 'react-native-sound';

Sound.setCategory('Ambient', true);

class AudioService {
  private enabled: boolean = true;
  private soundStandard: Sound | null = null;
  private soundSpacebar: Sound | null = null;
  private soundEnter: Sound | null = null;
  private soundHaptic: Sound | null = null;

  constructor() {
    this.initSounds();
  }

  private initSounds() {
    try {
      this.soundStandard = new Sound('key_standard', Sound.MAIN_BUNDLE, (err) => {
        if (err) console.warn('Failed to load key_standard sound', err);
      });

      this.soundSpacebar = new Sound('key_spacebar', Sound.MAIN_BUNDLE, (err) => {
        if (err) console.warn('Failed to load key_spacebar sound', err);
      });

      this.soundEnter = new Sound('key_enter', Sound.MAIN_BUNDLE, (err) => {
        if (err) console.warn('Failed to load key_enter sound', err);
      });

      this.soundHaptic = new Sound('click_haptic', Sound.MAIN_BUNDLE, (err) => {
        if (err) console.warn('Failed to load click_haptic sound', err);
      });
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

    let snd: Sound | null = null;
    if (type === 'spacebar') snd = this.soundSpacebar;
    else if (type === 'enter') snd = this.soundEnter;
    else snd = this.soundStandard;

    if (snd) {
      snd.stop(() => {
        snd?.play();
      });
    }
  }

  public playHapticClick() {
    if (!this.enabled || !this.soundHaptic) return;
    this.soundHaptic.stop(() => {
      this.soundHaptic?.play();
    });
  }
}

export const audioService = new AudioService();

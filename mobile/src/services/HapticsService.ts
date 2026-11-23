import { Vibration, Platform } from 'react-native';
import { settingsService, HapticIntensity } from './SettingsService';

class HapticsService {
  private enabled: boolean = true;
  private intensity: HapticIntensity = 'medium';

  constructor() {
    // Sync with settings service
    settingsService.subscribe((settings) => {
      this.enabled = settings.hapticsEnabled;
      this.intensity = settings.hapticsIntensity;
    });
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

  public setIntensity(intensity: HapticIntensity) {
    this.intensity = intensity;
  }

  private scaleDuration(ms: number): number {
    switch (this.intensity) {
      case 'subtle':
        return Math.max(8, Math.round(ms * 0.65));
      case 'strong':
        return Math.min(100, Math.round(ms * 1.5));
      case 'medium':
      default:
        return ms;
    }
  }

  private trigger(pattern: number[]) {
    if (!this.enabled) return;
    try {
      const scaled = pattern.map((val, idx) => (idx % 2 === 1 ? this.scaleDuration(val) : val));
      if (Platform.OS === 'android') {
        Vibration.vibrate(scaled);
      } else {
        Vibration.vibrate(scaled[1] || 30);
      }
    } catch (e) {
      // Ignore vibration errors on unsupported devices
    }
  }

  public light() {
    this.trigger([0, 18]);
  }

  public medium() {
    this.trigger([0, 32]);
  }

  public warning() {
    this.trigger([0, 40, 50, 40]);
  }

  public clickLeft() {
    this.trigger([0, 30]);
  }

  public clickRight() {
    this.trigger([0, 35, 40, 35]);
  }

  public dragLock() {
    this.trigger([0, 45]);
  }

  public gamepadTrigger() {
    this.trigger([0, 45, 30, 45]);
  }

  public gamepadButton() {
    this.trigger([0, 35]);
  }

  public gamepadBumper() {
    this.trigger([0, 38]);
  }

  public dpad() {
    this.trigger([0, 30]);
  }

  public sprint() {
    this.trigger([0, 35, 25, 45]);
  }

  public keyboard(isSpacebar: boolean = false) {
    this.trigger([0, isSpacebar ? 36 : 28]);
  }
}

export const hapticsService = new HapticsService();

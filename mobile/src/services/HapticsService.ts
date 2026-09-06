import { Vibration, Platform } from 'react-native';

class HapticsService {
  private enabled: boolean = true;

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

  private trigger(pattern: number[]) {
    if (!this.enabled) return;
    try {
      if (Platform.OS === 'android') {
        Vibration.vibrate(pattern);
      } else {
        Vibration.vibrate(pattern[1] || 30);
      }
    } catch (e) {
      // Ignore vibration errors on unsupported devices
    }
  }

  public light() {
    this.trigger([0, 18]);
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

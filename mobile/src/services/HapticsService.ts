import ReactNativeHapticFeedback, { HapticFeedbackTypes } from 'react-native-haptic-feedback';
import { settingsService, HapticIntensity } from './SettingsService';

const HAPTIC_OPTIONS = {
  enableVibrateFallback: true,
  ignoreAndroidSystemSettings: true,
};

class HapticsService {
  private enabled: boolean = true;
  private intensity: HapticIntensity = 'medium';

  constructor() {
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

  private triggerNative(
    subtleType: HapticFeedbackTypes,
    mediumType: HapticFeedbackTypes,
    strongType: HapticFeedbackTypes
  ) {
    if (!this.enabled) return;
    try {
      const chosen =
        this.intensity === 'subtle'
          ? subtleType
          : this.intensity === 'strong'
          ? strongType
          : mediumType;
      ReactNativeHapticFeedback.trigger(chosen, HAPTIC_OPTIONS);
    } catch (_) {
      // Ignore on unsupported devices
    }
  }

  public light() {
    this.triggerNative(
      HapticFeedbackTypes.clockTick,
      HapticFeedbackTypes.keyboardTap,
      HapticFeedbackTypes.impactLight
    );
  }

  public medium() {
    this.triggerNative(
      HapticFeedbackTypes.impactLight,
      HapticFeedbackTypes.impactMedium,
      HapticFeedbackTypes.impactHeavy
    );
  }

  public warning() {
    this.triggerNative(
      HapticFeedbackTypes.notificationWarning,
      HapticFeedbackTypes.notificationWarning,
      HapticFeedbackTypes.notificationError
    );
  }

  public clickLeft() {
    this.triggerNative(
      HapticFeedbackTypes.clockTick,
      HapticFeedbackTypes.impactLight,
      HapticFeedbackTypes.impactMedium
    );
  }

  public clickRight() {
    this.triggerNative(
      HapticFeedbackTypes.impactLight,
      HapticFeedbackTypes.impactMedium,
      HapticFeedbackTypes.impactHeavy
    );
  }

  public dragLock() {
    this.triggerNative(
      HapticFeedbackTypes.impactMedium,
      HapticFeedbackTypes.impactHeavy,
      HapticFeedbackTypes.impactHeavy
    );
  }

  public gamepadTrigger() {
    this.triggerNative(
      HapticFeedbackTypes.impactMedium,
      HapticFeedbackTypes.impactHeavy,
      HapticFeedbackTypes.impactHeavy
    );
  }

  public gamepadButton() {
    this.triggerNative(
      HapticFeedbackTypes.keyboardTap,
      HapticFeedbackTypes.impactLight,
      HapticFeedbackTypes.impactMedium
    );
  }

  public gamepadBumper() {
    this.triggerNative(
      HapticFeedbackTypes.clockTick,
      HapticFeedbackTypes.impactLight,
      HapticFeedbackTypes.impactMedium
    );
  }

  public dpad() {
    this.triggerNative(
      HapticFeedbackTypes.clockTick,
      HapticFeedbackTypes.keyboardTap,
      HapticFeedbackTypes.impactLight
    );
  }

  public sprint() {
    this.triggerNative(
      HapticFeedbackTypes.impactMedium,
      HapticFeedbackTypes.impactHeavy,
      HapticFeedbackTypes.impactHeavy
    );
  }

  public keyboard(isSpacebar: boolean = false) {
    if (isSpacebar) {
      this.triggerNative(
        HapticFeedbackTypes.keyboardTap,
        HapticFeedbackTypes.impactLight,
        HapticFeedbackTypes.impactMedium
      );
    } else {
      this.triggerNative(
        HapticFeedbackTypes.clockTick,
        HapticFeedbackTypes.keyboardTap,
        HapticFeedbackTypes.impactLight
      );
    }
  }
}

export const hapticsService = new HapticsService();

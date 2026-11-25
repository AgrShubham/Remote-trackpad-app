import AsyncStorage from '@react-native-async-storage/async-storage';
import KeepAwake from 'react-native-keep-awake';

export type HapticIntensity = 'subtle' | 'medium' | 'strong';
export type AccentTheme = 'teal' | 'blue' | 'emerald' | 'purple' | 'amber' | 'crimson';
export type ThemeMode = 'dark' | 'light' | 'system';
export type LaunchDeckOption = 'hub' | 'touchpad' | 'keyboard' | 'gamepad';

export interface AppSettings {
  themeMode: ThemeMode;
  hasCompletedOnboarding: boolean;
  keepAwake: boolean;
  hapticsEnabled: boolean;
  hapticsIntensity: HapticIntensity;
  accentTheme: AccentTheme;
  preferUdp: boolean;
  autoReconnect: boolean;
  // Touchpad & Mouse
  pointerSpeed: number;
  scrollSpeed: number;
  naturalScrolling: boolean;
  tapToClick: boolean;
  tapAndDrag: boolean;
  showMouseButtons: boolean;
  swapMouseButtons: boolean;
  // Launch & Presentation
  launchDeck: LaunchDeckOption;
  presentationTimerHaptics: boolean;
}

const SETTINGS_STORAGE_KEY = '@remote_mouse_settings_v1';

export const DEFAULT_SETTINGS: AppSettings = {
  themeMode: 'dark',
  hasCompletedOnboarding: false,
  keepAwake: true,
  hapticsEnabled: true,
  hapticsIntensity: 'medium',
  accentTheme: 'teal',
  preferUdp: true,
  autoReconnect: true,
  pointerSpeed: 1.4,
  scrollSpeed: 1.0,
  naturalScrolling: true,
  tapToClick: true,
  tapAndDrag: true,
  showMouseButtons: true,
  swapMouseButtons: false,
  launchDeck: 'hub',
  presentationTimerHaptics: true,
};

export const ACCENT_PALETTES: Record<
  AccentTheme,
  { name: string; primary: string; glow: string; border: string; bgSoft: string }
> = {
  teal: {
    name: 'Cyber Teal',
    primary: '#14b8a6',
    glow: 'rgba(20, 184, 166, 0.45)',
    border: 'rgba(20, 184, 166, 0.7)',
    bgSoft: 'rgba(20, 184, 166, 0.18)',
  },
  blue: {
    name: 'Cobalt Blue',
    primary: '#3b82f6',
    glow: 'rgba(59, 130, 246, 0.4)',
    border: 'rgba(59, 130, 246, 0.65)',
    bgSoft: 'rgba(59, 130, 246, 0.18)',
  },
  emerald: {
    name: 'Cyber Emerald',
    primary: '#10b981',
    glow: 'rgba(16, 185, 129, 0.4)',
    border: 'rgba(16, 185, 129, 0.65)',
    bgSoft: 'rgba(16, 185, 129, 0.18)',
  },
  purple: {
    name: 'Neon Violet',
    primary: '#8b5cf6',
    glow: 'rgba(139, 92, 246, 0.4)',
    border: 'rgba(139, 92, 246, 0.65)',
    bgSoft: 'rgba(139, 92, 246, 0.18)',
  },
  amber: {
    name: 'Sunset Amber',
    primary: '#f59e0b',
    glow: 'rgba(245, 158, 11, 0.4)',
    border: 'rgba(245, 158, 11, 0.65)',
    bgSoft: 'rgba(245, 158, 11, 0.18)',
  },
  crimson: {
    name: 'Crimson Red',
    primary: '#ef4444',
    glow: 'rgba(239, 68, 68, 0.4)',
    border: 'rgba(239, 68, 68, 0.65)',
    bgSoft: 'rgba(239, 68, 68, 0.18)',
  },
};

type SettingsListener = (settings: AppSettings) => void;

class SettingsService {
  private settings: AppSettings = { ...DEFAULT_SETTINGS };
  private listeners: Set<SettingsListener> = new Set();
  private isLoaded: boolean = false;

  constructor() {
    this.init();
  }

  private async init() {
    try {
      const stored = await AsyncStorage.getItem(SETTINGS_STORAGE_KEY);
      if (stored) {
        this.settings = { ...DEFAULT_SETTINGS, ...JSON.parse(stored) };
      }
    } catch (e) {
      console.warn('Failed to load settings:', e);
    } finally {
      this.isLoaded = true;
      this.applyKeepAwake();
      this.notify();
    }
  }

  public getSettings(): AppSettings {
    return { ...this.settings };
  }

  public subscribe(listener: SettingsListener): () => void {
    this.listeners.add(listener);
    if (this.isLoaded) {
      listener({ ...this.settings });
    }
    return () => this.listeners.delete(listener);
  }

  private notify() {
    this.listeners.forEach((listener) => listener({ ...this.settings }));
  }

  public async updateSetting<K extends keyof AppSettings>(key: K, value: AppSettings[K]) {
    this.settings[key] = value;
    if (key === 'keepAwake') {
      this.applyKeepAwake();
    }
    this.notify();

    try {
      await AsyncStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(this.settings));
    } catch (e) {
      console.warn('Failed to persist setting:', e);
    }
  }

  public async resetDefaults() {
    this.settings = { ...DEFAULT_SETTINGS };
    this.applyKeepAwake();
    this.notify();

    try {
      await AsyncStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(this.settings));
    } catch (e) {
      console.warn('Failed to reset settings:', e);
    }
  }

  private applyKeepAwake() {
    try {
      if (this.settings.keepAwake) {
        KeepAwake.activate();
      } else {
        KeepAwake.deactivate();
      }
    } catch (e) {
      // Ignore if unsupported
    }
  }
}

export const settingsService = new SettingsService();

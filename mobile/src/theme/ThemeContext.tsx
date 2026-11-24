import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useColorScheme } from 'react-native';
import {
  settingsService,
  AppSettings,
  ThemeMode,
  AccentTheme,
  ACCENT_PALETTES,
} from '../services/SettingsService';
import { DarkTokens, LightTokens, getThemeTokens } from './cyberTokens';

export interface ThemeContextType {
  themeMode: ThemeMode;
  isDark: boolean;
  tokens: typeof DarkTokens;
  accent: (typeof ACCENT_PALETTES)[AccentTheme];
  setThemeMode: (mode: ThemeMode) => void;
  setAccentTheme: (theme: AccentTheme) => void;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const ThemeProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const systemColorScheme = useColorScheme();
  const [settings, setSettings] = useState<AppSettings>(settingsService.getSettings());

  useEffect(() => {
    const unsub = settingsService.subscribe((newSettings) => {
      setSettings(newSettings);
    });
    return unsub;
  }, []);

  const themeMode = settings.themeMode || 'dark';

  const isDark =
    themeMode === 'system'
      ? systemColorScheme !== 'light'
      : themeMode === 'dark';

  const tokens = getThemeTokens(isDark);
  const accent = ACCENT_PALETTES[settings.accentTheme] || ACCENT_PALETTES.teal;

  const setThemeMode = (mode: ThemeMode) => {
    settingsService.updateSetting('themeMode', mode);
  };

  const setAccentTheme = (theme: AccentTheme) => {
    settingsService.updateSetting('accentTheme', theme);
  };

  const toggleTheme = () => {
    const nextMode: ThemeMode = isDark ? 'light' : 'dark';
    setThemeMode(nextMode);
  };

  return (
    <ThemeContext.Provider
      value={{
        themeMode,
        isDark,
        tokens,
        accent,
        setThemeMode,
        setAccentTheme,
        toggleTheme,
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = (): ThemeContextType => {
  const context = useContext(ThemeContext);
  if (!context) {
    return {
      themeMode: 'dark',
      isDark: true,
      tokens: DarkTokens,
      accent: ACCENT_PALETTES.teal,
      setThemeMode: () => {},
      setAccentTheme: () => {},
      toggleTheme: () => {},
    };
  }
  return context;
};


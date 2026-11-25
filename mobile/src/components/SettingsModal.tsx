import React, { useState, useEffect, useMemo } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import {
  settingsService,
  AppSettings,
  HapticIntensity,
  AccentTheme,
  ThemeMode,
  ACCENT_PALETTES,
} from '../services/SettingsService';
import { hapticsService } from '../services/HapticsService';
import { socketService } from '../services/SocketService';
import { authService, UserProfile } from '../services/AuthService';
import { userStorageService } from '../services/UserStorageService';
import { useTheme } from '../theme/ThemeContext';
import { DarkTokens } from '../theme/cyberTokens';

interface SettingsModalProps {
  visible: boolean;
  onClose: () => void;
  onOpenLogin?: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  visible,
  onClose,
  onOpenLogin,
}) => {
  const { isDark, tokens } = useTheme();
  const styles = useMemo(() => createStyles(tokens, isDark), [tokens, isDark]);
  const [settings, setSettings] = useState<AppSettings>(settingsService.getSettings());
  const [resetConfirm, setResetConfirm] = useState(false);
  const [user, setUser] = useState<UserProfile | null>(authService.getCurrentUser());
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncedAt, setLastSyncedAt] = useState<number | null>(userStorageService.getLastSyncedTime());

  useEffect(() => {
    const unsubSettings = settingsService.subscribe((newSettings) => {
      setSettings(newSettings);
    });

    const unsubAuth = authService.subscribe((newUser) => {
      setUser(newUser);
    });

    const unsubSync = userStorageService.subscribe((time, syncing) => {
      setLastSyncedAt(time);
      setIsSyncing(syncing);
    });

    return () => {
      unsubSettings();
      unsubAuth();
      unsubSync();
    };
  }, []);

  const handleToggle = <K extends keyof AppSettings>(key: K) => {
    hapticsService.light();
    const current = settings[key] as boolean;
    settingsService.updateSetting(key, !current as any);
  };

  const handleSetIntensity = (intensity: HapticIntensity) => {
    settingsService.updateSetting('hapticsIntensity', intensity);
    // Trigger demo pulse immediately at the selected intensity
    setTimeout(() => {
      hapticsService.light();
    }, 50);
  };

  const handleSetTheme = (theme: AccentTheme) => {
    hapticsService.light();
    settingsService.updateSetting('accentTheme', theme);
  };

  const handleReset = () => {
    hapticsService.light();
    if (!resetConfirm) {
      setResetConfirm(true);
      setTimeout(() => setResetConfirm(false), 3000);
    } else {
      settingsService.resetDefaults();
      setResetConfirm(false);
    }
  };

  const currentAccent = ACCENT_PALETTES[settings.accentTheme] || ACCENT_PALETTES.blue;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.container}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerTitleCol}>
              <View style={styles.headerTitleRow}>
                <View style={[styles.headerDot, { backgroundColor: currentAccent.primary }]} />
                <Text style={styles.modalTitle}>Settings & Preferences</Text>
              </View>
              <Text style={styles.modalSubtitle}>Customize your remote control experience</Text>
            </View>

            <TouchableOpacity
              onPress={onClose}
              style={styles.closeBtn}
              focusable={false}
              activeOpacity={0.8}
            >
              <Text style={styles.closeBtnText}>✕</Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.body} showsVerticalScrollIndicator={false}>
            {/* Section 0: Account & Cloud Backup */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>☁️ ACCOUNT & PREFERENCE BACKUP</Text>

              <View style={styles.card}>
                {user && !user.isGuest ? (
                  <View style={styles.accountBox}>
                    <View style={styles.profileRow}>
                      <View style={[styles.avatarCircle, { backgroundColor: currentAccent.bgSoft, borderColor: currentAccent.primary }]}>
                        <Text style={[styles.avatarInitial, { color: currentAccent.primary }]}>
                          {user.displayName ? user.displayName.charAt(0).toUpperCase() : 'G'}
                        </Text>
                      </View>
                      <View style={styles.profileTextCol}>
                        <Text style={styles.profileName}>{user.displayName}</Text>
                        <Text style={styles.profileEmail}>{user.email}</Text>
                        <View style={styles.syncStatusRow}>
                          <Text style={styles.syncStatusText}>
                            {isSyncing
                              ? '🔄 Syncing preferences to cloud...'
                              : lastSyncedAt
                              ? `✔ Cloud Synced (${new Date(lastSyncedAt).toLocaleTimeString()})`
                              : '✔ Cloud Backup Active'}
                          </Text>
                        </View>
                      </View>
                    </View>

                    <View style={styles.accountActionsRow}>
                      <TouchableOpacity
                        style={[styles.accountBtn, { borderColor: currentAccent.border }]}
                        onPress={() => {
                          hapticsService.light();
                          userStorageService.syncToCloud();
                        }}
                        disabled={isSyncing}
                        activeOpacity={0.8}
                      >
                        {isSyncing ? (
                          <ActivityIndicator size="small" color="#93c5fd" />
                        ) : (
                          <Text style={[styles.accountBtnText, { color: currentAccent.primary }]}>
                            Sync Now
                          </Text>
                        )}
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={styles.logoutBtn}
                        onPress={() => {
                          hapticsService.light();
                          authService.logout();
                        }}
                        activeOpacity={0.8}
                      >
                        <Text style={styles.logoutBtnText}>Sign Out</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                ) : (
                  <View style={styles.guestBox}>
                    <View style={styles.guestInfoRow}>
                      <Text style={styles.guestIcon}>👤</Text>
                      <View style={styles.guestTextCol}>
                        <Text style={styles.guestTitle}>Guest Mode (Offline Storage)</Text>
                        <Text style={styles.guestDesc}>
                          Sensitivities & custom gamepad layouts are saved only on this phone.
                        </Text>
                      </View>
                    </View>

                    <TouchableOpacity
                      style={[styles.signInGoogleBtn, { backgroundColor: currentAccent.primary }]}
                      onPress={async () => {
                        hapticsService.light();
                        if (onOpenLogin) {
                          onClose();
                          onOpenLogin();
                        } else {
                          await authService.loginWithGoogle();
                        }
                      }}
                      activeOpacity={0.85}
                    >
                      <Text style={styles.signInGoogleBtnText}>Sign In with Google for Cloud Backup</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            </View>

            {/* Section 1: Haptic Feedback */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>📳 TACTILE HAPTICS</Text>

              <View style={styles.card}>
                <View style={styles.settingRow}>
                  <View style={styles.settingTextCol}>
                    <Text style={styles.settingLabel}>Vibration Feedback</Text>
                    <Text style={styles.settingDesc}>
                      Physical clicks on trackpad, keyboard, and triggers
                    </Text>
                  </View>

                  <TouchableOpacity
                    style={[
                      styles.togglePill,
                      settings.hapticsEnabled
                        ? { backgroundColor: currentAccent.primary, borderColor: currentAccent.border }
                        : styles.togglePillOff,
                    ]}
                    onPress={() => handleToggle('hapticsEnabled')}
                    focusable={false}
                    activeOpacity={0.85}
                  >
                    <View
                      style={[
                        styles.toggleKnob,
                        settings.hapticsEnabled && styles.toggleKnobOn,
                      ]}
                    />
                  </TouchableOpacity>
                </View>

                {settings.hapticsEnabled && (
                  <View style={styles.subOptionContainer}>
                    <Text style={styles.subOptionLabel}>Vibration Intensity</Text>
                    <View style={styles.segmentedRow}>
                      {(['subtle', 'medium', 'strong'] as HapticIntensity[]).map((level) => {
                        const isSelected = settings.hapticsIntensity === level;
                        const label =
                          level === 'subtle' ? 'Subtle' : level === 'medium' ? 'Medium' : 'Strong';
                        return (
                          <TouchableOpacity
                            key={level}
                            style={[
                              styles.segmentBtn,
                              isSelected && {
                                backgroundColor: currentAccent.bgSoft,
                                borderColor: currentAccent.primary,
                              },
                            ]}
                            onPress={() => handleSetIntensity(level)}
                            focusable={false}
                            activeOpacity={0.85}
                          >
                            <Text
                              style={[
                                styles.segmentBtnText,
                                isSelected && {
                                  color: currentAccent.primary,
                                  fontWeight: '700',
                                },
                              ]}
                            >
                              {label}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  </View>
                )}
              </View>
            </View>

            {/* Section 2: Display & Power */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>📱 DISPLAY & POWER</Text>

              <View style={styles.card}>
                <View style={styles.settingRow}>
                  <View style={styles.settingTextCol}>
                    <Text style={styles.settingLabel}>Keep Screen Awake</Text>
                    <Text style={styles.settingDesc}>
                      Prevent phone display from dimming or sleeping
                    </Text>
                  </View>

                  <TouchableOpacity
                    style={[
                      styles.togglePill,
                      settings.keepAwake
                        ? { backgroundColor: currentAccent.primary, borderColor: currentAccent.border }
                        : styles.togglePillOff,
                    ]}
                    onPress={() => handleToggle('keepAwake')}
                    focusable={false}
                    activeOpacity={0.85}
                  >
                    <View
                      style={[
                        styles.toggleKnob,
                        settings.keepAwake && styles.toggleKnobOn,
                      ]}
                    />
                  </TouchableOpacity>
                </View>
              </View>
            </View>

            {/* Section 2.5: Appearance & Theme Mode */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>🌓 APPEARANCE & THEME</Text>

              <View style={styles.card}>
                <View style={styles.settingRow}>
                  <View style={styles.settingTextCol}>
                    <Text style={styles.settingLabel}>App Theme</Text>
                    <Text style={styles.settingDesc}>
                      Switch between Obsidian Dark, Crisp Studio Light, or System
                    </Text>
                  </View>
                </View>

                <View style={styles.segmentedRow}>
                  {[
                    { mode: 'dark' as ThemeMode, label: '🌙 Dark' },
                    { mode: 'light' as ThemeMode, label: '☀️ Light' },
                    { mode: 'system' as ThemeMode, label: '📱 Auto' },
                  ].map((item) => {
                    const isSelected = (settings.themeMode || 'dark') === item.mode;
                    return (
                      <TouchableOpacity
                        key={item.mode}
                        style={[
                          styles.segmentBtn,
                          isSelected && {
                            backgroundColor: currentAccent.bgSoft,
                            borderColor: currentAccent.primary,
                          },
                        ]}
                        onPress={() => {
                          hapticsService.light();
                          settingsService.updateSetting('themeMode', item.mode);
                        }}
                        focusable={false}
                        activeOpacity={0.85}
                      >
                        <Text
                          style={[
                            styles.segmentBtnText,
                            isSelected && {
                              color: currentAccent.primary,
                              fontWeight: '700',
                            },
                          ]}
                        >
                          {item.label}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            </View>

            {/* Section 3: Accent Theme Palettes */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>🎨 ACCENT COLOR PALETTE</Text>

              <View style={styles.card}>
                <View style={styles.paletteGrid}>
                  {(Object.keys(ACCENT_PALETTES) as AccentTheme[]).map((themeKey) => {
                    const palette = ACCENT_PALETTES[themeKey];
                    const isSelected = settings.accentTheme === themeKey;
                    return (
                      <TouchableOpacity
                        key={themeKey}
                        style={[
                          styles.paletteTile,
                          isSelected && {
                            borderColor: palette.primary,
                            backgroundColor: palette.bgSoft,
                          },
                        ]}
                        onPress={() => handleSetTheme(themeKey)}
                        focusable={false}
                        activeOpacity={0.85}
                      >
                        <View style={[styles.colorOrb, { backgroundColor: palette.primary }]}>
                          {isSelected && <Text style={styles.checkText}>✓</Text>}
                        </View>
                        <Text
                          style={[
                            styles.paletteName,
                            isSelected && { color: palette.primary, fontWeight: '700' },
                          ]}
                          numberOfLines={1}
                        >
                          {palette.name}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            </View>

            {/* Section 4: Network & Streaming */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>⚡ STREAMING & ENGINE</Text>

              <View style={styles.card}>
                <View style={styles.settingRow}>
                  <View style={styles.settingTextCol}>
                    <Text style={styles.settingLabel}>UDP Motion Engine</Text>
                    <Text style={styles.settingDesc}>
                      Sub-millisecond packet streaming (&lt;1ms latency)
                    </Text>
                  </View>

                  <TouchableOpacity
                    style={[
                      styles.togglePill,
                      settings.preferUdp
                        ? { backgroundColor: currentAccent.primary, borderColor: currentAccent.border }
                        : styles.togglePillOff,
                    ]}
                    onPress={() => handleToggle('preferUdp')}
                    focusable={false}
                    activeOpacity={0.85}
                  >
                    <View
                      style={[
                        styles.toggleKnob,
                        settings.preferUdp && styles.toggleKnobOn,
                      ]}
                    />
                  </TouchableOpacity>
                </View>

                <View style={[styles.settingRow, styles.settingRowBorderTop]}>
                  <View style={styles.settingTextCol}>
                    <Text style={styles.settingLabel}>Auto-Reconnect</Text>
                    <Text style={styles.settingDesc}>
                      Automatically reconnect to known PC on startup
                    </Text>
                  </View>

                  <TouchableOpacity
                    style={[
                      styles.togglePill,
                      settings.autoReconnect
                        ? { backgroundColor: currentAccent.primary, borderColor: currentAccent.border }
                        : styles.togglePillOff,
                    ]}
                    onPress={() => handleToggle('autoReconnect')}
                    focusable={false}
                    activeOpacity={0.85}
                  >
                    <View
                      style={[
                        styles.toggleKnob,
                        settings.autoReconnect && styles.toggleKnobOn,
                      ]}
                    />
                  </TouchableOpacity>
                </View>
              </View>
            </View>

            {/* Section 5: Diagnostics & Defaults */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>ℹ️ ABOUT & SYSTEM</Text>

              <View style={styles.card}>
                <View style={styles.infoRow}>
                  <Text style={styles.infoKey}>App Version</Text>
                  <Text style={styles.infoVal}>v1.3.0 Pro (Zero-Lag Edition)</Text>
                </View>
                <View style={styles.infoRow}>
                  <Text style={styles.infoKey}>Active Host</Text>
                  <Text style={styles.infoVal}>
                    {socketService.getHost() || 'Not connected'}
                  </Text>
                </View>

                <TouchableOpacity
                  style={styles.resetBtn}
                  onPress={() => {
                    hapticsService.light();
                    onClose();
                    settingsService.updateSetting('hasCompletedOnboarding', false);
                  }}
                  focusable={false}
                  activeOpacity={0.85}
                >
                  <Text style={styles.resetBtnText}>✨ Replay App Feature Tour</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.resetBtn,
                    resetConfirm && styles.resetBtnConfirm,
                  ]}
                  onPress={handleReset}
                  focusable={false}
                  activeOpacity={0.85}
                >
                  <Text style={[styles.resetBtnText, resetConfirm && styles.resetBtnTextConfirm]}>
                    {resetConfirm ? 'Tap Again to Confirm Reset' : '↺ Reset All Settings to Default'}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};

const createStyles = (tokens: typeof DarkTokens, isDark: boolean) =>
  StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: isDark ? 'rgba(3, 5, 10, 0.84)' : 'rgba(15, 23, 42, 0.45)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  container: {
    width: '100%',
    maxHeight: '90%',
    backgroundColor: tokens.bgSurface,
    borderRadius: 22,
    borderWidth: 1.2,
    borderColor: tokens.borderLight,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: isDark ? 0.9 : 0.2,
    shadowRadius: 30,
    elevation: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingTop: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: tokens.borderSubtle,
  },
  headerTitleCol: {
    flex: 1,
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  modalTitle: {
    color: tokens.textWhite,
    fontSize: 16.5,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  modalSubtitle: {
    color: tokens.textSecondary,
    fontSize: 11.5,
    marginTop: 2,
    marginLeft: 16,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.05)',
    borderWidth: 1,
    borderColor: tokens.borderLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 10,
  },
  closeBtnText: {
    color: tokens.textSecondary,
    fontSize: 14,
    fontWeight: '700',
  },
  body: {
    padding: 16,
  },
  section: {
    marginBottom: 16,
  },
  sectionTitle: {
    color: tokens.textMuted,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
    marginBottom: 8,
    marginLeft: 2,
  },
  card: {
    backgroundColor: isDark ? '#161925' : tokens.cardElevated,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: tokens.borderSubtle,
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  settingRowBorderTop: {
    borderTopWidth: 1,
    borderTopColor: tokens.borderSubtle,
    paddingTop: 12,
    marginTop: 12,
  },
  settingTextCol: {
    flex: 1,
    paddingRight: 14,
  },
  settingLabel: {
    color: tokens.textWhite,
    fontSize: 13.5,
    fontWeight: '700',
  },
  settingDesc: {
    color: tokens.textSecondary,
    fontSize: 11.5,
    lineHeight: 16,
    marginTop: 2,
  },
  togglePill: {
    width: 48,
    height: 26,
    borderRadius: 13,
    padding: 2,
    borderWidth: 1,
    justifyContent: 'center',
  },
  togglePillOff: {
    backgroundColor: isDark ? '#202230' : '#cbd5e1',
    borderColor: tokens.borderLight,
  },
  toggleKnob: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#ffffff',
  },
  toggleKnobOn: {
    alignSelf: 'flex-end',
  },
  subOptionContainer: {
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: tokens.borderSubtle,
  },
  subOptionLabel: {
    color: tokens.textSecondary,
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 8,
  },
  segmentedRow: {
    flexDirection: 'row',
    backgroundColor: isDark ? '#0f111a' : tokens.bgSurface,
    borderRadius: 10,
    padding: 3,
    gap: 4,
    borderWidth: 1,
    borderColor: tokens.borderSubtle,
  },
  segmentBtn: {
    flex: 1,
    paddingVertical: 7,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'transparent',
  },
  segmentBtnText: {
    color: tokens.textSecondary,
    fontSize: 12,
    fontWeight: '600',
  },
  paletteGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  paletteTile: {
    flexBasis: '31%',
    flexGrow: 1,
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 4,
    borderRadius: 10,
    backgroundColor: isDark ? '#0f111a' : tokens.bgSurface,
    borderWidth: 1.2,
    borderColor: tokens.borderSubtle,
  },
  colorOrb: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
    elevation: 2,
  },
  checkText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '800',
  },
  paletteName: {
    color: tokens.textSecondary,
    fontSize: 11,
    textAlign: 'center',
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: tokens.borderSubtle,
  },
  infoKey: {
    color: tokens.textSecondary,
    fontSize: 12,
  },
  infoVal: {
    color: tokens.textWhite,
    fontSize: 12,
    fontWeight: '600',
  },
  resetBtn: {
    marginTop: 12,
    paddingVertical: 9,
    borderRadius: 8,
    backgroundColor: isDark ? 'rgba(255, 255, 255, 0.04)' : 'rgba(0, 0, 0, 0.04)',
    borderWidth: 1,
    borderColor: tokens.borderLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  resetBtnConfirm: {
    backgroundColor: 'rgba(239, 68, 68, 0.16)',
    borderColor: 'rgba(239, 68, 68, 0.45)',
  },
  resetBtnText: {
    color: tokens.textSecondary,
    fontSize: 11.5,
    fontWeight: '600',
  },
  resetBtnTextConfirm: {
    color: '#ef4444',
    fontWeight: '700',
  },
  // Account & Cloud Backup Styles
  accountBox: {
    paddingVertical: 4,
  },
  profileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  avatarCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  avatarInitial: {
    fontSize: 18,
    fontWeight: '800',
  },
  profileTextCol: {
    flex: 1,
  },
  profileName: {
    fontSize: 14,
    fontWeight: '700',
    color: tokens.textWhite,
    marginBottom: 2,
  },
  profileEmail: {
    fontSize: 11,
    color: tokens.textSecondary,
    marginBottom: 3,
  },
  syncStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  syncStatusText: {
    fontSize: 10,
    color: tokens.statusConnected,
    fontWeight: '600',
  },
  accountActionsRow: {
    flexDirection: 'row',
    gap: 8,
    borderTopWidth: 1,
    borderTopColor: tokens.borderSubtle,
    paddingTop: 10,
  },
  accountBtn: {
    flex: 1,
    paddingVertical: 7,
    borderRadius: 8,
    backgroundColor: isDark ? 'rgba(255, 255, 255, 0.04)' : 'rgba(0, 0, 0, 0.04)',
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  accountBtnText: {
    fontSize: 11.5,
    fontWeight: '700',
  },
  logoutBtn: {
    paddingVertical: 7,
    paddingHorizontal: 14,
    borderRadius: 8,
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.35)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoutBtnText: {
    color: '#ef4444',
    fontSize: 11.5,
    fontWeight: '700',
  },
  guestBox: {
    paddingVertical: 4,
  },
  guestInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  guestIcon: {
    fontSize: 26,
    marginRight: 10,
  },
  guestTextCol: {
    flex: 1,
  },
  guestTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: tokens.textWhite,
    marginBottom: 2,
  },
  guestDesc: {
    fontSize: 11,
    color: tokens.textSecondary,
    lineHeight: 15,
  },
  signInGoogleBtn: {
    paddingVertical: 9,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  signInGoogleBtnText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '700',
  },
  });

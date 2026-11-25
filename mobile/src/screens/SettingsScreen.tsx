import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Share,
  PanResponder,
} from 'react-native';
import Svg, { Path, Rect, Circle } from 'react-native-svg';
import {
  settingsService,
  AppSettings,
  HapticIntensity,
  AccentTheme,
  ThemeMode,
  LaunchDeckOption,
  ACCENT_PALETTES,
} from '../services/SettingsService';
import { hapticsService } from '../services/HapticsService';
import { socketService, ConnectionStatus } from '../services/SocketService';
import { authService, UserProfile } from '../services/AuthService';
import { userStorageService } from '../services/UserStorageService';
import { useTheme } from '../theme/ThemeContext';
import { DarkTokens } from '../theme/cyberTokens';

export type SettingsSubView = 'main' | 'remote' | 'diagnostics' | 'troubleshoot' | 'faq';

interface SettingsScreenProps {
  onOpenLogin?: () => void;
  onOpenServerSwitcher?: () => void;
  onSubViewChange?: (isSubView: boolean) => void;
}

interface SettingSliderProps {
  label: string;
  value: number;
  min: number;
  max: number;
  accentColor: string;
  tokens: typeof DarkTokens;
  isDark: boolean;
  onChange: (val: number) => void;
}

const SettingSlider: React.FC<SettingSliderProps> = ({
  label,
  value,
  min,
  max,
  accentColor,
  tokens,
  isDark,
  onChange,
}) => {
  const trackRef = useRef<View>(null);
  const trackWidthRef = useRef(240);
  const trackPageXRef = useRef(0);

  const updateFromPageX = (pageX: number) => {
    const rel = Math.max(0, Math.min(1, (pageX - trackPageXRef.current) / trackWidthRef.current));
    const raw = min + rel * (max - min);
    const snapped = Math.round(raw * 10) / 10;
    onChange(snapped);
  };

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (evt) => {
        hapticsService.light();
        updateFromPageX(evt.nativeEvent.pageX);
      },
      onPanResponderMove: (evt) => {
        updateFromPageX(evt.nativeEvent.pageX);
      },
    })
  ).current;

  const pct = Math.max(0, Math.min(100, ((value - min) / (max - min)) * 100));

  return (
    <View style={{ paddingVertical: 8 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 }}>
        <Text style={{ fontSize: 14, fontWeight: '600', color: tokens.textWhite }}>{label}</Text>
        <Text style={{ fontSize: 13, fontWeight: '700', color: accentColor }}>
          {value.toFixed(1)}×
        </Text>
      </View>
      <View style={{ height: 28, justifyContent: 'center' }} {...panResponder.panHandlers}>
        <View
          ref={trackRef}
          onLayout={() => {
            trackRef.current?.measure((_x, _y, w, _h, px) => {
              if (w > 0) {
                trackWidthRef.current = w;
                trackPageXRef.current = px;
              }
            });
          }}
          style={{
            height: 5,
            borderRadius: 3,
            backgroundColor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.1)',
            position: 'relative',
          }}
        >
          <View
            style={{
              width: `${pct}%`,
              height: '100%',
              borderRadius: 3,
              backgroundColor: accentColor,
            }}
          />
          <View
            style={{
              position: 'absolute',
              left: `${pct}%`,
              top: -7,
              marginLeft: -9,
              width: 18,
              height: 18,
              borderRadius: 9,
              backgroundColor: accentColor,
              borderWidth: 2,
              borderColor: '#ffffff',
              elevation: 3,
            }}
          />
        </View>
      </View>
    </View>
  );
};

export const SettingsScreen: React.FC<SettingsScreenProps> = ({
  onOpenLogin,
  onOpenServerSwitcher,
  onSubViewChange,
}) => {
  const { isDark, tokens, accent } = useTheme();
  const styles = useMemo(() => createStyles(tokens, isDark), [tokens, isDark]);

  const [subView, setSubView] = useState<SettingsSubView>('main');
  const [settings, setSettings] = useState<AppSettings>(settingsService.getSettings());
  const [resetConfirm, setResetConfirm] = useState(false);
  const [user, setUser] = useState<UserProfile | null>(authService.getCurrentUser());
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncedAt, setLastSyncedAt] = useState<number | null>(userStorageService.getLastSyncedTime());
  const [connStatus, setConnStatus] = useState<ConnectionStatus>(socketService.getStatus());
  const [latency, setLatency] = useState<number>(0);
  const [expandedFaq, setExpandedFaq] = useState<number | null>(0);

  useEffect(() => {
    const unsubSettings = settingsService.subscribe(setSettings);
    const unsubAuth = authService.subscribe((u) => setUser(u));
    const unsubSync = userStorageService.subscribe((t, s) => {
      setLastSyncedAt(t);
      setIsSyncing(s);
    });
    const unsubSocket = socketService.subscribe((st, lat) => {
      setConnStatus(st);
      setLatency(lat);
    });
    return () => {
      unsubSettings();
      unsubAuth();
      unsubSync();
      unsubSocket();
    };
  }, []);

  const navigateSubView = (view: SettingsSubView) => {
    hapticsService.light();
    setSubView(view);
    onSubViewChange?.(view !== 'main');
  };

  const handleToggle = <K extends keyof AppSettings>(key: K) => {
    hapticsService.light();
    const current = settings[key] as boolean;
    settingsService.updateSetting(key, !current as any);
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

  const handleShareApp = async () => {
    hapticsService.light();
    try {
      await Share.share({
        message:
          'Control your PC wirelessly with Remote Mouse Pro — zero-lag Wi-Fi touchpad, mechanical keyboard, pro gamepad, presentation timer & webcam!',
      });
    } catch (e) {}
  };

  const renderSwitch = (value: boolean, onPress: () => void) => (
    <TouchableOpacity
      style={[
        styles.togglePill,
        value
          ? { backgroundColor: accent.primary, borderColor: accent.primary }
          : styles.togglePillOff,
      ]}
      onPress={onPress}
      activeOpacity={0.85}
      focusable={false}
    >
      <View style={[styles.toggleKnob, value && styles.toggleKnobOn]} />
    </TouchableOpacity>
  );

  const renderChevron = () => (
    <Svg width="16" height="16" viewBox="0 0 24 24" fill="none">
      <Path
        d="M9 18l6-6-6-6"
        stroke={tokens.textMuted}
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );

  const renderSubHeader = (title: string) => (
    <View style={styles.subHeader}>
      <TouchableOpacity
        style={styles.backCircle}
        onPress={() => navigateSubView('main')}
        activeOpacity={0.8}
        focusable={false}
      >
        <Svg width="18" height="18" viewBox="0 0 24 24" fill="none">
          <Path
            d="M19 12H5M12 19l-7-7 7-7"
            stroke={tokens.textWhite}
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </Svg>
      </TouchableOpacity>
      <Text style={styles.subHeaderTitle}>{title}</Text>
    </View>
  );

  // ================= SUB-VIEW 1: REMOTE SETTINGS =================
  if (subView === 'remote') {
    const launchOptions: { id: LaunchDeckOption; label: string }[] = [
      { id: 'hub', label: 'Hub' },
      { id: 'touchpad', label: 'Pad' },
      { id: 'keyboard', label: 'Keys' },
      { id: 'gamepad', label: 'Game' },
    ];

    return (
      <View style={styles.container}>
        {renderSubHeader('Remote settings')}
        <ScrollView contentContainerStyle={styles.subScroll} showsVerticalScrollIndicator={false}>
          {/* Group 1: Connection */}
          <Text style={styles.sectionTitle}>Connection</Text>
          <View style={styles.card}>
            <View style={styles.row}>
              <View style={styles.rowTextCol}>
                <Text style={styles.rowTitle}>Turbo UDP Mode</Text>
                <Text style={styles.rowSubtitle}>
                  Use ultra-low-latency UDP datagrams for mouse & gamepad
                </Text>
              </View>
              {renderSwitch(settings.preferUdp, () => handleToggle('preferUdp'))}
            </View>

            <View style={[styles.row, styles.rowBorderTop]}>
              <View style={styles.rowTextCol}>
                <Text style={styles.rowTitle}>Reconnect automatically</Text>
                <Text style={styles.rowSubtitle}>
                  Connect to your last used PC when the app starts
                </Text>
              </View>
              {renderSwitch(settings.autoReconnect, () => handleToggle('autoReconnect'))}
            </View>
          </View>

          {/* Group 2: Touchpad */}
          <Text style={styles.sectionTitle}>Touchpad</Text>
          <View style={styles.card}>
            <SettingSlider
              label="Pointer speed"
              value={settings.pointerSpeed}
              min={0.5}
              max={3.0}
              accentColor={accent.primary}
              tokens={tokens}
              isDark={isDark}
              onChange={(v) => settingsService.updateSetting('pointerSpeed', v)}
            />

            <View style={styles.divider} />

            <SettingSlider
              label="Scroll speed"
              value={settings.scrollSpeed}
              min={0.5}
              max={3.0}
              accentColor={accent.primary}
              tokens={tokens}
              isDark={isDark}
              onChange={(v) => settingsService.updateSetting('scrollSpeed', v)}
            />

            <View style={[styles.row, styles.rowBorderTop]}>
              <View style={styles.rowTextCol}>
                <Text style={styles.rowTitle}>Natural scrolling</Text>
                <Text style={styles.rowSubtitle}>
                  Scroll follows your fingers, like a touchscreen
                </Text>
              </View>
              {renderSwitch(settings.naturalScrolling, () => handleToggle('naturalScrolling'))}
            </View>
          </View>

          <View style={[styles.card, { marginTop: 12 }]}>
            <View style={styles.row}>
              <View style={styles.rowTextCol}>
                <Text style={styles.rowTitle}>Tap to click</Text>
                <Text style={styles.rowSubtitle}>Single finger tap triggers left click</Text>
              </View>
              {renderSwitch(settings.tapToClick, () => handleToggle('tapToClick'))}
            </View>

            <View style={[styles.row, styles.rowBorderTop]}>
              <View style={styles.rowTextCol}>
                <Text style={styles.rowTitle}>Tap and drag</Text>
                <Text style={styles.rowSubtitle}>Double-tap, hold and slide to drag items</Text>
              </View>
              {renderSwitch(settings.tapAndDrag, () => handleToggle('tapAndDrag'))}
            </View>

            <View style={[styles.row, styles.rowBorderTop]}>
              <View style={styles.rowTextCol}>
                <Text style={styles.rowTitle}>Show mouse buttons</Text>
                <Text style={styles.rowSubtitle}>
                  Display bottom Left / Scroll / Right bar on Trackpad
                </Text>
              </View>
              {renderSwitch(settings.showMouseButtons, () => handleToggle('showMouseButtons'))}
            </View>

            <View style={[styles.row, styles.rowBorderTop]}>
              <View style={styles.rowTextCol}>
                <Text style={styles.rowTitle}>Swap left and right buttons</Text>
                <Text style={styles.rowSubtitle}>Left-handed mouse button layout</Text>
              </View>
              {renderSwitch(settings.swapMouseButtons, () => handleToggle('swapMouseButtons'))}
            </View>
          </View>

          {/* Group 3: Control screens & Haptics */}
          <Text style={styles.sectionTitle}>Control screens</Text>
          <View style={styles.card}>
            <View style={{ paddingBottom: 10 }}>
              <Text style={styles.rowTitle}>Open at launch</Text>
              <Text style={[styles.rowSubtitle, { marginBottom: 10 }]}>
                Choose which deck opens automatically on startup
              </Text>
              <View style={styles.segmentedRow}>
                {launchOptions.map((opt) => {
                  const selected = settings.launchDeck === opt.id;
                  return (
                    <TouchableOpacity
                      key={opt.id}
                      style={[
                        styles.segmentBtn,
                        selected && {
                          backgroundColor: accent.bgSoft,
                          borderColor: accent.primary,
                        },
                      ]}
                      onPress={() => {
                        hapticsService.light();
                        settingsService.updateSetting('launchDeck', opt.id);
                      }}
                      activeOpacity={0.85}
                      focusable={false}
                    >
                      <Text
                        style={[
                          styles.segmentBtnText,
                          selected && { color: accent.primary, fontWeight: '700' },
                        ]}
                      >
                        {opt.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            <View style={[styles.row, styles.rowBorderTop]}>
              <View style={styles.rowTextCol}>
                <Text style={styles.rowTitle}>Vibrate on press</Text>
                <Text style={styles.rowSubtitle}>Tactile feedback on keys, clicks & buttons</Text>
              </View>
              {renderSwitch(settings.hapticsEnabled, () => handleToggle('hapticsEnabled'))}
            </View>

            {settings.hapticsEnabled && (
              <View style={{ paddingTop: 12 }}>
                <Text style={[styles.rowSubtitle, { marginBottom: 8 }]}>Vibration intensity</Text>
                <View style={styles.segmentedRow}>
                  {(['subtle', 'medium', 'strong'] as HapticIntensity[]).map((lvl) => {
                    const selected = settings.hapticsIntensity === lvl;
                    return (
                      <TouchableOpacity
                        key={lvl}
                        style={[
                          styles.segmentBtn,
                          selected && {
                            backgroundColor: accent.bgSoft,
                            borderColor: accent.primary,
                          },
                        ]}
                        onPress={() => {
                          settingsService.updateSetting('hapticsIntensity', lvl);
                          setTimeout(() => hapticsService.light(), 40);
                        }}
                        activeOpacity={0.85}
                        focusable={false}
                      >
                        <Text
                          style={[
                            styles.segmentBtnText,
                            selected && { color: accent.primary, fontWeight: '700' },
                          ]}
                        >
                          {lvl.charAt(0).toUpperCase() + lvl.slice(1)}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            )}

            <View style={[styles.row, styles.rowBorderTop]}>
              <View style={styles.rowTextCol}>
                <Text style={styles.rowTitle}>Keep the screen on</Text>
                <Text style={styles.rowSubtitle}>Prevent phone sleep while using remote</Text>
              </View>
              {renderSwitch(settings.keepAwake, () => handleToggle('keepAwake'))}
            </View>
          </View>

          {/* Group 4: Presentation */}
          <Text style={styles.sectionTitle}>Presentation</Text>
          <View style={styles.card}>
            <View style={styles.row}>
              <View style={styles.rowTextCol}>
                <Text style={styles.rowTitle}>Vibrate when time is running out</Text>
                <Text style={styles.rowSubtitle}>
                  Haptic buzz alerts at 5 minutes & 1 minute remaining
                </Text>
              </View>
              {renderSwitch(settings.presentationTimerHaptics, () =>
                handleToggle('presentationTimerHaptics')
              )}
            </View>
          </View>
        </ScrollView>
      </View>
    );
  }

  // ================= SUB-VIEW 2: CONNECTION DIAGNOSTICS =================
  if (subView === 'diagnostics') {
    const isConnected = connStatus === 'connected';
    return (
      <View style={styles.container}>
        {renderSubHeader('Check the connection')}
        <ScrollView contentContainerStyle={styles.subScroll} showsVerticalScrollIndicator={false}>
          <View style={styles.card}>
            <View style={styles.diagRow}>
              <Text style={styles.rowTitle}>Link Status</Text>
              <Text
                style={{
                  fontWeight: '700',
                  color: isConnected ? tokens.statusConnected : tokens.statusDisconnected,
                }}
              >
                {isConnected ? '● Connected' : '○ Disconnected'}
              </Text>
            </View>
            <View style={[styles.diagRow, styles.rowBorderTop]}>
              <Text style={styles.rowTitle}>Host PC</Text>
              <Text style={styles.rowSubtitle}>{socketService.getServerName() || 'None'}</Text>
            </View>
            <View style={[styles.diagRow, styles.rowBorderTop]}>
              <Text style={styles.rowTitle}>Target IP & TCP Port</Text>
              <Text style={styles.rowSubtitle}>
                {socketService.getHostIp()
                  ? `${socketService.getHostIp()}:${socketService.getPort()}`
                  : '—'}
              </Text>
            </View>
            <View style={[styles.diagRow, styles.rowBorderTop]}>
              <Text style={styles.rowTitle}>Transport Mode</Text>
              <Text style={styles.rowSubtitle}>
                {settings.preferUdp ? 'Turbo UDP + TCP' : 'TCP Reliable'}
              </Text>
            </View>
            <View style={[styles.diagRow, styles.rowBorderTop]}>
              <Text style={styles.rowTitle}>Measured Latency</Text>
              <Text style={{ fontWeight: '700', color: accent.primary }}>
                {isConnected ? (latency > 0 ? `${latency} ms` : '<1 ms') : 'N/A'}
              </Text>
            </View>
          </View>

          {onOpenServerSwitcher && (
            <TouchableOpacity
              style={[styles.primaryBtn, { backgroundColor: accent.primary, marginTop: 16 }]}
              onPress={() => {
                hapticsService.light();
                onOpenServerSwitcher();
              }}
              activeOpacity={0.85}
            >
              <Text style={styles.primaryBtnText}>
                {isConnected ? 'Switch or Rescan PC Servers' : 'Scan Wi-Fi for PC Server'}
              </Text>
            </TouchableOpacity>
          )}
        </ScrollView>
      </View>
    );
  }

  // ================= SUB-VIEW 3: TROUBLESHOOTING =================
  if (subView === 'troubleshoot') {
    const steps = [
      {
        n: '1',
        title: 'Run the PC Server',
        desc: 'Ensure the Python Remote Mouse server (server.py) is running on your Windows/Mac/Linux PC.',
      },
      {
        n: '2',
        title: 'Same Wi-Fi or Hotspot',
        desc: 'Both your phone and PC must be on the same local Wi-Fi network (or connected via Windows Mobile Hotspot).',
      },
      {
        n: '3',
        title: 'Allow Firewall Ports 5000 & 5002',
        desc: 'If discovery fails, allow Python through Windows Defender Firewall for Private Networks (TCP 5000, UDP 5002).',
      },
      {
        n: '4',
        title: 'Manual IP Fallback',
        desc: 'Open Switch Server → Connect Manually and enter your PC local IPv4 address (found via ipconfig).',
      },
    ];

    return (
      <View style={styles.container}>
        {renderSubHeader('Steps to fix the connection')}
        <ScrollView contentContainerStyle={styles.subScroll} showsVerticalScrollIndicator={false}>
          <View style={styles.card}>
            {steps.map((s, idx) => (
              <View key={s.n} style={[styles.stepRow, idx > 0 && styles.rowBorderTop]}>
                <View style={[styles.stepBadge, { backgroundColor: accent.bgSoft }]}>
                  <Text style={{ color: accent.primary, fontWeight: '800', fontSize: 13 }}>{s.n}</Text>
                </View>
                <View style={styles.rowTextCol}>
                  <Text style={styles.rowTitle}>{s.title}</Text>
                  <Text style={styles.rowSubtitle}>{s.desc}</Text>
                </View>
              </View>
            ))}
          </View>
        </ScrollView>
      </View>
    );
  }

  // ================= SUB-VIEW 4: FAQ =================
  if (subView === 'faq') {
    const faqs = [
      {
        q: 'How do I right-click or scroll on the Trackpad?',
        a: 'Tap once with 1 finger to left-click, tap with 2 fingers to right-click, and slide 2 fingers up/down to scroll smoothly.',
      },
      {
        q: 'How does the Gamepad Ambient Mouse work?',
        a: 'In any of the 7 gamepad presets, swiping on any blank space around the sticks or buttons moves your PC mouse cursor. Tap blank space to left-click or 2-finger tap to right-click.',
      },
      {
        q: 'How do I use Show on PC / Screen Mirroring?',
        a: 'Open the Show on PC tab in the bottom dock while connected to your PC to get your local portal URL and stream your screen or webcam.',
      },
      {
        q: 'Why is UDP faster than TCP?',
        a: 'Turbo UDP sends mouse deltas and thumbstick positions without packet-ack waiting, eliminating input lag during fast cursor movement or gaming.',
      },
    ];

    return (
      <View style={styles.container}>
        {renderSubHeader('Frequently asked questions')}
        <ScrollView contentContainerStyle={styles.subScroll} showsVerticalScrollIndicator={false}>
          <View style={styles.card}>
            {faqs.map((item, idx) => {
              const isOpen = expandedFaq === idx;
              return (
                <TouchableOpacity
                  key={idx}
                  style={[idx > 0 && styles.rowBorderTop, { paddingVertical: 10 }]}
                  onPress={() => {
                    hapticsService.light();
                    setExpandedFaq(isOpen ? null : idx);
                  }}
                  activeOpacity={0.8}
                >
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Text style={[styles.rowTitle, { flex: 1, paddingRight: 8 }]}>{item.q}</Text>
                    <Text style={{ color: accent.primary, fontWeight: '700', fontSize: 16 }}>
                      {isOpen ? '−' : '+'}
                    </Text>
                  </View>
                  {isOpen && (
                    <Text style={[styles.rowSubtitle, { marginTop: 6, lineHeight: 18 }]}>
                      {item.a}
                    </Text>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        </ScrollView>
      </View>
    );
  }

  // ================= MAIN SETTINGS TAB =================
  const themeModes: { id: ThemeMode; label: string }[] = [
    { id: 'system', label: 'System' },
    { id: 'light', label: 'Light' },
    { id: 'dark', label: 'Dark' },
  ];

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.mainScroll} showsVerticalScrollIndicator={false}>
        {/* Top Page Title */}
        <Text style={styles.pageTitle}>Settings</Text>

        {/* Hero Account & Cloud Sync Banner */}
        <View style={[styles.heroCard, { borderColor: `${accent.primary}40` }]}>
          {user && !user.isGuest ? (
            <View>
              <View style={styles.profileRow}>
                <View
                  style={[
                    styles.avatarCircle,
                    { backgroundColor: accent.bgSoft, borderColor: accent.primary },
                  ]}
                >
                  <Text style={[styles.avatarInitial, { color: accent.primary }]}>
                    {user.displayName ? user.displayName.charAt(0).toUpperCase() : 'U'}
                  </Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.rowTitle}>{user.displayName}</Text>
                  <Text style={styles.rowSubtitle} numberOfLines={1}>
                    {user.email}
                  </Text>
                  <Text style={{ fontSize: 11, color: tokens.statusConnected, fontWeight: '600', marginTop: 2 }}>
                    {isSyncing
                      ? 'Syncing preferences...'
                      : lastSyncedAt
                      ? `Synced • ${new Date(lastSyncedAt).toLocaleTimeString()}`
                      : 'Cloud Backup Active'}
                  </Text>
                </View>
              </View>
              <View style={styles.accountActions}>
                <TouchableOpacity
                  style={[styles.smallBtn, { borderColor: accent.border }]}
                  onPress={() => {
                    hapticsService.light();
                    userStorageService.syncToCloud();
                  }}
                  disabled={isSyncing}
                >
                  {isSyncing ? (
                    <ActivityIndicator size="small" color={accent.primary} />
                  ) : (
                    <Text style={{ color: accent.primary, fontWeight: '700', fontSize: 12 }}>
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
                >
                  <Text style={{ color: '#ef4444', fontWeight: '700', fontSize: 12 }}>Sign Out</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <View style={styles.guestRow}>
              <View style={[styles.iconBox, { backgroundColor: accent.bgSoft, width: 44, height: 44 }]}>
                <Svg width="22" height="22" viewBox="0 0 24 24" fill="none">
                  <Path
                    d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z"
                    stroke={accent.primary}
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </Svg>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.rowTitle}>Sync your PC Remote setup</Text>
                <Text style={styles.rowSubtitle}>
                  Back up gamepad layouts, sensitivities & servers
                </Text>
              </View>
              <TouchableOpacity
                style={[styles.pillCta, { backgroundColor: accent.primary }]}
                onPress={async () => {
                  hapticsService.light();
                  if (onOpenLogin) {
                    onOpenLogin();
                  } else {
                    await authService.loginWithGoogle();
                  }
                }}
                activeOpacity={0.85}
              >
                <Text style={styles.pillCtaText}>Sign In</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* Section 1: Display */}
        <Text style={styles.sectionTitle}>Display</Text>
        <View style={styles.card}>
          {/* Inline Theme Row */}
          <View style={styles.row}>
            <View style={styles.rowLeft}>
              <View style={[styles.iconBox, { backgroundColor: accent.bgSoft }]}>
                <Svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                  <Circle cx="12" cy="12" r="4" stroke={accent.primary} strokeWidth="2" />
                  <Path
                    d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"
                    stroke={accent.primary}
                    strokeWidth="2"
                    strokeLinecap="round"
                  />
                </Svg>
              </View>
              <Text style={styles.rowTitle}>Theme</Text>
            </View>

            <View style={styles.inlineSegmented}>
              {themeModes.map((m) => {
                const selected = (settings.themeMode || 'dark') === m.id;
                return (
                  <TouchableOpacity
                    key={m.id}
                    style={[
                      styles.inlineSegBtn,
                      selected && {
                        backgroundColor: isDark ? 'rgba(255,255,255,0.14)' : '#ffffff',
                      },
                    ]}
                    onPress={() => {
                      hapticsService.light();
                      settingsService.updateSetting('themeMode', m.id);
                    }}
                    activeOpacity={0.85}
                    focusable={false}
                  >
                    <Text
                      style={[
                        styles.inlineSegText,
                        selected && { color: tokens.textWhite, fontWeight: '700' },
                      ]}
                    >
                      {m.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          {/* Inline Colour Theme Swatches */}
          <View style={[styles.row, styles.rowBorderTop]}>
            <View style={styles.rowLeft}>
              <View style={[styles.iconBox, { backgroundColor: accent.bgSoft }]}>
                <Svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                  <Circle cx="12" cy="12" r="9" stroke={accent.primary} strokeWidth="2" />
                  <Circle cx="12" cy="12" r="3" fill={accent.primary} />
                </Svg>
              </View>
              <Text style={styles.rowTitle}>Colour theme</Text>
            </View>

            <View style={styles.swatchRow}>
              {(Object.keys(ACCENT_PALETTES) as AccentTheme[]).map((key) => {
                const pal = ACCENT_PALETTES[key];
                const isSelected = settings.accentTheme === key;
                return (
                  <TouchableOpacity
                    key={key}
                    onPress={() => {
                      hapticsService.light();
                      settingsService.updateSetting('accentTheme', key);
                    }}
                    style={[
                      styles.swatchDot,
                      { backgroundColor: pal.primary },
                      isSelected && {
                        borderWidth: 2.5,
                        borderColor: tokens.textWhite,
                        transform: [{ scale: 1.15 }],
                      },
                    ]}
                    activeOpacity={0.85}
                    focusable={false}
                  />
                );
              })}
            </View>
          </View>
        </View>

        {/* Section 2: Remote */}
        <Text style={styles.sectionTitle}>Remote</Text>
        <View style={styles.card}>
          <TouchableOpacity
            style={styles.row}
            onPress={() => navigateSubView('remote')}
            activeOpacity={0.75}
          >
            <View style={[styles.iconBox, { backgroundColor: accent.bgSoft }]}>
              <Svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                <Path
                  d="M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M1 14h6M9 8h6M17 16h6"
                  stroke={accent.primary}
                  strokeWidth="2"
                  strokeLinecap="round"
                />
              </Svg>
            </View>
            <View style={styles.rowTextCol}>
              <Text style={styles.rowTitle}>Remote settings</Text>
              <Text style={styles.rowSubtitle}>
                Pointer speed, scroll, haptics, launch deck
              </Text>
            </View>
            {renderChevron()}
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.row, styles.rowBorderTop]}
            onPress={() => navigateSubView('diagnostics')}
            activeOpacity={0.75}
          >
            <View style={[styles.iconBox, { backgroundColor: 'rgba(16, 185, 129, 0.16)' }]}>
              <Svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                <Path
                  d="M22 12h-4l-3 9L9 3l-3 9H2"
                  stroke={tokens.emerald}
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </Svg>
            </View>
            <View style={styles.rowTextCol}>
              <Text style={styles.rowTitle}>Check the connection</Text>
              <Text style={styles.rowSubtitle}>
                Live latency, UDP transport & server status
              </Text>
            </View>
            {renderChevron()}
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.row, styles.rowBorderTop]}
            onPress={() => navigateSubView('troubleshoot')}
            activeOpacity={0.75}
          >
            <View style={[styles.iconBox, { backgroundColor: 'rgba(59, 130, 246, 0.16)' }]}>
              <Svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                <Path
                  d="M5 12.55a11 11 0 0 1 14.08 0M8.53 16.11a6 6 0 0 1 6.95 0M12 20h.01"
                  stroke={tokens.blue}
                  strokeWidth="2"
                  strokeLinecap="round"
                />
              </Svg>
            </View>
            <View style={styles.rowTextCol}>
              <Text style={styles.rowTitle}>Steps to fix the connection</Text>
              <Text style={styles.rowSubtitle}>
                Wi-Fi broadcast, firewall & server.py checklist
              </Text>
            </View>
            {renderChevron()}
          </TouchableOpacity>
        </View>

        {/* Section 3: Support */}
        <Text style={styles.sectionTitle}>Support</Text>
        <View style={styles.card}>
          <TouchableOpacity
            style={styles.row}
            onPress={() => {
              hapticsService.light();
              settingsService.updateSetting('hasCompletedOnboarding', false);
            }}
            activeOpacity={0.75}
          >
            <View style={[styles.iconBox, { backgroundColor: accent.bgSoft }]}>
              <Svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                <Rect x="6" y="3" width="12" height="18" rx="2.5" stroke={accent.primary} strokeWidth="2" />
                <Circle cx="12" cy="17" r="1" fill={accent.primary} />
              </Svg>
            </View>
            <View style={styles.rowTextCol}>
              <Text style={styles.rowTitle}>App tour</Text>
              <Text style={styles.rowSubtitle}>What this app can do</Text>
            </View>
            {renderChevron()}
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.row, styles.rowBorderTop]}
            onPress={() => navigateSubView('faq')}
            activeOpacity={0.75}
          >
            <View style={[styles.iconBox, { backgroundColor: accent.bgSoft }]}>
              <Svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                <Circle cx="12" cy="12" r="9" stroke={accent.primary} strokeWidth="2" />
                <Path
                  d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3M12 17h.01"
                  stroke={accent.primary}
                  strokeWidth="2"
                  strokeLinecap="round"
                />
              </Svg>
            </View>
            <View style={styles.rowTextCol}>
              <Text style={styles.rowTitle}>Frequently asked questions</Text>
              <Text style={styles.rowSubtitle}>
                Gestures, gamepad mouse & Show on PC
              </Text>
            </View>
            {renderChevron()}
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.row, styles.rowBorderTop]}
            onPress={handleShareApp}
            activeOpacity={0.75}
          >
            <View style={[styles.iconBox, { backgroundColor: accent.bgSoft }]}>
              <Svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                <Path
                  d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8M16 6l-4-4-4 4M12 2v13"
                  stroke={accent.primary}
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </Svg>
            </View>
            <View style={styles.rowTextCol}>
              <Text style={styles.rowTitle}>Share</Text>
            </View>
            {renderChevron()}
          </TouchableOpacity>
        </View>

        {/* Section 4: About this app */}
        <Text style={styles.sectionTitle}>About this app</Text>
        <View style={styles.card}>
          <View style={styles.row}>
            <View style={styles.rowLeft}>
              <View style={[styles.iconBox, { backgroundColor: accent.bgSoft }]}>
                <Svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                  <Circle cx="12" cy="12" r="9" stroke={accent.primary} strokeWidth="2" />
                  <Path d="M12 16v-4M12 8h.01" stroke={accent.primary} strokeWidth="2" strokeLinecap="round" />
                </Svg>
              </View>
              <View>
                <Text style={styles.rowTitle}>Remote Mouse Pro</Text>
                <Text style={styles.rowSubtitle}>v1.4.0 • Hardware Accelerated UDP</Text>
              </View>
            </View>
          </View>

          <TouchableOpacity
            style={[
              styles.resetBtn,
              resetConfirm && styles.resetBtnConfirm,
            ]}
            onPress={handleReset}
            activeOpacity={0.85}
          >
            <Text style={[styles.resetBtnText, resetConfirm && styles.resetBtnTextConfirm]}>
              {resetConfirm ? 'Tap Again to Confirm Reset' : '↺ Reset All Settings to Default'}
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
};

const createStyles = (tokens: typeof DarkTokens, isDark: boolean) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: tokens.bgObsidian,
    },
    mainScroll: {
      paddingHorizontal: 16,
      paddingTop: 12,
      paddingBottom: 110,
    },
    subScroll: {
      paddingHorizontal: 16,
      paddingTop: 8,
      paddingBottom: 40,
    },
    pageTitle: {
      fontSize: 28,
      fontWeight: '800',
      color: tokens.textWhite,
      marginBottom: 14,
      letterSpacing: 0.2,
    },
    subHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 16,
      paddingVertical: 12,
      gap: 12,
    },
    backCircle: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)',
      alignItems: 'center',
      justifyContent: 'center',
    },
    subHeaderTitle: {
      fontSize: 19,
      fontWeight: '700',
      color: tokens.textWhite,
    },
    heroCard: {
      backgroundColor: tokens.cardBase,
      borderRadius: 18,
      padding: 14,
      borderWidth: 1,
      marginBottom: 18,
    },
    guestRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
    },
    pillCta: {
      paddingVertical: 8,
      paddingHorizontal: 14,
      borderRadius: 999,
    },
    pillCtaText: {
      color: '#071312',
      fontSize: 12.5,
      fontWeight: '800',
    },
    profileRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      marginBottom: 10,
    },
    avatarCircle: {
      width: 42,
      height: 42,
      borderRadius: 21,
      borderWidth: 1.5,
      alignItems: 'center',
      justifyContent: 'center',
    },
    avatarInitial: {
      fontSize: 17,
      fontWeight: '800',
    },
    accountActions: {
      flexDirection: 'row',
      gap: 8,
      paddingTop: 10,
      borderTopWidth: 1,
      borderTopColor: tokens.borderSubtle,
    },
    smallBtn: {
      flex: 1,
      paddingVertical: 7,
      borderRadius: 8,
      borderWidth: 1,
      alignItems: 'center',
      justifyContent: 'center',
    },
    logoutBtn: {
      paddingVertical: 7,
      paddingHorizontal: 14,
      borderRadius: 8,
      backgroundColor: 'rgba(239,68,68,0.12)',
      borderWidth: 1,
      borderColor: 'rgba(239,68,68,0.35)',
    },
    sectionTitle: {
      fontSize: 13.5,
      fontWeight: '700',
      color: tokens.textSecondary,
      marginBottom: 8,
      marginTop: 14,
      marginLeft: 4,
    },
    card: {
      backgroundColor: tokens.cardBase,
      borderRadius: 18,
      paddingHorizontal: 14,
      paddingVertical: 6,
      borderWidth: 1,
      borderColor: tokens.borderSubtle,
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: 11,
      gap: 12,
    },
    rowBorderTop: {
      borderTopWidth: 1,
      borderTopColor: tokens.borderSubtle,
    },
    rowLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      flex: 1,
    },
    iconBox: {
      width: 36,
      height: 36,
      borderRadius: 10,
      alignItems: 'center',
      justifyContent: 'center',
    },
    rowTextCol: {
      flex: 1,
    },
    rowTitle: {
      fontSize: 14.5,
      fontWeight: '700',
      color: tokens.textWhite,
    },
    rowSubtitle: {
      fontSize: 12,
      color: tokens.textSecondary,
      marginTop: 2,
      lineHeight: 16,
    },
    inlineSegmented: {
      flexDirection: 'row',
      backgroundColor: isDark ? '#0b0d14' : tokens.cardElevated,
      borderRadius: 10,
      padding: 3,
      borderWidth: 1,
      borderColor: tokens.borderSubtle,
    },
    inlineSegBtn: {
      paddingVertical: 5,
      paddingHorizontal: 10,
      borderRadius: 7,
    },
    inlineSegText: {
      fontSize: 12,
      fontWeight: '600',
      color: tokens.textMuted,
    },
    swatchRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    swatchDot: {
      width: 18,
      height: 18,
      borderRadius: 9,
    },
    togglePill: {
      width: 46,
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
    divider: {
      height: 1,
      backgroundColor: tokens.borderSubtle,
      marginVertical: 4,
    },
    segmentedRow: {
      flexDirection: 'row',
      backgroundColor: isDark ? '#0b0d14' : tokens.cardElevated,
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
    diagRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: 12,
    },
    primaryBtn: {
      paddingVertical: 13,
      borderRadius: 999,
      alignItems: 'center',
      justifyContent: 'center',
    },
    primaryBtnText: {
      color: '#071312',
      fontSize: 14,
      fontWeight: '800',
    },
    stepRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      paddingVertical: 12,
      gap: 12,
    },
    stepBadge: {
      width: 28,
      height: 28,
      borderRadius: 14,
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: 2,
    },
    resetBtn: {
      marginTop: 6,
      marginBottom: 8,
      paddingVertical: 10,
      borderRadius: 10,
      backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)',
      borderWidth: 1,
      borderColor: tokens.borderLight,
      alignItems: 'center',
    },
    resetBtnConfirm: {
      backgroundColor: 'rgba(239,68,68,0.16)',
      borderColor: 'rgba(239,68,68,0.45)',
    },
    resetBtnText: {
      color: tokens.textSecondary,
      fontSize: 12,
      fontWeight: '600',
    },
    resetBtnTextConfirm: {
      color: '#ef4444',
      fontWeight: '700',
    },
  });


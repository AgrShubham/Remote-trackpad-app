import React, { useState, useEffect } from 'react';
import {
  SafeAreaView,
  StatusBar,
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  Modal,
  Platform,
} from 'react-native';
import Svg, { Path, Rect } from 'react-native-svg';
import { CyberTokens } from './theme/cyberTokens';
import { ThemeProvider, useTheme } from './theme/ThemeContext';
import { socketService, ConnectionStatus } from './services/SocketService';
import { autoConnectService } from './services/AutoConnectService';
import { hapticsService } from './services/HapticsService';
import { settingsService, ACCENT_PALETTES, AppSettings } from './services/SettingsService';
import { authService, UserProfile } from './services/AuthService';
import { ConnectionModal } from './components/ConnectionModal';
import { SettingsModal } from './components/SettingsModal';
import { SplashScreen } from './screens/SplashScreen';
import { OnboardingScreen } from './screens/OnboardingScreen';
import { LoginScreen } from './screens/LoginScreen';
import { ConnectionGateModal } from './components/ConnectionGateModal';
import { ServerSwitcherBar } from './components/ServerSwitcherBar';
import { ServerSwitcherDrawer } from './components/ServerSwitcherDrawer';
import { BottomDock, BottomNavTab } from './components/BottomDock';
import { HomeScreen, ControlDeckType } from './screens/HomeScreen';
import { TrackpadScreen } from './screens/TrackpadScreen';
import { GamepadScreen } from './screens/GamepadScreen';
import { KeyboardScreen } from './screens/KeyboardScreen';
import { MediaScreen } from './screens/MediaScreen';
import { PresentationScreen } from './screens/PresentationScreen';
import { ShortcutsScreen } from './screens/ShortcutsScreen';
import { ShowOnPcScreen } from './screens/ShowOnPcScreen';

function AppContent() {
  const { isDark, tokens, accent } = useTheme();
  const [showSplash, setShowSplash] = useState(true);
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(authService.getCurrentUser());
  const [hasSkippedAuth, setHasSkippedAuth] = useState(authService.hasSkipped());
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [connectionGateSkipped, setConnectionGateSkipped] = useState(false);
  const [switcherDrawerVisible, setSwitcherDrawerVisible] = useState(false);

  // Navigation State Machine
  const [bottomTab, setBottomTab] = useState<BottomNavTab>('remote');
  const [currentDeck, setCurrentDeck] = useState<ControlDeckType | null>(null);

  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('disconnected');
  const [latency, setLatency] = useState(0);
  const [modalVisible, setModalVisible] = useState(false);
  const [settingsModalVisible, setSettingsModalVisible] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [settings, setSettings] = useState<AppSettings>(settingsService.getSettings());

  const toggleFullscreen = () => {
    setIsFullscreen((prev) => !prev);
  };

  useEffect(() => {
    const unsubSocket = socketService.subscribe((status, lat) => {
      setConnectionStatus(status);
      setLatency(lat);
    });

    const unsubSettings = settingsService.subscribe((newSettings) => {
      setSettings(newSettings);
    });

    const unsubAuth = authService.subscribe((user, skipped) => {
      setCurrentUser(user);
      setHasSkippedAuth(skipped);
    });

    return () => {
      unsubSocket();
      unsubSettings();
      unsubAuth();
    };
  }, []);

  const currentAccent = accent || ACCENT_PALETTES[settings.accentTheme] || ACCENT_PALETTES.teal;

  // 1. Splash Screen Phase
  if (showSplash) {
    return <SplashScreen onFinish={() => setShowSplash(false)} />;
  }

  // 1.5 First-Launch Onboarding Feature Overview Phase
  if (!settings.hasCompletedOnboarding) {
    return (
      <OnboardingScreen
        onComplete={() => settingsService.updateSetting('hasCompletedOnboarding', true)}
      />
    );
  }

  // 2. Authentication Screen Phase (First time launch if not logged in and not skipped)
  if (!currentUser && !hasSkippedAuth) {
    return (
      <LoginScreen
        onSuccess={() => {}}
        onSkip={() => {}}
      />
    );
  }

  // Handle bottom dock tab selection
  const handleSelectBottomTab = (tab: BottomNavTab) => {
    if (tab === 'settings') {
      setSettingsModalVisible(true);
    } else {
      setBottomTab(tab);
      setCurrentDeck(null);
    }
  };

  const deckTabs: { id: ControlDeckType; label: string }[] = [
    { id: 'touchpad', label: 'Trackpad' },
    { id: 'keyboard', label: 'Keyboard' },
    { id: 'gamepad', label: 'Gamepad' },
    { id: 'media', label: 'Media' },
    { id: 'presentation', label: 'Slides' },
    { id: 'shortcuts', label: 'Macros' },
  ];

  const renderDeckIcon = (deck: ControlDeckType, active: boolean, accentColor: string) => {
    const iconColor = active ? accentColor : tokens.textMuted;
    switch (deck) {
      case 'touchpad':
        return (
          <Svg width="18" height="18" viewBox="0 0 24 24" fill="none">
            <Rect x="4" y="3" width="16" height="18" rx="4" stroke={iconColor} strokeWidth="2" />
            <Path d="M4 14h16M12 14v7" stroke={iconColor} strokeWidth="1.8" />
          </Svg>
        );
      case 'keyboard':
        return (
          <Svg width="18" height="18" viewBox="0 0 24 24" fill="none">
            <Rect x="2" y="5" width="20" height="14" rx="3" stroke={iconColor} strokeWidth="2" />
            <Path d="M6 9h1M10 9h1M14 9h1M18 9h1M6 13h1M10 13h4M17 13h1" stroke={iconColor} strokeWidth="2" strokeLinecap="round" />
          </Svg>
        );
      case 'gamepad':
        return (
          <Svg width="18" height="18" viewBox="0 0 24 24" fill="none">
            <Rect x="2" y="6" width="20" height="12" rx="6" stroke={iconColor} strokeWidth="2" />
            <Path d="M6 12h4M8 10v4M15 11h.01M17 13h.01" stroke={iconColor} strokeWidth="2" strokeLinecap="round" />
          </Svg>
        );
      case 'media':
        return (
          <Svg width="18" height="18" viewBox="0 0 24 24" fill="none">
            <Path d="M11 5L6 9H2v6h4l5 4V5zM17 9a5 5 0 0 1 0 6M20 7a9 9 0 0 1 0 10" stroke={iconColor} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </Svg>
        );
      case 'presentation':
        return (
          <Svg width="18" height="18" viewBox="0 0 24 24" fill="none">
            <Rect x="3" y="3" width="18" height="12" rx="2" stroke={iconColor} strokeWidth="2" />
            <Path d="M8 21l4-6 4 6M12 15v6" stroke={iconColor} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          </Svg>
        );
      case 'shortcuts':
        return (
          <Svg width="18" height="18" viewBox="0 0 24 24" fill="none">
            <Rect x="3" y="3" width="7" height="7" rx="1.5" stroke={iconColor} strokeWidth="2" />
            <Rect x="14" y="3" width="7" height="7" rx="1.5" stroke={iconColor} strokeWidth="2" />
            <Rect x="3" y="14" width="7" height="7" rx="1.5" stroke={iconColor} strokeWidth="2" />
            <Rect x="14" y="14" width="7" height="7" rx="1.5" stroke={iconColor} strokeWidth="2" />
          </Svg>
        );
    }
  };

  // 3. Main Application Hub & Decks
  return (
    <SafeAreaView
      style={[
        styles.container,
        { backgroundColor: tokens.bgObsidian },
        isFullscreen && styles.containerFullscreen,
      ]}
    >
      <StatusBar
        hidden={isFullscreen}
        barStyle={isDark ? 'light-content' : 'dark-content'}
        backgroundColor={tokens.bgObsidian}
        translucent={Platform.OS === 'android'}
      />

      {/* Main Content Area */}
      <View
        style={[
          styles.content,
          { backgroundColor: tokens.bgObsidian },
          isFullscreen && styles.contentFullscreen,
        ]}
      >
        {bottomTab === 'remote' ? (
          currentDeck === null ? (
            /* Central Command Home Hub */
            <HomeScreen
              connectionStatus={connectionStatus}
              serverName={socketService.getServerName()}
              serverIp={socketService.getHostIp()}
              latency={latency}
              onOpenDeck={(deck) => setCurrentDeck(deck)}
              onOpenServerSwitcher={() => setSwitcherDrawerVisible(true)}
              accentColor={currentAccent.primary}
            />
          ) : (
            /* Active Control Deck View */
            <View style={[styles.deckContainer, { backgroundColor: tokens.bgObsidian }]}>
              {/* Top Quick Deck Switcher & Hub Return Ribbon - Hidden in Fullscreen */}
              {!isFullscreen && (
                <View
                  style={[
                    styles.deckSwitcherHeader,
                    {
                      backgroundColor: tokens.bgSurface,
                      borderBottomColor: tokens.borderSubtle,
                    },
                  ]}
                >
                  <TouchableOpacity
                    style={[
                      styles.hubReturnBtn,
                      {
                        backgroundColor: isDark
                          ? 'rgba(255, 255, 255, 0.08)'
                          : 'rgba(0, 0, 0, 0.05)',
                        borderColor: tokens.borderSubtle,
                      },
                    ]}
                    onPress={() => {
                      hapticsService.light();
                      setCurrentDeck(null);
                    }}
                    activeOpacity={0.8}
                  >
                    <Svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={tokens.textSecondary} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <Path d="M19 12H5M12 19l-7-7 7-7" />
                    </Svg>
                    <Text style={[styles.hubReturnText, { color: tokens.textWhite }]}>Hub</Text>
                  </TouchableOpacity>

                  <View style={styles.deckPillsScroll}>
                    {deckTabs.map((dt) => {
                      const isActive = currentDeck === dt.id;
                      return (
                        <TouchableOpacity
                          key={dt.id}
                          style={[
                            styles.deckPill,
                            {
                              backgroundColor: isDark
                                ? 'rgba(255, 255, 255, 0.03)'
                                : 'rgba(0, 0, 0, 0.04)',
                            },
                            isActive && [
                              styles.deckPillActive,
                              { backgroundColor: currentAccent.bgSoft, borderColor: currentAccent.border },
                            ],
                          ]}
                          onPress={() => {
                            hapticsService.light();
                            setCurrentDeck(dt.id);
                          }}
                          activeOpacity={0.8}
                        >
                          {renderDeckIcon(dt.id, isActive, currentAccent.primary)}
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>
              )}

              {/* Persistent Dedicated Server Switcher Bar - Hidden in Fullscreen */}
              {!isFullscreen && (
                <ServerSwitcherBar
                  status={connectionStatus}
                  serverName={socketService.getServerName()}
                  serverIp={socketService.getHostIp()}
                  latency={latency}
                  onOpenSwitcher={() => setSwitcherDrawerVisible(true)}
                  accentColor={currentAccent.primary}
                />
              )}

              {/* Render Selected Deck Component */}
              <View style={styles.deckBody}>
                {currentDeck === 'touchpad' && (
                  <TrackpadScreen
                    isFullscreen={isFullscreen}
                    onToggleFullscreen={toggleFullscreen}
                  />
                )}
                {currentDeck === 'keyboard' && (
                  <KeyboardScreen
                    isFullscreen={isFullscreen}
                    onToggleFullscreen={toggleFullscreen}
                  />
                )}
                {currentDeck === 'gamepad' && (
                  <GamepadScreen
                    isFullscreen={isFullscreen}
                    onToggleFullscreen={toggleFullscreen}
                  />
                )}
                {currentDeck === 'media' && (
                  <MediaScreen
                    isFullscreen={isFullscreen}
                    onToggleFullscreen={toggleFullscreen}
                  />
                )}
                {currentDeck === 'presentation' && (
                  <PresentationScreen
                    isFullscreen={isFullscreen}
                    onToggleFullscreen={toggleFullscreen}
                    accentColor={currentAccent.primary}
                  />
                )}
                {currentDeck === 'shortcuts' && (
                  <ShortcutsScreen
                    accentColor={currentAccent.primary}
                  />
                )}
              </View>
            </View>
          )
        ) : (
          /* Show on PC View */
          <ShowOnPcScreen
            serverIp={socketService.getHostIp()}
            serverName={socketService.getServerName()}
            accentColor={currentAccent.primary}
          />
        )}
      </View>

      {/* Floating Bottom Navigation Dock (Visible on Home and Show on PC) */}
      {!isFullscreen && currentDeck === null && (
        <BottomDock
          activeTab={bottomTab}
          onSelectTab={handleSelectBottomTab}
          accentColor={currentAccent.primary}
        />
      )}

      {/* Connection Gating Modal (Enforces connection on launch unless skipped) */}
      <ConnectionGateModal
        visible={
          connectionStatus !== 'connected' &&
          !connectionGateSkipped &&
          !showSplash
        }
        onSkip={() => setConnectionGateSkipped(true)}
        onConnected={() => setConnectionGateSkipped(true)}
      />

      {/* Dedicated Server Switcher Bottom Sheet Drawer */}
      <ServerSwitcherDrawer
        visible={switcherDrawerVisible}
        onClose={() => setSwitcherDrawerVisible(false)}
      />

      {/* Legacy/Manual Connection Modal */}
      <ConnectionModal
        visible={modalVisible}
        onClose={() => setModalVisible(false)}
      />

      {/* Settings & Preferences Modal */}
      <SettingsModal
        visible={settingsModalVisible}
        onClose={() => setSettingsModalVisible(false)}
        onOpenLogin={() => setShowLoginModal(true)}
      />

      {/* In-App Login Modal (Invoked from Settings if guest user wants to sign in) */}
      <Modal visible={showLoginModal} animationType="slide">
        <LoginScreen
          onSuccess={() => setShowLoginModal(false)}
          onSkip={() => setShowLoginModal(false)}
        />
      </Modal>
    </SafeAreaView>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <AppContent />
    </ThemeProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: CyberTokens.bgObsidian,
    paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight || 24) : 0,
  },
  containerFullscreen: {
    paddingTop: 0,
    backgroundColor: CyberTokens.bgObsidian,
  },
  content: {
    flex: 1,
    backgroundColor: CyberTokens.bgObsidian,
    minHeight: 0,
    overflow: 'hidden',
  },
  contentFullscreen: {
    padding: 0,
  },
  deckContainer: {
    flex: 1,
    flexDirection: 'column',
    backgroundColor: CyberTokens.bgObsidian,
  },
  deckSwitcherHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 5,
    paddingHorizontal: 8,
    backgroundColor: CyberTokens.bgSurface,
    borderBottomWidth: 1,
    borderBottomColor: CyberTokens.borderSubtle,
    gap: 6,
  },
  hubReturnBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderWidth: 1,
    borderColor: CyberTokens.borderSubtle,
    gap: 4,
  },
  hubReturnText: {
    color: '#cbd5e1',
    fontSize: 11,
    fontWeight: '700',
  },
  deckPillsScroll: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  deckPill: {
    flex: 1,
    height: 34,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
  },
  deckPillActive: {
    borderWidth: 1,
  },
  deckBody: {
    flex: 1,
  },
});

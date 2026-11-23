import React, { useState, useEffect } from 'react';
import {
  SafeAreaView,
  StatusBar,
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  Modal,
} from 'react-native';
import { CyberTokens } from './theme/cyberTokens';
import { socketService, ConnectionStatus } from './services/SocketService';
import { autoConnectService } from './services/AutoConnectService';
import { hapticsService } from './services/HapticsService';
import { settingsService, ACCENT_PALETTES, AppSettings } from './services/SettingsService';
import { authService, UserProfile } from './services/AuthService';
import { ConnectionModal } from './components/ConnectionModal';
import { SettingsModal } from './components/SettingsModal';
import { SplashScreen } from './screens/SplashScreen';
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

export default function App() {
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

  const currentAccent = ACCENT_PALETTES[settings.accentTheme] || ACCENT_PALETTES.teal;

  // 1. Splash Screen Phase
  if (showSplash) {
    return <SplashScreen onFinish={() => setShowSplash(false)} />;
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

  // 3. Main Application Hub & Decks
  return (
    <SafeAreaView style={[styles.container, isFullscreen && styles.containerFullscreen]}>
      <StatusBar hidden={isFullscreen} barStyle="light-content" backgroundColor={CyberTokens.bgObsidian} />

      {/* Main Content Area */}
      <View style={[styles.content, isFullscreen && styles.contentFullscreen]}>
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
            <View style={styles.deckContainer}>
              {/* Top Quick Deck Switcher & Hub Return Ribbon - Hidden in Fullscreen */}
              {!isFullscreen && (
                <View style={styles.deckSwitcherHeader}>
                  <TouchableOpacity
                    style={styles.hubReturnBtn}
                    onPress={() => {
                      hapticsService.light();
                      setCurrentDeck(null);
                    }}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.hubReturnIcon}>❮</Text>
                    <Text style={styles.hubReturnText}>Hub</Text>
                  </TouchableOpacity>

                  <View style={styles.deckPillsScroll}>
                    {deckTabs.map((dt) => {
                      const isActive = currentDeck === dt.id;
                      return (
                        <TouchableOpacity
                          key={dt.id}
                          style={[
                            styles.deckPill,
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
                          <Text
                            style={[
                              styles.deckPillText,
                              isActive && [styles.deckPillTextActive, { color: currentAccent.primary }],
                            ]}
                          >
                            {dt.label}
                          </Text>
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
                    onBack={() => setCurrentDeck(null)}
                  />
                )}
                {currentDeck === 'keyboard' && (
                  <KeyboardScreen
                    isFullscreen={isFullscreen}
                    onToggleFullscreen={toggleFullscreen}
                    onBack={() => setCurrentDeck(null)}
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
                    onBack={() => setCurrentDeck(null)}
                    accentColor={currentAccent.primary}
                  />
                )}
                {currentDeck === 'shortcuts' && (
                  <ShortcutsScreen
                    onBack={() => setCurrentDeck(null)}
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

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: CyberTokens.bgObsidian,
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
    paddingVertical: 5,
    paddingHorizontal: 8,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderWidth: 1,
    borderColor: CyberTokens.borderSubtle,
    gap: 3,
  },
  hubReturnIcon: {
    color: '#cbd5e1',
    fontSize: 11,
    fontWeight: '800',
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
    paddingVertical: 5,
    paddingHorizontal: 2,
    borderRadius: 7,
    borderWidth: 1,
    borderColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
  },
  deckPillActive: {
    borderWidth: 1,
  },
  deckPillText: {
    color: CyberTokens.textSecondary,
    fontSize: 11,
    fontWeight: '600',
  },
  deckPillTextActive: {
    fontWeight: '800',
  },
  deckBody: {
    flex: 1,
  },
});

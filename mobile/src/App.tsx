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
import { Colors } from './theme/colors';
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
import { TrackpadScreen } from './screens/TrackpadScreen';
import { GamepadScreen } from './screens/GamepadScreen';
import { KeyboardScreen } from './screens/KeyboardScreen';
import { MediaScreen } from './screens/MediaScreen';

export default function App() {
  const [showSplash, setShowSplash] = useState(true);
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(authService.getCurrentUser());
  const [hasSkippedAuth, setHasSkippedAuth] = useState(authService.hasSkipped());
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [connectionGateSkipped, setConnectionGateSkipped] = useState(false);
  const [switcherDrawerVisible, setSwitcherDrawerVisible] = useState(false);

  const [activeTab, setActiveTab] = useState<'touchpad' | 'gamepad' | 'keyboard' | 'media'>('touchpad');
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

  const currentAccent = ACCENT_PALETTES[settings.accentTheme] || ACCENT_PALETTES.blue;

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

  // 3. Main App Interface
  return (
    <SafeAreaView style={[styles.container, isFullscreen && styles.containerFullscreen]}>
      <StatusBar hidden={isFullscreen} barStyle="light-content" backgroundColor="#161720" />

      {/* Header - Hidden in Fullscreen */}
      {!isFullscreen && (
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.headerLeftAndCenter}
            onPress={() => {
              hapticsService.light();
              setSwitcherDrawerVisible(true);
            }}
            activeOpacity={0.8}
            focusable={false}
          >
            <View style={styles.appTitle}>
              <View style={[styles.logoDot, { backgroundColor: currentAccent.primary }]} />
              <Text style={styles.appTitleText}>Remote Trackpad Pro</Text>
            </View>
            <Text
              style={[
                styles.statusText,
                connectionStatus === 'connected' && styles.statusConnected,
                connectionStatus === 'connecting' && styles.statusConnecting,
              ]}
              numberOfLines={1}
            >
              {connectionStatus === 'connected'
                ? `Connected ✔ ${socketService.getServerName() ? `${socketService.getServerName()} ` : ''}${latency > 0 ? `(${latency}ms)` : ''}`
                : connectionStatus === 'connecting'
                ? `Connecting${socketService.getServerName() ? ` to ${socketService.getServerName()}...` : '...'}`
                : 'Disconnected ✖ (Tap to Switch Server)'}
            </Text>
          </TouchableOpacity>

          {/* Settings Icon Button */}
          <TouchableOpacity
            style={styles.settingsHeaderBtn}
            onPress={() => {
              hapticsService.light();
              setSettingsModalVisible(true);
            }}
            activeOpacity={0.8}
            focusable={false}
          >
            <Text style={styles.settingsHeaderIcon}>⚙️</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Tabs - Hidden in Fullscreen */}
      {!isFullscreen && (
        <View style={styles.tabs}>
          {(['touchpad', 'gamepad', 'keyboard', 'media'] as const).map((tab) => {
            const isActive = activeTab === tab;
            const label =
              tab === 'touchpad'
                ? 'Trackpad'
                : tab === 'gamepad'
                ? 'Gamepad'
                : tab === 'keyboard'
                ? 'Keyboard'
                : 'Media';
            return (
              <TouchableOpacity
                key={tab}
                style={[
                  styles.tabBtn,
                  isActive && {
                    backgroundColor: currentAccent.bgSoft,
                    borderColor: currentAccent.border,
                  },
                ]}
                onPress={() => {
                  setActiveTab(tab);
                  hapticsService.light();
                }}
                activeOpacity={0.88}
                focusable={false}
              >
                <Text
                  style={[
                    styles.tabBtnText,
                    isActive && {
                      color: '#ffffff',
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

      {/* Main Content View */}
      <View style={[styles.content, isFullscreen && styles.contentFullscreen]}>
        {activeTab === 'touchpad' && (
          <TrackpadScreen
            isFullscreen={isFullscreen}
            onToggleFullscreen={toggleFullscreen}
          />
        )}
        {activeTab === 'gamepad' && (
          <GamepadScreen
            isFullscreen={isFullscreen}
            onToggleFullscreen={toggleFullscreen}
          />
        )}
        {activeTab === 'keyboard' && (
          <KeyboardScreen
            isFullscreen={isFullscreen}
            onToggleFullscreen={toggleFullscreen}
          />
        )}
        {activeTab === 'media' && (
          <MediaScreen
            isFullscreen={isFullscreen}
            onToggleFullscreen={toggleFullscreen}
          />
        )}
      </View>

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
    backgroundColor: '#0b0c10',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
    paddingHorizontal: 14,
    backgroundColor: '#161720',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.08)',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.6,
    shadowRadius: 20,
    zIndex: 10,
  },
  headerLeftAndCenter: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  settingsHeaderBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.07)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },
  settingsHeaderIcon: {
    fontSize: 16,
  },
  appTitle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
  },
  logoDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 10,
    elevation: 4,
  },
  appTitleText: {
    fontWeight: '700',
    fontSize: 15,
    letterSpacing: 0.3,
    color: '#f5f5f7',
  },
  statusText: {
    fontSize: 11,
    marginTop: 2,
    color: '#8b8d9c',
  },
  statusConnected: {
    color: '#4ade80',
    fontWeight: '600',
  },
  statusConnecting: {
    color: '#f5f5f7',
  },
  tabs: {
    flexDirection: 'row',
    paddingVertical: 6,
    paddingHorizontal: 10,
    gap: 6,
    backgroundColor: '#0f1015',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.08)',
    zIndex: 10,
  },
  tabBtn: {
    flex: 1,
    paddingVertical: 7,
    paddingHorizontal: 4,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'transparent',
    backgroundColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabBtnText: {
    color: '#8b8d9c',
    fontSize: 12,
    fontWeight: '500',
    textAlign: 'center',
  },
  content: {
    flex: 1,
    backgroundColor: '#0b0c10',
    minHeight: 0,
    overflow: 'hidden',
  },
  containerFullscreen: {
    paddingTop: 0,
    backgroundColor: '#0b0c10',
  },
  contentFullscreen: {
    padding: 0,
  },
});

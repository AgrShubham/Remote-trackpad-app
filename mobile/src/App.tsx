import React, { useState, useEffect } from 'react';
import {
  SafeAreaView,
  StatusBar,
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
} from 'react-native';
import { Colors } from './theme/colors';
import { socketService, ConnectionStatus } from './services/SocketService';
import { hapticsService } from './services/HapticsService';
import { ConnectionModal } from './components/ConnectionModal';
import { TrackpadScreen } from './screens/TrackpadScreen';
import { GamepadScreen } from './screens/GamepadScreen';
import { KeyboardScreen } from './screens/KeyboardScreen';
import { MediaScreen } from './screens/MediaScreen';

export default function App() {
  const [activeTab, setActiveTab] = useState<'touchpad' | 'gamepad' | 'keyboard' | 'media'>('touchpad');
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('disconnected');
  const [latency, setLatency] = useState(0);
  const [modalVisible, setModalVisible] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const toggleFullscreen = () => {
    setIsFullscreen((prev) => !prev);
  };

  useEffect(() => {
    const unsub = socketService.subscribe((status, lat) => {
      setConnectionStatus(status);
      setLatency(lat);
    });
    return unsub;
  }, []);

  return (
    <SafeAreaView style={[styles.container, isFullscreen && styles.containerFullscreen]}>
      <StatusBar hidden={isFullscreen} barStyle="light-content" backgroundColor="#161720" />

      {/* Header - Hidden in Fullscreen */}
      {!isFullscreen && (
        <TouchableOpacity
          style={styles.header}
          onPress={() => setModalVisible(true)}
          activeOpacity={0.8}
          focusable={false}
        >
          <View style={styles.appTitle}>
            <View style={styles.logoDot} />
            <Text style={styles.appTitleText}>Remote Trackpad Pro</Text>
          </View>
          <Text
            style={[
              styles.statusText,
              connectionStatus === 'connected' && styles.statusConnected,
              connectionStatus === 'connecting' && styles.statusConnecting,
            ]}
          >
            {connectionStatus === 'connected'
              ? `Connected ✔${latency > 0 ? ` (${latency}ms)` : ''}`
              : connectionStatus === 'connecting'
              ? 'Connecting...'
              : 'Disconnected ✖ (Tap to Connect)'}
          </Text>
        </TouchableOpacity>
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
                style={[styles.tabBtn, isActive && styles.tabBtnActive]}
                onPress={() => {
                  setActiveTab(tab);
                  hapticsService.light();
                }}
                activeOpacity={0.88}
                focusable={false}
              >
                <Text style={[styles.tabBtnText, isActive && styles.tabBtnTextActive]}>
                  {label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
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

      {/* Connection & Discovery Modal */}
      <ConnectionModal
        visible={modalVisible}
        onClose={() => setModalVisible(false)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0b0c10',
  },
  header: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    alignItems: 'center',
    justifyContent: 'center',
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
    backgroundColor: '#4f8cff',
    shadowColor: '#4f8cff',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 10,
    elevation: 4,
  },
  appTitleText: {
    fontWeight: '600',
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
  tabBtnActive: {
    backgroundColor: 'rgba(79, 140, 255, 0.16)',
    borderColor: 'rgba(79, 140, 255, 0.4)',
    shadowColor: '#4f8cff',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 2,
  },
  tabBtnText: {
    color: '#8b8d9c',
    fontSize: 12,
    fontWeight: '500',
    textAlign: 'center',
  },
  tabBtnTextActive: {
    color: '#f5f5f7',
    fontWeight: '600',
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

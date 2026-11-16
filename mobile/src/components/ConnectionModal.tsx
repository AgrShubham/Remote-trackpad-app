import React, { useState, useEffect, useRef } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Share,
  Linking,
  Animated,
  Easing,
} from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Colors } from '../theme/colors';
import { socketService, ConnectionStatus } from '../services/SocketService';
import { discoveryService, DiscoveredHost } from '../services/DiscoveryService';
import { hapticsService } from '../services/HapticsService';

const RECENT_SERVERS_KEY = '@remote_mouse_recent_servers';

interface ConnectionModalProps {
  visible: boolean;
  onClose: () => void;
}

export const ConnectionModal: React.FC<ConnectionModalProps> = ({ visible, onClose }) => {
  const [activeTab, setActiveTab] = useState<'connect' | 'download'>('connect');
  const [ip, setIp] = useState('');
  const [port, setPort] = useState('5000');
  const [discoveredHosts, setDiscoveredHosts] = useState<DiscoveredHost[]>([]);
  const [recentServers, setRecentServers] = useState<string[]>([]);
  const [status, setStatus] = useState<ConnectionStatus>('disconnected');
  const [latency, setLatency] = useState(0);

  // Animated Dual-Ring Radar Pulse for host discovery
  const radarPulse1 = useRef(new Animated.Value(0)).current;
  const radarPulse2 = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Start looping radar wave animations
    const createRadarAnim = (animVal: Animated.Value, delayMs: number) => {
      return Animated.loop(
        Animated.sequence([
          Animated.delay(delayMs),
          Animated.timing(animVal, {
            toValue: 1,
            duration: 2200,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
          }),
          Animated.timing(animVal, {
            toValue: 0,
            duration: 0,
            useNativeDriver: true,
          }),
        ])
      );
    };

    const anim1 = createRadarAnim(radarPulse1, 0);
    const anim2 = createRadarAnim(radarPulse2, 1100);

    anim1.start();
    anim2.start();

    return () => {
      anim1.stop();
      anim2.stop();
    };
  }, [radarPulse1, radarPulse2]);

  useEffect(() => {
    // Subscribe to socket status & ping
    const unsubSocket = socketService.subscribe((s, lat) => {
      setStatus(s);
      setLatency(lat);
    });

    // Subscribe to UDP host discovery
    discoveryService.startListening();
    const unsubDiscovery = discoveryService.subscribe((hosts) => {
      setDiscoveredHosts(hosts);
    });

    // Load persisted recent servers
    loadRecentServers();

    return () => {
      unsubSocket();
      unsubDiscovery();
    };
  }, []);

  const loadRecentServers = async () => {
    try {
      const data = await AsyncStorage.getItem(RECENT_SERVERS_KEY);
      if (data) {
        setRecentServers(JSON.parse(data));
      }
    } catch (e) {}
  };

  const saveRecentServer = async (serverStr: string) => {
    try {
      const updated = [serverStr, ...recentServers.filter((s) => s !== serverStr)].slice(0, 5);
      setRecentServers(updated);
      await AsyncStorage.setItem(RECENT_SERVERS_KEY, JSON.stringify(updated));
    } catch (e) {}
  };

  const removeRecentServer = async (serverStr: string) => {
    hapticsService.light();
    try {
      const updated = recentServers.filter((s) => s !== serverStr);
      setRecentServers(updated);
      await AsyncStorage.setItem(RECENT_SERVERS_KEY, JSON.stringify(updated));
    } catch (e) {}
  };

  const handleConnect = (targetIp: string, targetPort: string = '5000', udpPort: number = 5002) => {
    if (!targetIp.trim()) return;
    hapticsService.light();
    const p = parseInt(targetPort, 10) || 5000;
    saveRecentServer(`${targetIp.trim()}:${p}`);
    socketService.connect(targetIp.trim(), p, udpPort);
  };

  const handleDisconnect = () => {
    hapticsService.light();
    socketService.disconnect();
  };

  const handleTabSwitch = (tab: 'connect' | 'download') => {
    hapticsService.light();
    setActiveTab(tab);
  };

  const handleRescan = () => {
    hapticsService.light();
    discoveryService.rescan();
  };

  // Derive PC Server download URL based on discovered host or manual IP
  const hostIp = discoveredHosts.length > 0 ? discoveredHosts[0].ip : ip.trim();
  const serverDownloadUrl = hostIp ? `http://${hostIp}:8080/RemoteMouseServer.exe` : 'http://<PC_IP>:8080/RemoteMouseServer.exe';

  const handleShareLink = async () => {
    hapticsService.light();
    try {
      await Share.share({
        title: 'Remote Mouse Server for Windows',
        message: `Download Remote Mouse Server for your Windows PC:\n${serverDownloadUrl}`,
        url: serverDownloadUrl,
      });
    } catch (error) {
      console.log('Share error:', error);
    }
  };

  const handleOpenBrowser = () => {
    hapticsService.light();
    Linking.openURL(serverDownloadUrl).catch((err) =>
      console.log('Failed to open download link:', err)
    );
  };

  // Radar ring animations
  const ring1Scale = radarPulse1.interpolate({
    inputRange: [0, 1],
    outputRange: [0.6, 2.2],
  });
  const ring1Opacity = radarPulse1.interpolate({
    inputRange: [0, 0.4, 1],
    outputRange: [0.8, 0.35, 0],
  });

  const ring2Scale = radarPulse2.interpolate({
    inputRange: [0, 1],
    outputRange: [0.6, 2.2],
  });
  const ring2Opacity = radarPulse2.interpolate({
    inputRange: [0, 0.4, 1],
    outputRange: [0.8, 0.35, 0],
  });

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.container}>
          {/* Header */}
          <View style={styles.modalHeader}>
            <View style={styles.headerTitleCol}>
              <View style={styles.headerTitleRow}>
                <View style={styles.headerDot} />
                <Text style={styles.modalTitle}>Remote Host Connection</Text>
              </View>
              <Text style={styles.modalSubtitle}>Pair wirelessly with your Windows PC</Text>
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

          {/* Top Segmented Tab Switcher */}
          <View style={styles.tabBarContainer}>
            <View style={styles.tabBar}>
              <TouchableOpacity
                style={[styles.tabBtn, activeTab === 'connect' && styles.tabBtnActive]}
                onPress={() => handleTabSwitch('connect')}
                focusable={false}
                activeOpacity={0.85}
              >
                <Text style={[styles.tabBtnText, activeTab === 'connect' && styles.tabBtnTextActive]}>
                  ⚡ Connect to PC
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.tabBtn, activeTab === 'download' && styles.tabBtnActive]}
                onPress={() => handleTabSwitch('download')}
                focusable={false}
                activeOpacity={0.85}
              >
                <Text style={[styles.tabBtnText, activeTab === 'download' && styles.tabBtnTextActive]}>
                  📥 Get PC Server
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          <ScrollView style={styles.body} showsVerticalScrollIndicator={false}>
            {activeTab === 'connect' ? (
              /* ================= TAB 1: CONNECT TO PC ================= */
              <>
                {/* Glowing Live Connection Status Card */}
                <View
                  style={[
                    styles.statusCard,
                    status === 'connected' && styles.statusCardConnected,
                    status === 'connecting' && styles.statusCardConnecting,
                  ]}
                >
                  <View style={styles.statusInfoCol}>
                    <View style={styles.statusBadgeRow}>
                      <View
                        style={[
                          styles.statusIndicatorDot,
                          {
                            backgroundColor:
                              status === 'connected'
                                ? '#22c55e'
                                : status === 'connecting'
                                ? '#fbbf24'
                                : '#ef4444',
                          },
                        ]}
                      />
                      <Text style={styles.statusHeading}>
                        {status === 'connected'
                          ? 'Connected to PC'
                          : status === 'connecting'
                          ? 'Connecting to Host...'
                          : 'Not Connected'}
                      </Text>

                      {status === 'connected' && latency > 0 && (
                        <View style={styles.latencyBadge}>
                          <Text style={styles.latencyText}>⚡ {latency}ms latency</Text>
                        </View>
                      )}
                    </View>

                    <Text style={styles.statusSubtext} numberOfLines={1}>
                      {status === 'connected'
                        ? socketService.getHost()
                        : status === 'connecting'
                        ? 'Negotiating WebSocket & UDP stream...'
                        : 'Ready to pair • Select or discover your PC below'}
                    </Text>
                  </View>

                  {status === 'connected' && (
                    <TouchableOpacity
                      style={styles.disconnectBtn}
                      onPress={handleDisconnect}
                      focusable={false}
                      activeOpacity={0.85}
                    >
                      <Text style={styles.disconnectBtnText}>Disconnect</Text>
                    </TouchableOpacity>
                  )}
                </View>

                {/* Auto-Discovered Servers with Animated Radar */}
                <View style={styles.section}>
                  <View style={styles.sectionHeaderRow}>
                    <Text style={styles.sectionTitle}>📡 Discovered PCs on Wi-Fi</Text>
                    <View style={styles.headerRightActions}>
                      <TouchableOpacity
                        style={styles.rescanBtn}
                        onPress={handleRescan}
                        focusable={false}
                        activeOpacity={0.8}
                      >
                        <Text style={styles.rescanBtnText}>🔄 Rescan</Text>
                      </TouchableOpacity>
                      {discoveredHosts.length > 0 ? (
                        <View style={styles.hostCountPill}>
                          <Text style={styles.hostCountText}>{discoveredHosts.length} Found</Text>
                        </View>
                      ) : (
                        <ActivityIndicator size="small" color="#60a5fa" />
                      )}
                    </View>
                  </View>

                  {discoveredHosts.length === 0 ? (
                    <View style={styles.radarCard}>
                      {/* Animated Wi-Fi Radar Beacon */}
                      <View style={styles.radarContainer}>
                        <Animated.View
                          style={[
                            styles.radarRing,
                            {
                              transform: [{ scale: ring1Scale }],
                              opacity: ring1Opacity,
                            },
                          ]}
                        />
                        <Animated.View
                          style={[
                            styles.radarRing,
                            {
                              transform: [{ scale: ring2Scale }],
                              opacity: ring2Opacity,
                            },
                          ]}
                        />
                        <View style={styles.radarCoreDot}>
                          <Text style={styles.radarBeaconIcon}>📡</Text>
                        </View>
                      </View>

                      <Text style={styles.radarStatusText}>
                        Scanning Wi-Fi subnet for PC Server...
                      </Text>
                      <Text style={styles.radarHintText}>
                        Make sure RemoteMouseServer.exe is running on your PC and both devices are on the same Wi-Fi.
                      </Text>

                      <TouchableOpacity
                        style={styles.radarDownloadHint}
                        onPress={() => handleTabSwitch('download')}
                        focusable={false}
                        activeOpacity={0.85}
                      >
                        <Text style={styles.radarDownloadHintText}>
                          Don't have the PC app yet? Get it here ➔
                        </Text>
                      </TouchableOpacity>
                    </View>
                  ) : (
                    discoveredHosts.map((host) => (
                      <TouchableOpacity
                        key={`${host.ip}:${host.port}`}
                        style={styles.hostCard}
                        onPress={() =>
                          handleConnect(host.ip, host.port.toString(), host.udpPort || 5002)
                        }
                        activeOpacity={0.85}
                        focusable={false}
                      >
                        <View style={styles.hostIconBox}>
                          <Text style={styles.hostIconEmoji}>🖥️</Text>
                        </View>

                        <View style={styles.hostInfo}>
                          <Text style={styles.hostName} numberOfLines={1}>
                            {host.name}
                          </Text>
                          <Text style={styles.hostIp}>
                            {host.ip}:{host.port}
                          </Text>
                          <View style={styles.udpBadge}>
                            <View style={styles.udpGreenDot} />
                            <Text style={styles.udpBadgeText}>&lt;1ms UDP Engine</Text>
                          </View>
                        </View>

                        <View style={styles.connectBtn}>
                          <Text style={styles.connectBtnText}>Connect ➔</Text>
                        </View>
                      </TouchableOpacity>
                    ))
                  )}
                </View>

                {/* Recent Servers */}
                {recentServers.length > 0 && (
                  <View style={styles.section}>
                    <Text style={styles.sectionTitle}>🕒 Recent Connections</Text>
                    <View style={styles.recentChipsContainer}>
                      {recentServers.map((s) => {
                        const [savedIp, savedPort] = s.split(':');
                        return (
                          <View key={s} style={styles.recentChip}>
                            <TouchableOpacity
                              style={styles.recentChipBody}
                              onPress={() => handleConnect(savedIp, savedPort)}
                              activeOpacity={0.82}
                              focusable={false}
                            >
                              <Text style={styles.recentChipIcon}>💻</Text>
                              <Text style={styles.recentChipText}>{s}</Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                              style={styles.recentDeleteBtn}
                              onPress={() => removeRecentServer(s)}
                              focusable={false}
                              activeOpacity={0.8}
                            >
                              <Text style={styles.recentDeleteText}>✕</Text>
                            </TouchableOpacity>
                          </View>
                        );
                      })}
                    </View>
                  </View>
                )}

                {/* Manual IP Entry */}
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>⌨️ Manual Connection</Text>
                  <View style={styles.inputRow}>
                    <TextInput
                      style={[styles.input, styles.inputIp]}
                      placeholder="PC LAN IP (e.g. 192.168.1.5)"
                      placeholderTextColor="#64748b"
                      value={ip}
                      onChangeText={setIp}
                      keyboardType="numeric"
                      autoCapitalize="none"
                      autoCorrect={false}
                    />
                    <TextInput
                      style={[styles.input, styles.inputPort]}
                      placeholder="Port"
                      placeholderTextColor="#64748b"
                      value={port}
                      onChangeText={setPort}
                      keyboardType="numeric"
                    />
                    <TouchableOpacity
                      style={styles.manualConnectBtn}
                      onPress={() => handleConnect(ip, port)}
                      focusable={false}
                      activeOpacity={0.85}
                    >
                      <Text style={styles.manualConnectBtnText}>Go ➔</Text>
                    </TouchableOpacity>
                  </View>
                </View>

                {/* Banner prompting to download PC Server */}
                <TouchableOpacity
                  style={styles.downloadBanner}
                  onPress={() => handleTabSwitch('download')}
                  activeOpacity={0.85}
                  focusable={false}
                >
                  <View style={styles.downloadBannerLeft}>
                    <Text style={styles.downloadBannerIcon}>📥</Text>
                    <View>
                      <Text style={styles.downloadBannerTitle}>Need the Windows PC Server?</Text>
                      <Text style={styles.downloadBannerSub}>Tap to view direct link & pairing QR code</Text>
                    </View>
                  </View>
                  <Text style={styles.downloadBannerArrow}>➔</Text>
                </TouchableOpacity>
              </>
            ) : (
              /* ================= TAB 2: GET PC SERVER ================= */
              <View style={styles.downloadHub}>
                {/* QR Code Hero Card */}
                <View style={styles.qrCard}>
                  <Text style={styles.qrTitle}>Point Camera or Scan QR to Download</Text>
                  <Text style={styles.qrSubtitle}>
                    Scan using your PC webcam, laptop, or mobile browser
                  </Text>

                  <View style={styles.qrWrapper}>
                    <QRCode
                      value={serverDownloadUrl}
                      size={175}
                      color="#090a0f"
                      backgroundColor="#ffffff"
                    />
                  </View>

                  <View style={styles.urlPill}>
                    <Text style={styles.urlPillLabel}>DIRECT URL</Text>
                    <Text style={styles.qrUrlText} numberOfLines={1}>
                      {serverDownloadUrl}
                    </Text>
                  </View>
                </View>

                {/* Direct Action Buttons */}
                <View style={styles.downloadActionRow}>
                  <TouchableOpacity
                    style={[styles.actionBtn, styles.actionBtnPrimary]}
                    onPress={handleOpenBrowser}
                    focusable={false}
                    activeOpacity={0.85}
                  >
                    <Text style={styles.actionBtnPrimaryText}>🌐 Open in Browser</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.actionBtn, styles.actionBtnSecondary]}
                    onPress={handleShareLink}
                    focusable={false}
                    activeOpacity={0.85}
                  >
                    <Text style={styles.actionBtnSecondaryText}>📤 Share Link</Text>
                  </TouchableOpacity>
                </View>

                {/* 3-Step Setup Instructions Card */}
                <View style={styles.guideCard}>
                  <Text style={styles.guideTitle}>⚡ Quick 3-Step Setup</Text>

                  <View style={styles.stepRow}>
                    <View style={styles.stepNumBadge}>
                      <Text style={styles.stepNumText}>1</Text>
                    </View>
                    <View style={styles.stepContent}>
                      <Text style={styles.stepHeading}>Download Executable</Text>
                      <Text style={styles.stepDesc}>
                        Download <Text style={styles.boldText}>RemoteMouseServer.exe</Text> on your Windows PC (standalone binary, zero dependencies or Python needed).
                      </Text>
                    </View>
                  </View>

                  <View style={styles.stepRow}>
                    <View style={styles.stepNumBadge}>
                      <Text style={styles.stepNumText}>2</Text>
                    </View>
                    <View style={styles.stepContent}>
                      <Text style={styles.stepHeading}>Double-Click to Launch</Text>
                      <Text style={styles.stepDesc}>
                        Runs silently in your Windows System Tray with ultra-low latency UDP streaming enabled.
                      </Text>
                    </View>
                  </View>

                  <View style={styles.stepRow}>
                    <View style={styles.stepNumBadge}>
                      <Text style={styles.stepNumText}>3</Text>
                    </View>
                    <View style={styles.stepContent}>
                      <Text style={styles.stepHeading}>Automatic Connection</Text>
                      <Text style={styles.stepDesc}>
                        Ensure phone & PC are on the same Wi-Fi. Switch to <Text style={styles.boldText}>Connect to PC</Text> and tap your computer!
                      </Text>
                    </View>
                  </View>
                </View>
              </View>
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(3, 5, 10, 0.82)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  container: {
    width: '100%',
    maxHeight: '92%',
    backgroundColor: '#11131d',
    borderRadius: 22,
    borderWidth: 1.2,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.9,
    shadowRadius: 30,
    elevation: 16,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingTop: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.08)',
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
    backgroundColor: '#3b82f6',
  },
  modalTitle: {
    color: '#ffffff',
    fontSize: 16.5,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  modalSubtitle: {
    color: '#94a3b8',
    fontSize: 11.5,
    marginTop: 2,
    marginLeft: 16,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 10,
  },
  closeBtnText: {
    color: '#cbd5e1',
    fontSize: 14,
    fontWeight: '700',
  },
  tabBarContainer: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#0a0c13',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.06)',
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: '#141622',
    borderRadius: 12,
    padding: 3,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
    gap: 4,
  },
  tabBtn: {
    flex: 1,
    paddingVertical: 9,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: 'transparent',
  },
  tabBtnActive: {
    backgroundColor: 'rgba(59, 130, 246, 0.22)',
    borderColor: 'rgba(59, 130, 246, 0.65)',
  },
  tabBtnText: {
    color: '#8b8d9c',
    fontSize: 12.5,
    fontWeight: '600',
  },
  tabBtnTextActive: {
    color: '#60a5fa',
    fontWeight: '700',
  },
  body: {
    padding: 16,
  },
  statusCard: {
    backgroundColor: '#161925',
    borderRadius: 14,
    padding: 14,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  statusCardConnected: {
    backgroundColor: 'rgba(34, 197, 94, 0.1)',
    borderColor: 'rgba(34, 197, 94, 0.35)',
  },
  statusCardConnecting: {
    backgroundColor: 'rgba(251, 191, 36, 0.1)',
    borderColor: 'rgba(251, 191, 36, 0.35)',
  },
  statusInfoCol: {
    flex: 1,
  },
  statusBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  statusIndicatorDot: {
    width: 9,
    height: 9,
    borderRadius: 4.5,
  },
  statusHeading: {
    color: '#ffffff',
    fontSize: 13.5,
    fontWeight: '700',
  },
  latencyBadge: {
    backgroundColor: 'rgba(34, 197, 94, 0.2)',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 0.8,
    borderColor: 'rgba(34, 197, 94, 0.4)',
  },
  latencyText: {
    color: '#4ade80',
    fontSize: 10.5,
    fontWeight: '700',
  },
  statusSubtext: {
    color: '#94a3b8',
    fontSize: 11.5,
    marginTop: 4,
    marginLeft: 17,
  },
  disconnectBtn: {
    backgroundColor: 'rgba(239, 68, 68, 0.16)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.45)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    marginLeft: 10,
  },
  disconnectBtnText: {
    color: '#f87171',
    fontSize: 11.5,
    fontWeight: '700',
  },
  section: {
    marginBottom: 18,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  headerRightActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  rescanBtn: {
    paddingHorizontal: 9,
    paddingVertical: 3,
    borderRadius: 7,
    backgroundColor: 'rgba(59, 130, 246, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(59, 130, 246, 0.35)',
  },
  rescanBtnText: {
    color: '#93c5fd',
    fontSize: 11,
    fontWeight: '700',
  },
  sectionTitle: {
    color: '#cbd5e1',
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  hostCountPill: {
    backgroundColor: 'rgba(59, 130, 246, 0.18)',
    borderWidth: 1,
    borderColor: 'rgba(59, 130, 246, 0.4)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  hostCountText: {
    color: '#93c5fd',
    fontSize: 11,
    fontWeight: '700',
  },
  radarCard: {
    backgroundColor: '#141622',
    borderRadius: 14,
    padding: 18,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    alignItems: 'center',
  },
  radarContainer: {
    width: 80,
    height: 80,
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 6,
  },
  radarRing: {
    position: 'absolute',
    width: 60,
    height: 60,
    borderRadius: 30,
    borderWidth: 1.5,
    borderColor: '#3b82f6',
    backgroundColor: 'rgba(59, 130, 246, 0.12)',
  },
  radarCoreDot: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(59, 130, 246, 0.25)',
    borderWidth: 1.2,
    borderColor: '#60a5fa',
    alignItems: 'center',
    justifyContent: 'center',
  },
  radarBeaconIcon: {
    fontSize: 14,
  },
  radarStatusText: {
    color: '#f1f5f9',
    fontSize: 13,
    fontWeight: '600',
    marginTop: 8,
    textAlign: 'center',
  },
  radarHintText: {
    color: '#8b8d9c',
    fontSize: 11,
    textAlign: 'center',
    lineHeight: 16,
    marginTop: 4,
    paddingHorizontal: 12,
  },
  radarDownloadHint: {
    marginTop: 12,
    backgroundColor: 'rgba(59, 130, 246, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(59, 130, 246, 0.3)',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 8,
  },
  radarDownloadHintText: {
    color: '#60a5fa',
    fontSize: 11.5,
    fontWeight: '600',
  },
  hostCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#181b27',
    borderRadius: 13,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1.2,
    borderColor: 'rgba(96, 165, 250, 0.28)',
  },
  hostIconBox: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: 'rgba(59, 130, 246, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(59, 130, 246, 0.3)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  hostIconEmoji: {
    fontSize: 20,
  },
  hostInfo: {
    flex: 1,
  },
  hostName: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '700',
  },
  hostIp: {
    color: '#93c5fd',
    fontSize: 11.5,
    marginTop: 2,
    fontFamily: 'monospace',
  },
  udpBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
  },
  udpGreenDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#22c55e',
  },
  udpBadgeText: {
    color: '#4ade80',
    fontSize: 10,
    fontWeight: '700',
  },
  connectBtn: {
    backgroundColor: '#2563eb',
    borderWidth: 1,
    borderColor: 'rgba(147, 197, 253, 0.4)',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    shadowColor: '#2563eb',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.4,
    shadowRadius: 4,
    elevation: 3,
  },
  connectBtnText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '700',
  },
  recentChipsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  recentChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#151824',
    borderRadius: 9,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    overflow: 'hidden',
  },
  recentChipBody: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  recentChipIcon: {
    fontSize: 12,
  },
  recentChipText: {
    color: '#cbd5e1',
    fontSize: 12,
    fontFamily: 'monospace',
  },
  recentDeleteBtn: {
    paddingHorizontal: 8,
    paddingVertical: 7,
    borderLeftWidth: 1,
    borderLeftColor: 'rgba(255, 255, 255, 0.08)',
  },
  recentDeleteText: {
    color: '#94a3b8',
    fontSize: 11,
    fontWeight: '700',
  },
  inputRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
  },
  input: {
    backgroundColor: '#0d0f16',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    borderRadius: 9,
    color: '#ffffff',
    paddingHorizontal: 12,
    paddingVertical: 9,
    fontSize: 13,
  },
  inputIp: {
    flex: 3,
  },
  inputPort: {
    flex: 1.2,
    textAlign: 'center',
  },
  manualConnectBtn: {
    backgroundColor: '#2563eb',
    borderRadius: 9,
    paddingHorizontal: 14,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(147, 197, 253, 0.4)',
  },
  manualConnectBtnText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '700',
  },
  downloadBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(59, 130, 246, 0.1)',
    borderWidth: 1.2,
    borderColor: 'rgba(59, 130, 246, 0.35)',
    borderRadius: 13,
    padding: 12,
    marginBottom: 10,
  },
  downloadBannerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  downloadBannerIcon: {
    fontSize: 22,
  },
  downloadBannerTitle: {
    color: '#93c5fd',
    fontSize: 12.5,
    fontWeight: '700',
  },
  downloadBannerSub: {
    color: '#60a5fa',
    fontSize: 11,
    marginTop: 2,
  },
  downloadBannerArrow: {
    color: '#60a5fa',
    fontSize: 16,
    fontWeight: '700',
    marginLeft: 8,
  },

  // Download Hub Styles
  downloadHub: {
    alignItems: 'center',
  },
  qrCard: {
    width: '100%',
    backgroundColor: '#151724',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1.2,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    alignItems: 'center',
    marginBottom: 14,
  },
  qrTitle: {
    color: '#ffffff',
    fontSize: 14.5,
    fontWeight: '700',
    textAlign: 'center',
  },
  qrSubtitle: {
    color: '#94a3b8',
    fontSize: 11.5,
    textAlign: 'center',
    marginTop: 3,
    marginBottom: 14,
  },
  qrWrapper: {
    padding: 12,
    backgroundColor: '#ffffff',
    borderRadius: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 6,
  },
  urlPill: {
    marginTop: 14,
    backgroundColor: '#0d0f16',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
    alignItems: 'center',
    width: '100%',
  },
  urlPillLabel: {
    color: '#64748b',
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  qrUrlText: {
    color: '#60a5fa',
    fontSize: 11.5,
    marginTop: 2,
    fontFamily: 'monospace',
  },
  downloadActionRow: {
    flexDirection: 'row',
    gap: 10,
    width: '100%',
    marginBottom: 14,
  },
  actionBtn: {
    flex: 1,
    paddingVertical: 11,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionBtnPrimary: {
    backgroundColor: '#2563eb',
    borderWidth: 1,
    borderColor: 'rgba(147, 197, 253, 0.4)',
  },
  actionBtnPrimaryText: {
    color: '#ffffff',
    fontSize: 12.5,
    fontWeight: '700',
  },
  actionBtnSecondary: {
    backgroundColor: '#1b1e2c',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.14)',
  },
  actionBtnSecondaryText: {
    color: '#e2e8f0',
    fontSize: 12.5,
    fontWeight: '600',
  },
  guideCard: {
    width: '100%',
    backgroundColor: '#141622',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    marginBottom: 10,
  },
  guideTitle: {
    color: '#f8fafc',
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 12,
  },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 12,
    gap: 10,
  },
  stepNumBadge: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#2563eb',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  stepNumText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '700',
  },
  stepContent: {
    flex: 1,
  },
  stepHeading: {
    color: '#f1f5f9',
    fontSize: 12.5,
    fontWeight: '700',
  },
  stepDesc: {
    color: '#94a3b8',
    fontSize: 11.5,
    lineHeight: 16,
    marginTop: 2,
  },
  boldText: {
    color: '#ffffff',
    fontWeight: '700',
  },
});

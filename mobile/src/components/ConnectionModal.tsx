import React, { useState, useEffect } from 'react';
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
} from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Colors } from '../theme/colors';
import { socketService, ConnectionStatus } from '../services/SocketService';
import { discoveryService, DiscoveredHost } from '../services/DiscoveryService';

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

  useEffect(() => {
    // Subscribe to socket status
    const unsubSocket = socketService.subscribe((s, lat) => {
      setStatus(s);
      setLatency(lat);
    });

    // Subscribe to UDP discovery
    discoveryService.startListening();
    const unsubDiscovery = discoveryService.subscribe((hosts) => {
      setDiscoveredHosts(hosts);
    });

    // Load recent servers
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
    try {
      const updated = recentServers.filter((s) => s !== serverStr);
      setRecentServers(updated);
      await AsyncStorage.setItem(RECENT_SERVERS_KEY, JSON.stringify(updated));
    } catch (e) {}
  };

  const handleConnect = (targetIp: string, targetPort: string = '5000') => {
    if (!targetIp.trim()) return;
    const p = parseInt(targetPort, 10) || 5000;
    saveRecentServer(`${targetIp.trim()}:${p}`);
    socketService.connect(targetIp.trim(), p);
  };

  const handleDisconnect = () => {
    socketService.disconnect();
  };

  // Derive PC Server download URL based on discovered host or default local subnet
  const hostIp = discoveredHosts.length > 0 ? discoveredHosts[0].ip : (ip.trim() || '192.168.29.228');
  const serverDownloadUrl = `http://${hostIp}:8080/RemoteMouseServer.exe`;
  const webHubUrl = `http://${hostIp}:8080/`;

  const handleShareLink = async () => {
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
    Linking.openURL(serverDownloadUrl).catch((err) =>
      console.log('Failed to open download link:', err)
    );
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.container}>
          {/* Header */}
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Remote Host Connection</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn} focusable={false} activeOpacity={0.85}>
              <Text style={styles.closeBtnText}>✕</Text>
            </TouchableOpacity>
          </View>

          {/* Top Segmented Tab Switcher */}
          <View style={styles.tabBar}>
            <TouchableOpacity
              style={[styles.tabBtn, activeTab === 'connect' && styles.tabBtnActive]}
              onPress={() => setActiveTab('connect')}
              focusable={false}
              activeOpacity={0.88}
            >
              <Text style={[styles.tabBtnText, activeTab === 'connect' && styles.tabBtnTextActive]}>
                ⚡ Connect to PC
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.tabBtn, activeTab === 'download' && styles.tabBtnActive]}
              onPress={() => setActiveTab('download')}
              focusable={false}
              activeOpacity={0.88}
            >
              <Text style={[styles.tabBtnText, activeTab === 'download' && styles.tabBtnTextActive]}>
                📥 Get PC Server
              </Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.body} showsVerticalScrollIndicator={false}>
            {activeTab === 'connect' ? (
              /* ================= TAB 1: CONNECT TO PC ================= */
              <>
                {/* Current Status Card */}
                <View style={styles.statusCard}>
                  <View style={styles.statusRow}>
                    <View
                      style={[
                        styles.statusIndicator,
                        {
                          backgroundColor:
                            status === 'connected'
                              ? Colors.success
                              : status === 'connecting'
                              ? Colors.warning
                              : Colors.error,
                        },
                      ]}
                    />
                    <Text style={styles.statusText}>
                      {status === 'connected'
                        ? `Connected (${socketService.getHost()})`
                        : status === 'connecting'
                        ? 'Connecting to PC...'
                        : 'Disconnected'}
                    </Text>
                  </View>

                  {status === 'connected' && latency > 0 && (
                    <Text style={styles.latencyText}>{latency}ms latency</Text>
                  )}

                  {status === 'connected' && (
                    <TouchableOpacity style={styles.disconnectBtn} onPress={handleDisconnect} focusable={false} activeOpacity={0.85}>
                      <Text style={styles.disconnectBtnText}>Disconnect</Text>
                    </TouchableOpacity>
                  )}
                </View>

                {/* Auto-Discovered Servers */}
                <View style={styles.section}>
                  <View style={styles.sectionHeaderRow}>
                    <Text style={styles.sectionTitle}>Discovered PCs on Wi-Fi</Text>
                    <ActivityIndicator size="small" color={Colors.accent} />
                  </View>

                  {discoveredHosts.length === 0 ? (
                    <View style={styles.emptyCard}>
                      <Text style={styles.emptyText}>
                        Searching for PCs running Remote Mouse Server on your Wi-Fi...
                      </Text>
                      <TouchableOpacity
                        style={styles.emptyDownloadHint}
                        onPress={() => setActiveTab('download')}
                        focusable={false}
                        activeOpacity={0.85}
                      >
                        <Text style={styles.emptyDownloadHintText}>
                          Don't have the PC app yet? Tap here to get it ➔
                        </Text>
                      </TouchableOpacity>
                    </View>
                  ) : (
                    discoveredHosts.map((host) => (
                      <TouchableOpacity
                        key={`${host.ip}:${host.port}`}
                        style={styles.hostCard}
                        onPress={() => handleConnect(host.ip, host.port.toString())}
                        activeOpacity={0.88}
                        focusable={false}
                      >
                        <View style={styles.hostInfo}>
                          <Text style={styles.hostName}>{host.name}</Text>
                          <Text style={styles.hostIp}>{host.ip}:{host.port}</Text>
                        </View>
                        <View style={styles.connectTag}>
                          <Text style={styles.connectTagText}>Connect</Text>
                        </View>
                      </TouchableOpacity>
                    ))
                  )}
                </View>

                {/* Manual IP Entry */}
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>Manual Connection</Text>
                  <View style={styles.inputRow}>
                    <TextInput
                      style={[styles.input, { flex: 3 }]}
                      placeholder="PC LAN IP (e.g. 192.168.1.5)"
                      placeholderTextColor={Colors.textMuted}
                      value={ip}
                      onChangeText={setIp}
                      keyboardType="numeric"
                    />
                    <TextInput
                      style={[styles.input, { flex: 1.2 }]}
                      placeholder="Port"
                      placeholderTextColor={Colors.textMuted}
                      value={port}
                      onChangeText={setPort}
                      keyboardType="numeric"
                    />
                    <TouchableOpacity
                      style={styles.manualConnectBtn}
                      onPress={() => handleConnect(ip, port)}
                      focusable={false}
                      activeOpacity={0.88}
                    >
                      <Text style={styles.manualConnectBtnText}>Go</Text>
                    </TouchableOpacity>
                  </View>
                </View>

                {/* Recent Servers */}
                {recentServers.length > 0 && (
                  <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Recent Connections</Text>
                    {recentServers.map((s) => {
                      const [savedIp, savedPort] = s.split(':');
                      return (
                        <View key={s} style={styles.recentRow}>
                          <TouchableOpacity
                            style={styles.recentInfo}
                            onPress={() => handleConnect(savedIp, savedPort)}
                            activeOpacity={0.85}
                            focusable={false}
                          >
                            <Text style={styles.recentText}>{s}</Text>
                          </TouchableOpacity>
                          <TouchableOpacity
                            style={styles.deleteRecentBtn}
                            onPress={() => removeRecentServer(s)}
                            focusable={false}
                            activeOpacity={0.85}
                          >
                            <Text style={styles.deleteRecentText}>✕</Text>
                          </TouchableOpacity>
                        </View>
                      );
                    })}
                  </View>
                )}

                {/* Banner prompting to download PC Server */}
                <TouchableOpacity
                  style={styles.downloadBanner}
                  onPress={() => setActiveTab('download')}
                  activeOpacity={0.88}
                  focusable={false}
                >
                  <Text style={styles.downloadBannerTitle}>📥 Get Remote Mouse PC Server for Windows</Text>
                  <Text style={styles.downloadBannerSub}>View direct download link & pairing QR code ➔</Text>
                </TouchableOpacity>
              </>
            ) : (
              /* ================= TAB 2: GET PC SERVER ================= */
              <View style={styles.downloadHub}>
                {/* QR Code Hero Card */}
                <View style={styles.qrCard}>
                  <Text style={styles.qrTitle}>Point Camera or Scan QR to Download</Text>
                  <Text style={styles.qrSubtitle}>Scan with your PC webcam, laptop, or phone camera</Text>

                  <View style={styles.qrWrapper}>
                    <QRCode
                      value={serverDownloadUrl}
                      size={165}
                      color="#0b0c10"
                      backgroundColor="#ffffff"
                    />
                  </View>

                  <Text style={styles.qrUrlText} numberOfLines={1}>
                    {serverDownloadUrl}
                  </Text>
                </View>

                {/* Direct Action Buttons */}
                <View style={styles.downloadActionRow}>
                  <TouchableOpacity
                    style={[styles.actionBtn, styles.actionBtnPrimary]}
                    onPress={handleOpenBrowser}
                    focusable={false}
                    activeOpacity={0.88}
                  >
                    <Text style={styles.actionBtnPrimaryText}>🌐 Open in Browser</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.actionBtn, styles.actionBtnSecondary]}
                    onPress={handleShareLink}
                    focusable={false}
                    activeOpacity={0.88}
                  >
                    <Text style={styles.actionBtnSecondaryText}>📤 Share Link</Text>
                  </TouchableOpacity>
                </View>

                {/* 3-Step Setup Instructions Card */}
                <View style={styles.guideCard}>
                  <Text style={styles.guideTitle}>⚡ Quick 3-Step Setup</Text>

                  <View style={styles.stepRow}>
                    <View style={styles.stepNumBadge}><Text style={styles.stepNumText}>1</Text></View>
                    <View style={styles.stepContent}>
                      <Text style={styles.stepHeading}>Download Executable</Text>
                      <Text style={styles.stepDesc}>Download <Text style={styles.boldText}>RemoteMouseServer.exe</Text> on your Windows PC (no Python or installation required).</Text>
                    </View>
                  </View>

                  <View style={styles.stepRow}>
                    <View style={styles.stepNumBadge}><Text style={styles.stepNumText}>2</Text></View>
                    <View style={styles.stepContent}>
                      <Text style={styles.stepHeading}>Double-Click to Run</Text>
                      <Text style={styles.stepDesc}>The server launches silently in your Windows System Tray with active zero-lag background streaming.</Text>
                    </View>
                  </View>

                  <View style={styles.stepRow}>
                    <View style={styles.stepNumBadge}><Text style={styles.stepNumText}>3</Text></View>
                    <View style={styles.stepContent}>
                      <Text style={styles.stepHeading}>Automatic Connection</Text>
                      <Text style={styles.stepDesc}>Ensure phone & PC are on the same Wi-Fi. Switch to the <Text style={styles.boldText}>Connect to PC</Text> tab and tap your PC!</Text>
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
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  container: {
    width: '100%',
    maxHeight: '90%',
    backgroundColor: '#161722',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.8,
    shadowRadius: 24,
    elevation: 10,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.08)',
  },
  modalTitle: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
  },
  closeBtn: {
    padding: 6,
  },
  closeBtnText: {
    color: '#94a3b8',
    fontSize: 16,
  },
  tabBar: {
    flexDirection: 'row',
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 8,
    backgroundColor: '#0f1015',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.06)',
  },
  tabBtn: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: 'transparent',
  },
  tabBtnActive: {
    backgroundColor: 'rgba(79, 140, 255, 0.18)',
    borderColor: 'rgba(79, 140, 255, 0.5)',
  },
  tabBtnText: {
    color: '#94a3b8',
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
    backgroundColor: '#1b1d2a',
    borderRadius: 12,
    padding: 14,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  statusIndicator: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  statusText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '600',
  },
  latencyText: {
    color: '#4ade80',
    fontSize: 11,
    fontWeight: '600',
  },
  disconnectBtn: {
    backgroundColor: 'rgba(239, 68, 68, 0.18)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.4)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
  },
  disconnectBtnText: {
    color: '#f87171',
    fontSize: 11,
    fontWeight: '700',
  },
  section: {
    marginBottom: 16,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  sectionTitle: {
    color: '#cbd5e1',
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 8,
  },
  emptyCard: {
    backgroundColor: '#14151e',
    borderRadius: 10,
    padding: 14,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
    alignItems: 'center',
  },
  emptyText: {
    color: '#94a3b8',
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 18,
  },
  emptyDownloadHint: {
    marginTop: 8,
    paddingVertical: 4,
  },
  emptyDownloadHintText: {
    color: '#60a5fa',
    fontSize: 12,
    fontWeight: '600',
  },
  hostCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#1c1d29',
    borderRadius: 10,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  hostInfo: {
    flex: 1,
  },
  hostName: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
  },
  hostIp: {
    color: '#60a5fa',
    fontSize: 12,
    marginTop: 2,
  },
  connectTag: {
    backgroundColor: '#2563eb',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  connectTagText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '600',
  },
  inputRow: {
    flexDirection: 'row',
    gap: 8,
  },
  input: {
    backgroundColor: '#121319',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 8,
    color: '#ffffff',
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 13,
  },
  manualConnectBtn: {
    backgroundColor: '#2563eb',
    borderRadius: 8,
    paddingHorizontal: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  manualConnectBtnText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '700',
  },
  recentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#121319',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 6,
  },
  recentInfo: {
    flex: 1,
  },
  recentText: {
    color: '#cbd5e1',
    fontSize: 13,
  },
  deleteRecentBtn: {
    padding: 4,
  },
  deleteRecentText: {
    color: '#94a3b8',
    fontSize: 13,
  },
  downloadBanner: {
    backgroundColor: 'rgba(79, 140, 255, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(79, 140, 255, 0.35)',
    borderRadius: 12,
    padding: 12,
    marginTop: 4,
    marginBottom: 10,
    alignItems: 'center',
  },
  downloadBannerTitle: {
    color: '#93c5fd',
    fontSize: 12.5,
    fontWeight: '700',
  },
  downloadBannerSub: {
    color: '#60a5fa',
    fontSize: 11,
    marginTop: 3,
  },

  // Download Hub Styles
  downloadHub: {
    alignItems: 'center',
  },
  qrCard: {
    width: '100%',
    backgroundColor: '#1a1c29',
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    alignItems: 'center',
    marginBottom: 12,
  },
  qrTitle: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '700',
    textAlign: 'center',
  },
  qrSubtitle: {
    color: '#94a3b8',
    fontSize: 11,
    textAlign: 'center',
    marginTop: 3,
    marginBottom: 12,
  },
  qrWrapper: {
    padding: 10,
    backgroundColor: '#ffffff',
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 4,
  },
  qrUrlText: {
    color: '#60a5fa',
    fontSize: 11,
    marginTop: 10,
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
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionBtnPrimary: {
    backgroundColor: '#2563eb',
  },
  actionBtnPrimaryText: {
    color: '#ffffff',
    fontSize: 12.5,
    fontWeight: '700',
  },
  actionBtnSecondary: {
    backgroundColor: '#222533',
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
    backgroundColor: '#161824',
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
    marginBottom: 10,
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
    fontWeight: '600',
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

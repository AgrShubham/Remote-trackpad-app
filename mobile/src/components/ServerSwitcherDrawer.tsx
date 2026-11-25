import React, { useState, useEffect, useMemo } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { socketService, ConnectionStatus } from '../services/SocketService';
import { discoveryService, DiscoveredHost } from '../services/DiscoveryService';
import { autoConnectService } from '../services/AutoConnectService';
import { hapticsService } from '../services/HapticsService';
import { useTheme } from '../theme/ThemeContext';
import { DarkTokens } from '../theme/cyberTokens';

const RECENT_SERVERS_KEY = '@remote_mouse_recent_servers_v1';

interface ServerSwitcherDrawerProps {
  visible: boolean;
  onClose: () => void;
}

export const ServerSwitcherDrawer: React.FC<ServerSwitcherDrawerProps> = ({
  visible,
  onClose,
}) => {
  const { isDark, tokens } = useTheme();
  const styles = useMemo(() => createStyles(tokens, isDark), [tokens, isDark]);
  const [hosts, setHosts] = useState<DiscoveredHost[]>([]);
  const [recentServers, setRecentServers] = useState<DiscoveredHost[]>([]);
  const [status, setStatus] = useState<ConnectionStatus>(socketService.getStatus());
  const [isScanning, setIsScanning] = useState(false);
  const [showManual, setShowManual] = useState(false);
  const [manualIp, setManualIp] = useState('');
  const [manualPort, setManualPort] = useState('5000');
  const [manualUdpPort, setManualUdpPort] = useState('5002');

  useEffect(() => {
    if (!visible) return;

    loadRecent();
    discoveryService.startListening();

    const unsubDiscovery = discoveryService.subscribe((list) => {
      setHosts(list);
    });

    const unsubSocket = socketService.subscribe((newStatus) => {
      setStatus(newStatus);
    });

    return () => {
      unsubDiscovery();
      unsubSocket();
    };
  }, [visible]);

  const loadRecent = async () => {
    try {
      const data = await AsyncStorage.getItem(RECENT_SERVERS_KEY);
      if (data) {
        setRecentServers(JSON.parse(data));
      }
    } catch (e) {}
  };

  const handleRescan = () => {
    hapticsService.light();
    setIsScanning(true);
    discoveryService.rescan();
    setTimeout(() => setIsScanning(false), 2000);
  };

  const handleConnect = async (host: {
    ip: string;
    port: number;
    udpPort?: number;
    name?: string;
  }) => {
    hapticsService.medium();
    const serverObj: DiscoveredHost = {
      name: host.name || host.ip,
      ip: host.ip,
      port: host.port,
      udpPort: host.udpPort || 5002,
      lastSeen: Date.now(),
    };

    await autoConnectService.rememberServer(serverObj);

    // Save to recents
    try {
      const filtered = recentServers.filter(
        (s) => !(s.ip === serverObj.ip && s.port === serverObj.port)
      );
      const updated = [serverObj, ...filtered].slice(0, 5);
      setRecentServers(updated);
      await AsyncStorage.setItem(RECENT_SERVERS_KEY, JSON.stringify(updated));
    } catch (e) {}

    socketService.connect(serverObj.ip, serverObj.port, serverObj.udpPort, serverObj.name);
    onClose();
  };

  const handleDisconnect = () => {
    hapticsService.light();
    socketService.disconnect();
  };

  const currentHostIp = socketService.getHostIp();
  const currentServerName = socketService.getServerName();

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <TouchableOpacity style={styles.backdropTouch} onPress={onClose} activeOpacity={1} />

        <View style={styles.sheet}>
          {/* Handle Bar */}
          <View style={styles.dragHandle} />

          {/* Header */}
          <View style={styles.header}>
            <View>
              <Text style={styles.sheetTitle}>Switch PC Server</Text>
              <Text style={styles.sheetSubtitle}>Migrate connection to another host PC</Text>
            </View>

            <View style={styles.headerRight}>
              <TouchableOpacity
                style={styles.rescanBtn}
                onPress={handleRescan}
                activeOpacity={0.7}
              >
                {isScanning ? (
                  <ActivityIndicator size="small" color="#3b82f6" />
                ) : (
                  <Text style={styles.rescanBtnText}>🔄 Rescan</Text>
                )}
              </TouchableOpacity>

              <TouchableOpacity style={styles.closeBtn} onPress={onClose} activeOpacity={0.7}>
                <Text style={styles.closeBtnText}>✕</Text>
              </TouchableOpacity>
            </View>
          </View>

          <ScrollView style={styles.body} showsVerticalScrollIndicator={false}>
            {/* Active Connection Card */}
            {status === 'connected' && (
              <View style={styles.activeCard}>
                <View style={styles.activeHeaderRow}>
                  <View style={styles.activeDot} />
                  <Text style={styles.activeTag}>CURRENTLY CONNECTED</Text>
                </View>
                <View style={styles.activeDetailsRow}>
                  <View style={styles.activeTextCol}>
                    <Text style={styles.activeName}>
                      {currentServerName || currentHostIp || 'Connected Server'}
                    </Text>
                    <Text style={styles.activeIp}>{currentHostIp}</Text>
                  </View>
                  <TouchableOpacity
                    style={styles.disconnectBtn}
                    onPress={handleDisconnect}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.disconnectBtnText}>Disconnect</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}

            {/* Discovered Servers Section */}
            <View style={styles.section}>
              <Text style={styles.sectionHeader}>DISCOVERED PCS ON WI-FI ({hosts.length})</Text>

              {hosts.length === 0 ? (
                <View style={styles.emptyCard}>
                  <Text style={styles.emptyText}>No other servers broadcasting on LAN</Text>
                  <Text style={styles.emptySubtext}>
                    Ensure server.py is running with UDP broadcasting active.
                  </Text>
                </View>
              ) : (
                hosts.map((host) => {
                  const isCurrent =
                    status === 'connected' &&
                    (currentHostIp === host.ip || (host.allIps && host.allIps.includes(currentHostIp)));
                  return (
                    <TouchableOpacity
                      key={`${host.ip}:${host.port}`}
                      style={[styles.hostCard, isCurrent && styles.hostCardActive]}
                      onPress={() => !isCurrent && handleConnect(host)}
                      activeOpacity={isCurrent ? 1 : 0.8}
                    >
                      <View style={styles.hostLeft}>
                        <Text style={styles.hostEmoji}>🖥️</Text>
                        <View style={{ flex: 1, marginRight: 8 }}>
                          <Text style={styles.hostTitle} numberOfLines={1}>{host.name}</Text>
                          <Text style={styles.hostSubtitle} numberOfLines={1}>
                            {host.ip}:{host.port} • UDP {host.udpPort || 5002}
                          </Text>
                        </View>
                      </View>

                      {isCurrent ? (
                        <View style={styles.currentBadge}>
                          <Text style={styles.currentBadgeText}>Active</Text>
                        </View>
                      ) : (
                        <View style={styles.switchPill}>
                          <Text style={styles.switchPillText}>Switch ➔</Text>
                        </View>
                      )}
                    </TouchableOpacity>
                  );
                })
              )}
            </View>

            {/* Recent Servers Section */}
            {recentServers.length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionHeader}>RECENT SERVERS</Text>
                {recentServers.map((s, idx) => (
                  <TouchableOpacity
                    key={`recent_${s.ip}_${s.port}_${idx}`}
                    style={styles.recentItem}
                    onPress={() => handleConnect(s)}
                    activeOpacity={0.8}
                  >
                    <View style={styles.recentLeft}>
                      <Text style={styles.recentIcon}>🕒</Text>
                      <View>
                        <Text style={styles.recentName}>{s.name || s.ip}</Text>
                        <Text style={styles.recentIp}>
                          {s.ip}:{s.port}
                        </Text>
                      </View>
                    </View>
                    <Text style={styles.recentConnect}>Connect ➔</Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}

            {/* Manual Connect Section */}
            <View style={styles.section}>
              <TouchableOpacity
                style={styles.manualToggleRow}
                onPress={() => setShowManual((p) => !p)}
                activeOpacity={0.8}
              >
                <Text style={styles.manualToggleText}>
                  {showManual ? '▼ Hide Manual Entry' : '▶ Enter IP Manually'}
                </Text>
              </TouchableOpacity>

              {showManual && (
                <View style={styles.manualCard}>
                  <Text style={styles.inputLabel}>SERVER IP ADDRESS</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="192.168.1.100"
                    placeholderTextColor="#64748b"
                    value={manualIp}
                    onChangeText={setManualIp}
                    keyboardType="numeric"
                    autoCapitalize="none"
                  />

                  <View style={styles.portRow}>
                    <View style={{ flex: 1, marginRight: 8 }}>
                      <Text style={styles.inputLabel}>HTTP PORT</Text>
                      <TextInput
                        style={styles.input}
                        placeholder="5000"
                        placeholderTextColor="#64748b"
                        value={manualPort}
                        onChangeText={setManualPort}
                        keyboardType="numeric"
                      />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.inputLabel}>UDP PORT</Text>
                      <TextInput
                        style={styles.input}
                        placeholder="5002"
                        placeholderTextColor="#64748b"
                        value={manualUdpPort}
                        onChangeText={setManualUdpPort}
                        keyboardType="numeric"
                      />
                    </View>
                  </View>

                  <TouchableOpacity
                    style={[
                      styles.manualConnectBtn,
                      !manualIp.trim() && { opacity: 0.5 },
                    ]}
                    disabled={!manualIp.trim()}
                    onPress={() =>
                      handleConnect({
                        ip: manualIp.trim(),
                        port: parseInt(manualPort, 10) || 5000,
                        udpPort: parseInt(manualUdpPort, 10) || 5002,
                        name: `PC (${manualIp.trim()})`,
                      })
                    }
                    activeOpacity={0.8}
                  >
                    <Text style={styles.manualConnectBtnText}>Connect to Host</Text>
                  </TouchableOpacity>
                </View>
              )}
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
    justifyContent: 'flex-end',
    backgroundColor: isDark ? 'rgba(0, 0, 0, 0.65)' : 'rgba(15, 23, 42, 0.4)',
  },
  backdropTouch: {
    flex: 1,
  },
  sheet: {
    backgroundColor: tokens.bgSurface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1,
    borderColor: tokens.borderLight,
    maxHeight: '85%',
    paddingBottom: 24,
  },
  dragHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: tokens.borderLight,
    alignSelf: 'center',
    marginTop: 10,
    marginBottom: 8,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: tokens.borderSubtle,
  },
  sheetTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: tokens.textWhite,
  },
  sheetSubtitle: {
    fontSize: 11,
    color: tokens.textSecondary,
    marginTop: 2,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  rescanBtn: {
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 8,
    backgroundColor: isDark ? 'rgba(255, 255, 255, 0.06)' : 'rgba(0, 0, 0, 0.05)',
    borderWidth: 1,
    borderColor: tokens.borderLight,
  },
  rescanBtnText: {
    fontSize: 12,
    color: tokens.blue,
    fontWeight: '600',
  },
  closeBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.05)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeBtnText: {
    fontSize: 13,
    color: tokens.textSecondary,
    fontWeight: '700',
  },
  body: {
    paddingHorizontal: 18,
    paddingTop: 14,
  },
  activeCard: {
    backgroundColor: isDark ? 'rgba(74, 222, 128, 0.08)' : 'rgba(5, 150, 105, 0.08)',
    borderWidth: 1,
    borderColor: isDark ? 'rgba(74, 222, 128, 0.3)' : 'rgba(5, 150, 105, 0.3)',
    borderRadius: 14,
    padding: 12,
    marginBottom: 16,
  },
  activeHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  activeDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: tokens.statusConnected,
    marginRight: 6,
  },
  activeTag: {
    fontSize: 10,
    fontWeight: '700',
    color: tokens.statusConnected,
    letterSpacing: 0.8,
  },
  activeDetailsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  activeTextCol: {
    flex: 1,
  },
  activeName: {
    fontSize: 14,
    fontWeight: '700',
    color: tokens.textWhite,
  },
  activeIp: {
    fontSize: 11,
    color: tokens.textSecondary,
    marginTop: 1,
  },
  disconnectBtn: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    borderWidth: 1,
    borderColor: '#ef4444',
  },
  disconnectBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#ef4444',
  },
  section: {
    marginBottom: 18,
  },
  sectionHeader: {
    fontSize: 10,
    fontWeight: '700',
    color: tokens.textMuted,
    letterSpacing: 1.1,
    marginBottom: 10,
  },
  emptyCard: {
    backgroundColor: isDark ? '#181b26' : tokens.cardElevated,
    borderRadius: 12,
    padding: 14,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 12,
    fontWeight: '600',
    color: tokens.textWhite,
    marginBottom: 2,
  },
  emptySubtext: {
    fontSize: 11,
    color: tokens.textMuted,
    textAlign: 'center',
  },
  hostCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: isDark ? '#181b26' : tokens.cardElevated,
    borderWidth: 1,
    borderColor: tokens.borderSubtle,
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
  },
  hostCardActive: {
    borderColor: tokens.blue,
    backgroundColor: isDark ? '#1b2234' : 'rgba(37, 99, 235, 0.08)',
  },
  hostLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  hostEmoji: {
    fontSize: 22,
    marginRight: 10,
  },
  hostTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: tokens.textWhite,
  },
  hostSubtitle: {
    fontSize: 11,
    color: tokens.textSecondary,
    marginTop: 1,
  },
  switchPill: {
    backgroundColor: '#2563eb',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  switchPillText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '700',
  },
  currentBadge: {
    backgroundColor: isDark ? 'rgba(74, 222, 128, 0.2)' : 'rgba(5, 150, 105, 0.14)',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 6,
  },
  currentBadgeText: {
    color: tokens.statusConnected,
    fontSize: 10,
    fontWeight: '700',
  },
  recentItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: isDark ? '#161822' : tokens.cardElevated,
    borderRadius: 10,
    marginBottom: 6,
  },
  recentLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  recentIcon: {
    fontSize: 16,
    marginRight: 10,
  },
  recentName: {
    fontSize: 12,
    fontWeight: '600',
    color: tokens.textWhite,
  },
  recentIp: {
    fontSize: 10,
    color: tokens.textMuted,
  },
  recentConnect: {
    fontSize: 11,
    color: tokens.blue,
    fontWeight: '600',
  },
  manualToggleRow: {
    paddingVertical: 6,
  },
  manualToggleText: {
    fontSize: 12,
    fontWeight: '700',
    color: tokens.blue,
  },
  manualCard: {
    backgroundColor: isDark ? '#161822' : tokens.cardElevated,
    borderRadius: 12,
    padding: 12,
    marginTop: 8,
  },
  inputLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: tokens.textMuted,
    marginBottom: 4,
    letterSpacing: 0.8,
  },
  input: {
    backgroundColor: isDark ? '#0c0d14' : tokens.bgSurface,
    borderWidth: 1,
    borderColor: tokens.borderLight,
    borderRadius: 8,
    color: tokens.textWhite,
    fontSize: 13,
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginBottom: 10,
  },
  portRow: {
    flexDirection: 'row',
  },
  manualConnectBtn: {
    backgroundColor: '#2563eb',
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: 'center',
    marginTop: 4,
  },
  manualConnectBtnText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '700',
  },
  });


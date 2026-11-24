import React, { useEffect, useRef, useState } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Animated,
  Easing,
  ActivityIndicator,
} from 'react-native';
import Svg, { Circle, Path, Defs, RadialGradient, Stop } from 'react-native-svg';
import { socketService, ConnectionStatus } from '../services/SocketService';
import { discoveryService, DiscoveredHost } from '../services/DiscoveryService';
import { autoConnectService } from '../services/AutoConnectService';
import { hapticsService } from '../services/HapticsService';

interface ConnectionGateModalProps {
  visible: boolean;
  onSkip: () => void;
  onConnected: () => void;
}

export const ConnectionGateModal: React.FC<ConnectionGateModalProps> = ({
  visible,
  onSkip,
  onConnected,
}) => {
  const [hosts, setHosts] = useState<DiscoveredHost[]>([]);
  const [status, setStatus] = useState<ConnectionStatus>(socketService.getStatus());
  const [connectingIp, setConnectingIp] = useState<string | null>(null);

  const radarPulse = useRef(new Animated.Value(0.8)).current;
  const radarOpacity = useRef(new Animated.Value(0.9)).current;

  useEffect(() => {
    if (!visible) return;

    // Start UDP discovery
    discoveryService.startListening();
    discoveryService.rescan();

    const unsubDiscovery = discoveryService.subscribe((list) => {
      setHosts(list);
    });

    const unsubSocket = socketService.subscribe((newStatus) => {
      setStatus(newStatus);
      if (newStatus === 'connected') {
        hapticsService.medium();
        onConnected();
      }
    });

    // Radar pulse loop
    const radarLoop = Animated.loop(
      Animated.parallel([
        Animated.timing(radarPulse, {
          toValue: 1.7,
          duration: 1500,
          easing: Easing.out(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(radarOpacity, {
          toValue: 0,
          duration: 1500,
          easing: Easing.out(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    );
    radarLoop.start();

    return () => {
      unsubDiscovery();
      unsubSocket();
      radarLoop.stop();
    };
  }, [visible]);

  const handleConnect = (host: DiscoveredHost) => {
    hapticsService.light();
    setConnectingIp(host.ip);
    autoConnectService.rememberServer(host);
    socketService.connect(host.ip, host.port, host.udpPort, host.name);
  };

  const handleSkip = () => {
    hapticsService.light();
    onSkip();
  };

  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.overlay}>
        <View style={styles.card}>
          {/* Header Radar Animation */}
          <View style={styles.radarWrapper}>
            <Animated.View
              style={[
                styles.radarWave,
                {
                  transform: [{ scale: radarPulse }],
                  opacity: radarOpacity,
                },
              ]}
            />
            <View style={styles.radarCenter}>
              <Svg width="36" height="36" viewBox="0 0 24 24" fill="none">
                <Path
                  d="M1 9L12 20L23 9C19.97 5.97 16.19 4 12 4C7.81 4 4.03 5.97 1 9Z"
                  stroke="#3b82f6"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <Circle cx="12" cy="18" r="1.5" fill="#60a5fa" />
              </Svg>
            </View>
          </View>

          {/* Heading */}
          <Text style={styles.title}>Server Connection Required</Text>
          <Text style={styles.subtitle}>
            {status === 'connecting'
              ? 'Establishing low-latency link to host PC...'
              : 'The app needs a connection to your PC server to transmit inputs.'}
          </Text>

          {/* Discovered Hosts List */}
          <View style={styles.listContainer}>
            <View style={styles.listHeaderRow}>
              <Text style={styles.listHeaderTitle}>DETECTED PCS ON WI-FI</Text>
              <Text style={styles.listHeaderBadge}>
                {hosts.length} {hosts.length === 1 ? 'PC' : 'PCs'} Found
              </Text>
            </View>

            {hosts.length === 0 ? (
              <View style={styles.emptyBox}>
                <ActivityIndicator size="small" color="#3b82f6" style={{ marginBottom: 8 }} />
                <Text style={styles.emptyText}>Scanning Wi-Fi broadcast for server.py...</Text>
                <Text style={styles.emptySubtext}>
                  Make sure your PC server is running and both devices are on the same Wi-Fi.
                </Text>
              </View>
            ) : (
              <ScrollView style={styles.hostsScroll} showsVerticalScrollIndicator={false}>
                {hosts.map((host) => {
                  const isThisConnecting = connectingIp === host.ip && status === 'connecting';
                  return (
                    <View key={`${host.ip}:${host.port}`} style={styles.hostCard}>
                      <View style={styles.hostTopRow}>
                        <Text style={styles.hostIcon}>🖥️</Text>
                        <View style={styles.hostInfoCol}>
                          <Text style={styles.hostName} numberOfLines={1}>
                            {host.name}
                          </Text>
                          <Text style={styles.hostIp} numberOfLines={1}>
                            {host.ip}:{host.port} • UDP {host.udpPort || 5002}
                          </Text>
                        </View>
                      </View>

                      <TouchableOpacity
                        style={[
                          styles.connectBtnBottom,
                          isThisConnecting && styles.connectBtnConnecting,
                        ]}
                        onPress={() => handleConnect(host)}
                        activeOpacity={0.85}
                      >
                        {isThisConnecting ? (
                          <View style={styles.connectingRow}>
                            <ActivityIndicator size="small" color="#ffffff" style={{ marginRight: 6 }} />
                            <Text style={styles.connectBtnBottomText}>Connecting...</Text>
                          </View>
                        ) : (
                          <Text style={styles.connectBtnBottomText}>Connect</Text>
                        )}
                      </TouchableOpacity>
                    </View>
                  );
                })}
              </ScrollView>
            )}
          </View>

          {/* Skip Button */}
          <TouchableOpacity style={styles.skipButton} onPress={handleSkip} activeOpacity={0.8}>
            <Text style={styles.skipButtonText}>Skip & Use Offline ➔</Text>
            <Text style={styles.skipButtonSubtext}>
              You can connect or switch servers anytime using the top bar
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(5, 6, 9, 0.92)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  card: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: '#12141c',
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: 'rgba(59, 130, 246, 0.35)',
    padding: 22,
    alignItems: 'center',
    shadowColor: '#3b82f6',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 10,
  },
  radarWrapper: {
    width: 80,
    height: 80,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  radarWave: {
    position: 'absolute',
    width: 76,
    height: 76,
    borderRadius: 38,
    borderWidth: 2,
    borderColor: '#3b82f6',
  },
  radarCenter: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: '#181b26',
    borderWidth: 1.5,
    borderColor: '#3b82f6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 18,
    fontWeight: '800',
    color: '#ffffff',
    letterSpacing: 0.3,
    marginBottom: 6,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 12,
    color: '#94a3b8',
    textAlign: 'center',
    lineHeight: 17,
    paddingHorizontal: 8,
    marginBottom: 20,
  },
  listContainer: {
    width: '100%',
    backgroundColor: '#0c0d14',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    padding: 14,
    marginBottom: 18,
  },
  listHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  listHeaderTitle: {
    fontSize: 10,
    fontWeight: '700',
    color: '#64748b',
    letterSpacing: 1.2,
  },
  listHeaderBadge: {
    fontSize: 10,
    fontWeight: '600',
    color: '#3b82f6',
  },
  emptyBox: {
    paddingVertical: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#cbd5e1',
    marginBottom: 4,
  },
  emptySubtext: {
    fontSize: 11,
    color: '#64748b',
    textAlign: 'center',
    paddingHorizontal: 12,
    lineHeight: 15,
  },
  hostsScroll: {
    maxHeight: 220,
  },
  hostCard: {
    backgroundColor: '#171a24',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    marginBottom: 10,
  },
  hostTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  hostIcon: {
    fontSize: 24,
    marginRight: 10,
  },
  hostInfoCol: {
    flex: 1,
  },
  hostName: {
    fontSize: 14,
    fontWeight: '700',
    color: '#ffffff',
    letterSpacing: 0.2,
  },
  hostIp: {
    fontSize: 11,
    color: '#8b8d9c',
    marginTop: 2,
  },
  connectBtnBottom: {
    width: '100%',
    backgroundColor: '#2563eb',
    paddingVertical: 9,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#2563eb',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.4,
    shadowRadius: 4,
    elevation: 3,
  },
  connectBtnConnecting: {
    backgroundColor: '#1d4ed8',
  },
  connectingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  connectBtnBottomText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  skipButton: {
    width: '100%',
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    alignItems: 'center',
  },
  skipButtonText: {
    color: '#93c5fd',
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.3,
    marginBottom: 2,
  },
  skipButtonSubtext: {
    color: '#64748b',
    fontSize: 10,
    textAlign: 'center',
  },
});


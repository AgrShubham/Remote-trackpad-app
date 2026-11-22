import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { ConnectionStatus } from '../services/SocketService';
import { hapticsService } from '../services/HapticsService';

interface ServerSwitcherBarProps {
  status: ConnectionStatus;
  serverName: string;
  serverIp: string;
  latency: number;
  onOpenSwitcher: () => void;
  accentColor?: string;
}

export const ServerSwitcherBar: React.FC<ServerSwitcherBarProps> = ({
  status,
  serverName,
  serverIp,
  latency,
  onOpenSwitcher,
  accentColor = '#3b82f6',
}) => {
  const isConnected = status === 'connected';
  const isConnecting = status === 'connecting';

  const handlePress = () => {
    hapticsService.light();
    onOpenSwitcher();
  };

  return (
    <View style={styles.container}>
      <TouchableOpacity
        style={styles.contentRow}
        onPress={handlePress}
        activeOpacity={0.8}
        focusable={false}
      >
        {/* Left Side: Server Indicator */}
        <View style={styles.serverInfoCol}>
          <View
            style={[
              styles.statusDot,
              isConnected && styles.dotConnected,
              isConnecting && styles.dotConnecting,
              !isConnected && !isConnecting && styles.dotDisconnected,
            ]}
          />
          <Text style={styles.serverTitleText} numberOfLines={1}>
            {isConnected
              ? serverName || serverIp || 'Connected PC'
              : isConnecting
              ? 'Connecting...'
              : 'No Server Connected'}
          </Text>
        </View>

        {/* Right Side: Latency Badge + Switch Button */}
        <View style={styles.rightActionsRow}>
          {isConnected && (
            <View style={styles.latencyBadge}>
              <Text
                style={[
                  styles.latencyText,
                  latency <= 15 ? styles.latencyFast : styles.latencyMedium,
                ]}
              >
                {latency > 0 ? `${latency}ms` : '<1ms'}
              </Text>
            </View>
          )}

          <View style={[styles.switchBtnPill, { borderColor: accentColor }]}>
            <Text style={[styles.switchBtnText, { color: accentColor }]}>Switch ⇄</Text>
          </View>
        </View>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#111219',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.07)',
    paddingVertical: 5,
    paddingHorizontal: 12,
  },
  contentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  serverInfoCol: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 10,
  },
  statusDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    marginRight: 7,
  },
  dotConnected: {
    backgroundColor: '#4ade80',
    shadowColor: '#4ade80',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 4,
    elevation: 3,
  },
  dotConnecting: {
    backgroundColor: '#fbbf24',
  },
  dotDisconnected: {
    backgroundColor: '#ef4444',
  },
  serverTitleText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#e2e8f0',
    letterSpacing: 0.2,
  },
  rightActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  latencyBadge: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    paddingVertical: 2,
    paddingHorizontal: 6,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  latencyText: {
    fontSize: 10,
    fontWeight: '700',
  },
  latencyFast: {
    color: '#4ade80',
  },
  latencyMedium: {
    color: '#fbbf24',
  },
  switchBtnPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 3,
    paddingHorizontal: 9,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderWidth: 1,
  },
  switchBtnText: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
});


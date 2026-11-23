import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  StatusBar,
} from 'react-native';
import Svg, { Path, Rect, Circle } from 'react-native-svg';
import { CyberTokens } from '../theme/cyberTokens';
import { ConnectionStatus, socketService } from '../services/SocketService';
import { hapticsService } from '../services/HapticsService';

export type ControlDeckType =
  | 'touchpad'
  | 'keyboard'
  | 'gamepad'
  | 'media'
  | 'presentation'
  | 'shortcuts';

interface HomeScreenProps {
  connectionStatus: ConnectionStatus;
  serverName: string;
  serverIp: string;
  latency: number;
  onOpenDeck: (deck: ControlDeckType) => void;
  onOpenServerSwitcher: () => void;
  accentColor?: string;
}

export const HomeScreen: React.FC<HomeScreenProps> = ({
  connectionStatus,
  serverName,
  serverIp,
  latency,
  onOpenDeck,
  onOpenServerSwitcher,
  accentColor = CyberTokens.teal,
}) => {
  const isConnected = connectionStatus === 'connected';
  const isConnecting = connectionStatus === 'connecting';

  const handleDeckPress = (deck: ControlDeckType) => {
    hapticsService.light();
    onOpenDeck(deck);
  };

  const handleQuickAction = (actionName: string, execute: () => void) => {
    hapticsService.light();
    execute();
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={CyberTokens.bgObsidian} />
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Top App Branding Bar */}
        <View style={styles.topBar}>
          <View style={styles.titleRow}>
            <View style={[styles.brandDot, { backgroundColor: accentColor }]} />
            <Text style={styles.brandTitle}>Remote Mouse Pro</Text>
            <View style={[styles.proBadge, { borderColor: `${accentColor}60` }]}>
              <Text style={[styles.proBadgeText, { color: accentColor }]}>TURBO UDP</Text>
            </View>
          </View>
        </View>

        {/* Hero Connection Card */}
        <TouchableOpacity
          style={[
            styles.heroCard,
            isConnected ? styles.heroCardConnected : styles.heroCardDisconnected,
            { borderColor: isConnected ? `${accentColor}40` : CyberTokens.borderSubtle },
          ]}
          onPress={() => {
            hapticsService.light();
            onOpenServerSwitcher();
          }}
          activeOpacity={0.85}
        >
          <View style={styles.heroHeaderRow}>
            <View style={styles.heroLeftIndicator}>
              <View
                style={[
                  styles.heroStatusDot,
                  isConnected && [styles.dotConnected, { backgroundColor: CyberTokens.statusConnected }],
                  isConnecting && [styles.dotConnecting, { backgroundColor: CyberTokens.statusConnecting }],
                  !isConnected && !isConnecting && [styles.dotDisconnected, { backgroundColor: CyberTokens.statusDisconnected }],
                ]}
              />
              <Text style={styles.heroStatusBadge}>
                {isConnected
                  ? 'ONLINE • ZERO-LAG UDP'
                  : isConnecting
                  ? 'CONNECTING...'
                  : 'DISCONNECTED'}
              </Text>
            </View>

            {isConnected && (
              <View style={styles.latencyTag}>
                <Text
                  style={[
                    styles.latencyTagText,
                    { color: latency <= 15 ? CyberTokens.statusConnected : CyberTokens.statusConnecting },
                  ]}
                >
                  {latency > 0 ? `${latency}ms` : '<1ms'}
                </Text>
              </View>
            )}
          </View>

          <View style={styles.heroBody}>
            <Text style={styles.heroServerTitle} numberOfLines={1}>
              {isConnected
                ? serverName || serverIp || 'Connected PC'
                : 'No PC Connected'}
            </Text>
            <Text style={styles.heroServerSubtitle} numberOfLines={1}>
              {isConnected
                ? `Active Target: ${serverIp || 'Localhost'}:${socketService.getPort()}`
                : 'Tap here to scan network or switch host PC'}
            </Text>
          </View>

          <View style={styles.heroFooter}>
            <View style={[styles.heroActionBtn, { backgroundColor: `${accentColor}20` }]}>
              <Text style={[styles.heroActionBtnText, { color: accentColor }]}>
                {isConnected ? 'Switch Server ⇄' : 'Scan & Connect 📡'}
              </Text>
            </View>
          </View>
        </TouchableOpacity>

        {/* Section Title: Control Decks */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Control Decks</Text>
          <Text style={styles.sectionSubtitle}>Select an interface to pilot your PC</Text>
        </View>

        {/* Bento Grid: 2 columns */}
        <View style={styles.bentoGrid}>
          {/* 1. Touchpad Deck */}
          <TouchableOpacity
            style={styles.bentoCard}
            onPress={() => handleDeckPress('touchpad')}
            activeOpacity={0.8}
          >
            <View style={[styles.bentoIconBox, { backgroundColor: `${accentColor}18` }]}>
              <Svg width="26" height="26" viewBox="0 0 24 24" fill="none">
                <Rect x="3" y="3" width="18" height="18" rx="4" stroke={accentColor} strokeWidth="2" />
                <Path d="M12 15v6M3 15h18" stroke={accentColor} strokeWidth="1.8" />
              </Svg>
            </View>
            <Text style={styles.bentoTitle}>Touchpad</Text>
            <Text style={styles.bentoDescription}>
              Precision trackpad, scroll slider & direct typing
            </Text>
            <View style={styles.bentoPillTag}>
              <Text style={[styles.bentoPillText, { color: accentColor }]}>Instant UDP</Text>
            </View>
          </TouchableOpacity>

          {/* 2. Keyboard Deck */}
          <TouchableOpacity
            style={styles.bentoCard}
            onPress={() => handleDeckPress('keyboard')}
            activeOpacity={0.8}
          >
            <View style={[styles.bentoIconBox, { backgroundColor: `${CyberTokens.blue}18` }]}>
              <Svg width="26" height="26" viewBox="0 0 24 24" fill="none">
                <Rect x="2" y="5" width="20" height="14" rx="3" stroke={CyberTokens.blue} strokeWidth="2" />
                <Path d="M6 9h1M10 9h1M14 9h1M18 9h1M6 13h1M10 13h4M17 13h1" stroke={CyberTokens.blue} strokeWidth="2" strokeLinecap="round" />
              </Svg>
            </View>
            <Text style={styles.bentoTitle}>Keyboard</Text>
            <Text style={styles.bentoDescription}>
              Full QWERTY layout with Mini-Touchpad
            </Text>
            <View style={styles.bentoPillTag}>
              <Text style={[styles.bentoPillText, { color: CyberTokens.blue }]}>PC Keys</Text>
            </View>
          </TouchableOpacity>

          {/* 3. Gamepad Deck */}
          <TouchableOpacity
            style={styles.bentoCard}
            onPress={() => handleDeckPress('gamepad')}
            activeOpacity={0.8}
          >
            <View style={[styles.bentoIconBox, { backgroundColor: `${CyberTokens.amber}18` }]}>
              <Svg width="26" height="26" viewBox="0 0 24 24" fill="none">
                <Rect x="2" y="6" width="20" height="12" rx="6" stroke={CyberTokens.amber} strokeWidth="2" />
                <Path d="M6 12h4M8 10v4M15 11h.01M17 13h.01" stroke={CyberTokens.amber} strokeWidth="2" strokeLinecap="round" />
              </Svg>
            </View>
            <Text style={styles.bentoTitle}>Gamepad</Text>
            <Text style={styles.bentoDescription}>
              Dual analog sticks, D-pad & shoulder triggers
            </Text>
            <View style={styles.bentoPillTag}>
              <Text style={[styles.bentoPillText, { color: CyberTokens.amber }]}>Console Feel</Text>
            </View>
          </TouchableOpacity>

          {/* 4. Media Deck */}
          <TouchableOpacity
            style={styles.bentoCard}
            onPress={() => handleDeckPress('media')}
            activeOpacity={0.8}
          >
            <View style={[styles.bentoIconBox, { backgroundColor: `${CyberTokens.purple}18` }]}>
              <Svg width="26" height="26" viewBox="0 0 24 24" fill="none">
                <Path d="M11 5L6 9H2v6h4l5 4V5zM19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07" stroke={CyberTokens.purple} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </Svg>
            </View>
            <Text style={styles.bentoTitle}>Media Remote</Text>
            <Text style={styles.bentoDescription}>
              Volume slider, playback, scrubbing & mute
            </Text>
            <View style={styles.bentoPillTag}>
              <Text style={[styles.bentoPillText, { color: CyberTokens.purple }]}>Playback</Text>
            </View>
          </TouchableOpacity>

          {/* 5. Presentation Deck */}
          <TouchableOpacity
            style={styles.bentoCard}
            onPress={() => handleDeckPress('presentation')}
            activeOpacity={0.8}
          >
            <View style={[styles.bentoIconBox, { backgroundColor: `${CyberTokens.emerald}18` }]}>
              <Svg width="26" height="26" viewBox="0 0 24 24" fill="none">
                <Rect x="3" y="3" width="18" height="12" rx="2" stroke={CyberTokens.emerald} strokeWidth="2" />
                <Path d="M7 21l5-6 5 6M12 15v6M9 9l3 3 3-3" stroke={CyberTokens.emerald} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
              </Svg>
            </View>
            <Text style={styles.bentoTitle}>Presentation</Text>
            <Text style={styles.bentoDescription}>
              Rehearsal timer, interval alerts & slide hotkeys
            </Text>
            <View style={styles.bentoPillTag}>
              <Text style={[styles.bentoPillText, { color: CyberTokens.emerald }]}>Slides & Timer</Text>
            </View>
          </TouchableOpacity>

          {/* 6. Shortcuts Deck */}
          <TouchableOpacity
            style={styles.bentoCard}
            onPress={() => handleDeckPress('shortcuts')}
            activeOpacity={0.8}
          >
            <View style={[styles.bentoIconBox, { backgroundColor: `${CyberTokens.cyan}18` }]}>
              <Svg width="26" height="26" viewBox="0 0 24 24" fill="none">
                <Rect x="4" y="4" width="6" height="6" rx="1.5" stroke={CyberTokens.cyan} strokeWidth="2" />
                <Rect x="14" y="4" width="6" height="6" rx="1.5" stroke={CyberTokens.cyan} strokeWidth="2" />
                <Rect x="4" y="14" width="6" height="6" rx="1.5" stroke={CyberTokens.cyan} strokeWidth="2" />
                <Rect x="14" y="14" width="6" height="6" rx="1.5" stroke={CyberTokens.cyan} strokeWidth="2" />
              </Svg>
            </View>
            <Text style={styles.bentoTitle}>Shortcuts</Text>
            <Text style={styles.bentoDescription}>
              Windows, Browser, Editing & System macros
            </Text>
            <View style={styles.bentoPillTag}>
              <Text style={[styles.bentoPillText, { color: CyberTokens.cyan }]}>Quick Macros</Text>
            </View>
          </TouchableOpacity>
        </View>

        {/* Quick PC Actions Strip */}
        <View style={styles.quickToolsSection}>
          <Text style={styles.quickToolsTitle}>Quick System Tools</Text>
          <View style={styles.quickToolsRow}>
            <TouchableOpacity
              style={styles.quickActionTile}
              onPress={() => handleQuickAction('Lock PC', () => socketService.shortcut(['win', 'l']))}
            >
              <Text style={styles.quickActionIcon}>🔒</Text>
              <Text style={styles.quickActionLabel}>Lock PC</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.quickActionTile}
              onPress={() => handleQuickAction('Desktop', () => socketService.shortcut(['win', 'd']))}
            >
              <Text style={styles.quickActionIcon}>🖥️</Text>
              <Text style={styles.quickActionLabel}>Desktop</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.quickActionTile}
              onPress={() => handleQuickAction('Task View', () => socketService.shortcut(['win', 'tab']))}
            >
              <Text style={styles.quickActionIcon}>🔲</Text>
              <Text style={styles.quickActionLabel}>Tasks</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.quickActionTile}
              onPress={() => handleQuickAction('Mute', () => socketService.key('media_volume_mute', 'tap'))}
            >
              <Text style={styles.quickActionIcon}>🔇</Text>
              <Text style={styles.quickActionLabel}>Mute</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: CyberTokens.bgObsidian,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 28,
  },
  topBar: {
    paddingVertical: 10,
    marginBottom: 6,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  brandDot: {
    width: 9,
    height: 9,
    borderRadius: 4.5,
  },
  brandTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: CyberTokens.textWhite,
    letterSpacing: 0.3,
  },
  proBadge: {
    paddingVertical: 2,
    paddingHorizontal: 7,
    borderRadius: 6,
    borderWidth: 1,
  },
  proBadgeText: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  heroCard: {
    backgroundColor: CyberTokens.cardBase,
    borderRadius: CyberTokens.radiusLg,
    padding: 16,
    borderWidth: 1,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 6,
  },
  heroCardConnected: {},
  heroCardDisconnected: {
    borderStyle: 'dashed',
  },
  heroHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  heroLeftIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  heroStatusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  dotConnected: {
    shadowColor: CyberTokens.statusConnected,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.9,
    shadowRadius: 6,
    elevation: 3,
  },
  dotConnecting: {},
  dotDisconnected: {},
  heroStatusBadge: {
    fontSize: 10,
    fontWeight: '800',
    color: CyberTokens.textSecondary,
    letterSpacing: 0.6,
  },
  latencyTag: {
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    paddingVertical: 2,
    paddingHorizontal: 8,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: CyberTokens.borderSubtle,
  },
  latencyTagText: {
    fontSize: 10,
    fontWeight: '800',
  },
  heroBody: {
    marginBottom: 12,
  },
  heroServerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: CyberTokens.textWhite,
    letterSpacing: 0.2,
    marginBottom: 2,
  },
  heroServerSubtitle: {
    fontSize: 12,
    color: CyberTokens.textSecondary,
  },
  heroFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
  },
  heroActionBtn: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  heroActionBtnText: {
    fontSize: 12,
    fontWeight: '700',
  },
  sectionHeader: {
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: CyberTokens.textWhite,
  },
  sectionSubtitle: {
    fontSize: 12,
    color: CyberTokens.textMuted,
    marginTop: 1,
  },
  bentoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 22,
  },
  bentoCard: {
    width: '48%',
    backgroundColor: CyberTokens.cardBase,
    borderRadius: CyberTokens.radiusMd,
    padding: 14,
    borderWidth: 1,
    borderColor: CyberTokens.borderSubtle,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  bentoIconBox: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  bentoTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: CyberTokens.textWhite,
    marginBottom: 4,
  },
  bentoDescription: {
    fontSize: 11,
    color: CyberTokens.textSecondary,
    lineHeight: 15,
    minHeight: 30,
    marginBottom: 8,
  },
  bentoPillTag: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    paddingVertical: 2,
    paddingHorizontal: 6,
    borderRadius: 5,
  },
  bentoPillText: {
    fontSize: 9,
    fontWeight: '700',
  },
  quickToolsSection: {
    backgroundColor: CyberTokens.cardBase,
    borderRadius: CyberTokens.radiusMd,
    padding: 14,
    borderWidth: 1,
    borderColor: CyberTokens.borderSubtle,
  },
  quickToolsTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: CyberTokens.textSecondary,
    marginBottom: 10,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  quickToolsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  quickActionTile: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    marginHorizontal: 3,
  },
  quickActionIcon: {
    fontSize: 18,
    marginBottom: 4,
  },
  quickActionLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: CyberTokens.textSecondary,
  },
});


import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Share,
} from 'react-native';
import Svg, { Path, Rect, Circle } from 'react-native-svg';
import { CyberTokens } from '../theme/cyberTokens';
import { useTheme } from '../theme/ThemeContext';
import { socketService } from '../services/SocketService';
import { hapticsService } from '../services/HapticsService';

interface ShowOnPcScreenProps {
  serverIp: string;
  serverName: string;
  accentColor?: string;
}

export const ShowOnPcScreen: React.FC<ShowOnPcScreenProps> = ({
  serverIp,
  serverName,
  accentColor: propAccentColor,
}) => {
  const { isDark, tokens, accent } = useTheme();
  const accentColor = propAccentColor || accent.primary;
  const isConnected = socketService.getStatus() === 'connected';
  const webPortalUrl = isConnected && serverIp
    ? `http://${serverIp}:${socketService.getPort()}`
    : 'Connect to PC to view portal URL';

  const handleShareUrl = async () => {
    if (!isConnected || !serverIp) return;
    hapticsService.light();
    try {
      await Share.share({
        message: `Remote PC Web Portal: ${webPortalUrl}`,
        url: webPortalUrl,
      });
    } catch (e) {
      // Ignore share dismissal
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: tokens.bgObsidian }]}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Top Header */}
        <View style={styles.header}>
          <Text style={[styles.headerTitle, { color: tokens.textWhite }]}>Show on PC</Text>
          <Text style={[styles.headerSubtitle, { color: tokens.textSecondary }]}>
            Share screen, cast photos & stream webcam directly to your PC
          </Text>
        </View>

        {/* Hero Web Portal Link Card */}
        <View style={[styles.portalCard, { backgroundColor: tokens.cardBase, borderColor: isConnected ? `${accentColor}50` : tokens.borderSubtle }]}>
          <View style={styles.portalCardHeader}>
            <View style={[styles.iconBox, { backgroundColor: `${accentColor}18` }]}>
              <Svg width="22" height="22" viewBox="0 0 24 24" fill="none">
                <Rect x="2" y="3" width="20" height="14" rx="2" stroke={accentColor} strokeWidth="2" />
                <Path d="M8 21h8M12 17v4" stroke={accentColor} strokeWidth="2" strokeLinecap="round" />
              </Svg>
            </View>
            <View style={styles.portalTitleBox}>
              <Text style={[styles.portalCardTitle, { color: tokens.textWhite }]}>PC Web Receiver</Text>
              <Text style={[styles.portalCardSubtitle, { color: tokens.textSecondary }]}>
                {isConnected ? `Hosted on ${serverName || 'PC'}` : 'Offline'}
              </Text>
            </View>
          </View>

          <View style={[styles.urlContainer, { backgroundColor: isDark ? 'rgba(0, 0, 0, 0.3)' : 'rgba(0, 0, 0, 0.04)', borderColor: tokens.borderSubtle }]}>
            <Text style={[styles.urlLabel, { color: tokens.textMuted }]}>Browser Access URL:</Text>
            <Text style={[styles.urlText, { color: tokens.textWhite }]} selectable>{webPortalUrl}</Text>
          </View>

          <TouchableOpacity
            style={[styles.shareBtn, !isConnected && styles.shareBtnDisabled, { backgroundColor: accentColor }]}
            onPress={handleShareUrl}
            disabled={!isConnected}
            activeOpacity={0.8}
          >
            <Text style={styles.shareBtnText}>Share / Copy Portal Link ↗</Text>
          </TouchableOpacity>
        </View>

        {/* Feature Cards Grid */}
        <View style={styles.featuresGrid}>
          {/* 1. Screen Mirroring Card */}
          <View style={[styles.featureCard, { backgroundColor: tokens.cardBase, borderColor: tokens.borderSubtle }]}>
            <View style={[styles.featureIcon, { backgroundColor: `${tokens.blue}18` }]}>
              <Svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                <Rect x="2" y="4" width="20" height="14" rx="2.5" stroke={tokens.blue} strokeWidth="2" />
                <Path d="M9 18l3-3 3 3" stroke={tokens.blue} strokeWidth="1.8" strokeLinecap="round" />
              </Svg>
            </View>
            <Text style={[styles.featureTitle, { color: tokens.textWhite }]}>Screen Mirroring</Text>
            <Text style={[styles.featureDescription, { color: tokens.textSecondary }]}>
              Cast your phone screen in real-time onto the PC desktop monitor with zero setup.
            </Text>
            <View style={styles.badgeRow}>
              <View style={[styles.badgePill, { backgroundColor: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.04)' }]}>
                <Text style={[styles.badgeText, { color: tokens.textMuted }]}>Local Wi-Fi</Text>
              </View>
            </View>
          </View>

          {/* 2. Webcam & Mic Stream */}
          <View style={[styles.featureCard, { backgroundColor: tokens.cardBase, borderColor: tokens.borderSubtle }]}>
            <View style={[styles.featureIcon, { backgroundColor: `${tokens.purple}18` }]}>
              <Svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                <Path d="M23 7l-7 5 7 5V7z" stroke={tokens.purple} strokeWidth="2" strokeLinejoin="round" />
                <Rect x="1" y="5" width="15" height="14" rx="2" stroke={tokens.purple} strokeWidth="2" />
              </Svg>
            </View>
            <Text style={[styles.featureTitle, { color: tokens.textWhite }]}>HD Phone Webcam</Text>
            <Text style={[styles.featureDescription, { color: tokens.textSecondary }]}>
              Turn your smartphone camera into a wireless HD PC webcam for Zoom, Teams and OBS.
            </Text>
            <View style={styles.badgeRow}>
              <View style={[styles.badgePill, { backgroundColor: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.04)' }]}>
                <Text style={[styles.badgeText, { color: tokens.textMuted }]}>1080p Stream</Text>
              </View>
            </View>
          </View>
        </View>

        {/* Security & Local Network Notice */}
        <View style={[styles.noticeBox, { backgroundColor: isDark ? 'rgba(255, 255, 255, 0.03)' : 'rgba(0, 0, 0, 0.03)', borderColor: tokens.borderSubtle }]}>
          <Text style={styles.noticeIcon}>🔒</Text>
          <Text style={[styles.noticeText, { color: tokens.textSecondary }]}>
            Streamed completely offline through your local Wi-Fi or Windows Mobile Hotspot. No video or audio leaves your private network.
          </Text>
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
    padding: 16,
    paddingBottom: 100,
  },
  header: {
    marginBottom: 16,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: CyberTokens.textWhite,
    letterSpacing: 0.3,
  },
  headerSubtitle: {
    fontSize: 12,
    color: CyberTokens.textSecondary,
    marginTop: 3,
    lineHeight: 17,
  },
  portalCard: {
    backgroundColor: CyberTokens.cardBase,
    borderRadius: CyberTokens.radiusLg,
    padding: 16,
    borderWidth: 1,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 4,
  },
  portalCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 12,
  },
  iconBox: {
    width: 42,
    height: 42,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  portalTitleBox: {
    flex: 1,
  },
  portalCardTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: CyberTokens.textWhite,
  },
  portalCardSubtitle: {
    fontSize: 12,
    color: CyberTokens.textSecondary,
  },
  urlContainer: {
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    borderRadius: 8,
    padding: 10,
    borderWidth: 1,
    borderColor: CyberTokens.borderSubtle,
    marginBottom: 12,
  },
  urlLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: CyberTokens.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 3,
  },
  urlText: {
    fontSize: 13,
    fontWeight: '600',
    color: CyberTokens.textWhite,
  },
  shareBtn: {
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  shareBtnDisabled: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  shareBtnText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '700',
  },
  featuresGrid: {
    gap: 12,
    marginBottom: 16,
  },
  featureCard: {
    backgroundColor: CyberTokens.cardBase,
    borderRadius: CyberTokens.radiusMd,
    padding: 14,
    borderWidth: 1,
    borderColor: CyberTokens.borderSubtle,
  },
  featureIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  featureTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: CyberTokens.textWhite,
    marginBottom: 4,
  },
  featureDescription: {
    fontSize: 12,
    color: CyberTokens.textSecondary,
    lineHeight: 16,
    marginBottom: 10,
  },
  badgeRow: {
    flexDirection: 'row',
  },
  badgePill: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 6,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '600',
    color: CyberTokens.textSecondary,
  },
  noticeBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: CyberTokens.borderSubtle,
  },
  noticeIcon: {
    fontSize: 16,
  },
  noticeText: {
    flex: 1,
    fontSize: 11,
    color: CyberTokens.textMuted,
    lineHeight: 15,
  },
});


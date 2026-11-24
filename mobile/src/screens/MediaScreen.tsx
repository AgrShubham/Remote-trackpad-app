import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  PanResponder,
  ScrollView,
} from 'react-native';
import Svg, { Path, Rect, Circle, Polygon } from 'react-native-svg';
import { socketService } from '../services/SocketService';
import { hapticsService } from '../services/HapticsService';
import { useTheme } from '../theme/ThemeContext';

interface MediaScreenProps {
  isFullscreen?: boolean;
  onToggleFullscreen?: () => void;
}

export const MediaScreen: React.FC<MediaScreenProps> = ({
  isFullscreen,
  onToggleFullscreen,
}) => {
  const { isDark, tokens } = useTheme();
  const [volume, setVolume] = useState<number>(60);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);

  // Volume track measurement refs
  const trackRef = useRef<View>(null);
  const trackWidthRef = useRef<number>(240);
  const trackPageXRef = useRef<number>(0);
  const lastEmittedVolRef = useRef<number>(60);

  const triggerKey = (keyName: string) => {
    socketService.key(keyName, 'tap');
    hapticsService.light();
  };

  const handlePlayPause = () => {
    socketService.key('media_play_pause', 'tap');
    setIsPlaying(!isPlaying);
    hapticsService.light();
  };

  const handleMuteToggle = () => {
    socketService.key('media_volume_mute', 'tap');
    setIsMuted(!isMuted);
    hapticsService.light();
  };

  const stepVolume = (delta: number) => {
    const nextVol = Math.max(0, Math.min(100, volume + delta));
    setVolume(nextVol);
    if (delta > 0) {
      socketService.key('media_volume_up', 'tap');
    } else {
      socketService.key('media_volume_down', 'tap');
    }
    hapticsService.light();
  };

  const updateVolumeFromPageX = (pageX: number) => {
    const width = trackWidthRef.current || 240;
    const x = pageX - trackPageXRef.current;
    const fraction = Math.max(0, Math.min(1, x / width));
    const newVol = Math.round(fraction * 100);
    setVolume(newVol);

    // Emit volume step if moved significantly
    const diff = newVol - lastEmittedVolRef.current;
    if (Math.abs(diff) >= 4) {
      const steps = Math.min(Math.abs(Math.round(diff / 4)), 3);
      for (let i = 0; i < steps; i++) {
        socketService.key(diff > 0 ? 'media_volume_up' : 'media_volume_down', 'tap');
      }
      lastEmittedVolRef.current = newVol;
      hapticsService.light();
    }
  };

  const volumePanResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (evt) => {
        updateVolumeFromPageX(evt.nativeEvent.pageX);
      },
      onPanResponderMove: (evt) => {
        updateVolumeFromPageX(evt.nativeEvent.pageX);
      },
    })
  ).current;

  return (
    <View style={[styles.container, { backgroundColor: tokens.bgObsidian }, isFullscreen && styles.containerFullscreen]}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Header Bar */}
        <View style={styles.header}>
          <View style={styles.titleRow}>
            <View style={styles.headerDot} />
            <Text style={[styles.headerTitle, { color: tokens.textWhite }]}>HIFI MEDIA DECK</Text>
          </View>
          {onToggleFullscreen && (
            <TouchableOpacity
              style={[
                styles.fullscreenBtn,
                {
                  backgroundColor: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.05)',
                  borderColor: tokens.borderSubtle,
                },
                isFullscreen && styles.fullscreenBtnActive,
              ]}
              onPress={onToggleFullscreen}
              activeOpacity={0.8}
              focusable={false}
            >
              <Text style={[styles.fullscreenBtnText, { color: tokens.textSecondary }, isFullscreen && styles.fullscreenBtnTextActive]}>
                {isFullscreen ? '✕ Exit' : '⛶ Fullscreen'}
              </Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Master Volume Scrubber Card */}
        <View style={[styles.card, { backgroundColor: tokens.cardBase, borderColor: tokens.borderSubtle }]}>
          <View style={styles.cardHeader}>
            <View style={styles.cardHeaderLeft}>
              <Svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="#60a5fa" strokeWidth={2}>
                <Polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                <Path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
                <Path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
              </Svg>
              <Text style={[styles.cardTitle, { color: tokens.textWhite }]}>Master Volume</Text>
            </View>
            <View style={[styles.volBadge, isMuted && styles.volBadgeMuted]}>
              <Text style={[styles.volBadgeText, isMuted && styles.volBadgeTextMuted]}>
                {isMuted ? 'MUTED' : `${volume}%`}
              </Text>
            </View>
          </View>

          {/* Interactive Volume Track */}
          <View style={styles.sliderHitArea} {...volumePanResponder.panHandlers}>
            <View
              ref={trackRef}
              style={styles.sliderTrack}
              onLayout={() => {
                trackRef.current?.measure((_x, _y, width, _height, pageX, _pageY) => {
                  if (width > 0) {
                    trackWidthRef.current = width;
                    trackPageXRef.current = pageX;
                  }
                });
              }}
            >
              <View
                style={[
                  styles.sliderFill,
                  { width: `${volume}%` },
                  isMuted && styles.sliderFillMuted,
                ]}
              />
              <View
                style={[
                  styles.sliderThumb,
                  { left: `${volume}%` },
                  isMuted && styles.sliderThumbMuted,
                ]}
              />
            </View>
          </View>

          {/* Fine Tuning Buttons & Mute */}
          <View style={styles.volControlsRow}>
            <TouchableOpacity
              style={styles.volStepBtn}
              onPress={() => stepVolume(-4)}
              activeOpacity={0.8}
              focusable={false}
            >
              <Text style={styles.volStepText}>− 4%</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.muteBtn, isMuted && styles.muteBtnActive]}
              onPress={handleMuteToggle}
              activeOpacity={0.8}
              focusable={false}
            >
              <Svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke={isMuted ? '#f87171' : '#cbd5e1'} strokeWidth={2}>
                <Polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                <Path d="M23 9l-6 6" />
                <Path d="M17 9l6 6" />
              </Svg>
              <Text style={[styles.muteBtnText, isMuted && styles.muteBtnTextActive]}>
                {isMuted ? 'Unmute' : 'Mute'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.volStepBtn}
              onPress={() => stepVolume(4)}
              activeOpacity={0.8}
              focusable={false}
            >
              <Text style={styles.volStepText}>+ 4%</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Primary Playback Transport Pod */}
        <View style={styles.card}>
          <Text style={styles.podSectionLabel}>PLAYBACK TRANSPORT</Text>

          {/* Main Controls: Previous, Play/Pause, Next */}
          <View style={styles.mainTransportRow}>
            {/* Previous Track */}
            <TouchableOpacity
              style={styles.skipBtn}
              onPress={() => triggerKey('media_previous')}
              activeOpacity={0.8}
              focusable={false}
            >
              <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="#f1f5f9" strokeWidth={2}>
                <Polygon points="19 20 9 12 19 4 19 20" />
                <Path d="M5 19V5" />
              </Svg>
            </TouchableOpacity>

            {/* Glowing Center Play / Pause */}
            <TouchableOpacity
              style={[styles.playPauseBtn, isPlaying && styles.playPauseBtnPlaying]}
              onPress={handlePlayPause}
              activeOpacity={0.85}
              focusable={false}
            >
              {isPlaying ? (
                <Svg width={28} height={28} viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth={2.5}>
                  <Rect x="6" y="4" width="4" height="16" rx="1" fill="#ffffff" />
                  <Rect x="14" y="4" width="4" height="16" rx="1" fill="#ffffff" />
                </Svg>
              ) : (
                <Svg width={30} height={30} viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth={2}>
                  <Polygon points="5 3 19 12 5 21 5 3" fill="#ffffff" />
                </Svg>
              )}
            </TouchableOpacity>

            {/* Next Track */}
            <TouchableOpacity
              style={styles.skipBtn}
              onPress={() => triggerKey('media_next')}
              activeOpacity={0.8}
              focusable={false}
            >
              <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="#f1f5f9" strokeWidth={2}>
                <Polygon points="5 4 15 12 5 20 5 4" />
                <Path d="M19 5v14" />
              </Svg>
            </TouchableOpacity>
          </View>

          {/* Video Seek & Instant Scrub Row */}
          <View style={styles.seekRow}>
            <TouchableOpacity
              style={styles.seekBtn}
              onPress={() => triggerKey('left')}
              activeOpacity={0.8}
              focusable={false}
            >
              <Text style={styles.seekBtnIcon}>⏪</Text>
              <Text style={styles.seekBtnText}>- 10s</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.spaceBtn}
              onPress={() => triggerKey('space')}
              activeOpacity={0.8}
              focusable={false}
            >
              <Text style={styles.spaceBtnText}>Space ⎵</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.seekBtn}
              onPress={() => triggerKey('right')}
              activeOpacity={0.8}
              focusable={false}
            >
              <Text style={styles.seekBtnText}>+ 10s</Text>
              <Text style={styles.seekBtnIcon}>⏩</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Video & Streaming Suite Card */}
        <View style={styles.card}>
          <Text style={styles.podSectionLabel}>STREAMING & VIDEO TOOLS</Text>
          <View style={styles.toolsGrid}>
            <TouchableOpacity
              style={styles.toolBtn}
              onPress={() => triggerKey('f')}
              activeOpacity={0.8}
              focusable={false}
            >
              <Svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="#60a5fa" strokeWidth={2}>
                <Path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3" />
              </Svg>
              <Text style={styles.toolBtnTitle}>Fullscreen</Text>
              <Text style={styles.toolBtnKey}>F Key</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.toolBtn}
              onPress={() => triggerKey('c')}
              activeOpacity={0.8}
              focusable={false}
            >
              <Svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="#60a5fa" strokeWidth={2}>
                <Path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
              </Svg>
              <Text style={styles.toolBtnTitle}>Subtitles</Text>
              <Text style={styles.toolBtnKey}>C Key</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.toolBtn}
              onPress={() => triggerKey('esc')}
              activeOpacity={0.8}
              focusable={false}
            >
              <Svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="#f87171" strokeWidth={2}>
                <Path d="M18 6L6 18" />
                <Path d="M6 6l12 12" />
              </Svg>
              <Text style={styles.toolBtnTitle}>Exit Window</Text>
              <Text style={styles.toolBtnKey}>Esc Key</Text>
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
    backgroundColor: '#0a0b10',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  containerFullscreen: {
    paddingHorizontal: 6,
    paddingVertical: 4,
  },
  scrollContent: {
    paddingBottom: 24,
  },

  // Header Bar
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
    paddingHorizontal: 4,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: '#3b82f6',
    elevation: 3,
  },
  headerTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: '#94a3b8',
    letterSpacing: 1,
  },
  fullscreenBtn: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 7,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
  },
  fullscreenBtnActive: {
    backgroundColor: 'rgba(52, 211, 153, 0.2)',
    borderColor: '#34d399',
  },
  fullscreenBtnText: {
    color: '#cbd5e1',
    fontSize: 11,
    fontWeight: '700',
  },
  fullscreenBtnTextActive: {
    color: '#34d399',
  },

  // Cards
  card: {
    backgroundColor: '#13151f',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    padding: 16,
    marginBottom: 10,
    elevation: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.5,
    shadowRadius: 14,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  cardHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  cardTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#ffffff',
  },
  volBadge: {
    paddingHorizontal: 9,
    paddingVertical: 3,
    borderRadius: 6,
    backgroundColor: 'rgba(59, 130, 246, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(59, 130, 246, 0.3)',
  },
  volBadgeMuted: {
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    borderColor: 'rgba(239, 68, 68, 0.35)',
  },
  volBadgeText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#60a5fa',
  },
  volBadgeTextMuted: {
    color: '#f87171',
  },

  // Volume Slider
  sliderHitArea: {
    height: 38,
    justifyContent: 'center',
  },
  sliderTrack: {
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    position: 'relative',
    justifyContent: 'center',
  },
  sliderFill: {
    height: '100%',
    borderRadius: 4,
    backgroundColor: '#3b82f6',
  },
  sliderFillMuted: {
    backgroundColor: '#6b7280',
  },
  sliderThumb: {
    position: 'absolute',
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#ffffff',
    borderWidth: 3,
    borderColor: '#3b82f6',
    marginLeft: -11,
    elevation: 4,
    shadowColor: '#3b82f6',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.6,
    shadowRadius: 5,
  },
  sliderThumbMuted: {
    borderColor: '#6b7280',
  },

  volControlsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    marginTop: 8,
  },
  volStepBtn: {
    flex: 1,
    paddingVertical: 9,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    alignItems: 'center',
  },
  volStepText: {
    color: '#e2e8f0',
    fontSize: 12,
    fontWeight: '700',
  },
  muteBtn: {
    flex: 1.2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 9,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  muteBtnActive: {
    backgroundColor: 'rgba(239, 68, 68, 0.18)',
    borderColor: '#ef4444',
  },
  muteBtnText: {
    color: '#cbd5e1',
    fontSize: 12,
    fontWeight: '700',
  },
  muteBtnTextActive: {
    color: '#f87171',
  },

  // Transport Pod
  podSectionLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: '#64748b',
    letterSpacing: 0.8,
    marginBottom: 12,
    textAlign: 'center',
  },
  mainTransportRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 24,
    marginVertical: 4,
  },
  skipBtn: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#1b1e2c',
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.14)',
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 3,
  },
  playPauseBtn: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: '#2563eb',
    borderWidth: 2,
    borderColor: '#60a5fa',
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 8,
    shadowColor: '#3b82f6',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.6,
    shadowRadius: 12,
  },
  playPauseBtnPlaying: {
    backgroundColor: '#1d4ed8',
  },

  seekRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    marginTop: 16,
  },
  seekBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 9,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  seekBtnText: {
    color: '#cbd5e1',
    fontSize: 12,
    fontWeight: '700',
  },
  seekBtnIcon: {
    fontSize: 11,
  },
  spaceBtn: {
    flex: 1.1,
    paddingVertical: 9,
    borderRadius: 8,
    backgroundColor: 'rgba(59, 130, 246, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(59, 130, 246, 0.3)',
    alignItems: 'center',
  },
  spaceBtnText: {
    color: '#93c5fd',
    fontSize: 12,
    fontWeight: '700',
  },

  // Streaming Tools Grid
  toolsGrid: {
    flexDirection: 'row',
    gap: 8,
  },
  toolBtn: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  toolBtnTitle: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#e2e8f0',
  },
  toolBtnKey: {
    fontSize: 9.5,
    color: '#64748b',
    fontWeight: '600',
  },
});

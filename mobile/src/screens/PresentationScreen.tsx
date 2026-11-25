import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
} from 'react-native';
import Svg, { Path, Rect, Circle } from 'react-native-svg';
import { CyberTokens } from '../theme/cyberTokens';
import { useTheme } from '../theme/ThemeContext';
import { socketService } from '../services/SocketService';
import { hapticsService } from '../services/HapticsService';
import { settingsService } from '../services/SettingsService';

interface PresentationScreenProps {
  isFullscreen?: boolean;
  onToggleFullscreen?: () => void;
  onBack?: () => void;
  accentColor?: string;
}

export const PresentationScreen: React.FC<PresentationScreenProps> = ({
  isFullscreen,
  onToggleFullscreen,
  onBack,
  accentColor: propAccentColor,
}) => {
  const { isDark, tokens, accent } = useTheme();
  const accentColor = propAccentColor || accent.primary || tokens.emerald;
  // Timer State (Target in seconds, default 15 minutes = 900s)
  const [targetSeconds, setTargetSeconds] = useState<number>(900);
  const [secondsRemaining, setSecondsRemaining] = useState<number>(900);
  const [isTimerRunning, setIsTimerRunning] = useState<boolean>(false);
  const [notesVisible, setNotesVisible] = useState<boolean>(false);
  const [blankScreenActive, setBlankScreenActive] = useState<boolean>(false);

  // Interval alerts flags to prevent repeated buzzes
  const alerted5Min = useRef<boolean>(false);
  const alerted1Min = useRef<boolean>(false);
  const timerIntervalRef = useRef<any>(null);

  useEffect(() => {
    if (isTimerRunning) {
      timerIntervalRef.current = setInterval(() => {
        setSecondsRemaining((prev) => {
          if (prev <= 1) {
            clearInterval(timerIntervalRef.current);
            setIsTimerRunning(false);
            if (settingsService.getSettings().presentationTimerHaptics) {
              hapticsService.warning();
            }
            return 0;
          }

          // 5-minute remaining haptic alert
          if (prev === 300 && !alerted5Min.current) {
            alerted5Min.current = true;
            if (settingsService.getSettings().presentationTimerHaptics) {
              hapticsService.medium();
              setTimeout(() => hapticsService.medium(), 250);
            }
          }

          // 1-minute remaining haptic alert
          if (prev === 60 && !alerted1Min.current) {
            alerted1Min.current = true;
            if (settingsService.getSettings().presentationTimerHaptics) {
              hapticsService.medium();
              setTimeout(() => hapticsService.medium(), 200);
              setTimeout(() => hapticsService.medium(), 400);
            }
          }

          return prev - 1;
        });
      }, 1000);
    } else {
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
        timerIntervalRef.current = null;
      }
    }

    return () => {
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
      }
    };
  }, [isTimerRunning]);

  const toggleTimer = () => {
    hapticsService.light();
    setIsTimerRunning(!isTimerRunning);
  };

  const resetTimer = () => {
    hapticsService.light();
    setIsTimerRunning(false);
    setSecondsRemaining(targetSeconds);
    alerted5Min.current = false;
    alerted1Min.current = false;
  };

  const selectDuration = (secs: number) => {
    hapticsService.light();
    setIsTimerRunning(false);
    setTargetSeconds(secs);
    setSecondsRemaining(secs);
    alerted5Min.current = false;
    alerted1Min.current = false;
  };

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  // Slide navigation actions
  const handleNextSlide = () => {
    // Windows/Mac PowerPoint/Keynote standard: Right Arrow / Page Down
    socketService.key('right', 'tap');
    hapticsService.light();
  };

  const handlePrevSlide = () => {
    socketService.key('left', 'tap');
    hapticsService.light();
  };

  const handleStartSlideshow = () => {
    // F5 starts presentation from slide 1
    socketService.key('f5', 'tap');
    hapticsService.light();
  };

  const handleFromCurrentSlide = () => {
    // Shift+F5 starts presentation from current slide
    socketService.shortcut(['shift', 'f5']);
    hapticsService.light();
  };

  const handleEndSlideshow = () => {
    // Esc exits presentation mode
    socketService.key('esc', 'tap');
    hapticsService.light();
  };

  const handleToggleBlackScreen = () => {
    // B keys toggle blank black screen in PowerPoint
    socketService.key('b', 'tap');
    setBlankScreenActive(!blankScreenActive);
    hapticsService.light();
  };

  const handleToggleWhiteScreen = () => {
    // W keys toggle white screen in PowerPoint
    socketService.key('w', 'tap');
    hapticsService.light();
  };

  return (
    <View style={[styles.container, { backgroundColor: tokens.bgObsidian }]}>
      {/* Top Deck Navigation Bar */}
      <View style={[styles.topBar, { backgroundColor: tokens.bgSurface, borderBottomColor: tokens.borderSubtle }]}>
        {onBack && (
          <TouchableOpacity
            style={[styles.backBtn, { backgroundColor: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.05)', borderColor: tokens.borderSubtle }]}
            onPress={() => {
              hapticsService.light();
              onBack();
            }}
            activeOpacity={0.8}
          >
            <Svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={tokens.textSecondary} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <Path d="M19 12H5M12 19l-7-7 7-7" />
            </Svg>
            <Text style={[styles.backBtnText, { color: tokens.textWhite }]}>Hub</Text>
          </TouchableOpacity>
        )}

        <View style={styles.topCenterTitle}>
          <Text style={[styles.topTitleText, { color: tokens.textWhite }]}>Presentation Deck</Text>
        </View>

        {onToggleFullscreen && (
          <TouchableOpacity
            style={styles.actionPill}
            onPress={onToggleFullscreen}
            activeOpacity={0.8}
          >
            <Text style={styles.actionPillText}>{isFullscreen ? '✕ Exit' : '⛶'}</Text>
          </TouchableOpacity>
        )}
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Rehearsal Countdown Timer Card */}
        <View style={styles.timerCard}>
          <View style={styles.timerHeader}>
            <View style={styles.timerStatusCol}>
              <Text style={styles.timerCardLabel}>REHEARSAL TIMER</Text>
              <Text style={[styles.timerStateBadge, { color: isTimerRunning ? CyberTokens.statusConnected : CyberTokens.textSecondary }]}>
                {isTimerRunning ? '● RUNNING' : '❚❚ PAUSED'}
              </Text>
            </View>
            <View style={styles.hapticAlertBadge}>
              <Text style={styles.hapticAlertText}>Vibrates at 5m & 1m</Text>
            </View>
          </View>

          {/* Big Digital Clock Display */}
          <Text style={[styles.timerDigits, secondsRemaining <= 60 && styles.timerDigitsUrgent]}>
            {formatTime(secondsRemaining)}
          </Text>

          {/* Duration Preset Selector */}
          <View style={styles.presetRow}>
            {[
              { label: '5m', sec: 300 },
              { label: '10m', sec: 600 },
              { label: '15m', sec: 900 },
              { label: '20m', sec: 1200 },
              { label: '30m', sec: 1800 },
            ].map((p) => {
              const isSelected = targetSeconds === p.sec;
              return (
                <TouchableOpacity
                  key={p.label}
                  style={[styles.presetBtn, isSelected && [styles.presetBtnActive, { borderColor: accentColor }]]}
                  onPress={() => selectDuration(p.sec)}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.presetBtnText, isSelected && { color: accentColor, fontWeight: '700' }]}>
                    {p.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Timer Controls Row */}
          <View style={styles.timerControlsRow}>
            <TouchableOpacity
              style={[styles.timerMainBtn, { backgroundColor: isTimerRunning ? '#f59e0b' : accentColor }]}
              onPress={toggleTimer}
              activeOpacity={0.85}
            >
              <Text style={styles.timerMainBtnText}>
                {isTimerRunning ? 'Pause Timer ❚❚' : 'Start Timer ▶'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.timerResetBtn}
              onPress={resetTimer}
              activeOpacity={0.8}
            >
              <Text style={styles.timerResetBtnText}>Reset ↺</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Presentation Shortcuts Quick Toolbar */}
        <View style={styles.hotkeysCard}>
          <Text style={styles.hotkeysTitle}>SLIDESHOW SHORTCUTS</Text>
          <View style={styles.hotkeysGrid}>
            <TouchableOpacity style={styles.hotkeyBtn} onPress={handleStartSlideshow}>
              <Text style={styles.hotkeyKey}>F5</Text>
              <Text style={styles.hotkeyLabel}>Start Show</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.hotkeyBtn} onPress={handleFromCurrentSlide}>
              <Text style={styles.hotkeyKey}>⇧ F5</Text>
              <Text style={styles.hotkeyLabel}>From Current</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.hotkeyBtn} onPress={handleToggleBlackScreen}>
              <Text style={styles.hotkeyKey}>B</Text>
              <Text style={styles.hotkeyLabel}>{blankScreenActive ? 'Unhide' : 'Black Screen'}</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.hotkeyBtn} onPress={handleToggleWhiteScreen}>
              <Text style={styles.hotkeyKey}>W</Text>
              <Text style={styles.hotkeyLabel}>White Screen</Text>
            </TouchableOpacity>

            <TouchableOpacity style={[styles.hotkeyBtn, styles.hotkeyBtnDanger]} onPress={handleEndSlideshow}>
              <Text style={[styles.hotkeyKey, { color: CyberTokens.crimson }]}>Esc</Text>
              <Text style={[styles.hotkeyLabel, { color: CyberTokens.crimson }]}>End Show</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Giant Thumb-Friendly Next / Prev Slide Trigger Pads */}
        <View style={styles.padsSection}>
          {/* Previous Slide Button */}
          <TouchableOpacity
            style={styles.prevSlidePad}
            onPress={handlePrevSlide}
            activeOpacity={0.8}
          >
            <Svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#cbd5e1" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <Path d="M15 18l-6-6 6-6" />
            </Svg>
            <Text style={styles.prevSlideText}>PREV SLIDE</Text>
            <Text style={styles.slideKeyHint}>[Left / PgUp]</Text>
          </TouchableOpacity>

          {/* Next Slide Button (Prominent Glowing Pad) */}
          <TouchableOpacity
            style={[styles.nextSlidePad, { borderColor: accentColor }]}
            onPress={handleNextSlide}
            activeOpacity={0.85}
          >
            <Svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round">
              <Path d="M9 18l6-6-6-6" />
            </Svg>
            <Text style={styles.nextSlideText}>NEXT SLIDE</Text>
            <Text style={styles.nextSlideKeyHint}>[Right / PgDn / Space]</Text>
          </TouchableOpacity>
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
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: CyberTokens.borderSubtle,
    backgroundColor: CyberTokens.bgSurface,
  },
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderWidth: 1,
    borderColor: CyberTokens.borderSubtle,
  },
  backBtnText: {
    color: '#cbd5e1',
    fontSize: 12,
    fontWeight: '700',
  },
  topCenterTitle: {
    flex: 1,
    alignItems: 'center',
  },
  topTitleText: {
    fontSize: 14,
    fontWeight: '700',
    color: CyberTokens.textWhite,
  },
  actionPill: {
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
  },
  actionPillText: {
    color: CyberTokens.textSecondary,
    fontSize: 11,
    fontWeight: '700',
  },
  scrollContent: {
    padding: 14,
    paddingBottom: 28,
  },
  timerCard: {
    backgroundColor: CyberTokens.cardBase,
    borderRadius: CyberTokens.radiusLg,
    padding: 16,
    borderWidth: 1,
    borderColor: CyberTokens.borderSubtle,
    alignItems: 'center',
    marginBottom: 16,
  },
  timerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    marginBottom: 8,
  },
  timerStatusCol: {
    flexDirection: 'column',
  },
  timerCardLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: CyberTokens.textMuted,
    letterSpacing: 0.6,
  },
  timerStateBadge: {
    fontSize: 10,
    fontWeight: '700',
    marginTop: 2,
  },
  hapticAlertBadge: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: CyberTokens.borderSubtle,
  },
  hapticAlertText: {
    fontSize: 10,
    color: CyberTokens.textSecondary,
  },
  timerDigits: {
    fontSize: 48,
    fontWeight: '800',
    color: CyberTokens.textWhite,
    letterSpacing: 2,
    marginVertical: 4,
    fontVariant: ['tabular-nums'],
  },
  timerDigitsUrgent: {
    color: CyberTokens.crimson,
  },
  presetRow: {
    flexDirection: 'row',
    gap: 8,
    marginVertical: 10,
  },
  presetBtn: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderWidth: 1,
    borderColor: CyberTokens.borderSubtle,
  },
  presetBtnActive: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  presetBtnText: {
    fontSize: 12,
    color: CyberTokens.textSecondary,
    fontWeight: '600',
  },
  timerControlsRow: {
    flexDirection: 'row',
    width: '100%',
    gap: 10,
    marginTop: 6,
  },
  timerMainBtn: {
    flex: 2,
    paddingVertical: 12,
    borderRadius: CyberTokens.radiusMd,
    alignItems: 'center',
    justifyContent: 'center',
  },
  timerMainBtnText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#ffffff',
  },
  timerResetBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: CyberTokens.radiusMd,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: CyberTokens.borderSubtle,
  },
  timerResetBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: CyberTokens.textSecondary,
  },
  hotkeysCard: {
    backgroundColor: CyberTokens.cardBase,
    borderRadius: CyberTokens.radiusMd,
    padding: 12,
    borderWidth: 1,
    borderColor: CyberTokens.borderSubtle,
    marginBottom: 16,
  },
  hotkeysTitle: {
    fontSize: 10,
    fontWeight: '800',
    color: CyberTokens.textMuted,
    marginBottom: 8,
    letterSpacing: 0.5,
  },
  hotkeysGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 6,
  },
  hotkeyBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderWidth: 1,
    borderColor: CyberTokens.borderSubtle,
  },
  hotkeyBtnDanger: {
    borderColor: 'rgba(239, 68, 68, 0.3)',
  },
  hotkeyKey: {
    fontSize: 12,
    fontWeight: '800',
    color: CyberTokens.textWhite,
  },
  hotkeyLabel: {
    fontSize: 9,
    color: CyberTokens.textSecondary,
    marginTop: 2,
    textAlign: 'center',
  },
  padsSection: {
    flexDirection: 'row',
    gap: 12,
    height: 180,
  },
  prevSlidePad: {
    flex: 1,
    backgroundColor: CyberTokens.cardBase,
    borderRadius: CyberTokens.radiusLg,
    borderWidth: 1,
    borderColor: CyberTokens.borderSubtle,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
  },
  prevSlideText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#cbd5e1',
    marginTop: 8,
  },
  slideKeyHint: {
    fontSize: 10,
    color: CyberTokens.textMuted,
    marginTop: 2,
  },
  nextSlidePad: {
    flex: 1.4,
    backgroundColor: '#0f3933',
    borderRadius: CyberTokens.radiusLg,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    shadowColor: CyberTokens.emerald,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 6,
  },
  nextSlideText: {
    fontSize: 16,
    fontWeight: '900',
    color: '#ffffff',
    letterSpacing: 0.5,
    marginTop: 8,
  },
  nextSlideKeyHint: {
    fontSize: 10.5,
    color: '#a7f3d0',
    marginTop: 2,
    fontWeight: '600',
  },
});

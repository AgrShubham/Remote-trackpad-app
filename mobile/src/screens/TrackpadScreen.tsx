import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  PanResponder,
  GestureResponderEvent,
  PanResponderGestureState,
  Modal,
} from 'react-native';
import Svg, { Path, Rect, Circle, Defs, Pattern } from 'react-native-svg';
import { socketService } from '../services/SocketService';
import { hapticsService } from '../services/HapticsService';
import { audioService } from '../services/AudioService';
import { settingsService, AppSettings } from '../services/SettingsService';
import { useTheme } from '../theme/ThemeContext';

interface TrackpadScreenProps {
  isFullscreen?: boolean;
  onToggleFullscreen?: () => void;
  onBack?: () => void;
}

export const TrackpadScreen: React.FC<TrackpadScreenProps> = ({
  isFullscreen: propIsFullscreen,
  onToggleFullscreen,
  onBack,
}) => {
  const { isDark, tokens } = useTheme();
  const [appSettings, setAppSettings] = useState<AppSettings>(settingsService.getSettings());
  const appSettingsRef = useRef<AppSettings>(appSettings);
  appSettingsRef.current = appSettings;

  const [speed, setSpeed] = useState<number>(appSettings.pointerSpeed);

  React.useEffect(() => {
    const unsub = settingsService.subscribe((next) => {
      setAppSettings(next);
      setSpeed(next.pointerSpeed);
    });
    return unsub;
  }, []);
  const [isDragLocked, setIsDragLocked] = useState<boolean>(false);
  const [leftClickActive, setLeftClickActive] = useState<boolean>(false);
  const [rightClickActive, setRightClickActive] = useState<boolean>(false);
  const [localFullscreen, setLocalFullscreen] = useState<boolean>(false);
  const [isSensitivityModalOpen, setIsSensitivityModalOpen] = useState<boolean>(false);
  const [directText, setDirectText] = useState<string>('');

  const isFullscreen = propIsFullscreen !== undefined ? propIsFullscreen : localFullscreen;
  const toggleFullscreen = () => {
    if (onToggleFullscreen) {
      onToggleFullscreen();
    } else {
      setLocalFullscreen((prev) => !prev);
    }
  };

  // Gesture tracking references
  const lastTouchTime = useRef<number>(0);
  const lastTouchX = useRef<number>(0);
  const lastTouchY = useRef<number>(0);
  const touchStartTime = useRef<number>(0);
  const touchStartX = useRef<number>(0);
  const touchStartY = useRef<number>(0);
  const maxTouches = useRef<number>(0);
  const prevTouchCount = useRef<number>(0);
  const isScrolling = useRef<boolean>(false);
  const lastTapTime = useRef<number>(0);
  const lastTapX = useRef<number>(0);
  const lastTapY = useRef<number>(0);
  const isDraggingRef = useRef<boolean>(false);

  // Scroll tracking & momentum
  const lastScrollY = useRef<number>(0);
  const scrollVelocityY = useRef<number>(0);
  const inertiaRaf = useRef<number | null>(null);

  // Keep speed and drag lock in sync with refs for event loop
  const speedRef = useRef<number>(speed);
  speedRef.current = speed;

  const dragLockRef = useRef<boolean>(isDragLocked);
  dragLockRef.current = isDragLocked;

  // Slider geometry & interactive PanResponder
  const trackRef = useRef<View>(null);
  const trackWidthRef = useRef<number>(240);
  const trackPageXRef = useRef<number>(0);

  const updateSpeedFromPageX = (pageX: number) => {
    const width = trackWidthRef.current || 240;
    const x = pageX - trackPageXRef.current;
    const fraction = Math.max(0, Math.min(1, x / width));
    // Range 0.5 to 3.5 (span = 3.0)
    const newSpeed = parseFloat((0.5 + fraction * 3.0).toFixed(1));
    setSpeed(newSpeed);
  };

  const sliderPanResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (evt) => {
        updateSpeedFromPageX(evt.nativeEvent.pageX);
        hapticsService.light();
      },
      onPanResponderMove: (evt) => {
        updateSpeedFromPageX(evt.nativeEvent.pageX);
      },
      onPanResponderRelease: () => {
        hapticsService.light();
      },
    })
  ).current;

  const cancelInertia = () => {
    if (inertiaRaf.current !== null) {
      cancelAnimationFrame(inertiaRaf.current);
      inertiaRaf.current = null;
    }
  };

  const startInertia = (initialVy: number) => {
    cancelInertia();
    let vy = initialVy;
    const loop = () => {
      if (Math.abs(vy) < 0.05) {
        inertiaRaf.current = null;
        return;
      }
      socketService.scroll(0, vy);
      vy *= 0.92;
      inertiaRaf.current = requestAnimationFrame(loop);
    };
    inertiaRaf.current = requestAnimationFrame(loop);
  };

  // Center Vertical Scroll Strip PanResponder (single finger direct wheel)
  const scrollStripLastY = useRef<number>(0);
  const scrollStripPanResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (evt) => {
        scrollStripLastY.current = evt.nativeEvent.pageY;
        hapticsService.light();
      },
      onPanResponderMove: (evt) => {
        const delta = scrollStripLastY.current - evt.nativeEvent.pageY;
        scrollStripLastY.current = evt.nativeEvent.pageY;
        if (Math.abs(delta) > 0.4) {
          socketService.scroll(0, delta * 2.2);
        }
      },
    })
  ).current;

  // Direct Text Input Handler
  const handleSendDirectText = () => {
    if (directText.trim()) {
      socketService.text(directText);
      setDirectText('');
      hapticsService.light();
    }
  };

  // Natural Precision Velocity Ballistics
  const computeAcceleratedDelta = (rawDx: number, rawDy: number) => {
    const dist = Math.sqrt(rawDx * rawDx + rawDy * rawDy);
    if (dist < 0.05) return { dx: 0, dy: 0 };

    const multiplier = speedRef.current;

    // 1. Micro-aiming (dist < 1.5): True 1:1 hardware pixel precision (zero jitter/over-acceleration)
    // 2. Normal cruise (1.5 <= dist < 6.0): Gentle progressive acceleration (1.0 -> 2.2x)
    // 3. Fast flick (dist >= 6.0): Controlled kinetic boost capped at 3.5x
    let factor: number;
    if (dist < 1.5) {
      factor = 1.0;
    } else if (dist < 6.0) {
      factor = 1.0 + Math.pow((dist - 1.5) / 4.5, 1.2) * 1.2;
    } else {
      factor = 2.2 + Math.min(Math.pow((dist - 6.0) / 6.0, 1.1) * 1.3, 1.3);
    }

    return {
      dx: rawDx * factor * multiplier,
      dy: rawDy * factor * multiplier,
    };
  };

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,

      onPanResponderGrant: (evt: GestureResponderEvent) => {
        cancelInertia();

        const now = Date.now();
        const touches = evt.nativeEvent.touches;
        const numTouches = touches.length;

        maxTouches.current = numTouches;
        prevTouchCount.current = numTouches;
        isScrolling.current = false;

        touchStartTime.current = now;
        lastTouchTime.current = now;

        if (numTouches === 1) {
          const x = touches[0].pageX;
          const y = touches[0].pageY;
          touchStartX.current = x;
          touchStartY.current = y;
          lastTouchX.current = x;
          lastTouchY.current = y;

          // Double tap check for drag lock:
          // Second tap arrives within 350ms and within 45px radius of previous single tap
          const timeSinceLastTap = now - lastTapTime.current;
          const distFromLastTap = Math.hypot(x - lastTapX.current, y - lastTapY.current);

          if (appSettingsRef.current.tapAndDrag && timeSinceLastTap < 350 && distFromLastTap < 45) {
            isDraggingRef.current = true;
            setIsDragLocked(true);
            socketService.mouseDown('left');
            hapticsService.dragLock();
            lastTapTime.current = 0; // prevent re-triggering
          }
        } else if (numTouches >= 2) {
          const avgX = (touches[0].pageX + touches[1].pageX) / 2;
          const avgY = (touches[0].pageY + touches[1].pageY) / 2;
          touchStartX.current = avgX;
          touchStartY.current = avgY;
          lastTouchX.current = avgX;
          lastTouchY.current = avgY;
          lastScrollY.current = avgY;
          scrollVelocityY.current = 0;
        }
      },

      onPanResponderMove: (evt: GestureResponderEvent, _gestureState: PanResponderGestureState) => {
        const now = Date.now();
        const touches = evt.nativeEvent.touches;
        const numTouches = touches.length;

        // Keep running high-water mark of fingers involved in this gesture
        if (numTouches > maxTouches.current) {
          maxTouches.current = numTouches;
        }

        // Multi-touch transition handling:
        // When transitioning between 1 and 2+ fingers, re-anchor coordinates and suppress jump spikes!
        if (numTouches !== prevTouchCount.current) {
          prevTouchCount.current = numTouches;
          if (numTouches === 1) {
            lastTouchX.current = touches[0].pageX;
            lastTouchY.current = touches[0].pageY;
          } else if (numTouches >= 2) {
            const avgX = (touches[0].pageX + touches[1].pageX) / 2;
            const avgY = (touches[0].pageY + touches[1].pageY) / 2;
            lastTouchX.current = avgX;
            lastTouchY.current = avgY;
            lastScrollY.current = avgY;
            scrollVelocityY.current = 0;
          }
          return; // Skip delta dispatch on transition frame
        }

        if (numTouches === 1) {
          // Single finger cursor glide
          const currentX = touches[0].pageX;
          const currentY = touches[0].pageY;

          const rawDx = currentX - lastTouchX.current;
          const rawDy = currentY - lastTouchY.current;

          // Compute accelerated delta with natural ballistics
          const { dx, dy } = computeAcceleratedDelta(rawDx, rawDy);
          if (Math.abs(dx) > 0.01 || Math.abs(dy) > 0.01) {
            socketService.move(dx, dy);
          }

          lastTouchX.current = currentX;
          lastTouchY.current = currentY;
          lastTouchTime.current = now;
        } else if (numTouches >= 2) {
          // Two-finger scrolling
          const avgX = (touches[0].pageX + touches[1].pageX) / 2;
          const avgY = (touches[0].pageY + touches[1].pageY) / 2;

          const distFromStart = Math.hypot(avgX - touchStartX.current, avgY - touchStartY.current);
          if (distFromStart > 6) {
            isScrolling.current = true;
          }

          const rawDx = avgX - lastTouchX.current;
          const rawDy = avgY - lastTouchY.current;

          const scrollDir = appSettingsRef.current.naturalScrolling ? 1 : -1;
          const scrollFactor = 0.85 * appSettingsRef.current.scrollSpeed * scrollDir;
          const scrollDx = rawDx * scrollFactor;
          const scrollDy = rawDy * scrollFactor;

          if (Math.abs(scrollDx) > 0.2 || Math.abs(scrollDy) > 0.2) {
            socketService.scroll(scrollDx, scrollDy);
            scrollVelocityY.current = scrollDy;
          }

          lastTouchX.current = avgX;
          lastTouchY.current = avgY;
          lastTouchTime.current = now;
        }
      },

      onPanResponderRelease: (evt: GestureResponderEvent) => {
        const now = Date.now();
        const duration = now - touchStartTime.current;

        // 1. If currently in drag lock mode, release mouse
        if (isDraggingRef.current) {
          isDraggingRef.current = false;
          setIsDragLocked(false);
          socketService.mouseUp('left');
          hapticsService.dragLock();
          lastTapTime.current = 0;
          return;
        }

        // 2. Compute net displacement from initial touch down to release
        const changedTouches = evt.nativeEvent.changedTouches;
        const releaseX = changedTouches && changedTouches.length > 0 ? changedTouches[0].pageX : lastTouchX.current;
        const releaseY = changedTouches && changedTouches.length > 0 ? changedTouches[0].pageY : lastTouchY.current;
        const totalTravel = Math.hypot(releaseX - touchStartX.current, releaseY - touchStartY.current);

        const highestTouch = maxTouches.current;

        // Standard touch slop: displacement < 14px and tap duration < 280ms
        const isTap = duration < 280 && totalTravel < 14;

        if (isTap) {
          if (highestTouch === 1 && appSettingsRef.current.tapToClick) {
            // Single-finger tap -> Left Click
            socketService.click('left');
            hapticsService.clickLeft();
            audioService.playHapticClick();
            lastTapTime.current = now;
            lastTapX.current = releaseX;
            lastTapY.current = releaseY;
          } else if (highestTouch === 2) {
            // Two-finger tap -> Right Click
            socketService.click('right');
            hapticsService.clickRight();
            audioService.playHapticClick();
            lastTapTime.current = 0;
          } else if (highestTouch >= 3) {
            // Three-finger tap -> Middle Click
            socketService.click('middle');
            hapticsService.clickRight();
            audioService.playHapticClick();
            lastTapTime.current = 0;
          }
        } else if (highestTouch >= 2 && isScrolling.current && Math.abs(scrollVelocityY.current) > 1.0) {
          // Two-finger kinetic scroll inertia
          startInertia(scrollVelocityY.current * 0.85);
        }
      },
    })
  ).current;

  // Seamless Integrated Click Handlers
  const handleLeftPressIn = () => {
    const btn = appSettingsRef.current.swapMouseButtons ? 'right' : 'left';
    setLeftClickActive(true);
    socketService.mouseDown(btn);
    hapticsService.clickLeft();
    audioService.playHapticClick();
  };

  const handleLeftPressOut = () => {
    const btn = appSettingsRef.current.swapMouseButtons ? 'right' : 'left';
    setLeftClickActive(false);
    socketService.mouseUp(btn);
  };

  const handleRightPress = () => {
    const btn = appSettingsRef.current.swapMouseButtons ? 'left' : 'right';
    setRightClickActive(true);
    socketService.click(btn);
    hapticsService.clickRight();
    audioService.playHapticClick();
    setTimeout(() => setRightClickActive(false), 120);
  };

  return (
    <View
      style={[
        styles.container,
        { backgroundColor: tokens.bgObsidian },
        isFullscreen && styles.fullscreenContainer,
      ]}
    >
      {/* Top Floating Action Bar (Hidden in Fullscreen) */}
      {!isFullscreen && (
        <View style={styles.topBar}>
          {/* Back to Hub Button */}
          {onBack && (
            <TouchableOpacity
              style={[
                styles.backBtn,
                {
                  backgroundColor: isDark
                    ? 'rgba(255, 255, 255, 0.08)'
                    : 'rgba(0, 0, 0, 0.05)',
                  borderColor: tokens.borderSubtle,
                },
              ]}
              onPress={() => {
                hapticsService.light();
                onBack();
              }}
              activeOpacity={0.8}
            >
              <Svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke={tokens.textSecondary} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
                <Path d="M19 12H5M12 19l-7-7 7-7" />
              </Svg>
              <Text style={[styles.backBtnText, { color: tokens.textWhite }]}>Hub</Text>
            </TouchableOpacity>
          )}

          {/* Floating Sensitivity Pill - Tapping opens real-time scrubber */}
          <TouchableOpacity
            style={[
              styles.sensitivityPill,
              {
                backgroundColor: isDark
                  ? 'rgba(255, 255, 255, 0.08)'
                  : 'rgba(0, 0, 0, 0.05)',
                borderColor: tokens.borderSubtle,
              },
            ]}
            onPress={() => {
              hapticsService.light();
              setIsSensitivityModalOpen(true);
            }}
            activeOpacity={0.75}
            focusable={false}
          >
            <Svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="#60a5fa" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
              <Path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
            </Svg>
            <Text style={[styles.sensitivityPillText, { color: tokens.textSecondary }]}>{speed.toFixed(1)}× Sensitivity</Text>
            <Svg width={10} height={10} viewBox="0 0 24 24" fill="none" stroke={tokens.textMuted} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
              <Path d="M6 9l6 6 6-6" />
            </Svg>
          </TouchableOpacity>

          {/* Clean Fullscreen Action Pill */}
          <TouchableOpacity
            style={[
              styles.fullscreenBtn,
              {
                backgroundColor: isDark
                  ? 'rgba(255, 255, 255, 0.08)'
                  : 'rgba(0, 0, 0, 0.05)',
                borderColor: tokens.borderSubtle,
              },
            ]}
            onPress={toggleFullscreen}
            activeOpacity={0.8}
            focusable={false}
          >
            <Svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke={tokens.textSecondary} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
              <Path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3" />
            </Svg>
            <Text style={[styles.fullscreenBtnText, { color: tokens.textSecondary }]}>Fullscreen</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Monolithic Glass Trackpad Surface */}
      <View
        style={[
          styles.macTrackpadFrame,
          {
            backgroundColor: tokens.bgSurface,
            borderColor: tokens.borderSubtle,
          },
          isFullscreen && styles.macTrackpadFrameFullscreen,
        ]}
      >
        {/* Floating Exit Button in Fullscreen Mode */}
        {isFullscreen && (
          <TouchableOpacity
            style={styles.floatingExitBtn}
            onPress={toggleFullscreen}
            activeOpacity={0.8}
            focusable={false}
          >
            <Svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
              <Path d="M4 14h6v6m10-10h-6V4m0 6 7-7M3 21l7-7" />
            </Svg>
            <Text style={styles.floatingExitBtnText}>Exit Full</Text>
          </TouchableOpacity>
        )}

        {/* Expansive Touch Motion Zone */}
        <View style={styles.motionZone} {...panResponder.panHandlers}>
          {/* Dotted Grid Matrix Canvas */}
          <View style={StyleSheet.absoluteFillObject} pointerEvents="none">
            <Svg width="100%" height="100%">
              <Defs>
                <Pattern id="trackpad-dots" width="22" height="22" patternUnits="userSpaceOnUse">
                  <Circle cx="11" cy="11" r="1.1" fill={isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.08)'} />
                </Pattern>
              </Defs>
              <Rect width="100%" height="100%" fill="url(#trackpad-dots)" />
            </Svg>
          </View>

          {/* Minimalist In-Canvas Gesture Guide Hints */}
          <View style={styles.gestureHintBox} pointerEvents="none">
            <Text style={styles.gestureHintText}>• 1 Finger: Move & Tap Click</Text>
            <Text style={styles.gestureHintText}>• 2 Fingers: Drag Scroll & Right-Click</Text>
          </View>

          {/* Dragging Pill Indicator */}
          {isDragLocked && (
            <View style={styles.dragPill} pointerEvents="none">
              <Text style={styles.dragPillText}>DRAGGING</Text>
            </View>
          )}
        </View>

        {/* Seamless Laptop-Style Bottom Click Zones with Center Scroll Strip */}
        {appSettings.showMouseButtons && (
          <View
            style={[
              styles.seamlessClickBar,
              {
                borderTopColor: tokens.borderSubtle,
                backgroundColor: isDark
                  ? 'rgba(255, 255, 255, 0.015)'
                  : 'rgba(0, 0, 0, 0.02)',
              },
              isFullscreen && styles.seamlessClickBarFullscreen,
            ]}
          >
          {/* Left Click Zone */}
          <TouchableOpacity
            style={[styles.seamlessClickZone, leftClickActive && styles.seamlessClickActive]}
            onPressIn={handleLeftPressIn}
            onPressOut={handleLeftPressOut}
            activeOpacity={0.92}
            focusable={false}
          >
            <Svg
              width={15}
              height={15}
              viewBox="0 0 24 24"
              fill="none"
              stroke={leftClickActive ? '#ffffff' : '#60a5fa'}
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <Rect x={6} y={3} width={12} height={18} rx={6} fill={leftClickActive ? 'rgba(96, 165, 250, 0.4)' : 'none'} />
              <Path d="M6 9h6" />
              <Path d="M12 3v6" />
            </Svg>
            <Text style={[styles.seamlessClickText, { color: tokens.textSecondary }, leftClickActive && styles.seamlessClickTextActive]}>
              Left Click
            </Text>
          </TouchableOpacity>

          {/* Center Vertical Scroll Slider Strip */}
          <View
            style={[
              styles.centerScrollStrip,
              {
                backgroundColor: isDark
                  ? 'rgba(255, 255, 255, 0.04)'
                  : 'rgba(0, 0, 0, 0.03)',
                borderColor: tokens.borderSubtle,
              },
            ]}
            {...scrollStripPanResponder.panHandlers}
          >
            <Svg width={14} height={18} viewBox="0 0 24 24" fill="none" stroke="#60a5fa" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
              <Path d="M12 3v18M7 8l5-5 5 5M7 16l5 5 5-5" />
            </Svg>
            <Text style={styles.scrollStripText}>SCROLL</Text>
          </View>

          {/* Right Click Zone */}
          <TouchableOpacity
            style={[styles.seamlessClickZone, rightClickActive && styles.seamlessClickActive]}
            onPress={handleRightPress}
            activeOpacity={0.92}
            focusable={false}
          >
            <Svg
              width={15}
              height={15}
              viewBox="0 0 24 24"
              fill="none"
              stroke={rightClickActive ? '#ffffff' : '#60a5fa'}
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <Rect x={6} y={3} width={12} height={18} rx={6} fill={rightClickActive ? 'rgba(96, 165, 250, 0.4)' : 'none'} />
              <Path d="M12 9h6" />
              <Path d="M12 3v6" />
            </Svg>
            <Text style={[styles.seamlessClickText, { color: tokens.textSecondary }, rightClickActive && styles.seamlessClickTextActive]}>
              Right Click
            </Text>
          </TouchableOpacity>
          </View>
        )}
      </View>

      {/* Docked Direct Text Input Bar */}
      {!isFullscreen && (
        <View style={[styles.dockedInputBar, { backgroundColor: tokens.cardBase, borderColor: tokens.borderSubtle }]}>
          <TextInput
            style={[styles.dockedTextInput, { color: tokens.textWhite }]}
            placeholder="Type here to send directly to PC..."
            placeholderTextColor={tokens.textMuted}
            value={directText}
            onChangeText={setDirectText}
            onSubmitEditing={handleSendDirectText}
            returnKeyType="send"
          />
          <TouchableOpacity
            style={[styles.dockedSendBtn, !directText.trim() && styles.dockedSendBtnDisabled]}
            onPress={handleSendDirectText}
            disabled={!directText.trim()}
            activeOpacity={0.8}
          >
            <Text style={styles.dockedSendBtnText}>Send ↵</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Expandable Sensitivity Scrubber Modal */}
      <Modal
        visible={isSensitivityModalOpen}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setIsSensitivityModalOpen(false)}
      >
        <TouchableOpacity
          style={styles.modalBackdrop}
          activeOpacity={1}
          onPress={() => setIsSensitivityModalOpen(false)}
        >
          <TouchableOpacity
            style={styles.modalCard}
            activeOpacity={1}
            onPress={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <View style={styles.modalHeader}>
              <View style={styles.modalTitleRow}>
                <Svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="#60a5fa" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
                  <Path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
                </Svg>
                <Text style={styles.modalTitle}>Cursor Sensitivity</Text>
              </View>
              <TouchableOpacity
                style={styles.modalCloseBtn}
                onPress={() => setIsSensitivityModalOpen(false)}
                activeOpacity={0.7}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Text style={styles.modalCloseText}>✕</Text>
              </TouchableOpacity>
            </View>

            {/* Value Display */}
            <View style={styles.sliderValueRow}>
              <Text style={styles.sliderValueNumber}>{speed.toFixed(1)}×</Text>
              <View style={styles.modeBadge}>
                <Text style={styles.modeBadgeText}>
                  {speed <= 1.0 ? 'Precision' : speed <= 1.6 ? 'Balanced' : speed <= 2.4 ? 'Fast' : 'Ultra Fast'}
                </Text>
              </View>
            </View>

            {/* Draggable Scrubber Slider */}
            <View style={styles.sliderContainer} {...sliderPanResponder.panHandlers}>
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
                {/* Active Fill */}
                <View
                  style={[
                    styles.sliderFill,
                    { width: `${Math.min(100, Math.max(0, ((speed - 0.5) / 3.0) * 100))}%` },
                  ]}
                />
                {/* Glowing Knob Thumb */}
                <View
                  style={[
                    styles.sliderThumb,
                    { left: `${Math.min(100, Math.max(0, ((speed - 0.5) / 3.0) * 100))}%` },
                  ]}
                />
              </View>
            </View>

            {/* Min / Max Labels */}
            <View style={styles.sliderRangeLabels}>
              <Text style={styles.rangeText}>0.5×</Text>
              <Text style={styles.rangeHint}>Drag to adjust smoothly</Text>
              <Text style={styles.rangeText}>3.5×</Text>
            </View>

            {/* Quick Presets */}
            <View style={styles.presetsGrid}>
              {[
                { label: 'Slow', val: 1.0 },
                { label: 'Normal', val: 1.4 },
                { label: 'Fast', val: 2.0 },
                { label: 'Turbo', val: 3.0 },
              ].map((p) => {
                const isActive = Math.abs(speed - p.val) < 0.05;
                return (
                  <TouchableOpacity
                    key={p.label}
                    style={[styles.presetPill, isActive && styles.presetPillActive]}
                    onPress={() => {
                      setSpeed(p.val);
                      hapticsService.light();
                    }}
                    activeOpacity={0.8}
                  >
                    <Text style={[styles.presetPillText, isActive && styles.presetPillTextActive]}>
                      {p.val.toFixed(1)}× {p.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 8,
    backgroundColor: '#0b0c10',
    flexDirection: 'column',
    minHeight: 0,
    overflow: 'hidden',
  },
  fullscreenContainer: {
    padding: 0,
  },

  // Floating Top Action Bar
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    paddingVertical: 4,
    paddingHorizontal: 6,
    marginBottom: 6,
    flexShrink: 0,
  },
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 999,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.14)',
  },
  backBtnText: {
    color: '#e5e5ea',
    fontSize: 12,
    fontWeight: '700',
  },
  sensitivityPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 999,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.14)',
  },
  sensitivityPillText: {
    color: '#e5e5ea',
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.2,
  },
  fullscreenBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 999,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.14)',
  },
  fullscreenBtnText: {
    color: '#e5e5ea',
    fontSize: 12,
    fontWeight: '600',
  },

  // Monolithic Trackpad Glass Surface
  macTrackpadFrame: {
    flex: 1,
    minHeight: 0,
    backgroundColor: '#13141b',
    borderRadius: 22,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    overflow: 'hidden',
    position: 'relative',
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 14 },
    shadowOpacity: 0.65,
    shadowRadius: 36,
  },
  macTrackpadFrameFullscreen: {
    borderRadius: 0,
    borderWidth: 0,
    elevation: 0,
  },
  motionZone: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  gestureHintBox: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.25)',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
  },
  gestureHintText: {
    fontSize: 11,
    color: '#64748b',
    fontWeight: '500',
    marginVertical: 1,
  },
  dragPill: {
    position: 'absolute',
    top: 14,
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 999,
    backgroundColor: 'rgba(245, 158, 11, 0.18)',
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.4)',
  },
  dragPillText: {
    color: '#fbbf24',
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.5,
  },

  floatingExitBtn: {
    position: 'absolute',
    top: 14,
    right: 14,
    zIndex: 99,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 999,
    backgroundColor: 'rgba(26, 28, 38, 0.85)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.16)',
    elevation: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 8,
  },
  floatingExitBtnText: {
    color: '#e5e5ea',
    fontSize: 11.5,
    fontWeight: '600',
  },

  // Seamless Monolithic Click Zones
  seamlessClickBar: {
    height: 60,
    minHeight: 60,
    flexShrink: 0,
    flexDirection: 'row',
    alignItems: 'stretch',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.08)',
    backgroundColor: 'rgba(255, 255, 255, 0.015)',
  },
  seamlessClickBarFullscreen: {
    height: 72,
    minHeight: 72,
    paddingBottom: 6,
    backgroundColor: '#0e0f14',
  },
  seamlessClickZone: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: 'transparent',
  },
  seamlessClickActive: {
    backgroundColor: 'rgba(79, 140, 255, 0.16)',
  },
  seamlessDivider: {
    width: 1,
    height: '60%',
    alignSelf: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
  },
  seamlessClickText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#8b8d9c',
    letterSpacing: 0.3,
  },
  seamlessClickTextActive: {
    color: '#60a5fa',
    fontWeight: '700',
  },
  centerScrollStrip: {
    width: 60,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  scrollStripText: {
    fontSize: 9,
    fontWeight: '700',
    color: '#60a5fa',
    marginTop: 2,
    letterSpacing: 0.5,
  },

  // Docked Direct Text Input Bar
  dockedInputBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#12141f',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    marginTop: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    gap: 8,
  },
  dockedTextInput: {
    flex: 1,
    color: '#ffffff',
    fontSize: 13,
    paddingVertical: 6,
    paddingHorizontal: 8,
  },
  dockedSendBtn: {
    backgroundColor: '#14b8a6',
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  dockedSendBtnDisabled: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
  },
  dockedSendBtnText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '700',
  },

  // Sensitivity Scrubber Modal Styles
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalCard: {
    width: '100%',
    maxWidth: 340,
    backgroundColor: '#161722',
    borderRadius: 22,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    padding: 20,
    elevation: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.7,
    shadowRadius: 30,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  modalTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  modalTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#ffffff',
    letterSpacing: 0.2,
  },
  modalCloseBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalCloseText: {
    color: '#9ca3af',
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 15,
  },

  sliderValueRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 10,
    marginBottom: 14,
  },
  sliderValueNumber: {
    fontSize: 34,
    fontWeight: '800',
    color: '#60a5fa',
    letterSpacing: -0.5,
  },
  modeBadge: {
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 6,
    backgroundColor: 'rgba(96, 165, 250, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(96, 165, 250, 0.3)',
  },
  modeBadgeText: {
    color: '#93c5fd',
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
  },

  // Interactive Slider Hit Area
  sliderContainer: {
    height: 40,
    justifyContent: 'center',
  },
  sliderTrack: {
    height: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 4,
    position: 'relative',
    justifyContent: 'center',
  },
  sliderFill: {
    height: '100%',
    backgroundColor: '#3b82f6',
    borderRadius: 4,
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

  sliderRangeLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 6,
    marginBottom: 16,
  },
  rangeText: {
    fontSize: 11,
    color: '#6b7280',
    fontWeight: '600',
  },
  rangeHint: {
    fontSize: 10.5,
    color: '#4b5563',
  },

  presetsGrid: {
    flexDirection: 'row',
    gap: 6,
    justifyContent: 'space-between',
  },
  presetPill: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    alignItems: 'center',
  },
  presetPillActive: {
    backgroundColor: 'rgba(59, 130, 246, 0.2)',
    borderColor: '#3b82f6',
  },
  presetPillText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#9ca3af',
  },
  presetPillTextActive: {
    color: '#60a5fa',
    fontWeight: '700',
  },
});

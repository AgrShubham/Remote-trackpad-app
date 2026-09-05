import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  PanResponder,
  GestureResponderEvent,
  PanResponderGestureState,
} from 'react-native';
import Svg, { Path, Rect } from 'react-native-svg';
import { Colors } from '../theme/colors';
import { socketService } from '../services/SocketService';
import { hapticsService } from '../services/HapticsService';
import { audioService } from '../services/AudioService';

interface TrackpadScreenProps {
  isFullscreen?: boolean;
  onToggleFullscreen?: () => void;
}

export const TrackpadScreen: React.FC<TrackpadScreenProps> = ({
  isFullscreen: propIsFullscreen,
  onToggleFullscreen,
}) => {
  const [speed, setSpeed] = useState<number>(1.5);
  const [isDragLocked, setIsDragLocked] = useState<boolean>(false);
  const [leftClickActive, setLeftClickActive] = useState<boolean>(false);
  const [rightClickActive, setRightClickActive] = useState<boolean>(false);
  const [localFullscreen, setLocalFullscreen] = useState<boolean>(false);

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
  const touchCount = useRef<number>(0);
  const hasMoved = useRef<boolean>(false);
  const lastTapTime = useRef<number>(0);
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

  // macOS Piecewise Velocity Acceleration Ballistics
  const computeAcceleratedDelta = (rawDx: number, rawDy: number, dt: number) => {
    const safeDt = Math.max(dt, 4);
    const dist = Math.sqrt(rawDx * rawDx + rawDy * rawDy);
    const v = dist / safeDt;

    let curveFactor: number;
    if (v < 0.25) {
      curveFactor = 0.85 + (v / 0.25) * 0.25;
    } else if (v < 1.20) {
      curveFactor = 1.10 + Math.pow((v - 0.25) / 0.95, 1.35) * 1.20;
    } else {
      curveFactor = 2.30 + Math.min((v - 1.20) * 1.50, 2.00);
    }

    const multiplier = speedRef.current;
    return {
      dx: rawDx * curveFactor * multiplier,
      dy: rawDy * curveFactor * multiplier,
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
        touchCount.current = touches.length;
        hasMoved.current = false;

        touchStartTime.current = now;
        lastTouchTime.current = now;

        if (touches.length === 1) {
          touchStartX.current = touches[0].pageX;
          touchStartY.current = touches[0].pageY;
          lastTouchX.current = touches[0].pageX;
          lastTouchY.current = touches[0].pageY;

          // Double tap check for drag lock
          if (now - lastTapTime.current < 300) {
            isDraggingRef.current = true;
            setIsDragLocked(true);
            socketService.mouseDown('left');
            hapticsService.dragLock();
          }
        } else if (touches.length === 2) {
          lastTouchX.current = (touches[0].pageX + touches[1].pageX) / 2;
          lastTouchY.current = (touches[0].pageY + touches[1].pageY) / 2;
          lastScrollY.current = lastTouchY.current;
          scrollVelocityY.current = 0;
        }
      },

      onPanResponderMove: (evt: GestureResponderEvent, gestureState: PanResponderGestureState) => {
        const now = Date.now();
        const dt = now - lastTouchTime.current;
        const touches = evt.nativeEvent.touches;

        if (touches.length === 1) {
          // Single finger cursor glide
          const currentX = touches[0].pageX;
          const currentY = touches[0].pageY;

          const rawDx = currentX - lastTouchX.current;
          const rawDy = currentY - lastTouchY.current;

          if (Math.abs(rawDx) > 0.1 || Math.abs(rawDy) > 0.1) {
            hasMoved.current = true;
            const { dx, dy } = computeAcceleratedDelta(rawDx, rawDy, dt);
            socketService.move(dx, dy);
          }

          lastTouchX.current = currentX;
          lastTouchY.current = currentY;
          lastTouchTime.current = now;
        } else if (touches.length >= 2) {
          // Two finger scrolling
          hasMoved.current = true;
          const avgY = (touches[0].pageY + touches[1].pageY) / 2;
          const avgX = (touches[0].pageX + touches[1].pageX) / 2;

          const rawDy = avgY - lastTouchY.current;
          const rawDx = avgX - lastTouchX.current;

          const scrollFactor = 0.75 * speedRef.current;
          const scrollDx = rawDx * scrollFactor;
          const scrollDy = rawDy * scrollFactor;

          if (Math.abs(scrollDx) > 0.3 || Math.abs(scrollDy) > 0.3) {
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

        // If in drag lock mode, release mouse
        if (isDraggingRef.current) {
          isDraggingRef.current = false;
          setIsDragLocked(false);
          socketService.mouseUp('left');
          hapticsService.dragLock();
          return;
        }

        if (!hasMoved.current && duration < 250) {
          if (touchCount.current === 1) {
            // Single finger tap -> Left Click
            socketService.click('left');
            hapticsService.clickLeft();
            audioService.playHapticClick();
            lastTapTime.current = now;
          } else if (touchCount.current === 2) {
            // Two finger tap -> Right Click
            socketService.click('right');
            hapticsService.clickRight();
            audioService.playHapticClick();
          }
        } else if (touchCount.current >= 2 && Math.abs(scrollVelocityY.current) > 1.2) {
          // Start momentum scroll glide
          startInertia(scrollVelocityY.current * 0.85);
        }
      },
    })
  ).current;

  // Integrated Click Strips
  const handleLeftPressIn = () => {
    setLeftClickActive(true);
    socketService.mouseDown('left');
    hapticsService.clickLeft();
    audioService.playHapticClick();
  };

  const handleLeftPressOut = () => {
    setLeftClickActive(false);
    socketService.mouseUp('left');
  };

  const handleRightPress = () => {
    setRightClickActive(true);
    socketService.click('right');
    hapticsService.clickRight();
    audioService.playHapticClick();
    setTimeout(() => setRightClickActive(false), 120);
  };

  return (
    <View style={[styles.container, isFullscreen && styles.fullscreenContainer]}>
      {/* Trackpad Toolbar - Hidden in Fullscreen so ONLY trackpad and buttons are visible */}
      {!isFullscreen && (
        <View style={styles.toolbar}>
          <View style={styles.toolbarLeft}>
            <Text style={styles.toolbarLabel}>SPEED</Text>
            <View style={styles.speedControl}>
              <TouchableOpacity
                style={styles.speedBtn}
                onPress={() => setSpeed((s) => Math.max(0.5, parseFloat((s - 0.2).toFixed(1))))}
                activeOpacity={0.8}
                focusable={false}
              >
                <Text style={styles.speedBtnText}>−</Text>
              </TouchableOpacity>

              <View style={styles.speedTrack}>
                <View
                  style={[
                    styles.speedFill,
                    { width: `${Math.min(100, Math.max(0, ((speed - 0.5) / (3.5 - 0.5)) * 100))}%` },
                  ]}
                />
              </View>

              <TouchableOpacity
                style={styles.speedBtn}
                onPress={() => setSpeed((s) => Math.min(3.5, parseFloat((s + 0.2).toFixed(1))))}
                activeOpacity={0.8}
                focusable={false}
              >
                <Text style={styles.speedBtnText}>+</Text>
              </TouchableOpacity>
            </View>
            <Text style={styles.speedValue}>{speed.toFixed(1)}×</Text>
          </View>

          <TouchableOpacity
            style={styles.fullscreenBtn}
            onPress={toggleFullscreen}
            activeOpacity={0.8}
            focusable={false}
          >
            <Svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="#e5e5ea" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
              <Path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3" />
            </Svg>
            <Text style={styles.fullscreenBtnText}>Fullscreen</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Monolithic Glass Trackpad Frame - 100% Matching templates/index.html lines 1534-1562 */}
      <View style={[styles.macTrackpadFrame, isFullscreen && styles.macTrackpadFrameFullscreen]}>
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

        <View style={styles.motionZone} {...panResponder.panHandlers}>
          {/* Dashed Center Crosshair (templates/index.html line 1536) */}
          <View style={styles.centerMark} pointerEvents="none">
            <View style={styles.centerMarkDot} />
          </View>

          {/* Dragging Pill Indicator (templates/index.html line 1537) */}
          {isDragLocked && (
            <View style={styles.dragPill} pointerEvents="none">
              <Text style={styles.dragPillText}>DRAGGING</Text>
            </View>
          )}
        </View>

        {/* Integrated Bottom Click Bar (templates/index.html lines 1541-1561) */}
        <View style={[styles.clickStrip, isFullscreen && styles.clickStripFullscreen]}>
          <View style={styles.clickDivider} pointerEvents="none" />

          {/* Left Click Zone with exact Mouse SVG */}
          <TouchableOpacity
            style={[styles.clickZone, leftClickActive && styles.clickZoneActive]}
            onPressIn={handleLeftPressIn}
            onPressOut={handleLeftPressOut}
            activeOpacity={0.92}
            focusable={false}
          >
            <Svg
              width={16}
              height={16}
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
            <Text style={[styles.clickZoneText, leftClickActive && styles.clickZoneTextActive]}>
              Left Click
            </Text>
          </TouchableOpacity>

          {/* Right Click Zone with exact Mouse SVG */}
          <TouchableOpacity
            style={[styles.clickZone, rightClickActive && styles.clickZoneActive]}
            onPress={handleRightPress}
            activeOpacity={0.92}
            focusable={false}
          >
            <Svg
              width={16}
              height={16}
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
            <Text style={[styles.clickZoneText, rightClickActive && styles.clickZoneTextActive]}>
              Right Click
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Gesture Guide Footer - 100% Matching templates/index.html lines 1565-1571 */}
      {!isFullscreen && (
        <View style={styles.guideBar}>
          <Text style={styles.guideText}>1-Finger: Move / Tap</Text>
          <Text style={styles.guideSep}>•</Text>
          <Text style={styles.guideText}>2-Finger: Scroll / Right-Click</Text>
          <Text style={styles.guideSep}>•</Text>
          <Text style={styles.guideText}>Bottom: Click Zones</Text>
        </View>
      )}
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
  // Toolbar styles matching .trackpad-toolbar
  toolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    paddingVertical: 6,
    paddingHorizontal: 12,
    backgroundColor: 'rgba(22, 23, 31, 0.85)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 12,
    marginBottom: 6,
    flexShrink: 0,
  },
  toolbarFullscreen: {
    borderRadius: 0,
    borderWidth: 0,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
    backgroundColor: 'rgba(14, 15, 21, 0.96)',
    marginBottom: 0,
  },
  toolbarLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
    minWidth: 0,
  },
  toolbarLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#8b8d9c',
    textTransform: 'uppercase',
    letterSpacing: 0.55,
  },
  speedControl: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    flex: 1,
    maxWidth: 130,
  },
  speedBtn: {
    width: 22,
    height: 22,
    borderRadius: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  speedBtnText: {
    color: '#f5f5f7',
    fontSize: 14,
    fontWeight: '600',
    lineHeight: 16,
  },
  speedTrack: {
    flex: 1,
    height: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    borderRadius: 2,
    overflow: 'hidden',
  },
  speedFill: {
    height: '100%',
    backgroundColor: '#4f8cff',
    borderRadius: 2,
  },
  speedValue: {
    fontSize: 11,
    fontWeight: '600',
    color: '#f5f5f7',
    minWidth: 28,
  },
  fullscreenBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 5,
    paddingHorizontal: 12,
    borderRadius: 999,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.16)',
  },
  fullscreenBtnActive: {
    backgroundColor: 'rgba(52, 211, 153, 0.15)',
    borderColor: 'rgba(52, 211, 153, 0.4)',
  },
  fullscreenBtnText: {
    color: '#e5e5ea',
    fontSize: 11.5,
    fontWeight: '600',
  },
  fullscreenBtnTextActive: {
    color: '#34d399',
  },

  // Monolithic Trackpad Glass Surface matching .mac-trackpad-frame
  macTrackpadFrame: {
    flex: 1,
    minHeight: 0,
    backgroundColor: '#13141b',
    borderRadius: 20,
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
  centerMark: {
    width: 46,
    height: 46,
    borderRadius: 23,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    opacity: 0.5,
  },
  centerMarkDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
  },
  dragPill: {
    position: 'absolute',
    top: 12,
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

  // Bottom Click Bar matching .trackpad-click-strip
  clickStrip: {
    height: 72,
    minHeight: 72,
    flexShrink: 0,
    position: 'relative',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 6,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.12)',
    backgroundColor: '#161821',
  },
  clickStripFullscreen: {
    height: 80,
    minHeight: 80,
    paddingBottom: 8,
    backgroundColor: '#12131a',
  },
  clickDivider: {
    position: 'absolute',
    top: '14%',
    bottom: '14%',
    left: '50%',
    width: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.18)',
    zIndex: 2,
  },
  clickZone: {
    flex: 1,
    height: 54,
    marginHorizontal: 4,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: 14,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    elevation: 3,
  },
  clickZoneActive: {
    backgroundColor: 'rgba(79, 140, 255, 0.28)',
    borderColor: 'rgba(79, 140, 255, 0.85)',
    shadowColor: '#4f8cff',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 8,
    elevation: 4,
    transform: [{ scale: 0.98 }],
  },
  clickZoneText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#ffffff',
  },
  clickZoneTextActive: {
    color: '#ffffff',
  },

  // Guide Bar matching .trackpad-guide-bar
  guideBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 5,
    paddingHorizontal: 8,
    backgroundColor: 'rgba(18, 19, 26, 0.85)',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    marginTop: 6,
    flexShrink: 0,
  },
  guideText: {
    fontSize: 10.5,
    fontWeight: '500',
    color: '#9da0b5',
  },
  guideSep: {
    marginHorizontal: 6,
    color: '#9da0b5',
    opacity: 0.35,
  },
});

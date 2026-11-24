import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  PanResponder,
  GestureResponderEvent,
} from 'react-native';
import Svg, { Rect, Circle, Defs, Pattern } from 'react-native-svg';
import { socketService } from '../services/SocketService';
import { hapticsService } from '../services/HapticsService';
import { useTheme } from '../theme/ThemeContext';
import { Keycap } from '../components/Keycap';

interface KeyboardScreenProps {
  isFullscreen?: boolean;
  onToggleFullscreen?: () => void;
  onBack?: () => void;
}

export const KeyboardScreen: React.FC<KeyboardScreenProps> = ({
  isFullscreen,
  onToggleFullscreen,
  onBack,
}) => {
  const { isDark, tokens } = useTheme();
  const [typedText, setTypedText] = useState('');
  const [activeDeck, setActiveDeck] = useState<'qwerty' | 'nav'>('qwerty');
  const [isShiftActive, setIsShiftActive] = useState(false);
  const [isCapsActive, setIsCapsActive] = useState(false);
  const [isCtrlLatched, setIsCtrlLatched] = useState(false);
  const [isAltLatched, setIsAltLatched] = useState(false);
  const [isQuickTextOpen, setIsQuickTextOpen] = useState(false);

  // Trackpad States
  const [speed, setSpeed] = useState<number>(1.4);
  const [leftActive, setLeftActive] = useState<boolean>(false);
  const [rightActive, setRightActive] = useState<boolean>(false);

  // Precision Trackpad Gesture Engine
  const lastTouchTime = useRef<number>(0);
  const lastTouchX = useRef<number>(0);
  const lastTouchY = useRef<number>(0);
  const touchStartTime = useRef<number>(0);
  const touchStartX = useRef<number>(0);
  const touchStartY = useRef<number>(0);
  const maxTouches = useRef<number>(0);
  const prevTouchCount = useRef<number>(0);
  const isScrolling = useRef<boolean>(false);
  const isDraggingRef = useRef<boolean>(false);

  const lastScrollY = useRef<number>(0);
  const inertiaRaf = useRef<number | null>(null);

  const speedRef = useRef<number>(speed);
  speedRef.current = speed;

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

  // Velocity Ballistics
  const computeAcceleratedDelta = (rawDx: number, rawDy: number) => {
    const dist = Math.sqrt(rawDx * rawDx + rawDy * rawDy);
    if (dist < 0.05) return { dx: 0, dy: 0 };

    const multiplier = speedRef.current;
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

  const trackpadPanResponder = useRef(
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
        } else if (numTouches === 2) {
          const avgY = (touches[0].pageY + touches[1].pageY) / 2;
          lastScrollY.current = avgY;
        }
      },

      onPanResponderMove: (evt: GestureResponderEvent) => {
        const now = Date.now();
        const touches = evt.nativeEvent.touches;
        const numTouches = touches.length;

        if (numTouches > maxTouches.current) {
          maxTouches.current = numTouches;
        }

        if (numTouches !== prevTouchCount.current) {
          prevTouchCount.current = numTouches;
          if (numTouches === 1) {
            lastTouchX.current = touches[0].pageX;
            lastTouchY.current = touches[0].pageY;
            lastTouchTime.current = now;
          } else if (numTouches === 2) {
            lastScrollY.current = (touches[0].pageY + touches[1].pageY) / 2;
          }
          return;
        }

        // Two-Finger Natural Scrolling
        if (numTouches === 2) {
          const avgY = (touches[0].pageY + touches[1].pageY) / 2;
          const deltaY = lastScrollY.current - avgY;
          lastScrollY.current = avgY;

          if (Math.abs(deltaY) > 0.4) {
            isScrolling.current = true;
            const scrollScale = 1.8;
            socketService.scroll(0, deltaY * scrollScale);
          }
          return;
        }

        // Single-Finger Precision Cursor Tracking
        if (numTouches === 1) {
          const x = touches[0].pageX;
          const y = touches[0].pageY;
          const rawDx = x - lastTouchX.current;
          const rawDy = y - lastTouchY.current;

          lastTouchX.current = x;
          lastTouchY.current = y;
          lastTouchTime.current = now;

          if (Math.abs(rawDx) > 0.1 || Math.abs(rawDy) > 0.1) {
            const { dx, dy } = computeAcceleratedDelta(rawDx, rawDy);
            socketService.move(dx, dy);
          }
        }
      },

      onPanResponderRelease: (evt: GestureResponderEvent) => {
        const now = Date.now();
        const duration = now - touchStartTime.current;
        const highestTouchCount = maxTouches.current;

        // Two-Finger Tap -> Right Click
        if (highestTouchCount === 2 && !isScrolling.current && duration < 320) {
          socketService.click('right');
          hapticsService.light();
          return;
        }

        // Single-Finger Tap -> Left Click
        if (highestTouchCount === 1) {
          const totalDx = Math.abs(evt.nativeEvent.pageX - touchStartX.current);
          const totalDy = Math.abs(evt.nativeEvent.pageY - touchStartY.current);
          const totalDist = Math.sqrt(totalDx * totalDx + totalDy * totalDy);

          if (totalDist < 8 && duration < 280) {
            socketService.click('left');
            hapticsService.light();
          }
        }
      },
    })
  ).current;

  const handleSendText = () => {
    if (typedText) {
      socketService.text(typedText);
      setTypedText('');
      hapticsService.light();
    }
  };

  const handleKeyPress = (code: string) => {
    const isShifted = isShiftActive !== isCapsActive;

    // Modifiers
    if (code === 'shift') {
      setIsShiftActive(!isShiftActive);
      return;
    }
    if (code === 'caps_lock') {
      setIsCapsActive(!isCapsActive);
      socketService.key('caps_lock', 'tap');
      return;
    }
    if (code === 'ctrl') {
      const next = !isCtrlLatched;
      setIsCtrlLatched(next);
      if (next) socketService.key('ctrl', 'press');
      else socketService.key('ctrl', 'release');
      return;
    }
    if (code === 'alt') {
      const next = !isAltLatched;
      setIsAltLatched(next);
      if (next) socketService.key('alt', 'press');
      else socketService.key('alt', 'release');
      return;
    }

    // Quick PC shortcut macros
    if (code === 'shortcut_copy') {
      socketService.shortcut(['ctrl', 'c']);
      hapticsService.light();
      return;
    }
    if (code === 'shortcut_paste') {
      socketService.shortcut(['ctrl', 'v']);
      hapticsService.light();
      return;
    }
    if (code === 'shortcut_undo') {
      socketService.shortcut(['ctrl', 'z']);
      hapticsService.light();
      return;
    }
    if (code === 'shortcut_select_all') {
      socketService.shortcut(['ctrl', 'a']);
      hapticsService.light();
      return;
    }
    if (code === 'shortcut_win_d') {
      socketService.shortcut(['win', 'd']);
      hapticsService.light();
      return;
    }
    if (code === 'shortcut_alt_tab') {
      socketService.shortcut(['alt', 'tab']);
      hapticsService.light();
      return;
    }

    // Special Keys
    const specialKeys = [
      'enter', 'backspace', 'tab', 'esc', 'space',
      'up', 'down', 'left', 'right', 'delete',
      'f1', 'f2', 'f3', 'f4', 'f5', 'f6', 'f7', 'f8', 'f9', 'f10', 'f11', 'f12',
      'home', 'end', 'page_up', 'page_down', 'print_screen', 'insert', 'pause', 'cmd',
    ];

    if (specialKeys.includes(code.toLowerCase())) {
      socketService.key(code.toLowerCase(), 'tap');
    } else {
      let charToSend = code;
      if (charToSend.length === 1) {
        charToSend = isShifted ? charToSend.toUpperCase() : charToSend.toLowerCase();
      }
      socketService.key(charToSend, 'tap');
    }

    if (isShiftActive) {
      setIsShiftActive(false);
    }
    if (isCtrlLatched) {
      setIsCtrlLatched(false);
      socketService.key('ctrl', 'release');
    }
    if (isAltLatched) {
      setIsAltLatched(false);
      socketService.key('alt', 'release');
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: tokens.bgObsidian }, isFullscreen && styles.containerFullscreen]}>
      {/* ================= 1. UPPER PRECISION TRACKPAD (flex: 1) ================= */}
      <View style={[styles.trackpadSection, { backgroundColor: tokens.cardBase, borderColor: tokens.borderSubtle }]}>
        <View style={[styles.touchSurface, { backgroundColor: tokens.bgSurface }]} {...trackpadPanResponder.panHandlers}>
          {/* Subtle Dot Matrix Pattern */}
          <View style={StyleSheet.absoluteFillObject} pointerEvents="none">
            <Svg width="100%" height="100%">
              <Defs>
                <Pattern id="kb-trackpad-dots" width="16" height="16" patternUnits="userSpaceOnUse">
                  <Circle cx="8" cy="8" r="1.1" fill={isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.08)'} />
                </Pattern>
              </Defs>
              <Rect width="100%" height="100%" fill="url(#kb-trackpad-dots)" />
            </Svg>
          </View>

          {/* Centered Ergonomic Gesture Guide */}
          <View style={[styles.gestureHintBadge, { backgroundColor: isDark ? 'rgba(18, 20, 31, 0.85)' : 'rgba(255, 255, 255, 0.90)', borderColor: tokens.borderSubtle }]} pointerEvents="none">
            <Text style={[styles.gestureHintText, { color: tokens.textSecondary }]}>
              • 1 Finger: Move & Tap Click  • 2 Fingers: Drag Scroll & Right-Click
            </Text>
          </View>
        </View>

        {/* Integrated Trackpad Action Strip (Click buttons + Vertical Scroll Wheel + Speed) */}
        <View style={[styles.trackpadActionStrip, { backgroundColor: tokens.cardElevated, borderTopColor: tokens.borderSubtle }]}>
          <TouchableOpacity
            style={[styles.clickBtn, leftActive && styles.clickBtnActive]}
            onPressIn={() => {
              setLeftActive(true);
              socketService.mouseDown('left');
              hapticsService.light();
            }}
            onPressOut={() => {
              setLeftActive(false);
              socketService.mouseUp('left');
            }}
            activeOpacity={0.85}
          >
            <Text style={styles.clickBtnText}>🖱️ Left</Text>
          </TouchableOpacity>

          {/* Direct Vertical Scroll Slider */}
          <View style={styles.scrollStrip} {...scrollStripPanResponder.panHandlers}>
            <Text style={styles.scrollStripText}>↕ SCROLL</Text>
          </View>

          <TouchableOpacity
            style={[styles.clickBtn, rightActive && styles.clickBtnActive]}
            onPressIn={() => {
              setRightActive(true);
              socketService.mouseDown('right');
              hapticsService.light();
            }}
            onPressOut={() => {
              setRightActive(false);
              socketService.mouseUp('right');
            }}
            activeOpacity={0.85}
          >
            <Text style={styles.clickBtnText}>Right 🖱️</Text>
          </TouchableOpacity>

          {/* Sensitivity Speed Pill */}
          <TouchableOpacity
            style={styles.speedPill}
            onPress={() => {
              const next = speed === 1.0 ? 1.4 : speed === 1.4 ? 2.0 : 1.0;
              setSpeed(next);
              hapticsService.light();
            }}
            activeOpacity={0.8}
          >
            <Text style={styles.speedPillText}>{speed}×</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* ================= 2. MIDDLE UTILITY RIBBON (Above Keyboard) ================= */}
      <View style={styles.utilityRibbon}>
        <View style={styles.utilityLeftGroup}>
          <Keycap label="⎋ Esc" code="esc" widthFactor={1.0} height={35} type="utility" accentColor="#f87171" onPress={handleKeyPress} />
          <Keycap label="⇥ Tab" code="tab" widthFactor={1.0} height={35} type="utility" onPress={handleKeyPress} />
          <Keycap label="⌦ Del" code="delete" widthFactor={1.0} height={35} type="utility" onPress={handleKeyPress} />
          <Keycap
            label="Caps"
            code="caps_lock"
            widthFactor={1.0}
            height={35}
            hasLed
            ledOn={isCapsActive}
            type="utility"
            onPress={handleKeyPress}
          />
        </View>

        <View style={styles.utilityRightGroup}>
          {/* Quick Text Input Drawer Toggle */}
          <TouchableOpacity
            style={[styles.utilityActionBtn, isQuickTextOpen && styles.utilityActionBtnActive]}
            onPress={() => {
              setIsQuickTextOpen(!isQuickTextOpen);
              hapticsService.light();
            }}
            activeOpacity={0.8}
          >
            <Text style={[styles.utilityActionBtnText, isQuickTextOpen && styles.utilityActionBtnTextActive]}>
              📋 Text
            </Text>
          </TouchableOpacity>

          {/* QWERTY vs Nav/F-Keys Switcher */}
          <TouchableOpacity
            style={[styles.utilityActionBtn, activeDeck === 'nav' && styles.deckPillActive]}
            onPress={() => {
              setActiveDeck(activeDeck === 'qwerty' ? 'nav' : 'qwerty');
              hapticsService.light();
            }}
            activeOpacity={0.8}
          >
            <Text style={[styles.utilityActionBtnText, activeDeck === 'nav' && styles.deckPillTextActive]}>
              {activeDeck === 'qwerty' ? '⚡ F-Keys' : '🔤 QWERTY'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Expandable Direct Text Drawer */}
      {isQuickTextOpen && (
        <View style={styles.quickTextDrawer}>
          <TextInput
            style={[
              styles.textInput,
              {
                backgroundColor: tokens.cardBase,
                borderColor: tokens.borderSubtle,
                color: tokens.textWhite,
              },
            ]}
            placeholder="Type or dictate text to send to PC..."
            placeholderTextColor={tokens.textMuted}
            value={typedText}
            onChangeText={setTypedText}
            onSubmitEditing={handleSendText}
            returnKeyType="send"
            autoFocus={true}
          />
          <TouchableOpacity
            style={styles.sendBtn}
            onPress={handleSendText}
            activeOpacity={0.85}
          >
            <Text style={styles.sendBtnText}>Send ↵</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* ================= 3. BOTTOM-DOCKED GBOARD KEYBOARD CHASSIS ================= */}
      <View
        style={[
          styles.keyboardChassis,
          {
            backgroundColor: isDark ? '#0e1017' : '#e2e8f0',
            borderColor: tokens.borderSubtle,
          },
        ]}
      >
        {activeDeck === 'qwerty' ? (
          <>
            {/* Row 1: Numbers & Symbols */}
            <View style={styles.row}>
              <Keycap label="1" subLabel="!" code="1" height={40} onPress={handleKeyPress} />
              <Keycap label="2" subLabel="@" code="2" height={40} onPress={handleKeyPress} />
              <Keycap label="3" subLabel="#" code="3" height={40} onPress={handleKeyPress} />
              <Keycap label="4" subLabel="$" code="4" height={40} onPress={handleKeyPress} />
              <Keycap label="5" subLabel="%" code="5" height={40} onPress={handleKeyPress} />
              <Keycap label="6" subLabel="^" code="6" height={40} onPress={handleKeyPress} />
              <Keycap label="7" subLabel="&" code="7" height={40} onPress={handleKeyPress} />
              <Keycap label="8" subLabel="*" code="8" height={40} onPress={handleKeyPress} />
              <Keycap label="9" subLabel="(" code="9" height={40} onPress={handleKeyPress} />
              <Keycap label="0" subLabel=")" code="0" height={40} onPress={handleKeyPress} />
            </View>

            {/* Row 2: QWERTY */}
            <View style={styles.row}>
              {['Q', 'W', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P'].map((k) => (
                <Keycap
                  key={k}
                  label={isShiftActive !== isCapsActive ? k : k.toLowerCase()}
                  code={k.toLowerCase()}
                  height={44}
                  onPress={handleKeyPress}
                />
              ))}
            </View>

            {/* Row 3: Home Row (A-L + ;) */}
            <View style={styles.row}>
              <View style={styles.spacerQuarter} />
              {['A', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L'].map((k) => (
                <Keycap
                  key={k}
                  label={isShiftActive !== isCapsActive ? k : k.toLowerCase()}
                  code={k.toLowerCase()}
                  height={44}
                  onPress={handleKeyPress}
                />
              ))}
              <Keycap label=";" subLabel=":" code=";" height={44} onPress={handleKeyPress} />
              <View style={styles.spacerQuarter} />
            </View>

            {/* Row 4: Shift, Bottom Row Letters & Backspace */}
            <View style={styles.row}>
              <Keycap
                label="⇧ Shift"
                code="shift"
                widthFactor={1.35}
                height={44}
                type="modifier"
                hasLed
                ledOn={isShiftActive}
                isLatched={isShiftActive}
                onPress={handleKeyPress}
              />
              {['Z', 'X', 'C', 'V', 'B', 'N', 'M'].map((k) => (
                <Keycap
                  key={k}
                  label={isShiftActive !== isCapsActive ? k : k.toLowerCase()}
                  code={k.toLowerCase()}
                  height={44}
                  onPress={handleKeyPress}
                />
              ))}
              <Keycap
                label="⌫"
                code="backspace"
                widthFactor={1.35}
                height={44}
                type="utility"
                accentColor="#fca5a5"
                onPress={handleKeyPress}
              />
            </View>

            {/* Row 5: Modifiers, Spacebar & Enter */}
            <View style={styles.row}>
              <Keycap
                label="Ctrl"
                code="ctrl"
                widthFactor={1.15}
                height={43}
                type="modifier"
                hasLed
                ledOn={isCtrlLatched}
                isLatched={isCtrlLatched}
                onPress={handleKeyPress}
              />
              <Keycap
                label="⊞ Win"
                code="cmd"
                widthFactor={1.05}
                height={43}
                type="modifier"
                onPress={handleKeyPress}
              />
              <Keycap
                label="Alt"
                code="alt"
                widthFactor={1.05}
                height={43}
                type="modifier"
                hasLed
                ledOn={isAltLatched}
                isLatched={isAltLatched}
                onPress={handleKeyPress}
              />
              <Keycap
                label="Space"
                code="space"
                widthFactor={3.6}
                height={43}
                type="spacebar"
                onPress={handleKeyPress}
              />
              <Keycap
                label="Enter ↵"
                code="enter"
                widthFactor={2.0}
                height={43}
                type="enter"
                onPress={handleKeyPress}
              />
            </View>

            {/* Row 6: Directional Arrows & Navigation Cluster */}
            <View style={styles.row}>
              <Keycap label="⇤ Home" code="home" widthFactor={1.1} height={38} type="utility" onPress={handleKeyPress} />
              <Keycap label="End ⇥" code="end" widthFactor={1.1} height={38} type="utility" onPress={handleKeyPress} />
              <Keycap label="◀" code="left" widthFactor={1.15} height={38} type="utility" onPress={handleKeyPress} />
              <Keycap label="▲" code="up" widthFactor={1.15} height={38} type="utility" onPress={handleKeyPress} />
              <Keycap label="▼" code="down" widthFactor={1.15} height={38} type="utility" onPress={handleKeyPress} />
              <Keycap label="▶" code="right" widthFactor={1.15} height={38} type="utility" onPress={handleKeyPress} />
              <Keycap label="⇞ PgUp" code="page_up" widthFactor={1.1} height={38} type="utility" onPress={handleKeyPress} />
              <Keycap label="⇟ PgDn" code="page_down" widthFactor={1.1} height={38} type="utility" onPress={handleKeyPress} />
            </View>
          </>
        ) : (
          /* ================= Function Keys & Navigation Deck ================= */
          <>
            {/* Row 1: F1 - F6 */}
            <View style={styles.row}>
              {['f1', 'f2', 'f3', 'f4', 'f5', 'f6'].map((f) => (
                <Keycap key={f} label={f.toUpperCase()} code={f} height={42} type="utility" onPress={handleKeyPress} />
              ))}
            </View>

            {/* Row 2: F7 - F12 */}
            <View style={styles.row}>
              {['f7', 'f8', 'f9', 'f10', 'f11', 'f12'].map((f) => (
                <Keycap key={f} label={f.toUpperCase()} code={f} height={42} type="utility" onPress={handleKeyPress} />
              ))}
            </View>

            {/* Row 3: PC Document Control */}
            <View style={styles.row}>
              <Keycap label="PrtSc" code="print_screen" height={40} type="utility" onPress={handleKeyPress} />
              <Keycap label="Ins" code="insert" height={40} type="utility" onPress={handleKeyPress} />
              <Keycap label="Home" code="home" height={40} type="utility" onPress={handleKeyPress} />
              <Keycap label="End" code="end" height={40} type="utility" onPress={handleKeyPress} />
              <Keycap label="PgUp" code="page_up" height={40} type="utility" onPress={handleKeyPress} />
              <Keycap label="PgDn" code="page_down" height={40} type="utility" onPress={handleKeyPress} />
            </View>

            {/* Row 4: Essential Windows Shortcuts */}
            <View style={styles.row}>
              <Keycap label="Win+D" code="shortcut_win_d" height={40} type="utility" accentColor="#60a5fa" onPress={handleKeyPress} />
              <Keycap label="Alt+Tab" code="shortcut_alt_tab" height={40} type="utility" accentColor="#60a5fa" onPress={handleKeyPress} />
              <Keycap label="Ctrl+C" code="shortcut_copy" height={40} type="utility" onPress={handleKeyPress} />
              <Keycap label="Ctrl+V" code="shortcut_paste" height={40} type="utility" onPress={handleKeyPress} />
              <Keycap label="Ctrl+Z" code="shortcut_undo" height={40} type="utility" onPress={handleKeyPress} />
              <Keycap label="Ctrl+A" code="shortcut_select_all" height={40} type="utility" onPress={handleKeyPress} />
            </View>

            {/* Row 5: Directional Inverted-T Cluster & Enter */}
            <View style={styles.row}>
              <Keycap
                label="Ctrl"
                code="ctrl"
                widthFactor={1.15}
                height={42}
                type="modifier"
                hasLed
                ledOn={isCtrlLatched}
                isLatched={isCtrlLatched}
                onPress={handleKeyPress}
              />
              <Keycap
                label="Alt"
                code="alt"
                widthFactor={1.15}
                height={42}
                type="modifier"
                hasLed
                ledOn={isAltLatched}
                isLatched={isAltLatched}
                onPress={handleKeyPress}
              />
              <Keycap label="◀" code="left" widthFactor={1.3} height={42} type="utility" onPress={handleKeyPress} />
              <Keycap label="▲" code="up" widthFactor={1.3} height={42} type="utility" onPress={handleKeyPress} />
              <Keycap label="▼" code="down" widthFactor={1.3} height={42} type="utility" onPress={handleKeyPress} />
              <Keycap label="▶" code="right" widthFactor={1.3} height={42} type="utility" onPress={handleKeyPress} />
              <Keycap label="Enter ↵" code="enter" widthFactor={1.8} height={42} type="enter" onPress={handleKeyPress} />
            </View>
          </>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0b10',
    paddingHorizontal: 4,
    paddingTop: 2,
    paddingBottom: 4,
    justifyContent: 'space-between',
  },
  containerFullscreen: {
    paddingHorizontal: 2,
    paddingTop: 1,
    paddingBottom: 2,
  },

  // Upper Precision Trackpad (flex: 1)
  trackpadSection: {
    flex: 1,
    backgroundColor: '#12141f',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    marginBottom: 6,
    overflow: 'hidden',
    position: 'relative',
  },
  touchSurface: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    backgroundColor: '#0e1017',
  },
  gestureHintBadge: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 14,
    backgroundColor: 'rgba(18, 20, 31, 0.85)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.07)',
  },
  gestureHintText: {
    fontSize: 10,
    color: '#64748b',
    fontWeight: '600',
    letterSpacing: 0.2,
  },

  // Trackpad Bottom Action Strip
  trackpadActionStrip: {
    flexDirection: 'row',
    alignItems: 'stretch',
    height: 40,
    backgroundColor: '#151724',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.08)',
  },
  clickBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
  },
  clickBtnActive: {
    backgroundColor: 'rgba(59, 130, 246, 0.25)',
  },
  clickBtnText: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#cbd5e1',
  },
  scrollStrip: {
    width: 82,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(96, 165, 250, 0.08)',
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  scrollStripText: {
    fontSize: 9.5,
    fontWeight: '800',
    color: '#60a5fa',
    letterSpacing: 0.5,
  },
  speedPill: {
    paddingHorizontal: 9,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    borderLeftWidth: 1,
    borderLeftColor: 'rgba(255, 255, 255, 0.08)',
  },
  speedPillText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#94a3b8',
  },

  // Middle Utility Ribbon
  utilityRibbon: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 5,
    paddingHorizontal: 2,
  },
  utilityLeftGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    maxWidth: 240,
  },
  utilityRightGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  utilityActionBtn: {
    paddingVertical: 7,
    paddingHorizontal: 10,
    borderRadius: 7,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
  },
  utilityActionBtnActive: {
    backgroundColor: 'rgba(59, 130, 246, 0.22)',
    borderColor: '#3b82f6',
  },
  utilityActionBtnText: {
    color: '#cbd5e1',
    fontSize: 11,
    fontWeight: '700',
  },
  utilityActionBtnTextActive: {
    color: '#60a5fa',
  },
  deckPillActive: {
    backgroundColor: 'rgba(79, 140, 255, 0.25)',
    borderColor: '#4f8cff',
  },
  deckPillTextActive: {
    color: '#60a5fa',
  },

  // Quick Text Drawer
  quickTextDrawer: {
    flexDirection: 'row',
    gap: 6,
    paddingVertical: 4,
    paddingHorizontal: 2,
    marginBottom: 5,
  },
  textInput: {
    flex: 1,
    height: 38,
    backgroundColor: '#161722',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    color: '#f8fafc',
    paddingHorizontal: 12,
    fontSize: 13,
  },
  sendBtn: {
    backgroundColor: '#3b82f6',
    borderRadius: 8,
    paddingHorizontal: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendBtnText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '700',
  },

  // Docked Keyboard Chassis
  keyboardChassis: {
    width: '100%',
    backgroundColor: '#0e1017',
    borderRadius: 12,
    padding: 3,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.07)',
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.6,
    shadowRadius: 12,
  },
  row: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 1,
  },
  spacerQuarter: {
    flex: 0.25,
  },
});

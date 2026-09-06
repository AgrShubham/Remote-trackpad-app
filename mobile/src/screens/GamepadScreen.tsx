import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  PanResponder,
} from 'react-native';
import Orientation from 'react-native-orientation-locker';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Svg, { Path } from 'react-native-svg';
import { Colors } from '../theme/colors';
import { socketService } from '../services/SocketService';
import { hapticsService } from '../services/HapticsService';
import { ConcentricStick } from '../components/ConcentricStick';
import { CloverDpad } from '../components/CloverDpad';
import { RebindModal, ButtonBinding } from '../components/RebindModal';

const GAMEPAD_BINDINGS_KEY = '@remote_mouse_gp_bindings';
const GAMEPAD_LAYOUT_KEY = '@remote_mouse_gp_layout';
const GAMEPAD_DEADZONE_KEY = '@remote_mouse_gp_deadzone';
const GAMEPAD_SENSITIVITY_KEY = '@remote_mouse_gp_sensitivity';

type LayoutType = 'arc' | 'asymmetric' | 'symmetric';

const DEFAULT_BINDINGS: Record<string, ButtonBinding> = {
  A: { id: 'A', label: 'JUMP', key: 'space' },
  B: { id: 'B', label: 'CROUCH', key: 'c' },
  X: { id: 'X', label: 'RELOAD', key: 'r' },
  Y: { id: 'Y', label: 'USE', key: 'e' },
  LB: { id: 'LB', label: 'AIM', key: 'mouse_right' },
  RB: { id: 'RB', label: 'MELEE', key: 'v' },
  LT: { id: 'LT', label: 'BRAKE', key: 'q' },
  RT: { id: 'RT', label: 'FIRE', key: 'mouse_left' },
  LS: { id: 'LS', label: 'SPRINT', key: 'shift' },
  RS: { id: 'RS', label: 'LOCK', key: 'f' },
  SELECT: { id: 'SELECT', label: 'MAP', key: 'm' },
  START: { id: 'START', label: 'PAUSE', key: 'esc' },
};

interface GamepadScreenProps {
  isFullscreen?: boolean;
  onToggleFullscreen?: () => void;
}

export const GamepadScreen: React.FC<GamepadScreenProps> = ({
  isFullscreen,
  onToggleFullscreen,
}) => {
  const [layout, setLayout] = useState<LayoutType>('arc');
  const [labelMode, setLabelMode] = useState<0 | 1 | 2>(0); // 0: Buttons, 1: Actions, 2: Keys
  const [bindings, setBindings] = useState<Record<string, ButtonBinding>>(DEFAULT_BINDINGS);
  const [activeButton, setActiveButton] = useState<string | null>(null);

  // Thumbstick Tuning States
  const [deadzone, setDeadzone] = useState<number>(0.12);
  const [stickSensitivity, setStickSensitivity] = useState<number>(1.0);
  const [isTuningModalVisible, setIsTuningModalVisible] = useState<boolean>(false);

  const [rebindTarget, setRebindTarget] = useState<ButtonBinding | null>(null);
  const [rebindModalVisible, setRebindModalVisible] = useState(false);

  const longPressTimer = useRef<any>(null);

  // Tuning Slider measurement refs
  const deadzoneTrackRef = useRef<View>(null);
  const deadzoneWidthRef = useRef<number>(200);
  const deadzonePageXRef = useRef<number>(0);

  const sensTrackRef = useRef<View>(null);
  const sensWidthRef = useRef<number>(200);
  const sensPageXRef = useRef<number>(0);

  useEffect(() => {
    try {
      Orientation.lockToLandscape();
    } catch (e) {}

    loadSavedSettings();

    return () => {
      socketService.gamepadReleaseAll();
      try {
        Orientation.unlockAllOrientations();
      } catch (e) {}
    };
  }, []);

  const loadSavedSettings = async () => {
    try {
      const [savedBindings, savedLayout, savedDeadzone, savedSens] = await Promise.all([
        AsyncStorage.getItem(GAMEPAD_BINDINGS_KEY),
        AsyncStorage.getItem(GAMEPAD_LAYOUT_KEY),
        AsyncStorage.getItem(GAMEPAD_DEADZONE_KEY),
        AsyncStorage.getItem(GAMEPAD_SENSITIVITY_KEY),
      ]);

      if (savedBindings) setBindings(JSON.parse(savedBindings));
      if (savedLayout && (savedLayout === 'arc' || savedLayout === 'asymmetric' || savedLayout === 'symmetric')) {
        setLayout(savedLayout as LayoutType);
      }
      if (savedDeadzone) setDeadzone(parseFloat(savedDeadzone));
      if (savedSens) setStickSensitivity(parseFloat(savedSens));
    } catch (e) {}
  };

  const saveBinding = async (id: string, newLabel: string, newKey: string) => {
    const updated = {
      ...bindings,
      [id]: { id, label: newLabel || bindings[id].label, key: newKey || bindings[id].key },
    };
    setBindings(updated);
    try {
      await AsyncStorage.setItem(GAMEPAD_BINDINGS_KEY, JSON.stringify(updated));
    } catch (e) {}
  };

  const cycleLayout = () => {
    socketService.gamepadReleaseAll();
    const order: LayoutType[] = ['arc', 'asymmetric', 'symmetric'];
    const nextIdx = (order.indexOf(layout) + 1) % order.length;
    const nextLayout = order[nextIdx];
    setLayout(nextLayout);
    AsyncStorage.setItem(GAMEPAD_LAYOUT_KEY, nextLayout).catch(() => {});
    hapticsService.light();
  };

  const cycleLabelMode = () => {
    const next = ((labelMode + 1) % 3) as 0 | 1 | 2;
    setLabelMode(next);
    hapticsService.light();
  };

  const getButtonText = (id: string): string => {
    const b = bindings[id] || DEFAULT_BINDINGS[id];
    if (!b) return id;
    if (labelMode === 0) return id;
    if (labelMode === 1) return b.label;
    return b.key.toUpperCase();
  };

  const handleButtonPressIn = (id: string, isTrigger = false, isBumper = false) => {
    setActiveButton(id);
    const b = bindings[id] || DEFAULT_BINDINGS[id];
    if (b) socketService.gamepadButtonDown(b.key);

    if (isTrigger) hapticsService.gamepadTrigger();
    else if (isBumper) hapticsService.gamepadBumper();
    else hapticsService.gamepadButton();

    longPressTimer.current = setTimeout(() => {
      if (b) {
        setRebindTarget(b);
        setRebindModalVisible(true);
      }
    }, 750);
  };

  const handleButtonPressOut = (id: string) => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
    setActiveButton(null);
    const b = bindings[id] || DEFAULT_BINDINGS[id];
    if (b) socketService.gamepadButtonUp(b.key);
  };

  // Deadzone Scrubber PanResponder
  const updateDeadzoneFromPageX = (pageX: number) => {
    const width = deadzoneWidthRef.current || 200;
    const x = pageX - deadzonePageXRef.current;
    const fraction = Math.max(0, Math.min(1, x / width));
    // Range 0.05 to 0.30 (span = 0.25)
    const val = parseFloat((0.05 + fraction * 0.25).toFixed(2));
    setDeadzone(val);
    AsyncStorage.setItem(GAMEPAD_DEADZONE_KEY, val.toString()).catch(() => {});
  };

  const deadzonePanResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (evt) => {
        updateDeadzoneFromPageX(evt.nativeEvent.pageX);
        hapticsService.light();
      },
      onPanResponderMove: (evt) => {
        updateDeadzoneFromPageX(evt.nativeEvent.pageX);
      },
    })
  ).current;

  // Sensitivity Scrubber PanResponder
  const updateSensFromPageX = (pageX: number) => {
    const width = sensWidthRef.current || 200;
    const x = pageX - sensPageXRef.current;
    const fraction = Math.max(0, Math.min(1, x / width));
    // Range 0.5 to 2.5 (span = 2.0)
    const val = parseFloat((0.5 + fraction * 2.0).toFixed(1));
    setStickSensitivity(val);
    AsyncStorage.setItem(GAMEPAD_SENSITIVITY_KEY, val.toString()).catch(() => {});
  };

  const sensPanResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (evt) => {
        updateSensFromPageX(evt.nativeEvent.pageX);
        hapticsService.light();
      },
      onPanResponderMove: (evt) => {
        updateSensFromPageX(evt.nativeEvent.pageX);
      },
    })
  ).current;

  return (
    <View style={[styles.container, isFullscreen && styles.containerFullscreen]}>
      {/* Top Shoulder & Trigger Bar with Curved Corner Grip Pads */}
      <View style={styles.topShoulderBar}>
        {/* Left Shoulder & Trigger Corner Grip */}
        <View style={styles.cornerGripLeft}>
          <TouchableOpacity
            style={[styles.cornerTrigger, styles.cornerTriggerLeft, activeButton === 'LT' && styles.triggerActive]}
            onPressIn={() => handleButtonPressIn('LT', true)}
            onPressOut={() => handleButtonPressOut('LT')}
            activeOpacity={1}
            focusable={false}
          >
            <Text style={styles.triggerBadge}>LT</Text>
            <Text style={styles.shoulderBtnText}>{getButtonText('LT')}</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.cornerBumper, activeButton === 'LB' && styles.bumperActive]}
            onPressIn={() => handleButtonPressIn('LB', false, true)}
            onPressOut={() => handleButtonPressOut('LB')}
            activeOpacity={1}
            focusable={false}
          >
            <Text style={styles.bumperBadge}>LB</Text>
            <Text style={styles.shoulderBtnText}>{getButtonText('LB')}</Text>
          </TouchableOpacity>
        </View>

        {/* Center Controller Control Deck */}
        <View style={styles.centerControlGroup}>
          {/* 3-Way Layout Switcher Button */}
          <TouchableOpacity
            style={styles.layoutToggle}
            onPress={cycleLayout}
            activeOpacity={0.8}
            focusable={false}
          >
            <Text style={styles.layoutToggleLabel}>LAYOUT</Text>
            <Text style={styles.layoutToggleText}>
              {layout === 'arc' ? '🕹️ Arc (Mobile)' : layout === 'asymmetric' ? '🎮 Xbox (Asym)' : '🎮 PS (Sym)'}
            </Text>
          </TouchableOpacity>

          {/* Tuning Drawer Button */}
          <TouchableOpacity
            style={styles.tuningBtn}
            onPress={() => {
              setIsTuningModalVisible(true);
              hapticsService.light();
            }}
            activeOpacity={0.8}
            focusable={false}
          >
            <Svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="#60a5fa" strokeWidth={2.5}>
              <Path d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z" />
              <Path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z" />
            </Svg>
            <Text style={styles.tuningBtnText}>Tuning</Text>
          </TouchableOpacity>

          {/* Label Mode Switcher */}
          <TouchableOpacity
            style={styles.labelModePill}
            onPress={cycleLabelMode}
            activeOpacity={0.8}
            focusable={false}
          >
            <Text style={styles.labelModeText}>
              {labelMode === 0 ? 'Buttons' : labelMode === 1 ? 'Actions' : 'PC Keys'}
            </Text>
          </TouchableOpacity>

          {/* Fullscreen Button */}
          {onToggleFullscreen && (
            <TouchableOpacity
              style={[styles.fullscreenToggle, isFullscreen && styles.fullscreenToggleActive]}
              onPress={onToggleFullscreen}
              activeOpacity={0.8}
              focusable={false}
            >
              <Text style={[styles.fullscreenToggleText, isFullscreen && styles.fullscreenToggleTextActive]}>
                {isFullscreen ? '✕ Exit' : '⛶'}
              </Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Right Shoulder & Trigger Corner Grip */}
        <View style={styles.cornerGripRight}>
          <TouchableOpacity
            style={[styles.cornerBumper, activeButton === 'RB' && styles.bumperActive]}
            onPressIn={() => handleButtonPressIn('RB', false, true)}
            onPressOut={() => handleButtonPressOut('RB')}
            activeOpacity={1}
            focusable={false}
          >
            <Text style={styles.bumperBadge}>RB</Text>
            <Text style={styles.shoulderBtnText}>{getButtonText('RB')}</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.cornerTrigger, styles.cornerTriggerRight, activeButton === 'RT' && styles.triggerActive]}
            onPressIn={() => handleButtonPressIn('RT', true)}
            onPressOut={() => handleButtonPressOut('RT')}
            activeOpacity={1}
            focusable={false}
          >
            <Text style={styles.triggerBadge}>RT</Text>
            <Text style={styles.shoulderBtnText}>{getButtonText('RT')}</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Main Handheld Controller Canvas */}
      <View style={styles.consoleBody}>
        <View style={styles.layoutContainer}>
          {/* ================= LEFT CONTROLLER WING ================= */}
          <View style={[styles.wing, layout === 'arc' && styles.wingArcLeft]}>
            {layout === 'asymmetric' ? (
              /* Xbox Mode: Left Stick on TOP, D-Pad on BOTTOM */
              <>
                <View style={styles.wingUpper}>
                  <ConcentricStick label="LS" size={118} deadzone={deadzone} sensitivity={stickSensitivity} />
                </View>
                <View style={styles.wingLower}>
                  <CloverDpad size={106} />
                </View>
              </>
            ) : layout === 'symmetric' ? (
              /* PlayStation Mode: D-Pad on TOP, Left Stick on BOTTOM */
              <>
                <View style={styles.wingUpper}>
                  <CloverDpad size={106} />
                </View>
                <View style={styles.wingLower}>
                  <ConcentricStick label="LS" size={118} deadzone={deadzone} sensitivity={stickSensitivity} />
                </View>
              </>
            ) : (
              /* Natural Arc Mode: Left Stick angled on upper-left sweep, D-pad on lower-inner sweep */
              <>
                <View style={[styles.wingUpper, styles.arcUpperLeft]}>
                  <ConcentricStick label="LS" size={118} deadzone={deadzone} sensitivity={stickSensitivity} />
                </View>
                <View style={[styles.wingLower, styles.arcLowerLeft]}>
                  <CloverDpad size={106} />
                </View>
              </>
            )}
          </View>

          {/* ================= CENTER DECK ================= */}
          <View style={styles.centerDeck}>
            {/* Select & Start Buttons */}
            <View style={styles.centerNavRow}>
              <TouchableOpacity
                style={[styles.centerNavBtn, activeButton === 'SELECT' && styles.centerNavBtnActive]}
                onPressIn={() => handleButtonPressIn('SELECT')}
                onPressOut={() => handleButtonPressOut('SELECT')}
                activeOpacity={1}
                focusable={false}
              >
                <Text style={styles.centerNavIcon}>⧉</Text>
                <Text style={styles.centerNavLabel}>{getButtonText('SELECT')}</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.centerNavBtn, activeButton === 'START' && styles.centerNavBtnActive]}
                onPressIn={() => handleButtonPressIn('START')}
                onPressOut={() => handleButtonPressOut('START')}
                activeOpacity={1}
                focusable={false}
              >
                <Text style={styles.centerNavIcon}>☰</Text>
                <Text style={styles.centerNavLabel}>{getButtonText('START')}</Text>
              </TouchableOpacity>
            </View>

            {/* Glowing Center Controller Badge */}
            <View style={styles.centerBadge}>
              <View style={styles.centerBadgeDot} />
              <Text style={styles.centerBadgeText}>PRO CONTROLLER</Text>
            </View>

            {/* Safety Release Panic Button */}
            <TouchableOpacity
              style={styles.centerUtilityBtn}
              onPress={() => {
                socketService.gamepadReleaseAll();
                hapticsService.light();
              }}
              activeOpacity={0.8}
              focusable={false}
            >
              <Text style={styles.centerUtilityText}>SAFETY RELEASE</Text>
            </TouchableOpacity>
          </View>

          {/* ================= RIGHT CONTROLLER WING ================= */}
          <View style={[styles.wing, layout === 'arc' && styles.wingArcRight]}>
            {/* Action Diamond ABXY with Pro Console Jewel Styling */}
            <View style={[styles.wingUpper, layout === 'arc' && styles.arcUpperRight]}>
              <View style={styles.diamondGrid}>
                {/* Y Button (Top - Amber Yellow) */}
                <TouchableOpacity
                  style={[styles.jewelBtn, styles.btnY, activeButton === 'Y' && styles.btnYActive]}
                  onPressIn={() => handleButtonPressIn('Y')}
                  onPressOut={() => handleButtonPressOut('Y')}
                  activeOpacity={1}
                  focusable={false}
                >
                  <Text style={[styles.jewelBtnText, styles.textY]}>{getButtonText('Y')}</Text>
                </TouchableOpacity>

                {/* X Button (Left - Cobalt Blue) & B Button (Right - Crimson Red) */}
                <View style={styles.diamondMidRow}>
                  <TouchableOpacity
                    style={[styles.jewelBtn, styles.btnX, activeButton === 'X' && styles.btnXActive]}
                    onPressIn={() => handleButtonPressIn('X')}
                    onPressOut={() => handleButtonPressOut('X')}
                    activeOpacity={1}
                    focusable={false}
                  >
                    <Text style={[styles.jewelBtnText, styles.textX]}>{getButtonText('X')}</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.jewelBtn, styles.btnB, activeButton === 'B' && styles.btnBActive]}
                    onPressIn={() => handleButtonPressIn('B')}
                    onPressOut={() => handleButtonPressOut('B')}
                    activeOpacity={1}
                    focusable={false}
                  >
                    <Text style={[styles.jewelBtnText, styles.textB]}>{getButtonText('B')}</Text>
                  </TouchableOpacity>
                </View>

                {/* A Button (Bottom - Emerald Green) */}
                <TouchableOpacity
                  style={[styles.jewelBtn, styles.btnA, activeButton === 'A' && styles.btnAActive]}
                  onPressIn={() => handleButtonPressIn('A')}
                  onPressOut={() => handleButtonPressOut('A')}
                  activeOpacity={1}
                  focusable={false}
                >
                  <Text style={[styles.jewelBtnText, styles.textA]}>{getButtonText('A')}</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Right Analog Stick (Camera / Look Aim) */}
            <View style={[styles.wingLower, layout === 'arc' && styles.arcLowerRight]}>
              <ConcentricStick label="RS" isRightStick size={118} deadzone={deadzone} sensitivity={stickSensitivity} />
            </View>
          </View>
        </View>
      </View>

      {/* Thumbstick Deadzone & Sensitivity Tuning Drawer Modal */}
      <Modal
        visible={isTuningModalVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setIsTuningModalVisible(false)}
      >
        <TouchableOpacity
          style={styles.modalBackdrop}
          activeOpacity={1}
          onPress={() => setIsTuningModalVisible(false)}
        >
          <TouchableOpacity
            style={styles.tuningCard}
            activeOpacity={1}
            onPress={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <View style={styles.tuningHeader}>
              <View style={styles.tuningTitleRow}>
                <Svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="#60a5fa" strokeWidth={2.5}>
                  <Path d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z" />
                </Svg>
                <Text style={styles.tuningTitle}>Thumbstick Tuning</Text>
              </View>
              <TouchableOpacity
                style={styles.tuningCloseBtn}
                onPress={() => setIsTuningModalVisible(false)}
                activeOpacity={0.7}
              >
                <Text style={styles.tuningCloseText}>✕</Text>
              </TouchableOpacity>
            </View>

            {/* Deadzone Control */}
            <View style={styles.tuningSection}>
              <View style={styles.tuningRowHeader}>
                <Text style={styles.tuningSectionLabel}>Inner Deadzone</Text>
                <Text style={styles.tuningValueBadge}>{Math.round(deadzone * 100)}%</Text>
              </View>
              <View style={styles.sliderHitBox} {...deadzonePanResponder.panHandlers}>
                <View
                  ref={deadzoneTrackRef}
                  style={styles.sliderTrack}
                  onLayout={() => {
                    deadzoneTrackRef.current?.measure((_x, _y, width, _height, pageX, _pageY) => {
                      if (width > 0) {
                        deadzoneWidthRef.current = width;
                        deadzonePageXRef.current = pageX;
                      }
                    });
                  }}
                >
                  <View
                    style={[
                      styles.sliderFill,
                      { width: `${Math.min(100, Math.max(0, ((deadzone - 0.05) / 0.25) * 100))}%` },
                    ]}
                  />
                  <View
                    style={[
                      styles.sliderThumb,
                      { left: `${Math.min(100, Math.max(0, ((deadzone - 0.05) / 0.25) * 100))}%` },
                    ]}
                  />
                </View>
              </View>
              <View style={styles.rangeSubtextRow}>
                <Text style={styles.rangeSubtext}>5% (Sensitive)</Text>
                <Text style={styles.rangeSubtext}>30% (High Resistance)</Text>
              </View>
            </View>

            {/* Aim Sensitivity Control */}
            <View style={styles.tuningSection}>
              <View style={styles.tuningRowHeader}>
                <Text style={styles.tuningSectionLabel}>Aim Sensitivity</Text>
                <Text style={styles.tuningValueBadge}>{stickSensitivity.toFixed(1)}×</Text>
              </View>
              <View style={styles.sliderHitBox} {...sensPanResponder.panHandlers}>
                <View
                  ref={sensTrackRef}
                  style={styles.sliderTrack}
                  onLayout={() => {
                    sensTrackRef.current?.measure((_x, _y, width, _height, pageX, _pageY) => {
                      if (width > 0) {
                        sensWidthRef.current = width;
                        sensPageXRef.current = pageX;
                      }
                    });
                  }}
                >
                  <View
                    style={[
                      styles.sliderFill,
                      { width: `${Math.min(100, Math.max(0, ((stickSensitivity - 0.5) / 2.0) * 100))}%` },
                    ]}
                  />
                  <View
                    style={[
                      styles.sliderThumb,
                      { left: `${Math.min(100, Math.max(0, ((stickSensitivity - 0.5) / 2.0) * 100))}%` },
                    ]}
                  />
                </View>
              </View>
              <View style={styles.rangeSubtextRow}>
                <Text style={styles.rangeSubtext}>0.5× (Precision)</Text>
                <Text style={styles.rangeSubtext}>2.5× (Fast Flick)</Text>
              </View>
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      {/* Live Rebinding Modal */}
      <RebindModal
        visible={rebindModalVisible}
        binding={rebindTarget}
        onSave={saveBinding}
        onClose={() => setRebindModalVisible(false)}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0b10',
    paddingHorizontal: 6,
    paddingVertical: 3,
  },
  containerFullscreen: {
    paddingHorizontal: 2,
    paddingVertical: 1,
  },

  // Curved Top Shoulder Bar
  topShoulderBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 2,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.08)',
  },
  cornerGripLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  cornerGripRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },

  // Corner Trigger & Bumper Styling
  cornerTrigger: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#161822',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    elevation: 4,
  },
  cornerTriggerLeft: {
    borderTopLeftRadius: 18,
    borderBottomLeftRadius: 6,
    borderTopRightRadius: 6,
    borderBottomRightRadius: 12,
    borderColor: 'rgba(96, 165, 250, 0.3)',
  },
  cornerTriggerRight: {
    borderTopRightRadius: 18,
    borderBottomRightRadius: 6,
    borderTopLeftRadius: 6,
    borderBottomLeftRadius: 12,
    borderColor: 'rgba(96, 165, 250, 0.3)',
  },
  cornerBumper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#1b1d28',
    paddingHorizontal: 11,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.14)',
  },

  triggerActive: {
    backgroundColor: 'rgba(59, 130, 246, 0.35)',
    borderColor: '#60a5fa',
    transform: [{ scale: 0.95 }],
  },
  bumperActive: {
    backgroundColor: 'rgba(79, 140, 255, 0.3)',
    borderColor: '#60a5fa',
    transform: [{ scale: 0.95 }],
  },

  triggerBadge: {
    fontSize: 9.5,
    fontWeight: '800',
    color: '#60a5fa',
    backgroundColor: 'rgba(96, 165, 250, 0.15)',
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 4,
  },
  bumperBadge: {
    fontSize: 9.5,
    fontWeight: '800',
    color: '#93c5fd',
    backgroundColor: 'rgba(147, 197, 253, 0.15)',
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 4,
  },
  shoulderBtnText: {
    color: '#f1f5f9',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.4,
  },

  // Center Control Toolbar
  centerControlGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  layoutToggle: {
    backgroundColor: '#181a24',
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    alignItems: 'center',
  },
  layoutToggleLabel: {
    fontSize: 8,
    color: '#64748b',
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  layoutToggleText: {
    color: '#60a5fa',
    fontSize: 10.5,
    fontWeight: '700',
  },
  tuningBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#181a24',
    paddingHorizontal: 9,
    paddingVertical: 7,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
  },
  tuningBtnText: {
    color: '#cbd5e1',
    fontSize: 10.5,
    fontWeight: '700',
  },
  labelModePill: {
    backgroundColor: '#181a24',
    paddingHorizontal: 8,
    paddingVertical: 7,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  labelModeText: {
    color: '#94a3b8',
    fontSize: 10,
    fontWeight: '600',
  },
  fullscreenToggle: {
    backgroundColor: '#181a24',
    paddingHorizontal: 8,
    paddingVertical: 7,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
  },
  fullscreenToggleActive: {
    backgroundColor: 'rgba(52, 211, 153, 0.2)',
    borderColor: '#34d399',
  },
  fullscreenToggleText: {
    color: '#e2e8f0',
    fontSize: 10.5,
    fontWeight: '700',
  },
  fullscreenToggleTextActive: {
    color: '#34d399',
  },

  // Handheld Console Body
  consoleBody: {
    flex: 1,
    justifyContent: 'center',
  },
  layoutContainer: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 8,
  },
  wing: {
    width: 145,
    height: '100%',
    justifyContent: 'space-evenly',
    alignItems: 'center',
    paddingVertical: 4,
  },
  wingArcLeft: {
    paddingLeft: 4,
  },
  wingArcRight: {
    paddingRight: 4,
  },
  wingUpper: {
    height: 125,
    justifyContent: 'center',
    alignItems: 'center',
  },
  wingLower: {
    height: 125,
    justifyContent: 'center',
    alignItems: 'center',
  },
  arcUpperLeft: {
    transform: [{ translateX: -6 }],
  },
  arcLowerLeft: {
    transform: [{ translateX: 8 }],
  },
  arcUpperRight: {
    transform: [{ translateX: 6 }],
  },
  arcLowerRight: {
    transform: [{ translateX: -8 }],
  },

  // Center Deck
  centerDeck: {
    flex: 1,
    height: '100%',
    justifyContent: 'space-evenly',
    alignItems: 'center',
    paddingVertical: 4,
  },
  centerNavRow: {
    flexDirection: 'row',
    gap: 16,
    alignItems: 'center',
  },
  centerNavBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#181a24',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    borderRadius: 8,
    paddingVertical: 6,
    paddingHorizontal: 12,
    minWidth: 62,
  },
  centerNavBtnActive: {
    backgroundColor: 'rgba(59, 130, 246, 0.25)',
    borderColor: '#60a5fa',
    transform: [{ scale: 0.95 }],
  },
  centerNavIcon: {
    color: '#cbd5e1',
    fontSize: 14,
    fontWeight: 'bold',
  },
  centerNavLabel: {
    color: '#94a3b8',
    fontSize: 9,
    fontWeight: '700',
    marginTop: 2,
  },
  centerBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  centerBadgeDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#3b82f6',
  },
  centerBadgeText: {
    color: '#94a3b8',
    fontSize: 9.5,
    fontWeight: '700',
    letterSpacing: 0.8,
  },
  centerUtilityBtn: {
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.4)',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  centerUtilityText: {
    color: '#f87171',
    fontSize: 9.5,
    fontWeight: '700',
    letterSpacing: 0.5,
  },

  // Pro Console Jewel Style ABXY Diamond
  diamondGrid: {
    width: 132,
    height: 132,
    alignItems: 'center',
    justifyContent: 'center',
  },
  diamondMidRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    marginVertical: 4,
  },
  jewelBtn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#181a24',
    borderWidth: 2,
    borderBottomWidth: 3.5,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.5,
    shadowRadius: 4,
  },
  btnA: {
    borderColor: '#22c55e',
    borderBottomColor: '#15803d',
    backgroundColor: '#13231a',
  },
  btnAActive: {
    backgroundColor: '#22c55e',
    borderColor: '#4ade80',
    transform: [{ translateY: 2 }, { scale: 0.95 }],
  },
  btnB: {
    borderColor: '#ef4444',
    borderBottomColor: '#b91c1c',
    backgroundColor: '#251417',
  },
  btnBActive: {
    backgroundColor: '#ef4444',
    borderColor: '#f87171',
    transform: [{ translateY: 2 }, { scale: 0.95 }],
  },
  btnX: {
    borderColor: '#3b82f6',
    borderBottomColor: '#1d4ed8',
    backgroundColor: '#131b2c',
  },
  btnXActive: {
    backgroundColor: '#3b82f6',
    borderColor: '#60a5fa',
    transform: [{ translateY: 2 }, { scale: 0.95 }],
  },
  btnY: {
    borderColor: '#f59e0b',
    borderBottomColor: '#b45309',
    backgroundColor: '#261e12',
  },
  btnYActive: {
    backgroundColor: '#f59e0b',
    borderColor: '#fbbf24',
    transform: [{ translateY: 2 }, { scale: 0.95 }],
  },

  jewelBtnText: {
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  textA: { color: '#4ade80' },
  textB: { color: '#f87171' },
  textX: { color: '#60a5fa' },
  textY: { color: '#fbbf24' },

  // Tuning Drawer Modal
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  tuningCard: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: '#161722',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    padding: 18,
    elevation: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.7,
    shadowRadius: 28,
  },
  tuningHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  tuningTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  tuningTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#ffffff',
  },
  tuningCloseBtn: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  tuningCloseText: {
    color: '#9ca3af',
    fontSize: 12,
    fontWeight: '600',
  },
  tuningSection: {
    marginVertical: 8,
  },
  tuningRowHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  tuningSectionLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#cbd5e1',
  },
  tuningValueBadge: {
    fontSize: 13,
    fontWeight: '700',
    color: '#60a5fa',
  },

  sliderHitBox: {
    height: 36,
    justifyContent: 'center',
  },
  sliderTrack: {
    height: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 3,
    position: 'relative',
    justifyContent: 'center',
  },
  sliderFill: {
    height: '100%',
    backgroundColor: '#3b82f6',
    borderRadius: 3,
  },
  sliderThumb: {
    position: 'absolute',
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#ffffff',
    borderWidth: 3,
    borderColor: '#3b82f6',
    marginLeft: -10,
    elevation: 3,
  },
  rangeSubtextRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  rangeSubtext: {
    fontSize: 10,
    color: '#64748b',
  },
});

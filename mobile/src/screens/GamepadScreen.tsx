import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  PanResponder,
  Dimensions,
} from 'react-native';
import Orientation from 'react-native-orientation-locker';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Svg, { Path } from 'react-native-svg';
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
  const [layout, setLayout] = useState<LayoutType>('asymmetric');
  const [labelMode, setLabelMode] = useState<0 | 1 | 2>(0); // 0: Buttons, 1: Actions, 2: Keys
  const [bindings, setBindings] = useState<Record<string, ButtonBinding>>(DEFAULT_BINDINGS);
  const [activeButton, setActiveButton] = useState<string | null>(null);

  // Orientation State Machine (Defaults to current orientation; does NOT force rotation on mount)
  const [isLandscape, setIsLandscape] = useState<boolean>(() => {
    const { width, height } = Dimensions.get('window');
    return width > height;
  });

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
    // Listen for orientation/dimension updates
    const subscription = Dimensions.addEventListener('change', ({ window }) => {
      setIsLandscape(window.width > window.height);
    });

    loadSavedSettings();

    return () => {
      subscription?.remove();
      socketService.gamepadReleaseAll();
      try {
        // Restore standard portrait mode on exit
        Orientation.lockToPortrait();
      } catch (e) {}
    };
  }, []);

  const toggleOrientation = () => {
    hapticsService.light();
    if (isLandscape) {
      try {
        Orientation.lockToPortrait();
      } catch (e) {}
      setIsLandscape(false);
    } else {
      try {
        Orientation.lockToLandscape();
      } catch (e) {}
      setIsLandscape(true);
    }
  };

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
    const order: LayoutType[] = ['asymmetric', 'arc', 'symmetric'];
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

  // Render ABXY Diamond
  const renderABXYCluster = () => (
    <View style={styles.diamondGrid}>
      {/* Y Button (Top - Amber) */}
      <TouchableOpacity
        style={[styles.jewelBtn, styles.btnY, activeButton === 'Y' && styles.btnYActive]}
        onPressIn={() => handleButtonPressIn('Y')}
        onPressOut={() => handleButtonPressOut('Y')}
        activeOpacity={1}
      >
        <Text style={[styles.jewelBtnText, styles.textY]}>{getButtonText('Y')}</Text>
      </TouchableOpacity>

      {/* X & B Row */}
      <View style={styles.diamondMidRow}>
        {/* X (Left - Azure Blue) */}
        <TouchableOpacity
          style={[styles.jewelBtn, styles.btnX, activeButton === 'X' && styles.btnXActive]}
          onPressIn={() => handleButtonPressIn('X')}
          onPressOut={() => handleButtonPressOut('X')}
          activeOpacity={1}
        >
          <Text style={[styles.jewelBtnText, styles.textX]}>{getButtonText('X')}</Text>
        </TouchableOpacity>

        {/* B (Right - Crimson Red) */}
        <TouchableOpacity
          style={[styles.jewelBtn, styles.btnB, activeButton === 'B' && styles.btnBActive]}
          onPressIn={() => handleButtonPressIn('B')}
          onPressOut={() => handleButtonPressOut('B')}
          activeOpacity={1}
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
      >
        <Text style={[styles.jewelBtnText, styles.textA]}>{getButtonText('A')}</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <View style={[styles.container, isFullscreen && styles.containerFullscreen]}>
      {/* ================= HEADER CONTROLLER TOOLBAR ================= */}
      <View style={styles.headerToolbar}>
        <View style={styles.headerLeftGroup}>
          <View style={styles.gamepadBadge}>
            <Text style={styles.gamepadBadgeIcon}>🎮</Text>
            <Text style={styles.gamepadBadgeText}>Gamepad Pro</Text>
          </View>
          <TouchableOpacity
            style={styles.headerPill}
            onPress={cycleLabelMode}
            activeOpacity={0.8}
          >
            <Text style={styles.headerPillText}>
              {labelMode === 0 ? 'Buttons' : labelMode === 1 ? 'Actions' : 'Keys'}
            </Text>
          </TouchableOpacity>
        </View>

        <View style={styles.headerRightGroup}>
          {/* Layout Mode Cycle */}
          <TouchableOpacity
            style={styles.headerPill}
            onPress={cycleLayout}
            activeOpacity={0.8}
          >
            <Text style={styles.headerPillText}>
              {layout === 'asymmetric' ? 'Xbox' : layout === 'symmetric' ? 'PS' : 'Arc'}
            </Text>
          </TouchableOpacity>

          {/* Tuning Drawer */}
          <TouchableOpacity
            style={styles.headerPill}
            onPress={() => {
              setIsTuningModalVisible(true);
              hapticsService.light();
            }}
            activeOpacity={0.8}
          >
            <Text style={styles.headerPillText}>⚙️</Text>
          </TouchableOpacity>

          {/* Orientation Toggle Button */}
          <TouchableOpacity
            style={[styles.headerPill, isLandscape && styles.orientationPillActive]}
            onPress={toggleOrientation}
            activeOpacity={0.8}
          >
            <Text style={[styles.headerPillText, isLandscape && styles.orientationPillTextActive]}>
              {isLandscape ? '📱 Portrait' : '🔄 Landscape'}
            </Text>
          </TouchableOpacity>

          {/* Fullscreen Toggle */}
          {onToggleFullscreen && (
            <TouchableOpacity
              style={styles.headerPill}
              onPress={onToggleFullscreen}
              activeOpacity={0.8}
            >
              <Text style={styles.headerPillText}>{isFullscreen ? '✕' : '⛶'}</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* ================= TOP SHOULDER TRIGGERS & BUMPERS ================= */}
      <View style={styles.shoulderSection}>
        {/* Left Shoulder Cluster */}
        <View style={styles.shoulderPod}>
          <TouchableOpacity
            style={[styles.shoulderBtn, styles.triggerBtn, activeButton === 'LT' && styles.triggerActive]}
            onPressIn={() => handleButtonPressIn('LT', true)}
            onPressOut={() => handleButtonPressOut('LT')}
            activeOpacity={1}
          >
            <Text style={styles.triggerBadge}>LT</Text>
            <Text style={styles.shoulderBtnText}>{getButtonText('LT')}</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.shoulderBtn, styles.bumperBtn, activeButton === 'LB' && styles.bumperActive]}
            onPressIn={() => handleButtonPressIn('LB', false, true)}
            onPressOut={() => handleButtonPressOut('LB')}
            activeOpacity={1}
          >
            <Text style={styles.bumperBadge}>LB</Text>
            <Text style={styles.shoulderBtnText}>{getButtonText('LB')}</Text>
          </TouchableOpacity>
        </View>

        {/* Center System Navigation Pills (Select, Logo, Start) */}
        <View style={styles.systemNavCenter}>
          <TouchableOpacity
            style={[styles.systemNavBtn, activeButton === 'SELECT' && styles.systemNavBtnActive]}
            onPressIn={() => handleButtonPressIn('SELECT')}
            onPressOut={() => handleButtonPressOut('SELECT')}
            activeOpacity={1}
          >
            <Text style={styles.systemNavIcon}>◀</Text>
            <Text style={styles.systemNavText}>{getButtonText('SELECT')}</Text>
          </TouchableOpacity>

          <View style={styles.consoleLogoBadge}>
            <View style={styles.logoDot} />
          </View>

          <TouchableOpacity
            style={[styles.systemNavBtn, activeButton === 'START' && styles.systemNavBtnActive]}
            onPressIn={() => handleButtonPressIn('START')}
            onPressOut={() => handleButtonPressOut('START')}
            activeOpacity={1}
          >
            <Text style={styles.systemNavIcon}>▶</Text>
            <Text style={styles.systemNavText}>{getButtonText('START')}</Text>
          </TouchableOpacity>
        </View>

        {/* Right Shoulder Cluster */}
        <View style={styles.shoulderPod}>
          <TouchableOpacity
            style={[styles.shoulderBtn, styles.bumperBtn, activeButton === 'RB' && styles.bumperActive]}
            onPressIn={() => handleButtonPressIn('RB', false, true)}
            onPressOut={() => handleButtonPressOut('RB')}
            activeOpacity={1}
          >
            <Text style={styles.bumperBadge}>RB</Text>
            <Text style={styles.shoulderBtnText}>{getButtonText('RB')}</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.shoulderBtn, styles.triggerBtn, activeButton === 'RT' && styles.triggerActive]}
            onPressIn={() => handleButtonPressIn('RT', true)}
            onPressOut={() => handleButtonPressOut('RT')}
            activeOpacity={1}
          >
            <Text style={styles.triggerBadge}>RT</Text>
            <Text style={styles.shoulderBtnText}>{getButtonText('RT')}</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* ================= CONTROLLER MAIN COCKPIT ================= */}
      {isLandscape ? (
        /* Widescreen Landscape Console */
        <View style={styles.consoleBodyLandscape}>
          {/* Left Wing */}
          <View style={[styles.wingLandscape, layout === 'arc' && styles.wingArcLeft]}>
            {layout === 'symmetric' ? (
              <>
                <View style={styles.wingCell}><CloverDpad size={112} /></View>
                <View style={styles.wingCell}><ConcentricStick label="LS" size={124} deadzone={deadzone} sensitivity={stickSensitivity} /></View>
              </>
            ) : (
              <>
                <View style={styles.wingCell}><ConcentricStick label="LS" size={124} deadzone={deadzone} sensitivity={stickSensitivity} /></View>
                <View style={styles.wingCell}><CloverDpad size={112} /></View>
              </>
            )}
          </View>

          {/* Center Bridge */}
          <View style={styles.centerBridgeLandscape}>
            <View style={styles.bridgeInfoPill}>
              <Text style={styles.bridgeInfoText}>
                {layout.toUpperCase()} • DZ {Math.round(deadzone * 100)}% • SENS {stickSensitivity.toFixed(1)}×
              </Text>
            </View>
          </View>

          {/* Right Wing */}
          <View style={[styles.wingLandscape, layout === 'arc' && styles.wingArcRight]}>
            <View style={styles.wingCell}>{renderABXYCluster()}</View>
            <View style={styles.wingCell}>
              <ConcentricStick label="RS" isRightStick size={124} deadzone={deadzone} sensitivity={stickSensitivity} />
            </View>
          </View>
        </View>
      ) : (
        /* Native Portrait Console (Default) */
        <View style={styles.consoleBodyPortrait}>
          <View style={styles.portraitGrid}>
            {/* Left Control Column (Thumbstick + D-Pad) */}
            <View style={styles.portraitColumn}>
              <View style={styles.portraitCell}>
                <ConcentricStick label="LS" size={126} deadzone={deadzone} sensitivity={stickSensitivity} />
              </View>
              <View style={styles.portraitCell}>
                <CloverDpad size={112} />
              </View>
            </View>

            {/* Right Control Column (ABXY Diamond + Right Stick) */}
            <View style={styles.portraitColumn}>
              <View style={styles.portraitCell}>
                {renderABXYCluster()}
              </View>
              <View style={styles.portraitCell}>
                <ConcentricStick label="RS" isRightStick size={126} deadzone={deadzone} sensitivity={stickSensitivity} />
              </View>
            </View>
          </View>

          {/* Bottom Console Info Ribbon */}
          <View style={styles.portraitFooter}>
            <Text style={styles.portraitFooterText}>
              Console Mode • Deadzone: {Math.round(deadzone * 100)}% • Sensitivity: {stickSensitivity.toFixed(1)}×
            </Text>
          </View>
        </View>
      )}

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

            {/* Deadzone */}
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

            {/* Aim Sensitivity */}
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
    paddingTop: 2,
    paddingBottom: 4,
  },
  containerFullscreen: {
    paddingHorizontal: 2,
    paddingTop: 1,
    paddingBottom: 2,
  },

  // Header Toolbar
  headerToolbar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
    marginBottom: 4,
  },
  headerLeftGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  headerRightGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  gamepadBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(59, 130, 246, 0.12)',
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(59, 130, 246, 0.25)',
  },
  gamepadBadgeIcon: {
    fontSize: 12,
  },
  gamepadBadgeText: {
    color: '#93c5fd',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  headerPill: {
    backgroundColor: '#161824',
    paddingHorizontal: 9,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  headerPillText: {
    color: '#cbd5e1',
    fontSize: 10.5,
    fontWeight: '700',
  },
  orientationPillActive: {
    backgroundColor: 'rgba(59, 130, 246, 0.2)',
    borderColor: '#3b82f6',
  },
  orientationPillTextActive: {
    color: '#60a5fa',
  },

  // Top Shoulder Section
  shoulderSection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#12141f',
    borderRadius: 12,
    padding: 4,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    marginBottom: 6,
  },
  shoulderPod: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  shoulderBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 8,
    borderWidth: 1,
  },
  triggerBtn: {
    backgroundColor: '#191c2b',
    borderColor: 'rgba(96, 165, 250, 0.25)',
  },
  bumperBtn: {
    backgroundColor: '#161824',
    borderColor: 'rgba(255, 255, 255, 0.12)',
  },
  triggerActive: {
    backgroundColor: 'rgba(59, 130, 246, 0.35)',
    borderColor: '#60a5fa',
    transform: [{ scale: 0.96 }],
  },
  bumperActive: {
    backgroundColor: 'rgba(79, 140, 255, 0.3)',
    borderColor: '#60a5fa',
    transform: [{ scale: 0.96 }],
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
    color: '#e2e8f0',
    fontSize: 10.5,
    fontWeight: '700',
  },

  // System Navigation Center
  systemNavCenter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  systemNavBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#1a1c28',
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 7,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  systemNavBtnActive: {
    backgroundColor: 'rgba(59, 130, 246, 0.25)',
    borderColor: '#60a5fa',
  },
  systemNavIcon: {
    color: '#94a3b8',
    fontSize: 10,
    fontWeight: '800',
  },
  systemNavText: {
    color: '#cbd5e1',
    fontSize: 9.5,
    fontWeight: '700',
  },
  consoleLogoBadge: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#1e2130',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
  },
  logoDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#3b82f6',
  },

  // ================= PORTRAIT CONSOLE STYLES =================
  consoleBodyPortrait: {
    flex: 1,
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  portraitGrid: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
  },
  portraitColumn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'space-around',
    height: '100%',
  },
  portraitCell: {
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 4,
  },
  portraitFooter: {
    alignItems: 'center',
    paddingVertical: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
  },
  portraitFooterText: {
    fontSize: 10,
    color: '#64748b',
    fontWeight: '600',
    letterSpacing: 0.3,
  },

  // ================= LANDSCAPE CONSOLE STYLES =================
  consoleBodyLandscape: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  wingLandscape: {
    width: 150,
    height: '100%',
    justifyContent: 'space-evenly',
    alignItems: 'center',
  },
  wingArcLeft: {
    paddingLeft: 4,
  },
  wingArcRight: {
    paddingRight: 4,
  },
  wingCell: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  centerBridgeLandscape: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bridgeInfoPill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  bridgeInfoText: {
    color: '#64748b',
    fontSize: 9.5,
    fontWeight: '800',
    letterSpacing: 0.8,
  },

  // Pro Console Jewel Style ABXY Diamond
  diamondGrid: {
    width: 126,
    height: 126,
    alignItems: 'center',
    justifyContent: 'center',
  },
  diamondMidRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    marginVertical: 3,
  },
  jewelBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
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
    fontSize: 13,
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
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
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

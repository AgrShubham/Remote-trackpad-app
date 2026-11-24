import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  PanResponder,
  Dimensions,
  ScrollView,
} from 'react-native';
import Orientation from 'react-native-orientation-locker';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Svg, { Path, Rect, Circle, Defs, Pattern } from 'react-native-svg';
import { socketService } from '../services/SocketService';
import { hapticsService } from '../services/HapticsService';
import { useTheme } from '../theme/ThemeContext';
import { ConcentricStick } from '../components/ConcentricStick';
import { CloverDpad } from '../components/CloverDpad';
import { RebindModal, ButtonBinding } from '../components/RebindModal';

const GAMEPAD_BINDINGS_KEY = '@remote_mouse_gp_bindings';
const GAMEPAD_PRESET_KEY = '@remote_mouse_gp_preset';
const GAMEPAD_DEADZONE_KEY = '@remote_mouse_gp_deadzone';
const GAMEPAD_SENSITIVITY_KEY = '@remote_mouse_gp_sensitivity';
const GAMEPAD_AMB_MOUSE_ENABLED_KEY = '@remote_mouse_gp_amb_enabled';
const GAMEPAD_AMB_MOUSE_SPEED_KEY = '@remote_mouse_gp_amb_speed';

export type GamepadPreset =
  | 'xbox'
  | 'ps'
  | 'fps'
  | 'rpg'
  | 'racing'
  | 'arcade'
  | 'retro';

interface PresetMeta {
  id: GamepadPreset;
  title: string;
  icon: string;
  badge: string;
  description: string;
}

const GAMEPAD_PRESETS: PresetMeta[] = [
  {
    id: 'xbox',
    title: 'Xbox Pro',
    icon: '🎮',
    badge: 'Asymmetric',
    description: 'High left stick, low D-pad, ABXY diamond, low right stick. Standard PC gaming.',
  },
  {
    id: 'ps',
    title: 'DualSense Pro',
    icon: '🕹️',
    badge: 'Symmetric',
    description: 'High D-pad, low left stick, ABXY diamond, low right stick.',
  },
  {
    id: 'fps',
    title: 'FPS Shooter',
    icon: '🎯',
    badge: 'Trackpad Aim',
    description: 'Left stick WASD movement + dedicated precision trackpad surface for camera aiming.',
  },
  {
    id: 'rpg',
    title: 'Action RPG',
    icon: '⚔️',
    badge: 'Souls-like',
    description: 'Giant Dodge/Sprint key, quick item D-pad, light/heavy attack triggers & lock-on.',
  },
  {
    id: 'racing',
    title: 'Racing & Drive',
    icon: '🏎️',
    badge: 'Smooth Sliders',
    description: 'Horizontal steering rocker + vertical progressive throttle and brake triggers.',
  },
  {
    id: 'arcade',
    title: 'Arcade Fight',
    icon: '🥋',
    badge: '6-Button',
    description: '8-way directional cross + 6-button curved matrix (LP, MP, HP, LK, MK, HK).',
  },
  {
    id: 'retro',
    title: 'Retro Classic',
    icon: '👾',
    badge: 'NES / SNES',
    description: 'Clean cross D-pad + classic 4-button action cluster.',
  },
];

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
  const { isDark, tokens } = useTheme();
  const [preset, setPreset] = useState<GamepadPreset>('xbox');
  const [isPresetModalVisible, setIsPresetModalVisible] = useState<boolean>(false);
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

  // Ambient Touchpad Mouse Engine Configuration
  const [ambientMouseEnabled, setAmbientMouseEnabled] = useState<boolean>(true);
  const [ambientMouseSpeed, setAmbientMouseSpeed] = useState<number>(1.4);

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

  const ambSpeedTrackRef = useRef<View>(null);
  const ambSpeedWidthRef = useRef<number>(200);
  const ambSpeedPageXRef = useRef<number>(0);

  // ================= AMBIENT TOUCHPAD MOUSE ENGINE =================
  const ambLastTouchX = useRef<number>(0);
  const ambLastTouchY = useRef<number>(0);
  const ambTouchStartTime = useRef<number>(0);
  const ambTouchStartX = useRef<number>(0);
  const ambTouchStartY = useRef<number>(0);
  const ambMaxTouches = useRef<number>(0);
  const ambPrevTouchCount = useRef<number>(0);
  const ambLastScrollY = useRef<number>(0);
  const ambIsScrolling = useRef<boolean>(false);

  const ambientMouseSpeedRef = useRef<number>(ambientMouseSpeed);
  ambientMouseSpeedRef.current = ambientMouseSpeed;

  const ambientMouseEnabledRef = useRef<boolean>(ambientMouseEnabled);
  ambientMouseEnabledRef.current = ambientMouseEnabled;

  const ambientPanResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => ambientMouseEnabledRef.current,
      onMoveShouldSetPanResponder: () => ambientMouseEnabledRef.current,
      onStartShouldSetPanResponderCapture: () => false,
      onMoveShouldSetPanResponderCapture: () => false,

      onPanResponderGrant: (evt) => {
        const now = Date.now();
        const touches = evt.nativeEvent.touches;
        const numTouches = touches.length;

        ambMaxTouches.current = numTouches;
        ambPrevTouchCount.current = numTouches;
        ambIsScrolling.current = false;
        ambTouchStartTime.current = now;

        if (numTouches === 1) {
          const x = touches[0].pageX;
          const y = touches[0].pageY;
          ambTouchStartX.current = x;
          ambTouchStartY.current = y;
          ambLastTouchX.current = x;
          ambLastTouchY.current = y;
        } else if (numTouches === 2) {
          const avgY = (touches[0].pageY + touches[1].pageY) / 2;
          ambLastScrollY.current = avgY;
        }
      },

      onPanResponderMove: (evt) => {
        const touches = evt.nativeEvent.touches;
        const numTouches = touches.length;

        if (numTouches > ambMaxTouches.current) {
          ambMaxTouches.current = numTouches;
        }

        if (numTouches !== ambPrevTouchCount.current) {
          ambPrevTouchCount.current = numTouches;
          if (numTouches === 1) {
            ambLastTouchX.current = touches[0].pageX;
            ambLastTouchY.current = touches[0].pageY;
          } else if (numTouches === 2) {
            ambLastScrollY.current = (touches[0].pageY + touches[1].pageY) / 2;
          }
          return;
        }

        // Two-Finger Ambient Scrolling
        if (numTouches === 2) {
          const avgY = (touches[0].pageY + touches[1].pageY) / 2;
          const deltaY = ambLastScrollY.current - avgY;
          ambLastScrollY.current = avgY;
          if (Math.abs(deltaY) > 0.4) {
            ambIsScrolling.current = true;
            socketService.scroll(0, deltaY * 1.8);
          }
          return;
        }

        // Single-Finger Ambient Cursor Move
        if (numTouches === 1) {
          const x = touches[0].pageX;
          const y = touches[0].pageY;
          const rawDx = x - ambLastTouchX.current;
          const rawDy = y - ambLastTouchY.current;
          ambLastTouchX.current = x;
          ambLastTouchY.current = y;

          if (Math.abs(rawDx) > 0.1 || Math.abs(rawDy) > 0.1) {
            const dist = Math.sqrt(rawDx * rawDx + rawDy * rawDy);
            let factor = 1.0;
            if (dist > 6.0) factor = 2.2;
            else if (dist > 1.5) factor = 1.4;

            socketService.move(
              rawDx * factor * ambientMouseSpeedRef.current,
              rawDy * factor * ambientMouseSpeedRef.current
            );
          }
        }
      },

      onPanResponderRelease: (evt) => {
        const now = Date.now();
        const duration = now - ambTouchStartTime.current;
        const highestTouchCount = ambMaxTouches.current;

        // Two-Finger Tap -> Right Click
        if (highestTouchCount === 2 && !ambIsScrolling.current && duration < 320) {
          socketService.click('right');
          hapticsService.light();
          return;
        }

        // Single-Finger Tap -> Left Click
        if (highestTouchCount === 1) {
          const totalDx = Math.abs(evt.nativeEvent.pageX - ambTouchStartX.current);
          const totalDy = Math.abs(evt.nativeEvent.pageY - ambTouchStartY.current);
          const totalDist = Math.sqrt(totalDx * totalDx + totalDy * totalDy);

          if (totalDist < 10 && duration < 280) {
            socketService.click('left');
            hapticsService.light();
          }
        }
      },
    })
  ).current;

  // ================= LIFECYCLE & STORAGE =================
  useEffect(() => {
    const subscription = Dimensions.addEventListener('change', ({ window }) => {
      setIsLandscape(window.width > window.height);
    });

    loadSavedSettings();

    return () => {
      subscription?.remove();
      socketService.gamepadReleaseAll();
      try {
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
      const [savedBindings, savedPreset, savedDeadzone, savedSens, savedAmbEnabled, savedAmbSpeed] = await Promise.all([
        AsyncStorage.getItem(GAMEPAD_BINDINGS_KEY),
        AsyncStorage.getItem(GAMEPAD_PRESET_KEY),
        AsyncStorage.getItem(GAMEPAD_DEADZONE_KEY),
        AsyncStorage.getItem(GAMEPAD_SENSITIVITY_KEY),
        AsyncStorage.getItem(GAMEPAD_AMB_MOUSE_ENABLED_KEY),
        AsyncStorage.getItem(GAMEPAD_AMB_MOUSE_SPEED_KEY),
      ]);

      if (savedBindings) setBindings(JSON.parse(savedBindings));
      if (savedPreset) setPreset(savedPreset as GamepadPreset);
      if (savedDeadzone) setDeadzone(parseFloat(savedDeadzone));
      if (savedSens) setStickSensitivity(parseFloat(savedSens));
      if (savedAmbEnabled !== null) setAmbientMouseEnabled(savedAmbEnabled === 'true');
      if (savedAmbSpeed) setAmbientMouseSpeed(parseFloat(savedAmbSpeed));
    } catch (e) {}
  };

  const handleSelectPreset = (p: GamepadPreset) => {
    setPreset(p);
    AsyncStorage.setItem(GAMEPAD_PRESET_KEY, p).catch(() => {});
    setIsPresetModalVisible(false);
    hapticsService.light();
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

  // Direct Key Pulse/Hold Helper for Preset Custom Actions
  const handleKeyDirectIn = (key: string, isClick = false) => {
    if (isClick) {
      socketService.key(key, 'tap');
    } else {
      socketService.key(key, 'press');
    }
    hapticsService.gamepadButton();
  };

  const handleKeyDirectOut = (key: string) => {
    socketService.key(key, 'release');
  };

  // ================= SLIDER PAN RESPONDERS =================
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

  const updateAmbSpeedFromPageX = (pageX: number) => {
    const width = ambSpeedWidthRef.current || 200;
    const x = pageX - ambSpeedPageXRef.current;
    const fraction = Math.max(0, Math.min(1, x / width));
    const val = parseFloat((0.5 + fraction * 2.5).toFixed(1));
    setAmbientMouseSpeed(val);
    AsyncStorage.setItem(GAMEPAD_AMB_MOUSE_SPEED_KEY, val.toString()).catch(() => {});
  };

  const ambSpeedPanResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (evt) => {
        updateAmbSpeedFromPageX(evt.nativeEvent.pageX);
        hapticsService.light();
      },
      onPanResponderMove: (evt) => {
        updateAmbSpeedFromPageX(evt.nativeEvent.pageX);
      },
    })
  ).current;

  // ================= CLUSTER RENDERERS =================
  const renderABXYCluster = () => (
    <View style={styles.diamondGrid}>
      <TouchableOpacity
        style={[styles.jewelBtn, styles.btnY, activeButton === 'Y' && styles.btnYActive]}
        onPressIn={() => handleButtonPressIn('Y')}
        onPressOut={() => handleButtonPressOut('Y')}
        activeOpacity={1}
      >
        <Text style={[styles.jewelBtnText, styles.textY]}>{getButtonText('Y')}</Text>
      </TouchableOpacity>

      <View style={styles.diamondMidRow}>
        <TouchableOpacity
          style={[styles.jewelBtn, styles.btnX, activeButton === 'X' && styles.btnXActive]}
          onPressIn={() => handleButtonPressIn('X')}
          onPressOut={() => handleButtonPressOut('X')}
          activeOpacity={1}
        >
          <Text style={[styles.jewelBtnText, styles.textX]}>{getButtonText('X')}</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.jewelBtn, styles.btnB, activeButton === 'B' && styles.btnBActive]}
          onPressIn={() => handleButtonPressIn('B')}
          onPressOut={() => handleButtonPressOut('B')}
          activeOpacity={1}
        >
          <Text style={[styles.jewelBtnText, styles.textB]}>{getButtonText('B')}</Text>
        </TouchableOpacity>
      </View>

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

  // Arcade 6-Button Matrix
  const renderArcadeCluster = () => (
    <View style={styles.arcadeGrid}>
      <View style={styles.arcadeRow}>
        <TouchableOpacity style={styles.arcadeBtn} onPressIn={() => handleKeyDirectIn('u')} onPressOut={() => handleKeyDirectOut('u')}>
          <Text style={styles.arcadeBtnText}>LP</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.arcadeBtn} onPressIn={() => handleKeyDirectIn('i')} onPressOut={() => handleKeyDirectOut('i')}>
          <Text style={styles.arcadeBtnText}>MP</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.arcadeBtn, styles.arcadeBtnHeavy]} onPressIn={() => handleKeyDirectIn('o')} onPressOut={() => handleKeyDirectOut('o')}>
          <Text style={styles.arcadeBtnText}>HP</Text>
        </TouchableOpacity>
      </View>
      <View style={styles.arcadeRow}>
        <TouchableOpacity style={styles.arcadeBtn} onPressIn={() => handleKeyDirectIn('j')} onPressOut={() => handleKeyDirectOut('j')}>
          <Text style={styles.arcadeBtnText}>LK</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.arcadeBtn} onPressIn={() => handleKeyDirectIn('k')} onPressOut={() => handleKeyDirectOut('k')}>
          <Text style={styles.arcadeBtnText}>MK</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.arcadeBtn, styles.arcadeBtnHeavy]} onPressIn={() => handleKeyDirectIn('l')} onPressOut={() => handleKeyDirectOut('l')}>
          <Text style={styles.arcadeBtnText}>HK</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  // FPS Dedicated Aiming Trackpad
  const renderFpsAimSurface = () => (
    <View style={styles.fpsAimContainer}>
      <View style={StyleSheet.absoluteFillObject} pointerEvents="none">
        <Svg width="100%" height="100%">
          <Defs>
            <Pattern id="fps-aim-dots" width="14" height="14" patternUnits="userSpaceOnUse">
              <Circle cx="7" cy="7" r="1.0" fill="rgba(96, 165, 250, 0.12)" />
            </Pattern>
          </Defs>
          <Rect width="100%" height="100%" fill="url(#fps-aim-dots)" />
        </Svg>
      </View>
      <View style={styles.fpsReticle}>
        <Text style={styles.fpsReticleText}>🎯 1:1 Trackpad Aim Area</Text>
      </View>
      <View style={styles.fpsActionStrip}>
        <TouchableOpacity style={styles.fpsActionBtn} onPressIn={() => handleKeyDirectIn('space', true)}>
          <Text style={styles.fpsActionText}>Jump ⎵</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.fpsActionBtn} onPressIn={() => handleKeyDirectIn('r', true)}>
          <Text style={styles.fpsActionText}>Reload 🔄</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.fpsActionBtn} onPressIn={() => handleKeyDirectIn('c', true)}>
          <Text style={styles.fpsActionText}>Crouch ↧</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  // Racing Pedals & Shifter
  const renderRacingPedals = () => (
    <View style={styles.racingContainer}>
      <View style={styles.pedalsRow}>
        <TouchableOpacity
          style={[styles.pedalBtn, styles.brakePedal]}
          onPressIn={() => handleKeyDirectIn('s')}
          onPressOut={() => handleKeyDirectOut('s')}
        >
          <Text style={styles.pedalBadge}>LT</Text>
          <Text style={styles.pedalTitle}>BRAKE</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.pedalBtn, styles.gasPedal]}
          onPressIn={() => handleKeyDirectIn('w')}
          onPressOut={() => handleKeyDirectOut('w')}
        >
          <Text style={styles.pedalBadge}>RT</Text>
          <Text style={styles.pedalTitle}>THROTTLE</Text>
        </TouchableOpacity>
      </View>
      <View style={styles.racingGearRow}>
        <TouchableOpacity style={styles.racingGearBtn} onPressIn={() => handleKeyDirectIn('space', true)}>
          <Text style={styles.racingGearText}>HANDBRAKE</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.racingGearBtn, styles.nitroBtn]} onPressIn={() => handleKeyDirectIn('shift')}>
          <Text style={styles.nitroText}>NITRO 🔥</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  const currentPresetMeta = GAMEPAD_PRESETS.find((p) => p.id === preset) || GAMEPAD_PRESETS[0];

  return (
    <View style={[styles.container, { backgroundColor: tokens.bgObsidian }, isFullscreen && styles.containerFullscreen]}>
      {/* ================= HEADER CONTROLLER TOOLBAR ================= */}
      <View style={[styles.headerToolbar, { backgroundColor: tokens.bgSurface, borderBottomColor: tokens.borderSubtle }]}>
        <View style={styles.headerLeftGroup}>
          {/* Preset Selector Pill */}
          <TouchableOpacity
            style={styles.presetPill}
            onPress={() => {
              setIsPresetModalVisible(true);
              hapticsService.light();
            }}
            activeOpacity={0.8}
          >
            <Text style={styles.presetPillIcon}>{currentPresetMeta.icon}</Text>
            <Text style={styles.presetPillText}>{currentPresetMeta.title}</Text>
            <Text style={styles.presetPillArrow}>▾</Text>
          </TouchableOpacity>

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
          {/* Ambient Mouse Indicator Badge */}
          {ambientMouseEnabled && (
            <View style={styles.ambIndicatorBadge}>
              <View style={styles.ambDot} />
              <Text style={styles.ambText}>Mouse Active</Text>
            </View>
          )}

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

        {/* Center System Navigation Pills */}
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

      {/* ================= CONTROLLER MAIN COCKPIT & AMBIENT CANVAS ================= */}
      <View style={styles.ambientCanvasWrapper} {...ambientPanResponder.panHandlers}>
        {isLandscape ? (
          /* Widescreen Landscape Cockpit */
          <View style={styles.consoleBodyLandscape}>
            {/* Left Wing */}
            <View style={styles.wingLandscape}>
              {preset === 'ps' ? (
                <>
                  <View style={styles.wingCell}><CloverDpad size={112} /></View>
                  <View style={styles.wingCell}><ConcentricStick label="LS" size={124} deadzone={deadzone} sensitivity={stickSensitivity} /></View>
                </>
              ) : preset === 'racing' ? (
                <>
                  <View style={styles.wingCell}><ConcentricStick label="STEER" size={128} deadzone={deadzone} sensitivity={stickSensitivity} /></View>
                  <View style={styles.wingCell}><CloverDpad size={106} /></View>
                </>
              ) : (
                <>
                  <View style={styles.wingCell}><ConcentricStick label="LS" size={124} deadzone={deadzone} sensitivity={stickSensitivity} /></View>
                  <View style={styles.wingCell}><CloverDpad size={112} /></View>
                </>
              )}
            </View>

            {/* Center Bridge (Ambient Touchpad Information) */}
            <View style={styles.centerBridgeLandscape}>
              <View style={styles.bridgeInfoPill}>
                <Text style={styles.bridgeInfoText}>
                  {currentPresetMeta.title.toUpperCase()} • AMBIENT MOUSE {ambientMouseEnabled ? 'ON' : 'OFF'}
                </Text>
                <Text style={styles.bridgeSubText}>
                  Swipe blank canvas to aim/move cursor • 1-Tap Left • 2-Tap Right
                </Text>
              </View>
            </View>

            {/* Right Wing */}
            <View style={styles.wingLandscape}>
              {preset === 'fps' ? (
                renderFpsAimSurface()
              ) : preset === 'racing' ? (
                renderRacingPedals()
              ) : preset === 'arcade' ? (
                renderArcadeCluster()
              ) : (
                <>
                  <View style={styles.wingCell}>{renderABXYCluster()}</View>
                  <View style={styles.wingCell}>
                    <ConcentricStick label="RS" isRightStick size={124} deadzone={deadzone} sensitivity={stickSensitivity} />
                  </View>
                </>
              )}
            </View>
          </View>
        ) : (
          /* Native Portrait Console (Default) */
          <View style={styles.consoleBodyPortrait}>
            <View style={styles.portraitGrid}>
              {/* Left Control Column */}
              <View style={styles.portraitColumn}>
                <View style={styles.portraitCell}>
                  <ConcentricStick label="LS" size={126} deadzone={deadzone} sensitivity={stickSensitivity} />
                </View>
                <View style={styles.portraitCell}>
                  <CloverDpad size={112} />
                </View>
              </View>

              {/* Right Control Column */}
              <View style={styles.portraitColumn}>
                {preset === 'fps' ? (
                  renderFpsAimSurface()
                ) : preset === 'racing' ? (
                  renderRacingPedals()
                ) : preset === 'arcade' ? (
                  renderArcadeCluster()
                ) : (
                  <>
                    <View style={styles.portraitCell}>
                      {renderABXYCluster()}
                    </View>
                    <View style={styles.portraitCell}>
                      <ConcentricStick label="RS" isRightStick size={126} deadzone={deadzone} sensitivity={stickSensitivity} />
                    </View>
                  </>
                )}
              </View>
            </View>

            {/* Bottom Console Info Ribbon */}
            <View style={styles.portraitFooter}>
              <Text style={styles.portraitFooterText}>
                {currentPresetMeta.title} • Ambient Mouse: {ambientMouseEnabled ? `${ambientMouseSpeed}× Active` : 'Disabled'} • Swipe blank space for PC cursor
              </Text>
            </View>
          </View>
        )}
      </View>

      {/* ================= PRESET SELECTION MODAL ================= */}
      <Modal
        visible={isPresetModalVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setIsPresetModalVisible(false)}
      >
        <TouchableOpacity
          style={styles.modalBackdrop}
          activeOpacity={1}
          onPress={() => setIsPresetModalVisible(false)}
        >
          <TouchableOpacity
            style={styles.presetModalCard}
            activeOpacity={1}
            onPress={(e) => e.stopPropagation()}
          >
            <View style={styles.modalHeaderRow}>
              <View style={styles.modalTitleBox}>
                <Text style={styles.modalTitle}>Select Gamepad Preset</Text>
                <Text style={styles.modalSubtitle}>Optimized ergonomics for different PC game genres</Text>
              </View>
              <TouchableOpacity
                style={styles.modalCloseBtn}
                onPress={() => setIsPresetModalVisible(false)}
              >
                <Text style={styles.modalCloseText}>✕</Text>
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.presetList} showsVerticalScrollIndicator={false}>
              {GAMEPAD_PRESETS.map((p) => {
                const isSelected = p.id === preset;
                return (
                  <TouchableOpacity
                    key={p.id}
                    style={[styles.presetCard, isSelected && styles.presetCardSelected]}
                    onPress={() => handleSelectPreset(p.id)}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.presetCardIcon}>{p.icon}</Text>
                    <View style={styles.presetCardContent}>
                      <View style={styles.presetCardTitleRow}>
                        <Text style={[styles.presetCardTitle, isSelected && styles.presetCardTitleSelected]}>
                          {p.title}
                        </Text>
                        <View style={styles.presetBadge}>
                          <Text style={styles.presetBadgeText}>{p.badge}</Text>
                        </View>
                      </View>
                      <Text style={styles.presetCardDescription}>{p.description}</Text>
                    </View>
                    {isSelected && (
                      <View style={styles.selectedCheck}>
                        <Text style={styles.selectedCheckText}>✓</Text>
                      </View>
                    )}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      {/* ================= TUNING & AMBIENT MOUSE DRAWER ================= */}
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
                <Text style={styles.tuningTitle}>Gamepad & Mouse Tuning</Text>
              </View>
              <TouchableOpacity
                style={styles.tuningCloseBtn}
                onPress={() => setIsTuningModalVisible(false)}
                activeOpacity={0.7}
              >
                <Text style={styles.tuningCloseText}>✕</Text>
              </TouchableOpacity>
            </View>

            {/* Ambient Mouse Toggle */}
            <View style={styles.toggleRow}>
              <View>
                <Text style={styles.toggleLabel}>Ambient Touchpad Mouse</Text>
                <Text style={styles.toggleSubtext}>Use empty screen areas as PC cursor trackpad</Text>
              </View>
              <TouchableOpacity
                style={[styles.togglePill, ambientMouseEnabled && styles.togglePillActive]}
                onPress={() => {
                  const next = !ambientMouseEnabled;
                  setAmbientMouseEnabled(next);
                  AsyncStorage.setItem(GAMEPAD_AMB_MOUSE_ENABLED_KEY, next.toString()).catch(() => {});
                  hapticsService.light();
                }}
              >
                <Text style={[styles.togglePillText, ambientMouseEnabled && styles.togglePillTextActive]}>
                  {ambientMouseEnabled ? 'ON' : 'OFF'}
                </Text>
              </TouchableOpacity>
            </View>

            {/* Ambient Mouse Speed */}
            {ambientMouseEnabled && (
              <View style={styles.tuningSection}>
                <View style={styles.tuningRowHeader}>
                  <Text style={styles.tuningSectionLabel}>Ambient Cursor Speed</Text>
                  <Text style={styles.tuningValueBadge}>{ambientMouseSpeed.toFixed(1)}×</Text>
                </View>
                <View style={styles.sliderHitBox} {...ambSpeedPanResponder.panHandlers}>
                  <View
                    ref={ambSpeedTrackRef}
                    style={styles.sliderTrack}
                    onLayout={() => {
                      ambSpeedTrackRef.current?.measure((_x, _y, width, _height, pageX, _pageY) => {
                        if (width > 0) {
                          ambSpeedWidthRef.current = width;
                          ambSpeedPageXRef.current = pageX;
                        }
                      });
                    }}
                  >
                    <View
                      style={[
                        styles.sliderFill,
                        { width: `${Math.min(100, Math.max(0, ((ambientMouseSpeed - 0.5) / 2.5) * 100))}%` },
                      ]}
                    />
                    <View
                      style={[
                        styles.sliderThumb,
                        { left: `${Math.min(100, Math.max(0, ((ambientMouseSpeed - 0.5) / 2.5) * 100))}%` },
                      ]}
                    />
                  </View>
                </View>
              </View>
            )}

            {/* Stick Deadzone */}
            <View style={styles.tuningSection}>
              <View style={styles.tuningRowHeader}>
                <Text style={styles.tuningSectionLabel}>Thumbstick Inner Deadzone</Text>
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
            </View>

            {/* Aim Sensitivity */}
            <View style={styles.tuningSection}>
              <View style={styles.tuningRowHeader}>
                <Text style={styles.tuningSectionLabel}>Stick Aim Sensitivity</Text>
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
  presetPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#161824',
    paddingHorizontal: 9,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(59, 130, 246, 0.3)',
  },
  presetPillIcon: {
    fontSize: 12,
  },
  presetPillText: {
    color: '#93c5fd',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  presetPillArrow: {
    color: '#60a5fa',
    fontSize: 10,
    fontWeight: '800',
  },
  headerPill: {
    backgroundColor: '#161824',
    paddingHorizontal: 8,
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
  ambIndicatorBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
    paddingHorizontal: 7,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.25)',
  },
  ambDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: '#10b981',
  },
  ambText: {
    fontSize: 9,
    fontWeight: '700',
    color: '#34d399',
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

  // Ambient Canvas Wrapper (Intercepts touches on negative space)
  ambientCanvasWrapper: {
    flex: 1,
    position: 'relative',
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
    fontSize: 9.5,
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
    width: 155,
    height: '100%',
    justifyContent: 'space-evenly',
    alignItems: 'center',
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
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    alignItems: 'center',
  },
  bridgeInfoText: {
    color: '#64748b',
    fontSize: 9.5,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  bridgeSubText: {
    color: '#475569',
    fontSize: 8.5,
    fontWeight: '600',
    marginTop: 2,
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

  // FPS Aim Surface Styles
  fpsAimContainer: {
    width: '95%',
    height: 200,
    backgroundColor: '#12141f',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(96, 165, 250, 0.25)',
    justifyContent: 'space-between',
    padding: 8,
    overflow: 'hidden',
  },
  fpsReticle: {
    alignItems: 'center',
    paddingTop: 8,
  },
  fpsReticleText: {
    color: '#60a5fa',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.4,
  },
  fpsActionStrip: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    gap: 4,
  },
  fpsActionBtn: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  fpsActionText: {
    color: '#cbd5e1',
    fontSize: 10,
    fontWeight: '700',
  },

  // Arcade Styles
  arcadeGrid: {
    gap: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  arcadeRow: {
    flexDirection: 'row',
    gap: 6,
  },
  arcadeBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#1e2130',
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  arcadeBtnHeavy: {
    borderColor: '#f59e0b',
  },
  arcadeBtnText: {
    color: '#f8fafc',
    fontSize: 11,
    fontWeight: '800',
  },

  // Racing Pedals Styles
  racingContainer: {
    width: '95%',
    alignItems: 'center',
    gap: 8,
  },
  pedalsRow: {
    flexDirection: 'row',
    gap: 8,
    width: '100%',
    justifyContent: 'center',
  },
  pedalBtn: {
    width: 64,
    height: 100,
    borderRadius: 10,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 6,
  },
  brakePedal: {
    backgroundColor: '#201316',
    borderColor: '#ef4444',
  },
  gasPedal: {
    backgroundColor: '#132018',
    borderColor: '#22c55e',
  },
  pedalBadge: {
    fontSize: 10,
    fontWeight: '800',
    color: '#94a3b8',
    marginBottom: 4,
  },
  pedalTitle: {
    fontSize: 10,
    fontWeight: '900',
    color: '#ffffff',
    letterSpacing: 0.5,
  },
  racingGearRow: {
    flexDirection: 'row',
    gap: 6,
  },
  racingGearBtn: {
    backgroundColor: '#1a1c28',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
  },
  racingGearText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#cbd5e1',
  },
  nitroBtn: {
    backgroundColor: '#251b10',
    borderColor: '#f59e0b',
  },
  nitroText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#fbbf24',
  },

  // Preset Selection Modal
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.78)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  presetModalCard: {
    width: '100%',
    maxWidth: 400,
    maxHeight: '82%',
    backgroundColor: '#141622',
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
  modalHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 14,
  },
  modalTitleBox: {
    flex: 1,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#ffffff',
  },
  modalSubtitle: {
    fontSize: 11,
    color: '#94a3b8',
    marginTop: 2,
  },
  modalCloseBtn: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalCloseText: {
    color: '#9ca3af',
    fontSize: 12,
    fontWeight: '600',
  },
  presetList: {
    marginTop: 4,
  },
  presetCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1b1d2c',
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.07)',
  },
  presetCardSelected: {
    borderColor: '#3b82f6',
    backgroundColor: 'rgba(59, 130, 246, 0.12)',
  },
  presetCardIcon: {
    fontSize: 22,
    marginRight: 12,
  },
  presetCardContent: {
    flex: 1,
  },
  presetCardTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 2,
  },
  presetCardTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#f8fafc',
  },
  presetCardTitleSelected: {
    color: '#60a5fa',
  },
  presetBadge: {
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 4,
  },
  presetBadgeText: {
    fontSize: 9,
    fontWeight: '700',
    color: '#94a3b8',
  },
  presetCardDescription: {
    fontSize: 11,
    color: '#64748b',
    lineHeight: 14,
  },
  selectedCheck: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#3b82f6',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },
  selectedCheckText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '900',
  },

  // Tuning Card
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
  toggleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.08)',
    marginBottom: 8,
  },
  toggleLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#f1f5f9',
  },
  toggleSubtext: {
    fontSize: 9.5,
    color: '#64748b',
    marginTop: 1,
  },
  togglePill: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  togglePillActive: {
    backgroundColor: 'rgba(16, 185, 129, 0.2)',
    borderColor: '#10b981',
  },
  togglePillText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#94a3b8',
  },
  togglePillTextActive: {
    color: '#34d399',
  },
  tuningSection: {
    marginVertical: 6,
  },
  tuningRowHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 5,
  },
  tuningSectionLabel: {
    fontSize: 11.5,
    fontWeight: '600',
    color: '#cbd5e1',
  },
  tuningValueBadge: {
    fontSize: 12,
    fontWeight: '700',
    color: '#60a5fa',
  },
  sliderHitBox: {
    height: 32,
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
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#ffffff',
    borderWidth: 3,
    borderColor: '#3b82f6',
    marginLeft: -9,
    elevation: 3,
  },
});

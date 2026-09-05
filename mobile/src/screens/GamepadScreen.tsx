import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';
import Orientation from 'react-native-orientation-locker';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Colors } from '../theme/colors';
import { socketService } from '../services/SocketService';
import { hapticsService } from '../services/HapticsService';
import { ConcentricStick } from '../components/ConcentricStick';
import { CloverDpad } from '../components/CloverDpad';
import { RebindModal, ButtonBinding } from '../components/RebindModal';

const GAMEPAD_BINDINGS_KEY = '@remote_mouse_gp_bindings';

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
  const [layout, setLayout] = useState<'asymmetric' | 'symmetric'>('asymmetric');
  const [labelMode, setLabelMode] = useState<0 | 1 | 2>(0); // 0: Controller, 1: Action, 2: Key
  const [bindings, setBindings] = useState<Record<string, ButtonBinding>>(DEFAULT_BINDINGS);
  const [activeButton, setActiveButton] = useState<string | null>(null);

  const [rebindTarget, setRebindTarget] = useState<ButtonBinding | null>(null);
  const [rebindModalVisible, setRebindModalVisible] = useState(false);

  const longPressTimer = useRef<any>(null);

  useEffect(() => {
    try {
      Orientation.lockToLandscape();
    } catch (e) {}

    loadBindings();

    return () => {
      socketService.gamepadReleaseAll();
      try {
        Orientation.unlockAllOrientations();
      } catch (e) {}
    };
  }, []);

  const loadBindings = async () => {
    try {
      const data = await AsyncStorage.getItem(GAMEPAD_BINDINGS_KEY);
      if (data) {
        setBindings(JSON.parse(data));
      }
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

  const cycleLabelMode = () => {
    const next = ((labelMode + 1) % 3) as 0 | 1 | 2;
    setLabelMode(next);
    hapticsService.dpad();
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

  return (
    <View style={[styles.container, isFullscreen && styles.containerFullscreen]}>
      {/* Top Shoulder & Trigger Bar with Curved Corner Pads */}
      <View style={styles.topShoulderBar}>
        {/* Left Shoulder Group */}
        <View style={styles.shoulderGroup}>
          <TouchableOpacity
            style={[styles.shoulderBtn, styles.triggerBtn, activeButton === 'LT' && styles.triggerActive]}
            onPressIn={() => handleButtonPressIn('LT', true)}
            onPressOut={() => handleButtonPressOut('LT')}
            activeOpacity={1}
            focusable={false}
          >
            <Text style={styles.shoulderBtnText}>{getButtonText('LT')}</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.shoulderBtn, styles.bumperBtn, activeButton === 'LB' && styles.bumperActive]}
            onPressIn={() => handleButtonPressIn('LB', false, true)}
            onPressOut={() => handleButtonPressOut('LB')}
            activeOpacity={1}
            focusable={false}
          >
            <Text style={styles.shoulderBtnText}>{getButtonText('LB')}</Text>
          </TouchableOpacity>
        </View>

        {/* Center Control Toolbar */}
        <View style={styles.centerControlGroup}>
          <TouchableOpacity
            style={styles.layoutToggle}
            onPress={() => {
              socketService.gamepadReleaseAll();
              setLayout(layout === 'asymmetric' ? 'symmetric' : 'asymmetric');
              hapticsService.dpad();
            }}
            activeOpacity={0.85}
            focusable={false}
          >
            <Text style={styles.layoutToggleText}>
              {layout === 'asymmetric' ? 'Xbox (Asym)' : 'PS (Sym)'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.labelModePill}
            onPress={cycleLabelMode}
            activeOpacity={0.85}
            focusable={false}
          >
            <Text style={styles.labelModeText}>
              Labels: {labelMode === 0 ? 'Buttons' : labelMode === 1 ? 'Actions' : 'PC Keys'}
            </Text>
          </TouchableOpacity>

          {onToggleFullscreen && (
            <TouchableOpacity
              style={[styles.fullscreenToggle, isFullscreen && styles.fullscreenToggleActive]}
              onPress={onToggleFullscreen}
              activeOpacity={0.85}
              focusable={false}
            >
              <Text style={[styles.fullscreenToggleText, isFullscreen && styles.fullscreenToggleTextActive]}>
                {isFullscreen ? '✕ Exit' : '⛶ Full'}
              </Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Right Shoulder Group */}
        <View style={styles.shoulderGroup}>
          <TouchableOpacity
            style={[styles.shoulderBtn, styles.bumperBtn, activeButton === 'RB' && styles.bumperActive]}
            onPressIn={() => handleButtonPressIn('RB', false, true)}
            onPressOut={() => handleButtonPressOut('RB')}
            activeOpacity={1}
            focusable={false}
          >
            <Text style={styles.shoulderBtnText}>{getButtonText('RB')}</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.shoulderBtn, styles.triggerBtn, activeButton === 'RT' && styles.triggerActive]}
            onPressIn={() => handleButtonPressIn('RT', true)}
            onPressOut={() => handleButtonPressOut('RT')}
            activeOpacity={1}
            focusable={false}
          >
            <Text style={styles.shoulderBtnText}>{getButtonText('RT')}</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Main Handheld Controller Canvas */}
      <View style={styles.consoleBody}>
        <View style={styles.layoutContainer}>
          {/* ================= LEFT WING ================= */}
          <View style={styles.wing}>
            {layout === 'asymmetric' ? (
              /* Xbox Mode: Left Stick on TOP (natural thumb rest), D-Pad on BOTTOM */
              <>
                <View style={styles.wingUpper}>
                  <ConcentricStick label="LS" size={114} />
                </View>
                <View style={styles.wingLower}>
                  <CloverDpad size={106} />
                </View>
              </>
            ) : (
              /* PS Mode: D-Pad on TOP, Left Stick on BOTTOM */
              <>
                <View style={styles.wingUpper}>
                  <CloverDpad size={106} />
                </View>
                <View style={styles.wingLower}>
                  <ConcentricStick label="LS" size={114} />
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
              <Text style={styles.centerBadgeText}>PRO GAMEPAD</Text>
            </View>

            {/* Safety Release Panic Button */}
            <TouchableOpacity
              style={styles.centerUtilityBtn}
              onPress={() => socketService.gamepadReleaseAll()}
              activeOpacity={0.85}
              focusable={false}
            >
              <Text style={styles.centerUtilityText}>SAFETY RELEASE</Text>
            </TouchableOpacity>
          </View>

          {/* ================= RIGHT WING ================= */}
          <View style={styles.wing}>
            {/* Action Diamond ABXY is ALWAYS on TOP (Primary Thumb Reach) */}
            <View style={styles.wingUpper}>
              <View style={styles.diamondGrid}>
                {/* Y (Top) */}
                <TouchableOpacity
                  style={[styles.actionBtn, styles.btnY, activeButton === 'Y' && styles.btnYActive]}
                  onPressIn={() => handleButtonPressIn('Y')}
                  onPressOut={() => handleButtonPressOut('Y')}
                  activeOpacity={1}
                  focusable={false}
                >
                  <Text style={[styles.actionBtnText, styles.textY]}>{getButtonText('Y')}</Text>
                </TouchableOpacity>

                {/* X (Left) & B (Right) */}
                <View style={styles.diamondMidRow}>
                  <TouchableOpacity
                    style={[styles.actionBtn, styles.btnX, activeButton === 'X' && styles.btnXActive]}
                    onPressIn={() => handleButtonPressIn('X')}
                    onPressOut={() => handleButtonPressOut('X')}
                    activeOpacity={1}
                    focusable={false}
                  >
                    <Text style={[styles.actionBtnText, styles.textX]}>{getButtonText('X')}</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.actionBtn, styles.btnB, activeButton === 'B' && styles.btnBActive]}
                    onPressIn={() => handleButtonPressIn('B')}
                    onPressOut={() => handleButtonPressOut('B')}
                    activeOpacity={1}
                    focusable={false}
                  >
                    <Text style={[styles.actionBtnText, styles.textB]}>{getButtonText('B')}</Text>
                  </TouchableOpacity>
                </View>

                {/* A (Bottom) */}
                <TouchableOpacity
                  style={[styles.actionBtn, styles.btnA, activeButton === 'A' && styles.btnAActive]}
                  onPressIn={() => handleButtonPressIn('A')}
                  onPressOut={() => handleButtonPressOut('A')}
                  activeOpacity={1}
                  focusable={false}
                >
                  <Text style={[styles.actionBtnText, styles.textA]}>{getButtonText('A')}</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Right Stick is on BOTTOM for Camera / Aim */}
            <View style={styles.wingLower}>
              <ConcentricStick label="RS" isRightStick size={114} />
            </View>
          </View>
        </View>
      </View>

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
    backgroundColor: Colors.gpBg,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  containerFullscreen: {
    paddingHorizontal: 4,
    paddingVertical: 2,
  },
  topShoulderBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 3,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.08)',
  },
  shoulderGroup: {
    flexDirection: 'row',
    gap: 6,
  },
  shoulderBtn: {
    backgroundColor: '#1e202c',
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 3,
  },
  triggerBtn: {
    borderTopLeftRadius: 14,
    borderTopRightRadius: 14,
    backgroundColor: '#1b1d28',
    borderColor: 'rgba(79, 140, 255, 0.3)',
  },
  bumperBtn: {
    borderRadius: 8,
    backgroundColor: '#202230',
  },
  triggerActive: {
    backgroundColor: 'rgba(79, 140, 255, 0.3)',
    borderColor: '#60a5fa',
    transform: [{ scale: 0.96 }],
  },
  bumperActive: {
    backgroundColor: 'rgba(79, 140, 255, 0.25)',
    borderColor: '#60a5fa',
    transform: [{ scale: 0.96 }],
  },
  shoulderBtnText: {
    color: '#e2e8f0',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  centerControlGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  layoutToggle: {
    backgroundColor: '#20222e',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 7,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
  },
  layoutToggleText: {
    color: Colors.accent,
    fontSize: 10.5,
    fontWeight: '700',
  },
  labelModePill: {
    backgroundColor: '#20222e',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 7,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  labelModeText: {
    color: '#94a3b8',
    fontSize: 10.5,
    fontWeight: '600',
  },
  fullscreenToggle: {
    backgroundColor: '#20222e',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 7,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.14)',
  },
  fullscreenToggleActive: {
    backgroundColor: 'rgba(52, 211, 153, 0.2)',
    borderColor: '#34d399',
  },
  fullscreenToggleText: {
    color: '#e5e5ea',
    fontSize: 10.5,
    fontWeight: '700',
  },
  fullscreenToggleTextActive: {
    color: '#34d399',
  },
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
    width: 140,
    height: '100%',
    justifyContent: 'space-evenly',
    alignItems: 'center',
    paddingVertical: 4,
  },
  wingUpper: {
    height: 120,
    justifyContent: 'center',
    alignItems: 'center',
  },
  wingLower: {
    height: 120,
    justifyContent: 'center',
    alignItems: 'center',
  },
  centerDeck: {
    flex: 1,
    height: '100%',
    justifyContent: 'space-evenly',
    alignItems: 'center',
    paddingVertical: 6,
  },
  centerNavRow: {
    flexDirection: 'row',
    gap: 16,
    alignItems: 'center',
  },
  centerNavBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1b1d28',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    borderRadius: 8,
    paddingVertical: 5,
    paddingHorizontal: 10,
    minWidth: 58,
  },
  centerNavBtnActive: {
    backgroundColor: 'rgba(79, 140, 255, 0.25)',
    borderColor: '#60a5fa',
    transform: [{ scale: 0.95 }],
  },
  centerNavIcon: {
    color: '#cbd5e1',
    fontSize: 13,
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
    marginVertical: 2,
  },
  actionBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#1b1d28',
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.18)',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.4,
    shadowRadius: 4,
  },
  btnA: {
    borderColor: '#10b981',
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
  },
  btnAActive: {
    backgroundColor: '#10b981',
    borderColor: '#34d399',
    transform: [{ scale: 0.94 }],
  },
  btnB: {
    borderColor: '#ef4444',
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
  },
  btnBActive: {
    backgroundColor: '#ef4444',
    borderColor: '#f87171',
    transform: [{ scale: 0.94 }],
  },
  btnX: {
    borderColor: '#3b82f6',
    backgroundColor: 'rgba(59, 130, 246, 0.12)',
  },
  btnXActive: {
    backgroundColor: '#3b82f6',
    borderColor: '#60a5fa',
    transform: [{ scale: 0.94 }],
  },
  btnY: {
    borderColor: '#f59e0b',
    backgroundColor: 'rgba(245, 158, 11, 0.12)',
  },
  btnYActive: {
    backgroundColor: '#f59e0b',
    borderColor: '#fbbf24',
    transform: [{ scale: 0.94 }],
  },
  actionBtnText: {
    fontSize: 12,
    fontWeight: 'bold',
  },
  textA: { color: '#34d399' },
  textB: { color: '#f87171' },
  textX: { color: '#60a5fa' },
  textY: { color: '#fbbf24' },
});

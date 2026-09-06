import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
} from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { socketService } from '../services/SocketService';
import { hapticsService } from '../services/HapticsService';
import { Keycap } from '../components/Keycap';

interface KeyboardScreenProps {
  isFullscreen?: boolean;
  onToggleFullscreen?: () => void;
}

export const KeyboardScreen: React.FC<KeyboardScreenProps> = ({
  isFullscreen,
  onToggleFullscreen,
}) => {
  const [typedText, setTypedText] = useState('');
  const [activeDeck, setActiveDeck] = useState<'qwerty' | 'nav'>('qwerty');
  const [isShiftActive, setIsShiftActive] = useState(false);
  const [isCapsActive, setIsCapsActive] = useState(false);
  const [isCtrlLatched, setIsCtrlLatched] = useState(false);
  const [isAltLatched, setIsAltLatched] = useState(false);
  const [isQuickTextOpen, setIsQuickTextOpen] = useState(false);

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
      // Normal character keys
      let charToSend = code;
      if (charToSend.length === 1) {
        charToSend = isShifted ? charToSend.toUpperCase() : charToSend.toLowerCase();
      }
      socketService.key(charToSend, 'tap');
    }

    // Unlatch Shift if single-press active
    if (isShiftActive) {
      setIsShiftActive(false);
    }

    // Release latched Ctrl/Alt after combo
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
    <View style={[styles.container, isFullscreen && styles.containerFullscreen]}>
      {/* Top Utility Ribbon */}
      <View style={styles.utilityRibbon}>
        {/* Essential PC Utility Keycaps */}
        <View style={styles.utilityKeyGroup}>
          <Keycap label="Esc" code="esc" widthFactor={1.1} height={36} type="utility" accentColor="#f87171" onPress={handleKeyPress} />
          <Keycap label="Tab ⇥" code="tab" widthFactor={1.2} height={36} type="utility" onPress={handleKeyPress} />
          <Keycap label="Del" code="delete" widthFactor={1.1} height={36} type="utility" onPress={handleKeyPress} />
          <Keycap
            label="Caps"
            code="caps_lock"
            widthFactor={1.2}
            height={36}
            hasLed
            ledOn={isCapsActive}
            type="utility"
            onPress={handleKeyPress}
          />
        </View>

        {/* Right Action Controls */}
        <View style={styles.utilityActionGroup}>
          {/* Quick Text Drawer Button */}
          <TouchableOpacity
            style={[styles.actionPill, isQuickTextOpen && styles.actionPillActive]}
            onPress={() => {
              setIsQuickTextOpen(!isQuickTextOpen);
              hapticsService.light();
            }}
            activeOpacity={0.8}
            focusable={false}
          >
            <Svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke={isQuickTextOpen ? '#60a5fa' : '#cbd5e1'} strokeWidth={2.5}>
              <Path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
              <Path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
            </Svg>
            <Text style={[styles.actionPillText, isQuickTextOpen && styles.actionPillTextActive]}>Text</Text>
          </TouchableOpacity>

          {/* Deck Switcher Button */}
          <TouchableOpacity
            style={[styles.actionPill, activeDeck === 'nav' && styles.deckPillActive]}
            onPress={() => {
              setActiveDeck(activeDeck === 'qwerty' ? 'nav' : 'qwerty');
              hapticsService.light();
            }}
            activeOpacity={0.8}
            focusable={false}
          >
            <Text style={[styles.actionPillText, activeDeck === 'nav' && styles.deckPillTextActive]}>
              {activeDeck === 'qwerty' ? '⚡ Nav/F' : '🔤 QWERTY'}
            </Text>
          </TouchableOpacity>

          {/* Fullscreen Button */}
          {onToggleFullscreen && (
            <TouchableOpacity
              style={[styles.fullscreenBtn, isFullscreen && styles.fullscreenBtnActive]}
              onPress={onToggleFullscreen}
              activeOpacity={0.8}
              focusable={false}
            >
              <Text style={[styles.fullscreenBtnText, isFullscreen && styles.fullscreenBtnTextActive]}>
                {isFullscreen ? '✕ Exit' : '⛶'}
              </Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Expandable Quick-Text Field Drawer */}
      {isQuickTextOpen && (
        <View style={styles.quickTextDrawer}>
          <TextInput
            style={styles.textInput}
            placeholder="Type or dictate text to send to PC..."
            placeholderTextColor="#64748b"
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
            focusable={false}
          >
            <Text style={styles.sendBtnText}>Send</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Edge-to-Edge Mechanical Keyboard Chassis */}
      <ScrollView
        contentContainerStyle={styles.chassisScrollContent}
        showsVerticalScrollIndicator={false}
        bounces={false}
      >
        <View style={styles.keyboardChassis}>
          {activeDeck === 'qwerty' ? (
            /* ================= QWERTY Stretched Mobile Layout ================= */
            <>
              {/* Row 1: Number & Shift Symbol Row */}
              <View style={styles.row}>
                <Keycap label="1" subLabel="!" code="1" height={42} onPress={handleKeyPress} />
                <Keycap label="2" subLabel="@" code="2" height={42} onPress={handleKeyPress} />
                <Keycap label="3" subLabel="#" code="3" height={42} onPress={handleKeyPress} />
                <Keycap label="4" subLabel="$" code="4" height={42} onPress={handleKeyPress} />
                <Keycap label="5" subLabel="%" code="5" height={42} onPress={handleKeyPress} />
                <Keycap label="6" subLabel="^" code="6" height={42} onPress={handleKeyPress} />
                <Keycap label="7" subLabel="&" code="7" height={42} onPress={handleKeyPress} />
                <Keycap label="8" subLabel="*" code="8" height={42} onPress={handleKeyPress} />
                <Keycap label="9" subLabel="(" code="9" height={42} onPress={handleKeyPress} />
                <Keycap label="0" subLabel=")" code="0" height={42} onPress={handleKeyPress} />
              </View>

              {/* Row 2: QWERTY Row */}
              <View style={styles.row}>
                {['Q', 'W', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P'].map((k) => (
                  <Keycap
                    key={k}
                    label={isShiftActive !== isCapsActive ? k : k.toLowerCase()}
                    code={k.toLowerCase()}
                    height={46}
                    onPress={handleKeyPress}
                  />
                ))}
              </View>

              {/* Row 3: Home Row (A-L with half-key ergonomic stagger spacer) */}
              <View style={styles.row}>
                <View style={styles.spacerQuarter} />
                {['A', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L'].map((k) => (
                  <Keycap
                    key={k}
                    label={isShiftActive !== isCapsActive ? k : k.toLowerCase()}
                    code={k.toLowerCase()}
                    height={46}
                    onPress={handleKeyPress}
                  />
                ))}
                <Keycap label=";" subLabel=":" code=";" height={46} onPress={handleKeyPress} />
                <View style={styles.spacerQuarter} />
              </View>

              {/* Row 4: Shift & Bottom Letters & Backspace */}
              <View style={styles.row}>
                <Keycap
                  label="⇧ Shift"
                  code="shift"
                  widthFactor={1.35}
                  height={46}
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
                    height={46}
                    onPress={handleKeyPress}
                  />
                ))}
                <Keycap
                  label="⌫"
                  code="backspace"
                  widthFactor={1.35}
                  height={46}
                  type="utility"
                  accentColor="#fca5a5"
                  onPress={handleKeyPress}
                />
              </View>

              {/* Row 5: Thumb Modifiers & Full-Width Spacebar */}
              <View style={styles.row}>
                <Keycap
                  label="Ctrl"
                  code="ctrl"
                  widthFactor={1.2}
                  height={45}
                  type="modifier"
                  hasLed
                  ledOn={isCtrlLatched}
                  isLatched={isCtrlLatched}
                  onPress={handleKeyPress}
                />
                <Keycap
                  label="⊞ Win"
                  code="cmd"
                  widthFactor={1.1}
                  height={45}
                  type="modifier"
                  onPress={handleKeyPress}
                />
                <Keycap
                  label="Alt"
                  code="alt"
                  widthFactor={1.1}
                  height={45}
                  type="modifier"
                  hasLed
                  ledOn={isAltLatched}
                  isLatched={isAltLatched}
                  onPress={handleKeyPress}
                />
                <Keycap
                  label="Space"
                  code="space"
                  widthFactor={3.8}
                  height={45}
                  type="spacebar"
                  onPress={handleKeyPress}
                />
                <Keycap
                  label="Enter ↵"
                  code="enter"
                  widthFactor={2.0}
                  height={45}
                  type="enter"
                  onPress={handleKeyPress}
                />
              </View>

              {/* Row 6: Dedicated Arrow Navigation Strip */}
              <View style={styles.row}>
                <Keycap label="Home" code="home" widthFactor={1.0} height={40} type="utility" onPress={handleKeyPress} />
                <Keycap label="End" code="end" widthFactor={1.0} height={40} type="utility" onPress={handleKeyPress} />
                <Keycap label="◀" code="left" widthFactor={1.3} height={40} type="utility" onPress={handleKeyPress} />
                <Keycap label="▲" code="up" widthFactor={1.3} height={40} type="utility" onPress={handleKeyPress} />
                <Keycap label="▼" code="down" widthFactor={1.3} height={40} type="utility" onPress={handleKeyPress} />
                <Keycap label="▶" code="right" widthFactor={1.3} height={40} type="utility" onPress={handleKeyPress} />
                <Keycap label="PgUp" code="page_up" widthFactor={1.0} height={40} type="utility" onPress={handleKeyPress} />
                <Keycap label="PgDn" code="page_down" widthFactor={1.0} height={40} type="utility" onPress={handleKeyPress} />
              </View>
            </>
          ) : (
            /* ================= Function Keys & Navigation Grid ================= */
            <>
              {/* Row 1: F1 - F6 */}
              <View style={styles.row}>
                {['f1', 'f2', 'f3', 'f4', 'f5', 'f6'].map((f) => (
                  <Keycap key={f} label={f.toUpperCase()} code={f} height={44} type="utility" onPress={handleKeyPress} />
                ))}
              </View>

              {/* Row 2: F7 - F12 */}
              <View style={styles.row}>
                {['f7', 'f8', 'f9', 'f10', 'f11', 'f12'].map((f) => (
                  <Keycap key={f} label={f.toUpperCase()} code={f} height={44} type="utility" onPress={handleKeyPress} />
                ))}
              </View>

              {/* Row 3: PC Document Navigation */}
              <View style={styles.row}>
                <Keycap label="PrtSc" code="print_screen" height={42} type="utility" onPress={handleKeyPress} />
                <Keycap label="Ins" code="insert" height={42} type="utility" onPress={handleKeyPress} />
                <Keycap label="Home" code="home" height={42} type="utility" onPress={handleKeyPress} />
                <Keycap label="End" code="end" height={42} type="utility" onPress={handleKeyPress} />
                <Keycap label="PgUp" code="page_up" height={42} type="utility" onPress={handleKeyPress} />
                <Keycap label="PgDn" code="page_down" height={42} type="utility" onPress={handleKeyPress} />
              </View>

              {/* Row 4: Instant PC Productivity Shortcuts */}
              <View style={styles.row}>
                <Keycap label="Win+D" code="shortcut_win_d" height={42} type="utility" accentColor="#60a5fa" onPress={handleKeyPress} />
                <Keycap label="Alt+Tab" code="shortcut_alt_tab" height={42} type="utility" accentColor="#60a5fa" onPress={handleKeyPress} />
                <Keycap label="Ctrl+C" code="shortcut_copy" height={42} type="utility" onPress={handleKeyPress} />
                <Keycap label="Ctrl+V" code="shortcut_paste" height={42} type="utility" onPress={handleKeyPress} />
                <Keycap label="Ctrl+Z" code="shortcut_undo" height={42} type="utility" onPress={handleKeyPress} />
                <Keycap label="Ctrl+A" code="shortcut_select_all" height={42} type="utility" onPress={handleKeyPress} />
              </View>

              {/* Row 5: Navigation Directional Cluster & Enter */}
              <View style={styles.row}>
                <Keycap
                  label="Ctrl"
                  code="ctrl"
                  widthFactor={1.2}
                  height={44}
                  type="modifier"
                  hasLed
                  ledOn={isCtrlLatched}
                  isLatched={isCtrlLatched}
                  onPress={handleKeyPress}
                />
                <Keycap
                  label="Alt"
                  code="alt"
                  widthFactor={1.2}
                  height={44}
                  type="modifier"
                  hasLed
                  ledOn={isAltLatched}
                  isLatched={isAltLatched}
                  onPress={handleKeyPress}
                />
                <Keycap label="◀" code="left" widthFactor={1.4} height={44} type="utility" onPress={handleKeyPress} />
                <Keycap label="▲" code="up" widthFactor={1.4} height={44} type="utility" onPress={handleKeyPress} />
                <Keycap label="▼" code="down" widthFactor={1.4} height={44} type="utility" onPress={handleKeyPress} />
                <Keycap label="▶" code="right" widthFactor={1.4} height={44} type="utility" onPress={handleKeyPress} />
                <Keycap label="Enter ↵" code="enter" widthFactor={1.8} height={44} type="enter" onPress={handleKeyPress} />
              </View>
            </>
          )}
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0b0c10',
    paddingHorizontal: 4,
    paddingVertical: 4,
    justifyContent: 'flex-start',
  },
  containerFullscreen: {
    paddingHorizontal: 2,
    paddingVertical: 2,
  },

  // Top Compact Utility Ribbon
  utilityRibbon: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 4,
    paddingVertical: 2,
    paddingHorizontal: 2,
    marginBottom: 4,
    width: '100%',
  },
  utilityKeyGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    maxWidth: 220,
  },
  utilityActionGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  actionPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 7,
    paddingHorizontal: 9,
    borderRadius: 7,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
  },
  actionPillActive: {
    backgroundColor: 'rgba(59, 130, 246, 0.2)',
    borderColor: '#3b82f6',
  },
  actionPillText: {
    color: '#cbd5e1',
    fontSize: 11,
    fontWeight: '700',
  },
  actionPillTextActive: {
    color: '#60a5fa',
  },
  deckPillActive: {
    backgroundColor: 'rgba(79, 140, 255, 0.25)',
    borderColor: '#4f8cff',
  },
  deckPillTextActive: {
    color: '#60a5fa',
  },
  fullscreenBtn: {
    paddingVertical: 7,
    paddingHorizontal: 8,
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
    color: '#94a3b8',
    fontSize: 11,
    fontWeight: '700',
  },
  fullscreenBtnTextActive: {
    color: '#34d399',
  },

  // Expandable Quick Text Drawer
  quickTextDrawer: {
    flexDirection: 'row',
    gap: 6,
    paddingVertical: 4,
    paddingHorizontal: 2,
    marginBottom: 4,
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

  // Chassis & Key Rows
  chassisScrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
  },
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

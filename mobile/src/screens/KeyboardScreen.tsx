import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { Colors } from '../theme/colors';
import { socketService } from '../services/SocketService';
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

  const handleSendText = () => {
    if (typedText) {
      socketService.text(typedText);
      setTypedText('');
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

    // Special Keys
    const specialKeys = [
      'enter', 'backspace', 'tab', 'esc', 'space',
      'up', 'down', 'left', 'right', 'delete',
      'f1', 'f2', 'f3', 'f4', 'f5', 'f6', 'f7', 'f8', 'f9', 'f10', 'f11', 'f12',
      'home', 'end', 'page_up', 'page_down', 'print_screen', 'insert', 'pause',
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
      {/* Quick-Text & Mobile Dictation Bar */}
      <View style={styles.quickTextBar}>
        <TextInput
          style={styles.textInput}
          placeholder="Type or dictate text to send to PC..."
          placeholderTextColor={Colors.textMuted}
          value={typedText}
          onChangeText={setTypedText}
          onSubmitEditing={handleSendText}
          returnKeyType="send"
        />
        <TouchableOpacity
          style={styles.sendBtn}
          onPress={handleSendText}
          activeOpacity={0.88}
          focusable={false}
        >
          <Text style={styles.sendBtnText}>Send</Text>
        </TouchableOpacity>

        {onToggleFullscreen && (
          <TouchableOpacity
            style={[styles.fullscreenBtn, isFullscreen && styles.fullscreenBtnActive]}
            onPress={onToggleFullscreen}
            activeOpacity={0.88}
            focusable={false}
          >
            <Text style={[styles.fullscreenBtnText, isFullscreen && styles.fullscreenBtnTextActive]}>
              {isFullscreen ? '✕ Exit' : '⛶ Full'}
            </Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Top PC Utility & Deck Selector Bar */}
      <View style={styles.utilityBar}>
        <Keycap label="Esc" code="esc" widthFactor={1.2} height={34} type="utility" onPress={handleKeyPress} />
        <Keycap label="Tab ⇥" code="tab" widthFactor={1.4} height={34} type="utility" onPress={handleKeyPress} />
        <Keycap label="Del" code="delete" widthFactor={1.2} height={34} type="utility" onPress={handleKeyPress} />
        <Keycap
          label="Caps"
          code="caps_lock"
          widthFactor={1.3}
          height={34}
          hasLed
          ledOn={isCapsActive}
          type="utility"
          onPress={handleKeyPress}
        />
        
        {/* Switcher button between QWERTY & Function/Nav */}
        <TouchableOpacity
          style={[styles.deckSwitchBtn, activeDeck === 'nav' && styles.deckSwitchBtnActive]}
          onPress={() => setActiveDeck(activeDeck === 'qwerty' ? 'nav' : 'qwerty')}
          activeOpacity={0.88}
          focusable={false}
        >
          <Text style={[styles.deckSwitchBtnText, activeDeck === 'nav' && styles.deckSwitchBtnTextActive]}>
            {activeDeck === 'qwerty' ? '⚡ F1-F12 / Nav' : '🔤 QWERTY'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Stretched Mobile Keyboard Chassis (100% Width, Zero Horizontal Scroll) */}
      <View style={styles.keyboardChassis}>
        {activeDeck === 'qwerty' ? (
          /* ================= QWERTY Stretched Mobile Layout ================= */
          <>
            {/* Number Row (1-0 with Shift symbols) */}
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

            {/* QWERTY Row */}
            <View style={styles.row}>
              {['Q', 'W', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P'].map((k) => (
                <Keycap
                  key={k}
                  label={isShiftActive !== isCapsActive ? k : k.toLowerCase()}
                  code={k.toLowerCase()}
                  height={43}
                  onPress={handleKeyPress}
                />
              ))}
            </View>

            {/* Home Row (A-L with half-key ergonomic stagger spacer) */}
            <View style={styles.row}>
              <View style={styles.spacerHalf} />
              {['A', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L'].map((k) => (
                <Keycap
                  key={k}
                  label={isShiftActive !== isCapsActive ? k : k.toLowerCase()}
                  code={k.toLowerCase()}
                  height={43}
                  onPress={handleKeyPress}
                />
              ))}
              <View style={styles.spacerHalf} />
            </View>

            {/* Shift & Bottom Letters Row */}
            <View style={styles.row}>
              <Keycap
                label="⇧ Shift"
                code="shift"
                widthFactor={1.4}
                height={43}
                type="modifier"
                isLatched={isShiftActive}
                onPress={handleKeyPress}
              />
              {['Z', 'X', 'C', 'V', 'B', 'N', 'M'].map((k) => (
                <Keycap
                  key={k}
                  label={isShiftActive !== isCapsActive ? k : k.toLowerCase()}
                  code={k.toLowerCase()}
                  height={43}
                  onPress={handleKeyPress}
                />
              ))}
              <Keycap
                label="⌫"
                code="backspace"
                widthFactor={1.4}
                height={43}
                type="utility"
                onPress={handleKeyPress}
              />
            </View>

            {/* Ergonomic Thumb & Control Row */}
            <View style={styles.row}>
              <Keycap
                label="Ctrl"
                code="ctrl"
                widthFactor={1.15}
                height={42}
                type="modifier"
                isLatched={isCtrlLatched}
                onPress={handleKeyPress}
              />
              <Keycap
                label="Alt"
                code="alt"
                widthFactor={1.15}
                height={42}
                type="modifier"
                isLatched={isAltLatched}
                onPress={handleKeyPress}
              />
              <Keycap
                label="Space"
                code="space"
                widthFactor={3.8}
                height={42}
                type="spacebar"
                onPress={handleKeyPress}
              />
              <Keycap
                label="Enter ↵"
                code="enter"
                widthFactor={1.8}
                height={42}
                type="enter"
                onPress={handleKeyPress}
              />
              <Keycap label="◀" code="left" widthFactor={1.0} height={42} type="utility" onPress={handleKeyPress} />
              <Keycap label="▲" code="up" widthFactor={1.0} height={42} type="utility" onPress={handleKeyPress} />
              <Keycap label="▼" code="down" widthFactor={1.0} height={42} type="utility" onPress={handleKeyPress} />
              <Keycap label="▶" code="right" widthFactor={1.0} height={42} type="utility" onPress={handleKeyPress} />
            </View>
          </>
        ) : (
          /* ================= Function Keys & Navigation Grid ================= */
          <>
            {/* F1 - F6 */}
            <View style={styles.row}>
              {['f1', 'f2', 'f3', 'f4', 'f5', 'f6'].map((f) => (
                <Keycap key={f} label={f.toUpperCase()} code={f} height={42} type="utility" onPress={handleKeyPress} />
              ))}
            </View>

            {/* F7 - F12 */}
            <View style={styles.row}>
              {['f7', 'f8', 'f9', 'f10', 'f11', 'f12'].map((f) => (
                <Keycap key={f} label={f.toUpperCase()} code={f} height={42} type="utility" onPress={handleKeyPress} />
              ))}
            </View>

            {/* PC Document Navigation */}
            <View style={styles.row}>
              <Keycap label="PrtSc" code="print_screen" height={42} type="utility" onPress={handleKeyPress} />
              <Keycap label="Home" code="home" height={42} type="utility" onPress={handleKeyPress} />
              <Keycap label="PgUp" code="page_up" height={42} type="utility" onPress={handleKeyPress} />
              <Keycap label="PgDn" code="page_down" height={42} type="utility" onPress={handleKeyPress} />
              <Keycap label="End" code="end" height={42} type="utility" onPress={handleKeyPress} />
              <Keycap label="Ins" code="insert" height={42} type="utility" onPress={handleKeyPress} />
            </View>

            {/* Modifier & Arrow Cluster */}
            <View style={styles.row}>
              <Keycap
                label="Ctrl"
                code="ctrl"
                widthFactor={1.2}
                height={42}
                type="modifier"
                isLatched={isCtrlLatched}
                onPress={handleKeyPress}
              />
              <Keycap
                label="Win"
                code="cmd"
                widthFactor={1.2}
                height={42}
                type="modifier"
                onPress={handleKeyPress}
              />
              <Keycap
                label="Alt"
                code="alt"
                widthFactor={1.2}
                height={42}
                type="modifier"
                isLatched={isAltLatched}
                onPress={handleKeyPress}
              />
              <Keycap label="◀" code="left" widthFactor={1.1} height={42} type="utility" onPress={handleKeyPress} />
              <Keycap label="▲" code="up" widthFactor={1.1} height={42} type="utility" onPress={handleKeyPress} />
              <Keycap label="▼" code="down" widthFactor={1.1} height={42} type="utility" onPress={handleKeyPress} />
              <Keycap label="▶" code="right" widthFactor={1.1} height={42} type="utility" onPress={handleKeyPress} />
              <Keycap label="Enter ↵" code="enter" widthFactor={1.6} height={42} type="enter" onPress={handleKeyPress} />
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
    backgroundColor: Colors.bg,
    paddingHorizontal: 6,
    paddingVertical: 6,
    justifyContent: 'flex-start',
  },
  containerFullscreen: {
    paddingHorizontal: 4,
    paddingVertical: 2,
  },
  quickTextBar: {
    flexDirection: 'row',
    marginBottom: 6,
    gap: 6,
  },
  textInput: {
    flex: 1,
    backgroundColor: '#161722',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    color: Colors.textMain,
    paddingHorizontal: 12,
    paddingVertical: 7,
    fontSize: 13,
  },
  sendBtn: {
    backgroundColor: Colors.accent,
    borderRadius: 10,
    paddingHorizontal: 14,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 3,
  },
  sendBtnText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '700',
  },
  fullscreenBtn: {
    backgroundColor: '#22232c',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.14)',
    paddingHorizontal: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  fullscreenBtnActive: {
    backgroundColor: 'rgba(52, 211, 153, 0.2)',
    borderColor: '#34d399',
  },
  fullscreenBtnText: {
    color: '#e5e5ea',
    fontSize: 11,
    fontWeight: '700',
  },
  fullscreenBtnTextActive: {
    color: '#34d399',
  },
  utilityBar: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
    width: '100%',
    gap: 3,
  },
  deckSwitchBtn: {
    flex: 2.2,
    height: 34,
    backgroundColor: '#252836',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 6,
  },
  deckSwitchBtnActive: {
    backgroundColor: 'rgba(79, 140, 255, 0.25)',
    borderColor: '#4f8cff',
  },
  deckSwitchBtnText: {
    color: '#cbd5e1',
    fontSize: 11,
    fontWeight: '700',
  },
  deckSwitchBtnTextActive: {
    color: '#60a5fa',
  },
  keyboardChassis: {
    width: '100%',
    backgroundColor: '#181a24',
    borderRadius: 14,
    padding: 5,
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    elevation: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 10,
  },
  row: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 2,
  },
  spacerHalf: {
    flex: 0.5,
  },
});

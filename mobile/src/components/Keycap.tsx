import React, { useState } from 'react';
import {
  Text,
  TouchableOpacity,
  StyleSheet,
  View,
} from 'react-native';
import { audioService } from '../services/AudioService';
import { hapticsService } from '../services/HapticsService';

interface KeycapProps {
  label: string;
  subLabel?: string;
  code: string;
  widthFactor?: number; // 1 = standard, 1.5, 2, etc.
  height?: number;
  isLatched?: boolean;
  hasLed?: boolean;
  ledOn?: boolean;
  accentColor?: string;
  type?: 'standard' | 'spacebar' | 'enter' | 'modifier' | 'utility';
  onPress: (code: string) => void;
  onLongPress?: (code: string) => void;
}

export const Keycap: React.FC<KeycapProps> = ({
  label,
  subLabel,
  code,
  widthFactor = 1,
  height = 44,
  isLatched = false,
  hasLed = false,
  ledOn = false,
  accentColor,
  type = 'standard',
  onPress,
  onLongPress,
}) => {
  const [isPressed, setIsPressed] = useState(false);

  const handlePressIn = () => {
    setIsPressed(true);
    audioService.playKey(type === 'spacebar' ? 'spacebar' : type === 'enter' ? 'enter' : 'standard');
    hapticsService.keyboard(type === 'spacebar');
  };

  const handlePressOut = () => {
    setIsPressed(false);
  };

  const handlePress = () => {
    onPress(code);
  };

  const isDarkKey = type === 'modifier' || type === 'utility';
  const isEnterKey = type === 'enter';
  const isSpacebar = type === 'spacebar';

  return (
    <TouchableOpacity
      style={[
        styles.keyContainer,
        { flex: widthFactor, height },
        isEnterKey && styles.keyContainerEnter,
        isLatched && styles.keyContainerLatched,
        isPressed && styles.keyPressed,
      ]}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      onPress={handlePress}
      onLongPress={() => onLongPress && onLongPress(code)}
      activeOpacity={1}
      focusable={false}
    >
      <View
        style={[
          styles.keyFace,
          isDarkKey && styles.keyFaceDark,
          isEnterKey && styles.keyFaceEnter,
          isSpacebar && styles.keyFaceSpacebar,
          isLatched && styles.keyFaceLatched,
          isPressed && styles.keyFacePressed,
          isPressed && isDarkKey && styles.keyFaceDarkPressed,
          isPressed && isEnterKey && styles.keyFaceEnterPressed,
        ]}
      >
        {/* Physical LED Status Light */}
        {hasLed && (
          <View style={[styles.led, ledOn && styles.ledActive]} />
        )}

        {/* Dual-Legend Characters (Number + Shift Symbol) */}
        {subLabel ? (
          <View style={styles.dualLabelContainer}>
            <Text style={[styles.subLabelText, isLatched && styles.textLatched]}>{subLabel}</Text>
            <Text style={[styles.mainLabelText, isLatched && styles.textLatched]}>{label}</Text>
          </View>
        ) : (
          <Text
            style={[
              styles.labelText,
              isDarkKey && styles.labelTextDark,
              isEnterKey && styles.labelTextEnter,
              accentColor && { color: accentColor },
              widthFactor > 1.3 && styles.specialLabelText,
              isLatched && styles.textLatched,
            ]}
            numberOfLines={1}
          >
            {label}
          </Text>
        )}

        {/* Tactile Center Indicator for Spacebar */}
        {isSpacebar && (
          <View style={styles.spacebarDash} />
        )}
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  keyContainer: {
    margin: 1.5,
    borderRadius: 7,
    backgroundColor: '#12141c',
    borderBottomWidth: 3.5,
    borderBottomColor: '#090a0f',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.55,
    shadowRadius: 3,
    elevation: 4,
  },
  keyContainerEnter: {
    backgroundColor: '#1e3a8a',
    borderBottomColor: '#172554',
  },
  keyContainerLatched: {
    backgroundColor: '#1d4ed8',
    borderBottomColor: '#1e3a8a',
  },
  keyPressed: {
    transform: [{ translateY: 2 }],
    borderBottomWidth: 1.5,
    shadowOpacity: 0.15,
    elevation: 1,
  },

  // Keycap Face with 3D Mechanical Top Highlight
  keyFace: {
    flex: 1,
    backgroundColor: '#232635',
    borderRadius: 5,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.18)',
    borderLeftWidth: 0.5,
    borderLeftColor: 'rgba(255, 255, 255, 0.08)',
    borderRightWidth: 0.5,
    borderRightColor: 'rgba(0, 0, 0, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 2,
    position: 'relative',
  },
  keyFaceDark: {
    backgroundColor: '#1a1c26',
    borderTopColor: 'rgba(255, 255, 255, 0.12)',
  },
  keyFaceEnter: {
    backgroundColor: '#2563eb',
    borderTopColor: 'rgba(255, 255, 255, 0.35)',
  },
  keyFaceSpacebar: {
    backgroundColor: '#262939',
  },
  keyFaceLatched: {
    backgroundColor: '#2563eb',
    borderTopColor: '#93c5fd',
    borderColor: '#60a5fa',
    borderWidth: 1,
  },

  keyFacePressed: {
    backgroundColor: '#1c1e2b',
    borderTopColor: 'rgba(255, 255, 255, 0.05)',
  },
  keyFaceDarkPressed: {
    backgroundColor: '#14151e',
  },
  keyFaceEnterPressed: {
    backgroundColor: '#1d4ed8',
  },

  // Typography
  labelText: {
    color: '#f8fafc',
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  labelTextDark: {
    color: '#cbd5e1',
    fontSize: 11.5,
    fontWeight: '600',
  },
  labelTextEnter: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  specialLabelText: {
    fontSize: 10.5,
    fontWeight: '600',
  },
  textLatched: {
    color: '#ffffff',
    fontWeight: '800',
  },

  // Dual Label (e.g. "1" and "!")
  dualLabelContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 1,
  },
  subLabelText: {
    color: '#60a5fa',
    fontSize: 10,
    fontWeight: '700',
    lineHeight: 11,
  },
  mainLabelText: {
    color: '#f8fafc',
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 14,
  },

  // Spacebar Tactile Dash
  spacebarDash: {
    width: 24,
    height: 2,
    borderRadius: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
    position: 'absolute',
    bottom: 5,
  },

  // Realistic LED Indicator Light
  led: {
    position: 'absolute',
    top: 4,
    left: 4,
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: '#374151',
  },
  ledActive: {
    backgroundColor: '#22c55e',
    shadowColor: '#22c55e',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 5,
    elevation: 4,
  },
});

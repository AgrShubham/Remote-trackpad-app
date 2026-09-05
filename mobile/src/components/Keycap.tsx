import React, { useState } from 'react';
import {
  Text,
  TouchableOpacity,
  StyleSheet,
  View,
} from 'react-native';
import { Colors } from '../theme/colors';
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
  type?: 'standard' | 'spacebar' | 'enter' | 'modifier' | 'utility';
  onPress: (code: string) => void;
  onLongPress?: (code: string) => void;
}

export const Keycap: React.FC<KeycapProps> = ({
  label,
  subLabel,
  code,
  widthFactor = 1,
  height = 42,
  isLatched = false,
  hasLed = false,
  ledOn = false,
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

  return (
    <TouchableOpacity
      style={[
        styles.keyContainer,
        { flex: widthFactor, height },
        isPressed && styles.keyPressed,
        isLatched && styles.keyLatched,
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
          isPressed && styles.keyFacePressed,
          isPressed && isDarkKey && styles.keyFaceDarkPressed,
          isLatched && styles.keyFaceLatched,
        ]}
      >
        {hasLed && (
          <View style={[styles.led, ledOn && styles.ledActive]} />
        )}
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
              widthFactor > 1.3 && styles.specialLabelText,
              isLatched && styles.textLatched,
            ]}
            numberOfLines={1}
          >
            {label}
          </Text>
        )}
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  keyContainer: {
    height: 36,
    margin: 1.5,
    borderRadius: 5,
    backgroundColor: '#b0b5c0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.35,
    shadowRadius: 2,
    elevation: 3,
  },
  keyPressed: {
    transform: [{ translateY: 2 }],
    shadowOpacity: 0.1,
    elevation: 1,
  },
  keyLatched: {
    backgroundColor: '#1d4ed8',
  },
  keyFace: {
    flex: 1,
    backgroundColor: '#e4e7ee',
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#ffffff',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 2,
  },
  keyFaceDark: {
    backgroundColor: '#353a47',
    borderColor: '#4b5263',
  },
  keyFaceDarkPressed: {
    backgroundColor: '#434a5c',
  },
  keyFacePressed: {
    backgroundColor: '#cbd2e0',
  },
  keyFaceLatched: {
    backgroundColor: '#2563eb',
    borderColor: '#60a5fa',
  },
  labelText: {
    color: '#1a1b24',
    fontSize: 12,
    fontWeight: '700',
  },
  labelTextDark: {
    color: '#f3f4f6',
  },
  specialLabelText: {
    fontSize: 10,
    fontWeight: '600',
  },
  textLatched: {
    color: '#ffffff',
  },
  dualLabelContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  subLabelText: {
    color: '#6b7280',
    fontSize: 9,
    fontWeight: '600',
    lineHeight: 10,
  },
  mainLabelText: {
    color: '#1a1b24',
    fontSize: 11,
    fontWeight: '700',
    lineHeight: 12,
  },
  led: {
    position: 'absolute',
    top: 3,
    left: 4,
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#374151',
  },
  ledActive: {
    backgroundColor: '#22c55e',
    shadowColor: '#22c55e',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 4,
    elevation: 4,
  },
});

import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Colors } from '../theme/colors';
import { socketService } from '../services/SocketService';
import { hapticsService } from '../services/HapticsService';

interface CloverDpadProps {
  size?: number;
}

export const CloverDpad: React.FC<CloverDpadProps> = ({ size = 130 }) => {
  const [activePetal, setActivePetal] = useState<string | null>(null);

  const handlePressIn = (dir: string, inputCode: string) => {
    setActivePetal(dir);
    socketService.gamepadButtonDown(inputCode);
    hapticsService.dpad();
  };

  const handlePressOut = (inputCode: string) => {
    setActivePetal(null);
    socketService.gamepadButtonUp(inputCode);
  };

  const petalSize = size * 0.36;

  return (
    <View style={[styles.container, { width: size, height: size }]}>
      {/* Up Petal */}
      <TouchableOpacity
        style={[
          styles.petal,
          styles.petalUp,
          { width: petalSize, height: petalSize },
          activePetal === 'up' && styles.petalActive,
        ]}
        onPressIn={() => handlePressIn('up', 'up')}
        onPressOut={() => handlePressOut('up')}
        activeOpacity={1}
        focusable={false}
      >
        <Text style={styles.arrow}>▲</Text>
      </TouchableOpacity>

      {/* Down Petal */}
      <TouchableOpacity
        style={[
          styles.petal,
          styles.petalDown,
          { width: petalSize, height: petalSize },
          activePetal === 'down' && styles.petalActive,
        ]}
        onPressIn={() => handlePressIn('down', 'down')}
        onPressOut={() => handlePressOut('down')}
        activeOpacity={1}
        focusable={false}
      >
        <Text style={styles.arrow}>▼</Text>
      </TouchableOpacity>

      {/* Left Petal */}
      <TouchableOpacity
        style={[
          styles.petal,
          styles.petalLeft,
          { width: petalSize, height: petalSize },
          activePetal === 'left' && styles.petalLeftActive,
        ]}
        onPressIn={() => handlePressIn('left', 'left')}
        onPressOut={() => handlePressOut('left')}
        activeOpacity={1}
        focusable={false}
      >
        <Text style={styles.arrow}>◀</Text>
      </TouchableOpacity>

      {/* Right Petal */}
      <TouchableOpacity
        style={[
          styles.petal,
          styles.petalRight,
          { width: petalSize, height: petalSize },
          activePetal === 'right' && styles.petalActive,
        ]}
        onPressIn={() => handlePressIn('right', 'right')}
        onPressOut={() => handlePressOut('right')}
        activeOpacity={1}
        focusable={false}
      >
        <Text style={styles.arrow}>▶</Text>
      </TouchableOpacity>

      {/* Center Disc */}
      <View style={[styles.centerDisc, { width: size * 0.3, height: size * 0.3 }]} />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'relative',
    justifyContent: 'center',
    alignItems: 'center',
  },
  petal: {
    position: 'absolute',
    backgroundColor: Colors.gpBtnBase,
    borderWidth: 2,
    borderColor: Colors.gpBtnBorder,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 8,
  },
  petalUp: {
    top: 0,
    borderTopLeftRadius: 14,
    borderTopRightRadius: 14,
  },
  petalDown: {
    bottom: 0,
    borderBottomLeftRadius: 14,
    borderBottomRightRadius: 14,
  },
  petalLeft: {
    left: 0,
    borderTopLeftRadius: 14,
    borderBottomLeftRadius: 14,
  },
  petalRight: {
    right: 0,
    borderTopRightRadius: 14,
    borderBottomRightRadius: 14,
  },
  petalActive: {
    backgroundColor: Colors.gpBtnActive,
    borderColor: Colors.accent,
  },
  petalLeftActive: {
    backgroundColor: Colors.gpBtnActive,
    borderColor: Colors.accent,
  },
  arrow: {
    color: Colors.textMain,
    fontSize: 12,
    fontWeight: 'bold',
  },
  centerDisc: {
    backgroundColor: '#3a3a3d',
    borderRadius: 999,
  },
});

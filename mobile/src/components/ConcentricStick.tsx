import React, { useRef, useState } from 'react';
import {
  View,
  StyleSheet,
  PanResponder,
  GestureResponderEvent,
  PanResponderGestureState,
  Animated,
} from 'react-native';
import { Colors } from '../theme/colors';
import { socketService } from '../services/SocketService';
import { hapticsService } from '../services/HapticsService';

interface ConcentricStickProps {
  label: string;
  isRightStick?: boolean;
  size?: number;
  onStickClick?: () => void;
}

export const ConcentricStick: React.FC<ConcentricStickProps> = ({
  label,
  isRightStick = false,
  size = 130,
  onStickClick,
}) => {
  const [isSprinting, setIsSprinting] = useState(false);
  const knobPos = useRef(new Animated.ValueXY({ x: 0, y: 0 })).current;

  const currentKeys = useRef<string[]>([]);
  const wasSprinting = useRef<boolean>(false);

  const radius = size / 2;
  const knobRadius = 26;
  const maxDistance = radius - knobRadius;

  const evaluateOctant = (normX: number, normY: number, r: number): string[] => {
    if (r < 0.18) return [];

    const theta = Math.atan2(normY, normX);
    const PI = Math.PI;
    const PI_8 = PI / 8;

    let keys: string[] = [];

    if (isRightStick) {
      // Right stick can emulate mouse look/aim
      return [];
    }

    // Left stick 8-way WASD mapping
    if (theta >= -PI_8 && theta < PI_8) {
      keys = ['d'];
    } else if (theta >= PI_8 && theta < 3 * PI_8) {
      keys = ['s', 'd'];
    } else if (theta >= 3 * PI_8 && theta < 5 * PI_8) {
      keys = ['s'];
    } else if (theta >= 5 * PI_8 && theta < 7 * PI_8) {
      keys = ['s', 'a'];
    } else if (theta >= 7 * PI_8 || theta < -7 * PI_8) {
      keys = ['a'];
    } else if (theta >= -7 * PI_8 && theta < -5 * PI_8) {
      keys = ['w', 'a'];
    } else if (theta >= -5 * PI_8 && theta < -3 * PI_8) {
      keys = ['w'];
    } else if (theta >= -3 * PI_8 && theta < -PI_8) {
      keys = ['w', 'd'];
    }

    // Sprint Ring
    if (r > 0.82) {
      keys.push('shift');
      if (!wasSprinting.current) {
        wasSprinting.current = true;
        setIsSprinting(true);
        hapticsService.sprint();
      }
    } else {
      if (wasSprinting.current) {
        wasSprinting.current = false;
        setIsSprinting(false);
      }
    }

    return keys;
  };

  const syncKeys = (newKeys: string[]) => {
    const prevSorted = [...currentKeys.current].sort().join(',');
    const newSorted = [...newKeys].sort().join(',');

    if (prevSorted !== newSorted) {
      currentKeys.current = newKeys;
      socketService.gamepadStickSync(newKeys);
    }
  };

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,

      onPanResponderGrant: () => {
        hapticsService.dpad();
      },

      onPanResponderMove: (_evt: GestureResponderEvent, gestureState: PanResponderGestureState) => {
        const dx = gestureState.dx;
        const dy = gestureState.dy;

        const dist = Math.sqrt(dx * dx + dy * dy);
        const clampedDist = Math.min(dist, maxDistance);
        const angle = Math.atan2(dy, dx);

        const clampedX = Math.cos(angle) * clampedDist;
        const clampedY = Math.sin(angle) * clampedDist;

        knobPos.setValue({ x: clampedX, y: clampedY });

        const normR = clampedDist / maxDistance;
        const normX = clampedX / maxDistance;
        const normY = clampedY / maxDistance;

        if (isRightStick) {
          // Right stick can send camera aim deltas
          socketService.move(normX * 8, normY * 8);
        } else {
          const keys = evaluateOctant(normX, normY, normR);
          syncKeys(keys);
        }
      },

      onPanResponderRelease: () => {
        Animated.spring(knobPos, {
          toValue: { x: 0, y: 0 },
          friction: 6,
          tension: 80,
          useNativeDriver: false,
        }).start();

        wasSprinting.current = false;
        setIsSprinting(false);
        syncKeys([]);
      },
    })
  ).current;

  return (
    <View style={[styles.outerRing, { width: size, height: size, borderRadius: size / 2 }]}>
      {/* Concentric Sprint Ring Indicator */}
      <View
        style={[
          styles.sprintRing,
          { width: size * 0.82, height: size * 0.82, borderRadius: (size * 0.82) / 2 },
          isSprinting && styles.sprintRingActive,
        ]}
      />

      {/* Deadzone Inner Ring */}
      <View
        style={[
          styles.deadzoneRing,
          { width: size * 0.36, height: size * 0.36, borderRadius: (size * 0.36) / 2 },
        ]}
      />

      {/* Concentric Thumb Knob */}
      <Animated.View
        style={[
          styles.knob,
          {
            width: knobRadius * 2,
            height: knobRadius * 2,
            borderRadius: knobRadius,
            transform: knobPos.getTranslateTransform(),
          },
          isSprinting && styles.knobSprinting,
        ]}
        {...panResponder.panHandlers}
      >
        <View style={styles.knobCenter} />
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  outerRing: {
    backgroundColor: Colors.gpStickOuter,
    borderWidth: 2,
    borderColor: Colors.gpStickRing,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 8,
    elevation: 6,
  },
  sprintRing: {
    position: 'absolute',
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  sprintRingActive: {
    borderColor: Colors.accent,
    backgroundColor: 'rgba(79, 140, 255, 0.08)',
  },
  deadzoneRing: {
    position: 'absolute',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
  },
  knob: {
    backgroundColor: Colors.gpStickKnob,
    borderWidth: 2,
    borderColor: '#3c3c40',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.6,
    shadowRadius: 5,
    elevation: 8,
  },
  knobSprinting: {
    borderColor: Colors.accent,
    backgroundColor: '#3b82f6',
  },
  knobCenter: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#1e1e22',
  },
});

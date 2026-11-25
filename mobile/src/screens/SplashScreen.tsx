import React, { useEffect, useRef, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  Easing,
  Dimensions,
  StatusBar,
} from 'react-native';
import Svg, { Circle, Path, Defs, RadialGradient, Stop } from 'react-native-svg';
import { useTheme } from '../theme/ThemeContext';
import { DarkTokens } from '../theme/cyberTokens';

const { width } = Dimensions.get('window');

interface SplashScreenProps {
  onFinish: () => void;
}

export const SplashScreen: React.FC<SplashScreenProps> = ({ onFinish }) => {
  const { isDark, tokens } = useTheme();
  const styles = useMemo(() => createStyles(tokens, isDark), [tokens, isDark]);
  const pulseAnim = useRef(new Animated.Value(0.9)).current;
  const ringScale1 = useRef(new Animated.Value(0.8)).current;
  const ringOpacity1 = useRef(new Animated.Value(0.8)).current;
  const ringScale2 = useRef(new Animated.Value(0.5)).current;
  const ringOpacity2 = useRef(new Animated.Value(0.9)).current;
  const contentFade = useRef(new Animated.Value(0)).current;
  const containerFade = useRef(new Animated.Value(1)).current;
  const progressAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // 1. Content Fade In
    Animated.timing(contentFade, {
      toValue: 1,
      duration: 400,
      useNativeDriver: true,
    }).start();

    // 2. Pulse Logo Loop
    const pulseLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.06,
          duration: 900,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 0.94,
          duration: 900,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    );
    pulseLoop.start();

    // 3. Radar Wave 1 Loop
    const ring1Loop = Animated.loop(
      Animated.parallel([
        Animated.timing(ringScale1, {
          toValue: 1.8,
          duration: 1400,
          easing: Easing.out(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(ringOpacity1, {
          toValue: 0,
          duration: 1400,
          easing: Easing.out(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    );
    ring1Loop.start();

    // 4. Radar Wave 2 Loop (Offset)
    const ring2Loop = Animated.loop(
      Animated.sequence([
        Animated.delay(450),
        Animated.parallel([
          Animated.timing(ringScale2, {
            toValue: 1.6,
            duration: 1400,
            easing: Easing.out(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(ringOpacity2, {
            toValue: 0,
            duration: 1400,
            easing: Easing.out(Easing.ease),
            useNativeDriver: true,
          }),
        ]),
      ])
    );
    ring2Loop.start();

    // 5. Progress Bar
    Animated.timing(progressAnim, {
      toValue: 1,
      duration: 1100,
      easing: Easing.out(Easing.quad),
      useNativeDriver: false,
    }).start();

    // 6. Transition Out after ~1.4 seconds
    const timer = setTimeout(() => {
      Animated.timing(containerFade, {
        toValue: 0,
        duration: 350,
        useNativeDriver: true,
      }).start(() => {
        pulseLoop.stop();
        ring1Loop.stop();
        ring2Loop.stop();
        onFinish();
      });
    }, 1300);

    return () => {
      clearTimeout(timer);
      pulseLoop.stop();
      ring1Loop.stop();
      ring2Loop.stop();
    };
  }, []);

  const progressWidth = progressAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', '100%'],
  });

  return (
    <Animated.View style={[styles.container, { opacity: containerFade }]}>
      <StatusBar
        barStyle={isDark ? 'light-content' : 'dark-content'}
        backgroundColor={tokens.bgObsidian}
      />

      {/* Background Radial Glow */}
      <View style={styles.glowBg}>
        <Svg width={width} height={width} viewBox="0 0 200 200">
          <Defs>
            <RadialGradient id="splashGlow" cx="50%" cy="50%" r="50%">
              <Stop offset="0%" stopColor="#3b82f6" stopOpacity={isDark ? '0.25' : '0.15'} />
              <Stop offset="60%" stopColor="#1e3a8a" stopOpacity="0.06" />
              <Stop offset="100%" stopColor={tokens.bgObsidian} stopOpacity="0" />
            </RadialGradient>
          </Defs>
          <Circle cx="100" cy="100" r="100" fill="url(#splashGlow)" />
        </Svg>
      </View>

      <Animated.View style={[styles.contentWrapper, { opacity: contentFade }]}>
        {/* Animated Radar Center */}
        <View style={styles.radarContainer}>
          {/* Radar Ring 1 */}
          <Animated.View
            style={[
              styles.radarRing,
              {
                transform: [{ scale: ringScale1 }],
                opacity: ringOpacity1,
              },
            ]}
          />

          {/* Radar Ring 2 */}
          <Animated.View
            style={[
              styles.radarRing,
              {
                borderColor: '#60a5fa',
                transform: [{ scale: ringScale2 }],
                opacity: ringOpacity2,
              },
            ]}
          />

          {/* Emblem Icon Core */}
          <Animated.View
            style={[
              styles.iconCore,
              {
                transform: [{ scale: pulseAnim }],
              },
            ]}
          >
            <Svg width="52" height="52" viewBox="0 0 24 24" fill="none">
              {/* Wireless Signal Waves */}
              <Path
                d="M4.93 4.93C8.83 1.02 15.17 1.02 19.07 4.93"
                stroke="#60a5fa"
                strokeWidth="2.2"
                strokeLinecap="round"
              />
              <Path
                d="M7.76 7.76C10.1 5.42 13.9 5.42 16.24 7.76"
                stroke="#3b82f6"
                strokeWidth="2.2"
                strokeLinecap="round"
              />
              {/* Trackpad / Gamepad Controller Surface */}
              <Path
                d="M6 13C6 11.34 7.34 10 9 10H15C16.66 10 18 11.34 18 13V18C18 19.66 16.66 21 15 21H9C7.34 21 6 19.66 6 18V13Z"
                fill="rgba(59, 130, 246, 0.25)"
                stroke="#93c5fd"
                strokeWidth="2"
              />
              {/* Center Dot */}
              <Circle cx="12" cy="15.5" r="1.8" fill="#ffffff" />
            </Svg>
          </Animated.View>
        </View>

        {/* Branding Typography */}
        <View style={styles.titleSection}>
          <Text style={styles.brandTitle}>Remote Trackpad Pro</Text>
          <Text style={styles.brandSubtitle}>HIGH-PRECISION WIRELESS INTERFACE</Text>
        </View>

        {/* Loading Progress Subsystem */}
        <View style={styles.loadingSection}>
          <View style={styles.progressBarTrack}>
            <Animated.View style={[styles.progressBarFill, { width: progressWidth }]} />
          </View>
          <Text style={styles.statusCaption}>INITIALIZING ULTRA-LOW LATENCY ENGINE</Text>
        </View>
      </Animated.View>

      {/* Footer Version Tag */}
      <View style={styles.footer}>
        <Text style={styles.footerVersion}>v1.4.0 • HARDWARE ACCELERATED UDP</Text>
      </View>
    </Animated.View>
  );
};

const createStyles = (tokens: typeof DarkTokens, isDark: boolean) =>
  StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: tokens.bgObsidian,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 99999,
  },
  glowBg: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  contentWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  radarContainer: {
    width: 140,
    height: 140,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 32,
  },
  radarRing: {
    position: 'absolute',
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 1.5,
    borderColor: '#3b82f6',
  },
  iconCore: {
    width: 86,
    height: 86,
    borderRadius: 43,
    backgroundColor: tokens.cardBase,
    borderWidth: 1.5,
    borderColor: isDark ? 'rgba(59, 130, 246, 0.6)' : 'rgba(37, 99, 235, 0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#3b82f6',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: isDark ? 0.8 : 0.25,
    shadowRadius: 24,
    elevation: 12,
  },
  titleSection: {
    alignItems: 'center',
    marginBottom: 40,
  },
  brandTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: tokens.textWhite,
    letterSpacing: 0.6,
    marginBottom: 6,
  },
  brandSubtitle: {
    fontSize: 10,
    fontWeight: '700',
    color: tokens.blue,
    letterSpacing: 2.2,
  },
  loadingSection: {
    width: 200,
    alignItems: 'center',
  },
  progressBarTrack: {
    width: '100%',
    height: 3,
    backgroundColor: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.08)',
    borderRadius: 2,
    overflow: 'hidden',
    marginBottom: 10,
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: '#3b82f6',
    borderRadius: 2,
  },
  statusCaption: {
    fontSize: 9,
    fontWeight: '600',
    color: tokens.textMuted,
    letterSpacing: 1.2,
  },
  footer: {
    position: 'absolute',
    bottom: 24,
  },
  footerVersion: {
    fontSize: 10,
    fontWeight: '600',
    color: tokens.textMuted,
    letterSpacing: 1.4,
  },
  });


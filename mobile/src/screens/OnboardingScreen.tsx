import React, { useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Dimensions,
  StatusBar,
  NativeSyntheticEvent,
  NativeScrollEvent,
  SafeAreaView,
  Platform,
} from 'react-native';
import Svg, { Rect, Path, Circle } from 'react-native-svg';
import { useTheme } from '../theme/ThemeContext';
import { hapticsService } from '../services/HapticsService';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface OnboardingScreenProps {
  onComplete: () => void;
}

interface FeatureItem {
  id: string;
  title: string;
  description: string;
  renderIcon: (color: string) => React.ReactNode;
}

export const OnboardingScreen: React.FC<OnboardingScreenProps> = ({ onComplete }) => {
  const { isDark, tokens, accent } = useTheme();
  const scrollRef = useRef<ScrollView>(null);
  const [activeIndex, setActiveIndex] = useState(0);

  const features: FeatureItem[] = [
    {
      id: 'mouse_kb',
      title: 'Mouse, keyboard & gamepad',
      description:
        'Zero-lag Wi-Fi touchpad, Gboard-style PC keyboard, and 7 pro gamepad presets with ambient mouse.',
      renderIcon: (color) => (
        <Svg width="22" height="22" viewBox="0 0 24 24" fill="none">
          <Rect x="3" y="4" width="18" height="16" rx="4" stroke={color} strokeWidth="2" />
          <Path d="M3 14h18M12 14v6" stroke={color} strokeWidth="1.8" />
        </Svg>
      ),
    },
    {
      id: 'presentation',
      title: 'Presentation remote',
      description:
        'Change slides effortlessly with built-in rehearsal timer and haptic interval alerts.',
      renderIcon: (color) => (
        <Svg width="22" height="22" viewBox="0 0 24 24" fill="none">
          <Rect x="3" y="3" width="18" height="12" rx="2" stroke={color} strokeWidth="2" />
          <Path
            d="M8 21l4-6 4 6M12 15v6"
            stroke={color}
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </Svg>
      ),
    },
    {
      id: 'mirroring',
      title: 'Screen mirroring',
      description:
        "Open your PC's local browser portal address to view your phone's screen over Wi-Fi.",
      renderIcon: (color) => (
        <Svg width="22" height="22" viewBox="0 0 24 24" fill="none">
          <Rect x="2" y="4" width="20" height="14" rx="2.5" stroke={color} strokeWidth="2" />
          <Path
            d="M8 21h8M12 18v3"
            stroke={color}
            strokeWidth="2"
            strokeLinecap="round"
          />
        </Svg>
      ),
    },
    {
      id: 'webcam',
      title: 'HD phone webcam',
      description:
        "Show your phone's camera in the PC's browser, OBS, Zoom, or VLC wirelessly.",
      renderIcon: (color) => (
        <Svg width="22" height="22" viewBox="0 0 24 24" fill="none">
          <Circle cx="12" cy="10" r="6" stroke={color} strokeWidth="2" />
          <Circle cx="12" cy="10" r="2.2" fill={color} />
          <Path
            d="M8 20h8M12 16v4"
            stroke={color}
            strokeWidth="2"
            strokeLinecap="round"
          />
        </Svg>
      ),
    },
  ];

  const handleScrollEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const page = Math.round(e.nativeEvent.contentOffset.x / SCREEN_WIDTH);
    if (page !== activeIndex) {
      setActiveIndex(page);
    }
  };

  const handleNext = () => {
    hapticsService.light();
    scrollRef.current?.scrollTo({ x: SCREEN_WIDTH, animated: true });
    setActiveIndex(1);
  };

  const handleFinish = () => {
    hapticsService.medium();
    onComplete();
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: tokens.bgObsidian }]}>
      <StatusBar
        barStyle={isDark ? 'light-content' : 'dark-content'}
        backgroundColor={tokens.bgObsidian}
      />

      {/* Top Skip Row (only shown on Slide 1 for clean layout) */}
      <View style={styles.topRow}>
        {activeIndex === 0 ? (
          <TouchableOpacity
            onPress={() => {
              hapticsService.light();
              onComplete();
            }}
            style={styles.skipBtn}
            activeOpacity={0.7}
            focusable={false}
          >
            <Text style={[styles.skipText, { color: tokens.textSecondary }]}>Skip</Text>
          </TouchableOpacity>
        ) : (
          <View style={styles.skipPlaceholder} />
        )}
      </View>

      {/* Horizontal 2-Slide Pager */}
      <ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={handleScrollEnd}
        scrollEventThrottle={16}
        style={styles.pager}
      >
        {/* ================= SLIDE 1: HERO VALUE PROP ================= */}
        <View style={[styles.slide, { width: SCREEN_WIDTH }]}>
          <View style={styles.heroIllustrationWrap}>
            <Svg width="220" height="145" viewBox="0 0 220 145" fill="none">
              {/* Smartphone Outline */}
              <Rect
                x="18"
                y="34"
                width="42"
                height="74"
                rx="9"
                fill={isDark ? '#12141f' : '#ffffff'}
                stroke={isDark ? '#64748b' : '#475569'}
                strokeWidth="3.5"
              />
              {/* Glowing Touchpad Dot on Phone */}
              <Circle cx="39" cy="71" r="7.5" fill={accent.primary} />

              {/* Wireless Signal Arcs */}
              <Path
                d="M71 57C76 62 78 66 78 71C78 76 76 80 71 85"
                stroke={accent.primary}
                strokeWidth="3.5"
                strokeLinecap="round"
              />
              <Path
                d="M81 48C88 55 91 62 91 71C91 80 88 87 81 94"
                stroke={accent.primary}
                strokeWidth="3.5"
                strokeLinecap="round"
              />

              {/* PC Monitor Frame */}
              <Rect
                x="104"
                y="20"
                width="98"
                height="74"
                rx="10"
                fill={isDark ? '#12141f' : '#ffffff'}
                stroke={isDark ? '#334155' : '#64748b'}
                strokeWidth="4"
              />
              {/* Monitor Inner Screen */}
              <Rect
                x="113"
                y="29"
                width="80"
                height="56"
                rx="4"
                fill={accent.bgSoft}
              />
              {/* Cursor Arrow Inside Screen */}
              <Path
                d="M145 45L148 68L154 61L163 63L145 45Z"
                fill={accent.primary}
                stroke={accent.primary}
                strokeWidth="2"
                strokeLinejoin="round"
              />
              {/* Monitor Stand */}
              <Path
                d="M153 94V112M135 112H171"
                stroke={isDark ? '#64748b' : '#475569'}
                strokeWidth="4"
                strokeLinecap="round"
              />
            </Svg>
          </View>

          <Text style={[styles.heroHeadline, { color: tokens.textWhite }]}>
            Turn your phone into a{'\n'}remote for your PC
          </Text>
          <Text style={[styles.heroSubtitle, { color: tokens.textSecondary }]}>
            A zero-lag Wi-Fi touchpad, mechanical keyboard, pro gamepad, and presentation remote.
            Your phone's screen and camera can be shown on your PC too.
          </Text>
        </View>

        {/* ================= SLIDE 2: WHAT YOU CAN DO ================= */}
        <View style={[styles.slide, styles.slideTwo, { width: SCREEN_WIDTH }]}>
          <Text style={[styles.slideTwoTitle, { color: tokens.textWhite }]}>
            What you can do
          </Text>

          <ScrollView
            style={styles.featuresScroll}
            contentContainerStyle={styles.featuresList}
            showsVerticalScrollIndicator={false}
          >
            {features.map((item) => (
              <View
                key={item.id}
                style={[
                  styles.featureCard,
                  {
                    backgroundColor: tokens.cardBase,
                    borderColor: tokens.borderSubtle,
                  },
                ]}
              >
                <View
                  style={[
                    styles.featureIconBox,
                    { backgroundColor: accent.bgSoft },
                  ]}
                >
                  {item.renderIcon(accent.primary)}
                </View>

                <View style={styles.featureTextCol}>
                  <Text style={[styles.featureTitle, { color: tokens.textWhite }]}>
                    {item.title}
                  </Text>
                  <Text
                    style={[styles.featureDescription, { color: tokens.textSecondary }]}
                  >
                    {item.description}
                  </Text>
                </View>
              </View>
            ))}
          </ScrollView>
        </View>
      </ScrollView>

      {/* Bottom Pagination Dots & Primary Pill CTA */}
      <View style={styles.footer}>
        <View style={styles.dotsRow}>
          {[0, 1].map((idx) => {
            const isActive = activeIndex === idx;
            return (
              <View
                key={idx}
                style={[
                  styles.dot,
                  {
                    backgroundColor: isActive
                      ? accent.primary
                      : isDark
                      ? 'rgba(255, 255, 255, 0.22)'
                      : 'rgba(0, 0, 0, 0.18)',
                  },
                ]}
              />
            );
          })}
        </View>

        <TouchableOpacity
          style={[styles.ctaButton, { backgroundColor: accent.primary }]}
          onPress={activeIndex === 0 ? handleNext : handleFinish}
          activeOpacity={0.85}
          focusable={false}
        >
          <Text style={styles.ctaButtonText}>
            {activeIndex === 0 ? 'Next' : 'Get started'}
          </Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight || 24 : 0,
  },
  topRow: {
    height: 48,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  skipBtn: {
    paddingVertical: 6,
    paddingHorizontal: 10,
  },
  skipText: {
    fontSize: 15,
    fontWeight: '600',
  },
  skipPlaceholder: {
    height: 30,
  },
  pager: {
    flex: 1,
  },
  slide: {
    flex: 1,
    paddingHorizontal: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  slideTwo: {
    justifyContent: 'flex-start',
    paddingTop: 6,
  },
  heroIllustrationWrap: {
    marginBottom: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroHeadline: {
    fontSize: 25,
    fontWeight: '800',
    textAlign: 'center',
    lineHeight: 32,
    marginBottom: 14,
    letterSpacing: 0.2,
  },
  heroSubtitle: {
    fontSize: 14.5,
    textAlign: 'center',
    lineHeight: 22,
    paddingHorizontal: 8,
  },
  slideTwoTitle: {
    fontSize: 25,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 20,
    letterSpacing: 0.2,
  },
  featuresScroll: {
    width: '100%',
    flex: 1,
  },
  featuresList: {
    gap: 12,
    paddingBottom: 16,
  },
  featureCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 15,
    borderRadius: 16,
    borderWidth: 1,
    gap: 14,
  },
  featureIconBox: {
    width: 46,
    height: 46,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  featureTextCol: {
    flex: 1,
  },
  featureTitle: {
    fontSize: 15.5,
    fontWeight: '700',
    marginBottom: 4,
  },
  featureDescription: {
    fontSize: 13,
    lineHeight: 18,
  },
  footer: {
    paddingHorizontal: 22,
    paddingTop: 12,
    paddingBottom: Platform.OS === 'ios' ? 24 : 22,
    alignItems: 'center',
  },
  dotsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 18,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  ctaButton: {
    width: '100%',
    height: 52,
    borderRadius: 9999,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  ctaButtonText: {
    color: '#071312',
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
});


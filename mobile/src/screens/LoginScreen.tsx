import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  StatusBar,
  ScrollView,
} from 'react-native';
import Svg, { Path, Circle, Defs, RadialGradient, Stop } from 'react-native-svg';
import { authService, UserProfile } from '../services/AuthService';
import { hapticsService } from '../services/HapticsService';

interface LoginScreenProps {
  onSuccess: (user: UserProfile) => void;
  onSkip: () => void;
}

export const LoginScreen: React.FC<LoginScreenProps> = ({ onSuccess, onSkip }) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleGoogleLogin = async () => {
    hapticsService.light();
    setLoading(true);
    setError(null);

    try {
      const user = await authService.loginWithGoogle();
      hapticsService.medium();
      onSuccess(user);
    } catch (err: any) {
      setError('Unable to authenticate with Google. You can continue as guest.');
    } finally {
      setLoading(false);
    }
  };

  const handleSkip = async () => {
    hapticsService.light();
    await authService.skipAuth();
    onSkip();
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#0b0c10" />

      {/* Background Ambient Glow */}
      <View style={styles.ambientGlow}>
        <Svg width="360" height="360" viewBox="0 0 200 200">
          <Defs>
            <RadialGradient id="loginGlow" cx="50%" cy="50%" r="50%">
              <Stop offset="0%" stopColor="#3b82f6" stopOpacity="0.18" />
              <Stop offset="70%" stopColor="#1e3a8a" stopOpacity="0.04" />
              <Stop offset="100%" stopColor="#0b0c10" stopOpacity="0" />
            </RadialGradient>
          </Defs>
          <Circle cx="100" cy="100" r="100" fill="url(#loginGlow)" />
        </Svg>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} bounces={false}>
        {/* Header Branding */}
        <View style={styles.header}>
          <View style={styles.iconRing}>
            <Svg width="44" height="44" viewBox="0 0 24 24" fill="none">
              <Path
                d="M12 2C6.48 2 2 6.48 2 12C2 17.52 6.48 22 12 22C17.52 22 22 17.52 22 12"
                stroke="#3b82f6"
                strokeWidth="2"
                strokeLinecap="round"
              />
              <Path
                d="M8 12C8 9.79 9.79 8 12 8C14.21 8 16 9.79 16 12V16C16 17.1 15.1 18 14 18H10C8.9 18 8 17.1 8 16V12Z"
                fill="rgba(59, 130, 246, 0.2)"
                stroke="#60a5fa"
                strokeWidth="1.8"
              />
              <Circle cx="12" cy="11.5" r="1.5" fill="#ffffff" />
            </Svg>
          </View>
          <Text style={styles.title}>Remote Trackpad Pro</Text>
          <Text style={styles.subtitle}>
            Sign in to sync your sensitivity profiles, custom gamepad layouts, and favorite host PCs across devices.
          </Text>
        </View>

        {/* Feature Highlights Card */}
        <View style={styles.featuresCard}>
          <View style={styles.featureRow}>
            <Text style={styles.featureIcon}>☁️</Text>
            <View style={styles.featureTextCol}>
              <Text style={styles.featureTitle}>Cloud Backup & Sync</Text>
              <Text style={styles.featureDesc}>
                Preserve customized button rebinds & joystick deadzones.
              </Text>
            </View>
          </View>

          <View style={styles.featureRow}>
            <Text style={styles.featureIcon}>⚡</Text>
            <View style={styles.featureTextCol}>
              <Text style={styles.featureTitle}>Instant Reconnect</Text>
              <Text style={styles.featureDesc}>
                Auto-pair with your authorized PCs securely.
              </Text>
            </View>
          </View>

          <View style={styles.featureRow}>
            <Text style={styles.featureIcon}>💾</Text>
            <View style={styles.featureTextCol}>
              <Text style={styles.featureTitle}>Dual-Mode Storage</Text>
              <Text style={styles.featureDesc}>
                Sync to cloud or save completely offline on this device.
              </Text>
            </View>
          </View>
        </View>

        {/* Error Notification */}
        {error && (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>⚠️ {error}</Text>
          </View>
        )}

        {/* Action Controls */}
        <View style={styles.actions}>
          {/* Google Sign-In Button */}
          <TouchableOpacity
            style={styles.googleBtn}
            onPress={handleGoogleLogin}
            disabled={loading}
            activeOpacity={0.85}
          >
            {loading ? (
              <ActivityIndicator color="#1e293b" />
            ) : (
              <>
                {/* Official Google G Logo */}
                <Svg width="22" height="22" viewBox="0 0 24 24" style={styles.googleSvg}>
                  <Path
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                    fill="#4285F4"
                  />
                  <Path
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                    fill="#34A853"
                  />
                  <Path
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                    fill="#FBBC05"
                  />
                  <Path
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                    fill="#EA4335"
                  />
                </Svg>
                <Text style={styles.googleBtnText}>Continue with Google</Text>
              </>
            )}
          </TouchableOpacity>

          {/* Divider */}
          <View style={styles.dividerRow}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>OR</Text>
            <View style={styles.dividerLine} />
          </View>

          {/* Skip Button */}
          <TouchableOpacity
            style={styles.skipBtn}
            onPress={handleSkip}
            disabled={loading}
            activeOpacity={0.8}
          >
            <Text style={styles.skipBtnText}>Skip & Continue as Guest ➔</Text>
            <Text style={styles.skipBtnSubtext}>
              Preferences will be saved to this phone's local storage
            </Text>
          </TouchableOpacity>
        </View>

        {/* Footer Note */}
        <Text style={styles.footerNote}>
          You can sign in or change storage settings at any time in the ⚙️ Settings menu.
        </Text>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0b0c10',
  },
  ambientGlow: {
    position: 'absolute',
    top: 30,
    alignSelf: 'center',
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingTop: 50,
    paddingBottom: 30,
    alignItems: 'center',
  },
  header: {
    alignItems: 'center',
    marginBottom: 28,
  },
  iconRing: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: '#151722',
    borderWidth: 1.5,
    borderColor: 'rgba(59, 130, 246, 0.4)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    shadowColor: '#3b82f6',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 14,
    elevation: 8,
  },
  title: {
    fontSize: 23,
    fontWeight: '800',
    color: '#ffffff',
    letterSpacing: 0.4,
    marginBottom: 10,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 13,
    color: '#94a3b8',
    textAlign: 'center',
    lineHeight: 19,
    paddingHorizontal: 10,
  },
  featuresCard: {
    width: '100%',
    backgroundColor: '#141620',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    padding: 16,
    marginBottom: 26,
    gap: 14,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  featureIcon: {
    fontSize: 20,
    marginRight: 12,
  },
  featureTextCol: {
    flex: 1,
  },
  featureTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#f1f5f9',
    marginBottom: 2,
  },
  featureDesc: {
    fontSize: 12,
    color: '#8b8d9c',
    lineHeight: 16,
  },
  errorBox: {
    width: '100%',
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    borderWidth: 1,
    borderColor: '#ef4444',
    borderRadius: 10,
    padding: 10,
    marginBottom: 16,
  },
  errorText: {
    color: '#fca5a5',
    fontSize: 12,
    textAlign: 'center',
  },
  actions: {
    width: '100%',
    alignItems: 'center',
  },
  googleBtn: {
    width: '100%',
    height: 50,
    borderRadius: 12,
    backgroundColor: '#ffffff',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 4,
  },
  googleSvg: {
    marginRight: 10,
  },
  googleBtnText: {
    color: '#1f2937',
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    marginVertical: 18,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  dividerText: {
    marginHorizontal: 12,
    fontSize: 11,
    fontWeight: '700',
    color: '#64748b',
    letterSpacing: 1,
  },
  skipBtn: {
    width: '100%',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.14)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  skipBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#93c5fd',
    letterSpacing: 0.3,
    marginBottom: 3,
  },
  skipBtnSubtext: {
    fontSize: 11,
    color: '#64748b',
    textAlign: 'center',
  },
  footerNote: {
    fontSize: 11,
    color: '#475569',
    textAlign: 'center',
    marginTop: 24,
    lineHeight: 16,
    paddingHorizontal: 20,
  },
});


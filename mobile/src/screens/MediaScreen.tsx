import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { socketService } from '../services/SocketService';
import { hapticsService } from '../services/HapticsService';

interface MediaScreenProps {
  isFullscreen?: boolean;
  onToggleFullscreen?: () => void;
}

export const MediaScreen: React.FC<MediaScreenProps> = ({
  isFullscreen,
  onToggleFullscreen,
}) => {
  const triggerMediaKey = (keyName: string) => {
    socketService.key(keyName, 'tap');
    hapticsService.dpad();
  };

  return (
    <View style={[styles.container, isFullscreen && styles.containerFullscreen]}>
      {/* Exact Card matching templates/index.html lines 1968-1988 */}
      <View style={[styles.card, isFullscreen && styles.cardFullscreen]}>
        <View style={styles.sectionTitle}>
          <Text style={styles.titleText}>Media controls</Text>
          <View style={styles.headerRightGroup}>
            <View style={styles.badge}>
              <Text style={styles.badgeText}>System</Text>
            </View>
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
        </View>

        <View style={styles.mediaGrid}>
          <TouchableOpacity
            style={styles.mediaBtn}
            onPress={() => triggerMediaKey('media_previous')}
            activeOpacity={0.88}
            focusable={false}
          >
            <Text style={styles.mediaBtnText}>⏮ Prev</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.mediaBtn, styles.mediaBtnPrimary]}
            onPress={() => triggerMediaKey('media_play_pause')}
            activeOpacity={0.88}
            focusable={false}
          >
            <Text style={[styles.mediaBtnText, styles.primaryText]}>⏯ Play/Pause</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.mediaBtn}
            onPress={() => triggerMediaKey('media_next')}
            activeOpacity={0.88}
            focusable={false}
          >
            <Text style={styles.mediaBtnText}>⏭ Next</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.mediaBtn}
            onPress={() => triggerMediaKey('media_volume_down')}
            activeOpacity={0.88}
            focusable={false}
          >
            <Text style={styles.mediaBtnText}>🔉 Vol -</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.mediaBtn}
            onPress={() => triggerMediaKey('media_volume_mute')}
            activeOpacity={0.88}
            focusable={false}
          >
            <Text style={styles.mediaBtnText}>🔇 Mute</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.mediaBtn}
            onPress={() => triggerMediaKey('media_volume_up')}
            activeOpacity={0.88}
            focusable={false}
          >
            <Text style={styles.mediaBtnText}>🔊 Vol +</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.hint}>
          Media keys behavior can vary depending on OS and active desktop application.
        </Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 10,
    backgroundColor: '#0b0c10',
  },
  containerFullscreen: {
    padding: 0,
  },
  card: {
    backgroundColor: 'rgba(18, 19, 26, 0.96)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.65,
    shadowRadius: 30,
    elevation: 6,
    padding: 14,
    gap: 12,
  },
  cardFullscreen: {
    flex: 1,
    borderRadius: 0,
    borderWidth: 0,
    justifyContent: 'center',
    padding: 20,
  },
  sectionTitle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerRightGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  fullscreenBtn: {
    backgroundColor: '#22232c',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.14)',
    paddingHorizontal: 8,
    paddingVertical: 3,
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
  titleText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#f5f5f7',
  },
  badge: {
    paddingVertical: 2,
    paddingHorizontal: 7,
    borderRadius: 999,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
  },
  badgeText: {
    fontSize: 10.5,
    color: '#8b8d9c',
  },
  mediaGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 8,
  },
  mediaBtn: {
    width: '31.5%',
    paddingVertical: 14,
    paddingHorizontal: 4,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
    backgroundColor: '#1c1d28',
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 2,
  },
  mediaBtnPrimary: {
    backgroundColor: '#4f8cff',
    borderColor: '#4f8cff',
    elevation: 4,
  },
  mediaBtnText: {
    color: '#f5f5f7',
    fontSize: 13,
    fontWeight: '500',
    textAlign: 'center',
  },
  primaryText: {
    color: '#ffffff',
    fontWeight: '600',
  },
  hint: {
    fontSize: 11,
    color: '#8b8d9c',
    lineHeight: 16,
    marginTop: 4,
  },
});

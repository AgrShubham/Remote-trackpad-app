import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import Svg, { Path, Rect, Circle } from 'react-native-svg';
import { CyberTokens } from '../theme/cyberTokens';
import { hapticsService } from '../services/HapticsService';

export type BottomNavTab = 'remote' | 'screen' | 'settings';

interface BottomDockProps {
  activeTab: BottomNavTab;
  onSelectTab: (tab: BottomNavTab) => void;
  accentColor?: string;
}

export const BottomDock: React.FC<BottomDockProps> = ({
  activeTab,
  onSelectTab,
  accentColor = CyberTokens.teal,
}) => {
  const tabs: { id: BottomNavTab; label: string }[] = [
    { id: 'remote', label: 'Remote' },
    { id: 'screen', label: 'Show on PC' },
    { id: 'settings', label: 'Settings' },
  ];

  const handleTabPress = (tab: BottomNavTab) => {
    hapticsService.light();
    onSelectTab(tab);
  };

  const renderIcon = (id: BottomNavTab, active: boolean) => {
    const iconColor = active ? accentColor : CyberTokens.textSecondary;

    if (id === 'remote') {
      return (
        <Svg width="22" height="22" viewBox="0 0 24 24" fill="none">
          <Rect
            x="3"
            y="3"
            width="18"
            height="18"
            rx="5"
            stroke={iconColor}
            strokeWidth="2"
          />
          <Circle cx="8" cy="8" r="1.5" fill={iconColor} />
          <Circle cx="16" cy="8" r="1.5" fill={iconColor} />
          <Path
            d="M8 14h8M12 11v6"
            stroke={iconColor}
            strokeWidth="1.8"
            strokeLinecap="round"
          />
        </Svg>
      );
    }

    if (id === 'screen') {
      return (
        <Svg width="22" height="22" viewBox="0 0 24 24" fill="none">
          <Rect
            x="2"
            y="3"
            width="20"
            height="14"
            rx="2.5"
            stroke={iconColor}
            strokeWidth="2"
          />
          <Path
            d="M8 21h8M12 17v4"
            stroke={iconColor}
            strokeWidth="2"
            strokeLinecap="round"
          />
          <Path
            d="M7 11l3-3 2 2 4-4"
            stroke={iconColor}
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </Svg>
      );
    }

    // Settings icon
    return (
      <Svg width="22" height="22" viewBox="0 0 24 24" fill="none">
        <Circle cx="12" cy="12" r="3" stroke={iconColor} strokeWidth="2" />
        <Path
          d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"
          stroke={iconColor}
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </Svg>
    );
  };

  return (
    <View style={styles.outerContainer}>
      <View style={styles.dockCapsule}>
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <TouchableOpacity
              key={tab.id}
              style={[
                styles.tabItem,
                isActive && [
                  styles.tabItemActive,
                  { backgroundColor: `${accentColor}18` },
                ],
              ]}
              onPress={() => handleTabPress(tab.id)}
              activeOpacity={0.8}
              focusable={false}
            >
              <View style={styles.iconContainer}>
                {renderIcon(tab.id, isActive)}
                {isActive && (
                  <View
                    style={[
                      styles.activeIndicatorDot,
                      { backgroundColor: accentColor },
                    ]}
                  />
                )}
              </View>
              <Text
                style={[
                  styles.tabLabel,
                  isActive
                    ? [styles.tabLabelActive, { color: CyberTokens.textWhite }]
                    : styles.tabLabelInactive,
                ]}
              >
                {tab.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  outerContainer: {
    paddingHorizontal: 20,
    paddingBottom: Platform.OS === 'ios' ? 14 : 10,
    paddingTop: 6,
    backgroundColor: 'transparent',
    alignItems: 'center',
  },
  dockCapsule: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    width: '100%',
    maxWidth: 420,
    backgroundColor: CyberTokens.cardBase,
    borderRadius: CyberTokens.radiusPill,
    paddingVertical: 7,
    paddingHorizontal: 8,
    borderWidth: 1,
    borderColor: CyberTokens.borderSubtle,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.5,
    shadowRadius: 14,
    elevation: 8,
  },
  tabItem: {
    flex: 1,
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 6,
    borderRadius: CyberTokens.radiusPill,
    marginHorizontal: 3,
  },
  tabItemActive: {
    borderWidth: 1,
    borderColor: CyberTokens.borderSubtle,
  },
  iconContainer: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  activeIndicatorDot: {
    position: 'absolute',
    top: -4,
    right: -4,
    width: 5,
    height: 5,
    borderRadius: 2.5,
  },
  tabLabel: {
    fontSize: 11,
    marginTop: 3,
    letterSpacing: 0.2,
  },
  tabLabelActive: {
    fontWeight: '700',
  },
  tabLabelInactive: {
    fontWeight: '500',
    color: CyberTokens.textSecondary,
  },
});


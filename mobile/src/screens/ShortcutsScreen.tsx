import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
} from 'react-native';
import Svg, { Path, Rect } from 'react-native-svg';
import { CyberTokens } from '../theme/cyberTokens';
import { useTheme } from '../theme/ThemeContext';
import { socketService } from '../services/SocketService';
import { hapticsService } from '../services/HapticsService';

type CategoryFilter = 'all' | 'windows' | 'editing' | 'browser' | 'media';

interface MacroShortcut {
  id: string;
  category: 'windows' | 'editing' | 'browser' | 'media';
  title: string;
  description: string;
  keys: string[];
  actionType: 'shortcut' | 'key';
  accentColor?: string;
}

const MACRO_LIST: MacroShortcut[] = [
  // Windows & Navigation
  {
    id: 'alt_tab',
    category: 'windows',
    title: 'Switch App',
    description: 'Cycle open windows (Task Switcher)',
    keys: ['alt', 'tab'],
    actionType: 'shortcut',
    accentColor: CyberTokens.blue,
  },
  {
    id: 'win_d',
    category: 'windows',
    title: 'Show Desktop',
    description: 'Minimize or restore all windows',
    keys: ['win', 'd'],
    actionType: 'shortcut',
    accentColor: CyberTokens.blue,
  },
  {
    id: 'win_l',
    category: 'windows',
    title: 'Lock Workstation',
    description: 'Instantly lock PC screen',
    keys: ['win', 'l'],
    actionType: 'shortcut',
    accentColor: CyberTokens.crimson,
  },
  {
    id: 'win_e',
    category: 'windows',
    title: 'File Explorer',
    description: 'Open file manager window',
    keys: ['win', 'e'],
    actionType: 'shortcut',
    accentColor: CyberTokens.amber,
  },
  {
    id: 'win_r',
    category: 'windows',
    title: 'Run Dialog',
    description: 'Open Windows Run prompt',
    keys: ['win', 'r'],
    actionType: 'shortcut',
    accentColor: CyberTokens.teal,
  },
  {
    id: 'task_mgr',
    category: 'windows',
    title: 'Task Manager',
    description: 'Direct Task Manager shortcut',
    keys: ['ctrl', 'shift', 'esc'],
    actionType: 'shortcut',
    accentColor: CyberTokens.crimson,
  },
  {
    id: 'snap_left',
    category: 'windows',
    title: 'Snap Left',
    description: 'Snap active window to left half',
    keys: ['win', 'left'],
    actionType: 'shortcut',
    accentColor: CyberTokens.cyan,
  },
  {
    id: 'snap_right',
    category: 'windows',
    title: 'Snap Right',
    description: 'Snap active window to right half',
    keys: ['win', 'right'],
    actionType: 'shortcut',
    accentColor: CyberTokens.cyan,
  },
  {
    id: 'alt_f4',
    category: 'windows',
    title: 'Close Window',
    description: 'Quit or close active application',
    keys: ['alt', 'f4'],
    actionType: 'shortcut',
    accentColor: CyberTokens.crimson,
  },

  // Document & Text Editing
  {
    id: 'ctrl_c',
    category: 'editing',
    title: 'Copy',
    description: 'Copy selection to clipboard',
    keys: ['ctrl', 'c'],
    actionType: 'shortcut',
    accentColor: CyberTokens.teal,
  },
  {
    id: 'ctrl_v',
    category: 'editing',
    title: 'Paste',
    description: 'Paste clipboard contents',
    keys: ['ctrl', 'v'],
    actionType: 'shortcut',
    accentColor: CyberTokens.teal,
  },
  {
    id: 'ctrl_x',
    category: 'editing',
    title: 'Cut',
    description: 'Cut selection to clipboard',
    keys: ['ctrl', 'x'],
    actionType: 'shortcut',
    accentColor: CyberTokens.amber,
  },
  {
    id: 'ctrl_z',
    category: 'editing',
    title: 'Undo',
    description: 'Undo last edit or change',
    keys: ['ctrl', 'z'],
    actionType: 'shortcut',
    accentColor: CyberTokens.purple,
  },
  {
    id: 'ctrl_y',
    category: 'editing',
    title: 'Redo',
    description: 'Redo undone action',
    keys: ['ctrl', 'y'],
    actionType: 'shortcut',
    accentColor: CyberTokens.purple,
  },
  {
    id: 'ctrl_a',
    category: 'editing',
    title: 'Select All',
    description: 'Select all text or items in view',
    keys: ['ctrl', 'a'],
    actionType: 'shortcut',
    accentColor: CyberTokens.blue,
  },
  {
    id: 'ctrl_s',
    category: 'editing',
    title: 'Save File',
    description: 'Save current document or project',
    keys: ['ctrl', 's'],
    actionType: 'shortcut',
    accentColor: CyberTokens.emerald,
  },
  {
    id: 'ctrl_f',
    category: 'editing',
    title: 'Find',
    description: 'Search document or web page',
    keys: ['ctrl', 'f'],
    actionType: 'shortcut',
    accentColor: CyberTokens.cyan,
  },

  // Web Browser Shortcuts
  {
    id: 'new_tab',
    category: 'browser',
    title: 'New Tab',
    description: 'Open a fresh browser tab',
    keys: ['ctrl', 't'],
    actionType: 'shortcut',
    accentColor: CyberTokens.teal,
  },
  {
    id: 'close_tab',
    category: 'browser',
    title: 'Close Tab',
    description: 'Close active browser tab',
    keys: ['ctrl', 'w'],
    actionType: 'shortcut',
    accentColor: CyberTokens.crimson,
  },
  {
    id: 'reopen_tab',
    category: 'browser',
    title: 'Reopen Tab',
    description: 'Restore last closed tab',
    keys: ['ctrl', 'shift', 't'],
    actionType: 'shortcut',
    accentColor: CyberTokens.amber,
  },
  {
    id: 'refresh_page',
    category: 'browser',
    title: 'Reload Page',
    description: 'Refresh current web page',
    keys: ['ctrl', 'r'],
    actionType: 'shortcut',
    accentColor: CyberTokens.blue,
  },
  {
    id: 'address_bar',
    category: 'browser',
    title: 'Address Bar',
    description: 'Focus URL bar to type website',
    keys: ['ctrl', 'l'],
    actionType: 'shortcut',
    accentColor: CyberTokens.cyan,
  },
  {
    id: 'zoom_in',
    category: 'browser',
    title: 'Zoom In',
    description: 'Increase page zoom scale',
    keys: ['ctrl', '='],
    actionType: 'shortcut',
    accentColor: CyberTokens.emerald,
  },
  {
    id: 'zoom_out',
    category: 'browser',
    title: 'Zoom Out',
    description: 'Decrease page zoom scale',
    keys: ['ctrl', '-'],
    actionType: 'shortcut',
    accentColor: CyberTokens.emerald,
  },

  // Media & Utilities
  {
    id: 'screenshot',
    category: 'media',
    title: 'Take Screenshot',
    description: 'Windows Snipping tool area capture',
    keys: ['win', 'shift', 's'],
    actionType: 'shortcut',
    accentColor: CyberTokens.purple,
  },
  {
    id: 'project_display',
    category: 'media',
    title: 'Project Display',
    description: 'Switch monitor mirror / extend modes',
    keys: ['win', 'p'],
    actionType: 'shortcut',
    accentColor: CyberTokens.amber,
  },
  {
    id: 'media_mute',
    category: 'media',
    title: 'Toggle Mute',
    description: 'Mute / unmute PC system audio',
    keys: ['media_volume_mute'],
    actionType: 'key',
    accentColor: CyberTokens.crimson,
  },
  {
    id: 'media_play',
    category: 'media',
    title: 'Play / Pause',
    description: 'Toggle current media playback',
    keys: ['media_play_pause'],
    actionType: 'key',
    accentColor: CyberTokens.teal,
  },
];

interface ShortcutsScreenProps {
  onBack?: () => void;
  accentColor?: string;
}

export const ShortcutsScreen: React.FC<ShortcutsScreenProps> = ({
  onBack,
  accentColor: propAccentColor,
}) => {
  const { isDark, tokens, accent } = useTheme();
  const accentColor = propAccentColor || accent.primary || tokens.cyan;
  const [activeCategory, setActiveCategory] = useState<CategoryFilter>('all');
  const [lastExecutedId, setLastExecutedId] = useState<string | null>(null);

  const categories: { id: CategoryFilter; label: string }[] = [
    { id: 'all', label: 'All' },
    { id: 'windows', label: 'Windows' },
    { id: 'editing', label: 'Editing' },
    { id: 'browser', label: 'Browser' },
    { id: 'media', label: 'System & Media' },
  ];

  const filteredMacros =
    activeCategory === 'all'
      ? MACRO_LIST
      : MACRO_LIST.filter((m) => m.category === activeCategory);

  const handleExecute = (macro: MacroShortcut) => {
    hapticsService.light();
    setLastExecutedId(macro.id);
    setTimeout(() => setLastExecutedId(null), 300);

    if (macro.actionType === 'shortcut') {
      socketService.shortcut(macro.keys);
    } else {
      socketService.key(macro.keys[0], 'tap');
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: tokens.bgObsidian }]}>
      {/* Top Bar */}
      <View style={[styles.topBar, { backgroundColor: tokens.bgSurface, borderBottomColor: tokens.borderSubtle }]}>
        {onBack && (
          <TouchableOpacity
            style={[
              styles.backBtn,
              {
                backgroundColor: isDark
                  ? 'rgba(255, 255, 255, 0.08)'
                  : 'rgba(0, 0, 0, 0.05)',
                borderColor: tokens.borderSubtle,
              },
            ]}
            onPress={() => {
              hapticsService.light();
              onBack();
            }}
            activeOpacity={0.8}
          >
            <Svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={tokens.textSecondary} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
              <Path d="M19 12H5M12 19l-7-7 7-7" />
            </Svg>
            <Text style={[styles.backBtnText, { color: tokens.textWhite }]}>Hub</Text>
          </TouchableOpacity>
        )}

        <View style={styles.topTitleBox}>
          <Text style={[styles.topTitleText, { color: tokens.textWhite }]}>Shortcuts & Macros</Text>
        </View>
      </View>

      {/* Filter Tabs */}
      <View style={[styles.filterRow, { backgroundColor: tokens.bgSurface, borderBottomColor: tokens.borderSubtle }]}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterScroll}>
          {categories.map((c) => {
            const isSelected = activeCategory === c.id;
            return (
              <TouchableOpacity
                key={c.id}
                style={[
                  styles.filterPill,
                  {
                    backgroundColor: isDark
                      ? 'rgba(255, 255, 255, 0.04)'
                      : 'rgba(0, 0, 0, 0.04)',
                    borderColor: tokens.borderSubtle,
                  },
                  isSelected && [styles.filterPillActive, { borderColor: accentColor }],
                ]}
                onPress={() => {
                  hapticsService.light();
                  setActiveCategory(c.id);
                }}
                activeOpacity={0.8}
              >
                <Text
                  style={[
                    styles.filterPillText,
                    { color: tokens.textSecondary },
                    isSelected && { color: accentColor, fontWeight: '700' },
                  ]}
                >
                  {c.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* Macro Grid */}
      <ScrollView contentContainerStyle={styles.gridContent} showsVerticalScrollIndicator={false}>
        <View style={styles.macroGrid}>
          {filteredMacros.map((macro) => {
            const isExecuted = lastExecutedId === macro.id;
            const cardAccent = macro.accentColor || accentColor;

            return (
              <TouchableOpacity
                key={macro.id}
                style={[
                  styles.macroCard,
                  { backgroundColor: tokens.cardBase, borderColor: tokens.borderSubtle },
                  isExecuted && [styles.macroCardExecuted, { borderColor: cardAccent }],
                ]}
                onPress={() => handleExecute(macro)}
                activeOpacity={0.8}
              >
                {/* Keycaps Pills Header */}
                <View style={styles.keycapsRow}>
                  {macro.keys.map((k, idx) => (
                    <React.Fragment key={idx}>
                      <View style={[styles.keycapBadge, { borderColor: `${cardAccent}50` }]}>
                        <Text style={[styles.keycapText, { color: cardAccent }]}>
                          {k.toUpperCase()}
                        </Text>
                      </View>
                      {idx < macro.keys.length - 1 && (
                        <Text style={styles.plusSign}>+</Text>
                      )}
                    </React.Fragment>
                  ))}
                </View>

                {/* Title & Description */}
                <Text style={[styles.macroTitle, { color: tokens.textWhite }]}>{macro.title}</Text>
                <Text style={[styles.macroDescription, { color: tokens.textSecondary }]} numberOfLines={2}>
                  {macro.description}
                </Text>

                <View style={styles.cardFooter}>
                  <Text style={[styles.triggerHint, { color: cardAccent }]}>Tap to trigger ↵</Text>
                </View>
              </TouchableOpacity>
            );
          })}
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: CyberTokens.bgObsidian,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: CyberTokens.borderSubtle,
    backgroundColor: CyberTokens.bgSurface,
  },
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderWidth: 1,
    borderColor: CyberTokens.borderSubtle,
    marginRight: 10,
  },
  backBtnText: {
    color: '#cbd5e1',
    fontSize: 12,
    fontWeight: '700',
  },
  topTitleBox: {
    flex: 1,
  },
  topTitleText: {
    fontSize: 14,
    fontWeight: '700',
    color: CyberTokens.textWhite,
  },
  filterRow: {
    paddingVertical: 8,
    backgroundColor: CyberTokens.bgSurface,
    borderBottomWidth: 1,
    borderBottomColor: CyberTokens.borderSubtle,
  },
  filterScroll: {
    paddingHorizontal: 12,
    gap: 8,
  },
  filterPill: {
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderWidth: 1,
    borderColor: CyberTokens.borderSubtle,
  },
  filterPillActive: {
    backgroundColor: 'rgba(255, 255, 255, 0.09)',
  },
  filterPillText: {
    fontSize: 12,
    fontWeight: '600',
    color: CyberTokens.textSecondary,
  },
  gridContent: {
    padding: 12,
    paddingBottom: 28,
  },
  macroGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 10,
  },
  macroCard: {
    width: '48.5%',
    backgroundColor: CyberTokens.cardBase,
    borderRadius: CyberTokens.radiusMd,
    padding: 12,
    borderWidth: 1,
    borderColor: CyberTokens.borderSubtle,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 3,
  },
  macroCardExecuted: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
  },
  keycapsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 3,
    marginBottom: 8,
  },
  keycapBadge: {
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    paddingVertical: 2,
    paddingHorizontal: 5,
    borderRadius: 4,
    borderWidth: 1,
  },
  keycapText: {
    fontSize: 9.5,
    fontWeight: '800',
  },
  plusSign: {
    fontSize: 10,
    fontWeight: '700',
    color: CyberTokens.textMuted,
  },
  macroTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: CyberTokens.textWhite,
    marginBottom: 3,
  },
  macroDescription: {
    fontSize: 10.5,
    color: CyberTokens.textSecondary,
    lineHeight: 14,
    minHeight: 28,
    marginBottom: 6,
  },
  cardFooter: {
    marginTop: 2,
  },
  triggerHint: {
    fontSize: 9.5,
    fontWeight: '700',
  },
});


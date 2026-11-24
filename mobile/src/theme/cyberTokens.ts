export const DarkTokens = {
  // Backgrounds & Surfaces (Cyber Dark)
  bgObsidian: '#07080b',
  bgSurface: '#0d0f17',
  cardBase: '#12141f',
  cardElevated: '#171926',
  cardHighlight: '#1f2336',

  // Cyber Accents
  teal: '#14b8a6',
  tealGlow: 'rgba(20, 184, 166, 0.35)',
  tealSoft: 'rgba(20, 184, 166, 0.15)',
  cyan: '#06b6d4',
  purple: '#8b5cf6',
  purpleSoft: 'rgba(139, 92, 246, 0.16)',
  blue: '#3b82f6',
  emerald: '#10b981',
  amber: '#f59e0b',
  crimson: '#ef4444',

  // Status Indicators
  statusConnected: '#10b981',
  statusConnecting: '#f59e0b',
  statusDisconnected: '#ef4444',

  // Borders & Glows
  borderSubtle: 'rgba(255, 255, 255, 0.07)',
  borderLight: 'rgba(255, 255, 255, 0.12)',
  borderTeal: 'rgba(20, 184, 166, 0.4)',
  glowTeal: 'rgba(20, 184, 166, 0.25)',

  // Text Hierarchy
  textWhite: '#ffffff',
  textSecondary: '#94a3b8',
  textMuted: '#64748b',
  textDim: '#475569',

  // Tactile Grid / Dotted Canvas
  dotColor: 'rgba(255, 255, 255, 0.12)',
  dotActive: 'rgba(20, 184, 166, 0.5)',

  // Border Radii
  radiusSm: 8,
  radiusMd: 14,
  radiusLg: 20,
  radiusXl: 26,
  radiusPill: 9999,
};

export const LightTokens = {
  // Backgrounds & Surfaces (Crisp Studio Light)
  bgObsidian: '#f8fafc', // Crisp Slate 50 background
  bgSurface: '#ffffff',
  cardBase: '#ffffff',
  cardElevated: '#f1f5f9', // Slate 100
  cardHighlight: '#e2e8f0', // Slate 200

  // Accents (Adjusted for high legibility on light background)
  teal: '#0d9488',
  tealGlow: 'rgba(13, 148, 136, 0.25)',
  tealSoft: 'rgba(13, 148, 136, 0.12)',
  cyan: '#0891b2',
  purple: '#7c3aed',
  purpleSoft: 'rgba(124, 58, 237, 0.12)',
  blue: '#2563eb',
  emerald: '#059669',
  amber: '#d97706',
  crimson: '#dc2626',

  // Status Indicators
  statusConnected: '#059669',
  statusConnecting: '#d97706',
  statusDisconnected: '#dc2626',

  // Borders & Glows
  borderSubtle: 'rgba(0, 0, 0, 0.08)',
  borderLight: 'rgba(0, 0, 0, 0.14)',
  borderTeal: 'rgba(13, 148, 136, 0.4)',
  glowTeal: 'rgba(13, 148, 136, 0.20)',

  // Text Hierarchy
  textWhite: '#0f172a', // Deep Slate 900 for primary text in light mode!
  textSecondary: '#475569', // Slate 600
  textMuted: '#64748b', // Slate 500
  textDim: '#94a3b8', // Slate 400

  // Tactile Grid / Dotted Canvas
  dotColor: 'rgba(0, 0, 0, 0.10)',
  dotActive: 'rgba(13, 148, 136, 0.4)',

  // Border Radii
  radiusSm: 8,
  radiusMd: 14,
  radiusLg: 20,
  radiusXl: 26,
  radiusPill: 9999,
};

export const getThemeTokens = (isDark: boolean) => (isDark ? DarkTokens : LightTokens);

// Backward-compatible export defaulting to dark mode
export const CyberTokens = DarkTokens;

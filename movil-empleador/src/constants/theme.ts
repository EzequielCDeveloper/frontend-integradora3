import { Platform } from 'react-native';

/**
 * Sahara — Warm Minimalism Design System (WCAG 2.2 AA Hardened)
 * North Star: "Sun-Baked Simplicity"
 * Luxurious warmth meets disciplined minimalism. Golden tones, editorial serif headings, and abundant whitespace.
 */
export const SaharaColors = {
  primary: '#c2652a',              // Burnt sienna — brand accent & large displays
  primaryAccessible: '#a8511b',    // WCAG 2.2 AA (>= 5.18:1 on #ffffff & >= 4.72:1 on #faf5ee) for button fills & small text links
  primaryContainer: '#e08850',
  primaryFixed: '#fbe8d8',
  primaryFixedDim: '#f0a878',
  onPrimary: '#ffffff',
  onPrimaryFixed: '#401a08',       // 12.88:1 on primaryFixed
  onPrimaryFixedVariant: '#8a4518', // 5.99:1 on primaryFixed
  onPrimaryContainer: '#fbe8d8',

  background: '#faf5ee',           // Warm linen — never cold white
  surface: '#faf5ee',
  surfaceBright: '#faf5ee',
  surfaceDim: '#dcd6cc',
  surfaceContainerLowest: '#ffffff',
  surfaceContainerLow: '#f6f0e8',
  surfaceContainer: '#f2ece4',
  surfaceContainerHigh: '#ece6dc',
  surfaceContainerHighest: '#e6e0d6',
  surfaceVariant: '#ece6dc',
  surfaceTint: '#c2652a',

  onBackground: '#3a302a',         // 11.83:1 on surface
  onSurface: '#3a302a',
  onSurfaceVariant: '#605850',     // 6.43:1 on surface

  secondary: '#5d554f',            // WCAG 2.2 AA hardened (>= 6.8:1 on surface, >= 5.3:1 on surfaceContainerHighest)
  secondaryContainer: '#eae2da',
  secondaryFixed: '#eae2da',
  secondaryFixedDim: '#cec6be',
  onSecondary: '#ffffff',
  onSecondaryContainer: '#504840',
  onSecondaryFixed: '#2a2420',
  onSecondaryFixedVariant: '#504840',

  tertiary: '#8c3c3c',             // Dusty rose — 5.97:1 on tertiaryFixed
  tertiaryContainer: '#d47070',
  tertiaryFixed: '#fce0e0',
  tertiaryFixedDim: '#e8a0a0',
  onTertiary: '#ffffff',
  onTertiaryContainer: '#3a2020',
  onTertiaryFixed: '#2e1515',
  onTertiaryFixedVariant: '#6e3030',

  error: '#b02a1e',                // WCAG 2.2 AA hardened (>= 5.9:1 on surface)
  errorContainer: '#fce4e0',
  onError: '#ffffff',
  onErrorContainer: '#7a1a10',

  outline: '#7c726a',              // WCAG 2.2 1.4.11 Non-text contrast >= 3.8:1 on surfaceContainerLow
  outlineVariant: '#857b73',       // WCAG 2.2 1.4.11 Non-text contrast >= 3.3:1 on surfaceContainerLow

  // Centralized translucent border & backdrop tokens (SYS-07 fix: zero hardcoded rgba in views)
  borderSubtle: 'rgba(133, 123, 115, 0.35)',
  borderDefault: 'rgba(133, 123, 115, 0.5)',
  borderStrong: 'rgba(133, 123, 115, 0.75)',
  errorBorderSubtle: 'rgba(176, 42, 30, 0.4)',
  backdropOverlay: 'rgba(58, 48, 42, 0.55)',

  inverseSurface: '#3a302a',
  inverseOnSurface: '#faf5ee',
  inversePrimary: '#f0a878',

  success: '#1f6337',
  successContainer: '#e2f4e8',
  onSuccessContainer: '#144424',

  warning: '#8f5708',
  warningContainer: '#fdf2df',
  onWarningContainer: '#5c3705',
} as const;

export const Colors = {
  light: {
    ...SaharaColors,
    text: SaharaColors.onSurface,
    backgroundElement: SaharaColors.surfaceContainerLow,
    backgroundSelected: SaharaColors.primaryFixed,
    textSecondary: SaharaColors.onSurfaceVariant,
  },
  dark: {
    ...SaharaColors,
    background: '#1e1916',
    surface: '#1e1916',
    surfaceContainerLowest: '#26201c',
    surfaceContainerLow: '#2d2621',
    surfaceContainer: '#352d27',
    surfaceContainerHigh: '#3f352f',
    surfaceContainerHighest: '#4a3f38',
    onBackground: '#f6f0e8',
    onSurface: '#f6f0e8',
    onSurfaceVariant: '#d8d0c8',
    secondary: '#cec6be',
    text: '#f6f0e8',
    backgroundElement: '#2d2621',
    backgroundSelected: '#401a08',
    textSecondary: '#d8d0c8',
  },
} as const;

export type ThemeColor = keyof typeof Colors.light;

export const Fonts = Platform.select({
  ios: {
    headline: 'Georgia',
    body: 'System',
    label: 'System',
    sans: 'System',
    serif: 'Georgia',
    rounded: 'System',
    mono: 'Menlo',
  },
  android: {
    headline: 'serif',
    body: 'sans-serif',
    label: 'sans-serif-medium',
    sans: 'sans-serif',
    serif: 'serif',
    rounded: 'sans-serif',
    mono: 'monospace',
  },
  default: {
    headline: 'serif',
    body: 'sans-serif',
    label: 'sans-serif',
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    headline: '"EB Garamond", Georgia, serif',
    body: '"Manrope", system-ui, -apple-system, sans-serif',
    label: '"Manrope", system-ui, -apple-system, sans-serif',
    sans: '"Manrope", system-ui, -apple-system, sans-serif',
    serif: '"EB Garamond", Georgia, serif',
    rounded: '"Manrope", sans-serif',
    mono: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
  },
})!;

export const Spacing = {
  xs: 4,
  sm: 8,
  gutter: 12,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
  half: 2,
  one: 4,
  two: 8,
  three: 16,
  four: 24,
  five: 32,
  six: 64,
} as const;

export const Radius = {
  xs: 4,
  sm: 6,
  md: 8,
  lg: 12,
  xl: 16,
  xxl: 24,
  full: 9999,
} as const;

export const SaharaShadows = {
  soft: Platform.select({
    ios: {
      shadowColor: '#3a302a',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.05,
      shadowRadius: 12,
    },
    android: {
      elevation: 2,
    },
    default: {
      shadowColor: '#3a302a',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.05,
      shadowRadius: 12,
    },
  }),
  elevated: Platform.select({
    ios: {
      shadowColor: '#3a302a',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.09,
      shadowRadius: 16,
    },
    android: {
      elevation: 4,
    },
    default: {
      shadowColor: '#3a302a',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.09,
      shadowRadius: 16,
    },
  }),
} as const;

export const BottomTabInset = Platform.select({ ios: 50, android: 72 }) ?? 64;
export const MaxContentWidth = 800;

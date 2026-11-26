export const SAHARA_COLORS = {
  primary: '#c2652a',
  onPrimary: '#ffffff',
  primaryContainer: '#e08850',
  onPrimaryContainer: '#fbe8d8',
  primaryFixed: '#fbe8d8',
  primaryFixedDim: '#f0a878',
  onPrimaryFixed: '#401a08',
  onPrimaryFixedVariant: '#8a4518',

  secondary: '#78706a',
  secondaryContainer: '#eae2da',
  onSecondaryContainer: '#605850',

  tertiary: '#8c3c3c',
  onTertiary: '#ffffff',
  tertiaryFixed: '#fce0e0',
  onTertiaryFixed: '#2e1515',
  onTertiaryFixedVariant: '#6e3030',

  error: '#c0392b',
  onError: '#ffffff',
  errorContainer: '#fce4e0',
  onErrorContainer: '#7a1a10',

  background: '#faf5ee',
  surface: '#faf5ee',
  surfaceContainerLowest: '#ffffff',
  surfaceContainerLow: '#f6f0e8',
  surfaceContainer: '#f2ece4',
  surfaceContainerHigh: '#ece6dc',
  surfaceContainerHighest: '#e6e0d6',

  onSurface: '#3a302a',
  onSurfaceVariant: '#605850',
  outline: '#9a9088',
  outlineVariant: '#d8d0c8',
} as const

export type BadgeTone =
  | 'primary'
  | 'secondary'
  | 'tertiary'
  | 'error'
  | 'neutral'
  | 'success'

export const BADGE_TONE_CLASSES: Record<BadgeTone, string> = {
  primary: 'bg-primary-fixed text-on-primary-fixed',
  secondary: 'bg-secondary-container text-on-secondary-container',
  tertiary: 'bg-tertiary-fixed text-on-tertiary-fixed-variant',
  error: 'bg-error-container text-on-error-container',
  neutral: 'bg-surface-container-highest text-on-surface-variant',
  success: 'bg-primary-container/25 text-on-primary-fixed-variant',
}

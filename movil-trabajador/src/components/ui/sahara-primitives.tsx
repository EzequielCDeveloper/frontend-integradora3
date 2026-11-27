/**
 * Sahara Atomic UI Components Library — Solidez MX (Trabajador)
 * Misma identidad visual cálida, accesible y consistente con la app del empleador.
 */
import React from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type StyleProp,
  type TextInputProps,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  Fonts,
  Radius,
  SaharaColors,
  SaharaShadows,
  Spacing,
} from '@/constants/theme';
import type {
  ApplicationStatus,
  AttachmentKind,
  CaseStatus,
  JobStatus,
  PaymentStatus,
} from '@/types/database';
import {
  APPLICATION_STATUS_LABELS,
  CASE_STATUS_LABELS,
  formatFileSize,
  JOB_STATUS_LABELS,
  PAYMENT_STATUS_LABELS,
} from '@/shared/utils/formatters';
import { useCountdown } from '@/shared/hooks/use-countdown';
import {
  validateAttachmentCandidate,
  type CandidateAttachmentFile,
} from '@/shared/utils/validators';

// -----------------------------------------------------------------------------
// 1. ICONOGRAFÍA CONSISTENTE CON LA APP DEL EMPLEADOR
// -----------------------------------------------------------------------------
const ICON_GLYPHS: Record<string, string> = {
  home: '🏠',
  explore: '🧭',
  search: '🔍',
  assured_workload: '🏛',
  verified_user: '✓',
  verified: '✓',
  notifications: '🔔',
  notifications_active: '🔔',
  person: '👤',
  account_circle: '👤',
  lock: '🔒',
  lock_open: '🔓',
  lock_clock: '⏱',
  receipt_long: '📄',
  receipt: '📄',
  add: '+',
  add_circle: '+',
  add_a_photo: '📷+',
  add_photo_alternate: '🖼+',
  photo_camera: '📷',
  image: '🖼',
  picture_as_pdf: 'PDF',
  arrow_back: '←',
  arrow_forward: '→',
  chevron_right: '›',
  expand_more: '▾',
  close: '✕',
  check: '✓',
  check_circle: '✓',
  task_alt: '✓',
  done_all: '✓✓',
  radio_button_unchecked: '○',
  timer: '⏱',
  schedule: '⏱',
  hourglass_top: '⏳',
  calendar_today: '📅',
  calendar_month: '📅',
  event_available: '📅',
  event_busy: '📅',
  location_on: '📍',
  push_pin: '📌',
  pin_drop: '📍',
  my_location: '◎',
  navigation: '➤',
  star: '★',
  star_outline: '☆',
  group: '👥',
  work: '💼',
  business_center: '💼',
  folder_shared: '📁',
  folder_open: '📂',
  handyman: '🔧',
  construction: '🔨',
  cleaning_services: '🧹',
  format_paint: '🖌',
  yard: '🌱',
  local_shipping: '🚚',
  celebration: '🎉',
  bolt: '⚡',
  lightbulb: '💡',
  chat: '💬',
  call: '📞',
  phone_iphone: '📱',
  mail: '✉',
  key: '🔑',
  visibility: '👁',
  visibility_off: '🚫',
  edit: '✎',
  cancel: '✕',
  warning: '⚠',
  info: 'ℹ',
  gavel: '⚖',
  balance: '⚖',
  support_agent: '🎧',
  flag: '⚑',
  send: '➤',
  content_copy: '📋',
  account_balance_wallet: '💳',
  account_balance: '🏦',
  payments: '💳',
  undo: '↺',
  download: '⬇',
  logout: '⎋',
  inbox: '📥',
  handshake: '🤝',
  shield: '🛡',
  domain: '🏢',
  article: '📄',
  assignment: '📋',
  history: '⏱',
  tune: '⚙',
};

export function SaharaIcon({
  name,
  size = 14,
  color = SaharaColors.onSurface,
  style,
}: {
  name: string;
  size?: number;
  color?: string;
  style?: StyleProp<TextStyle>;
}) {
  const glyph = ICON_GLYPHS[name] ?? '•';
  return (
    <Text
      accessible={false}
      importantForAccessibility="no"
      style={[
        {
          fontFamily: Fonts.label,
          fontSize: Math.max(10, Math.round(size * 0.72)),
          fontWeight: '700',
          color,
          textAlign: 'center',
        },
        style,
      ]}>
      {glyph}
    </Text>
  );
}

// -----------------------------------------------------------------------------
// 2. AVATAR CON INICIALES Y TONO CÁLIDO
// -----------------------------------------------------------------------------
export function AvatarBadge({
  initials,
  size = 44,
  tone = SaharaColors.primaryFixed,
  textColor = SaharaColors.onPrimaryFixed,
}: {
  initials: string;
  size?: number;
  tone?: string;
  textColor?: string;
}) {
  return (
    <View
      style={[
        styles.avatarCircle,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: tone,
        },
      ]}>
      <Text
        style={[
          styles.avatarInitials,
          { fontSize: Math.round(size * 0.36), color: textColor },
        ]}>
        {initials.slice(0, 2).toUpperCase()}
      </Text>
    </View>
  );
}

// -----------------------------------------------------------------------------
// 3. SAHARA BUTTON
// -----------------------------------------------------------------------------
export interface SaharaButtonProps {
  label: string;
  sublabel?: string;
  accessibilityLabel?: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'outline' | 'danger' | 'ghost' | 'dark';
  icon?: string;
  trailingIcon?: string;
  disabled?: boolean;
  loading?: boolean;
  fullWidth?: boolean;
  size?: 'sm' | 'md' | 'lg';
  testID?: string;
  style?: StyleProp<ViewStyle>;
}

export function SaharaButton({
  label,
  sublabel,
  accessibilityLabel,
  onPress,
  variant = 'primary',
  icon,
  trailingIcon,
  disabled = false,
  loading = false,
  fullWidth = true,
  size = 'md',
  testID,
  style,
}: SaharaButtonProps) {
  const isLocked = disabled || loading;

  const bgColors: Record<NonNullable<SaharaButtonProps['variant']>, string> = {
    primary: SaharaColors.primaryAccessible,
    secondary: SaharaColors.surfaceContainerHigh,
    outline: SaharaColors.surfaceContainerLowest,
    danger: SaharaColors.errorContainer,
    ghost: 'transparent',
    dark: SaharaColors.onSurface,
  };

  const textColors: Record<NonNullable<SaharaButtonProps['variant']>, string> = {
    primary: SaharaColors.onPrimary,
    secondary: SaharaColors.onSurface,
    outline: SaharaColors.onSurface,
    danger: SaharaColors.onErrorContainer,
    ghost: SaharaColors.primaryAccessible,
    dark: SaharaColors.surface,
  };

  const paddings = {
    sm: { paddingVertical: 11, paddingHorizontal: 14, minHeight: 44 },
    md: { paddingVertical: 13, paddingHorizontal: 18, minHeight: 48 },
    lg: { paddingVertical: 15, paddingHorizontal: 22, minHeight: 52 },
  }[size];

  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={
        accessibilityLabel ?? (sublabel ? `${label}. ${sublabel}` : label)
      }
      accessibilityState={{ disabled: isLocked, busy: loading }}
      disabled={isLocked}
      onPress={onPress}
      style={({ pressed }) => [
        styles.buttonBase,
        paddings,
        {
          backgroundColor: bgColors[variant],
          width: fullWidth ? '100%' : undefined,
          opacity: isLocked ? 0.52 : pressed ? 0.9 : 1,
          borderWidth: variant === 'outline' ? 1 : 0,
          borderColor:
            variant === 'outline' ? SaharaColors.outlineVariant : 'transparent',
        },
        variant === 'primary' ? SaharaShadows.soft : undefined,
        style,
      ]}>
      <View style={styles.buttonRow}>
        {loading ? (
          <ActivityIndicator
            size="small"
            color={textColors[variant]}
            style={{ marginRight: 8 }}
          />
        ) : icon ? (
          <SaharaIcon
            name={icon}
            size={size === 'sm' ? 14 : 16}
            color={textColors[variant]}
            style={{ marginRight: 6 }}
          />
        ) : null}
        <Text
          style={[
            styles.buttonText,
            {
              color: textColors[variant],
              fontSize: size === 'sm' ? 12.5 : size === 'lg' ? 15 : 13.5,
            },
          ]}>
          {label}
        </Text>
        {!loading && trailingIcon ? (
          <SaharaIcon
            name={trailingIcon}
            size={size === 'sm' ? 14 : 16}
            color={textColors[variant]}
            style={{ marginLeft: 6 }}
          />
        ) : null}
      </View>
      {sublabel ? (
        <Text
          style={[
            styles.buttonSublabel,
            {
              color:
                variant === 'primary'
                  ? SaharaColors.onPrimary
                  : SaharaColors.onSurfaceVariant,
            },
          ]}>
          {sublabel}
        </Text>
      ) : null}
    </Pressable>
  );
}

// -----------------------------------------------------------------------------
// 4. SAHARA CARD
// -----------------------------------------------------------------------------
export function SaharaCard({
  children,
  variant = 'lowest',
  accentColor,
  style,
  onPress,
  accessibilityLabel,
  testID,
}: {
  children: React.ReactNode;
  variant?: 'lowest' | 'low' | 'default' | 'high' | 'primaryFixed' | 'tertiaryFixed';
  accentColor?: string;
  style?: StyleProp<ViewStyle>;
  onPress?: () => void;
  accessibilityLabel?: string;
  testID?: string;
}) {
  const bgMap = {
    lowest: SaharaColors.surfaceContainerLowest,
    low: SaharaColors.surfaceContainerLow,
    default: SaharaColors.surfaceContainer,
    high: SaharaColors.surfaceContainerHigh,
    primaryFixed: SaharaColors.primaryFixed,
    tertiaryFixed: SaharaColors.tertiaryFixed,
  };

  const content = (
    <View
      style={[
        styles.cardBase,
        {
          backgroundColor: bgMap[variant],
          borderColor:
            variant === 'lowest'
              ? SaharaColors.borderDefault
              : SaharaColors.borderSubtle,
        },
        variant === 'lowest' ? SaharaShadows.soft : undefined,
        style,
      ]}>
      {accentColor ? (
        <View style={[styles.cardAccentStripe, { backgroundColor: accentColor }]} />
      ) : null}
      {children}
    </View>
  );

  if (onPress) {
    return (
      <Pressable
        testID={testID}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel ?? 'Abrir detalle'}
        onPress={onPress}
        style={({ pressed }) => [{ opacity: pressed ? 0.94 : 1 }]}>
        {content}
      </Pressable>
    );
  }
  return content;
}

// -----------------------------------------------------------------------------
// 5. SAHARA INPUT
// -----------------------------------------------------------------------------
export interface SaharaInputProps extends TextInputProps {
  label?: string;
  helperText?: string;
  errorText?: string | null;
  icon?: string;
  rightBadge?: string;
  prefixText?: string;
  containerStyle?: StyleProp<ViewStyle>;
}

export function SaharaInput({
  label,
  helperText,
  errorText,
  icon,
  rightBadge,
  prefixText,
  containerStyle,
  editable = true,
  multiline,
  accessibilityLabel,
  style,
  ...rest
}: SaharaInputProps) {
  return (
    <View style={[styles.inputWrapper, containerStyle]}>
      {label || rightBadge ? (
        <View style={styles.inputHeaderRow}>
          {label ? (
            <Text
              style={[styles.inputLabel, { flex: 1, marginRight: 8 }]}
              numberOfLines={1}>
              {label}
            </Text>
          ) : (
            <View />
          )}
          {rightBadge ? (
            <View style={styles.rightBadgePill}>
              <Text style={styles.rightBadgeText}>{rightBadge}</Text>
            </View>
          ) : null}
        </View>
      ) : null}

      <View
        style={[
          styles.inputBox,
          multiline ? styles.inputBoxMultiline : undefined,
          !editable ? styles.inputBoxDisabled : undefined,
          errorText ? styles.inputBoxError : undefined,
        ]}>
        {icon ? (
          <SaharaIcon
            name={icon}
            size={15}
            color={SaharaColors.secondary}
            style={{ marginRight: 8, marginTop: multiline ? 4 : 0 }}
          />
        ) : null}
        {prefixText ? <Text style={styles.inputPrefix}>{prefixText}</Text> : null}
        <TextInput
          editable={editable}
          multiline={multiline}
          accessibilityLabel={accessibilityLabel ?? label ?? rest.placeholder}
          accessibilityHint={errorText ?? helperText}
          placeholderTextColor={SaharaColors.onSurfaceVariant}
          style={[
            styles.textInput,
            multiline ? { minHeight: 82, textAlignVertical: 'top' } : undefined,
            style,
          ]}
          {...rest}
        />
      </View>

      {errorText ? (
        <Text accessibilityLiveRegion="polite" style={styles.errorText}>
          {errorText}
        </Text>
      ) : helperText ? (
        <Text style={styles.helperText}>{helperText}</Text>
      ) : null}
    </View>
  );
}

// -----------------------------------------------------------------------------
// 6. FILTER PILL & SECTION HEADER
// -----------------------------------------------------------------------------
export function FilterPill({
  label,
  active,
  count,
  onPress,
  icon,
}: {
  label: string;
  active: boolean;
  count?: number;
  onPress: () => void;
  icon?: string;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      onPress={onPress}
      style={[
        styles.filterPill,
        active ? styles.filterPillActive : styles.filterPillInactive,
      ]}>
      {icon ? (
        <SaharaIcon
          name={icon}
          size={12}
          color={active ? SaharaColors.onPrimary : SaharaColors.onSurfaceVariant}
        />
      ) : null}
      <Text
        style={[
          styles.filterPillText,
          active ? styles.filterPillTextActive : undefined,
        ]}>
        {label}
        {typeof count === 'number' ? ` (${count})` : ''}
      </Text>
    </Pressable>
  );
}

export function SectionHeader({
  title,
  actionLabel,
  onAction,
}: {
  title: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <View style={styles.sectionHeaderRow}>
      <Text style={styles.sectionHeaderTitle}>{title}</Text>
      {actionLabel && onAction ? (
        <Pressable
          accessibilityRole="button"
          onPress={onAction}
          style={styles.sectionActionBtn}>
          <Text style={styles.sectionActionText}>{actionLabel}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

// -----------------------------------------------------------------------------
// 7. STATUS BADGES
// -----------------------------------------------------------------------------
export function JobStatusBadge({ status }: { status: JobStatus }) {
  const toneMap: Record<JobStatus, { bg: string; fg: string; dot: string }> = {
    published: {
      bg: SaharaColors.surfaceContainerHigh,
      fg: SaharaColors.onSurface,
      dot: SaharaColors.secondary,
    },
    has_applications: {
      bg: SaharaColors.primaryFixed,
      fg: SaharaColors.onPrimaryFixedVariant,
      dot: SaharaColors.primaryAccessible,
    },
    assigned: {
      bg: SaharaColors.primaryFixed,
      fg: SaharaColors.onPrimaryFixed,
      dot: SaharaColors.primaryAccessible,
    },
    arrival_registered: {
      bg: SaharaColors.warningContainer,
      fg: SaharaColors.onWarningContainer,
      dot: SaharaColors.warning,
    },
    in_progress: {
      bg: SaharaColors.primaryFixed,
      fg: SaharaColors.onPrimaryFixed,
      dot: SaharaColors.primaryAccessible,
    },
    completion_requested: {
      bg: SaharaColors.tertiaryFixed,
      fg: SaharaColors.onTertiaryFixedVariant,
      dot: SaharaColors.tertiary,
    },
    in_claim: {
      bg: SaharaColors.errorContainer,
      fg: SaharaColors.onErrorContainer,
      dot: SaharaColors.error,
    },
    completed: {
      bg: SaharaColors.successContainer,
      fg: SaharaColors.onSuccessContainer,
      dot: SaharaColors.success,
    },
    cancelled: {
      bg: SaharaColors.surfaceContainerHighest,
      fg: SaharaColors.onSurface,
      dot: SaharaColors.secondary,
    },
    expired: {
      bg: SaharaColors.surfaceContainerHighest,
      fg: SaharaColors.onSurface,
      dot: SaharaColors.secondary,
    },
  };

  const tone = toneMap[status] ?? toneMap.published;
  return (
    <View style={[styles.badgePill, { backgroundColor: tone.bg }]}>
      <View style={[styles.badgeDot, { backgroundColor: tone.dot }]} />
      <Text style={[styles.badgeText, { color: tone.fg }]}>
        {JOB_STATUS_LABELS[status]}
      </Text>
    </View>
  );
}

export function PaymentStatusBadge({ status }: { status: PaymentStatus }) {
  const isSuccess =
    status === 'transferred' || status === 'partial_settlement_completed';
  const isProtected =
    status === 'confirmed' ||
    status === 'transfer_pending' ||
    status === 'partial_settlement_pending';
  const isAlert =
    status === 'in_claim' ||
    status === 'failed' ||
    status === 'transfer_failed' ||
    status === 'partial_settlement_failed' ||
    status === 'refund_failed';

  const bg = isSuccess
    ? SaharaColors.successContainer
    : isProtected
      ? SaharaColors.primaryFixed
      : isAlert
        ? SaharaColors.errorContainer
        : SaharaColors.surfaceContainerHigh;
  const fg = isSuccess
    ? SaharaColors.onSuccessContainer
    : isProtected
      ? SaharaColors.onPrimaryFixed
      : isAlert
        ? SaharaColors.onErrorContainer
        : SaharaColors.onSurface;

  return (
    <View style={[styles.badgePill, { backgroundColor: bg }]}>
      <SaharaIcon
        name={isSuccess ? 'check_circle' : isAlert ? 'gavel' : 'payments'}
        size={12}
        color={fg}
      />
      <Text style={[styles.badgeText, { color: fg }]}>
        {PAYMENT_STATUS_LABELS[status]}
      </Text>
    </View>
  );
}

export function ApplicationStatusBadge({ status }: { status: ApplicationStatus }) {
  const toneMap: Record<ApplicationStatus, { bg: string; fg: string }> = {
    pending: {
      bg: SaharaColors.warningContainer,
      fg: SaharaColors.onWarningContainer,
    },
    accepted: {
      bg: SaharaColors.successContainer,
      fg: SaharaColors.onSuccessContainer,
    },
    rejected: {
      bg: SaharaColors.errorContainer,
      fg: SaharaColors.onErrorContainer,
    },
    withdrawn: {
      bg: SaharaColors.surfaceContainerHighest,
      fg: SaharaColors.onSurfaceVariant,
    },
    expired: {
      bg: SaharaColors.surfaceContainerHighest,
      fg: SaharaColors.onSurface,
    },
  };
  const tone = toneMap[status];
  return (
    <View style={[styles.badgePill, { backgroundColor: tone.bg }]}>
      <Text style={[styles.badgeText, { color: tone.fg }]}>
        {APPLICATION_STATUS_LABELS[status]}
      </Text>
    </View>
  );
}

export function CaseStatusBadge({ status }: { status: CaseStatus }) {
  const bg =
    status === 'resolved' || status === 'attended'
      ? SaharaColors.successContainer
      : status === 'in_review'
        ? SaharaColors.primaryFixed
        : status === 'open' || status === 'pending'
          ? SaharaColors.warningContainer
          : SaharaColors.surfaceContainerHigh;
  const fg =
    status === 'resolved' || status === 'attended'
      ? SaharaColors.onSuccessContainer
      : status === 'in_review'
        ? SaharaColors.onPrimaryFixed
        : status === 'open' || status === 'pending'
          ? SaharaColors.onWarningContainer
          : SaharaColors.onSurface;

  return (
    <View style={[styles.badgePill, { backgroundColor: bg }]}>
      <Text style={[styles.badgeText, { color: fg }]}>
        {CASE_STATUS_LABELS[status]}
      </Text>
    </View>
  );
}

// -----------------------------------------------------------------------------
// 8. COUNTDOWN BANNER
// -----------------------------------------------------------------------------
export function CountdownBanner({
  targetIso,
  title,
  subtitle,
  mode = 'hms',
  variant = 'primary',
}: {
  targetIso: string | null | undefined;
  title: string;
  subtitle?: string;
  mode?: 'hms' | 'ms' | 'days';
  variant?: 'primary' | 'tertiary';
}) {
  const countdown = useCountdown(targetIso, mode);
  const bg =
    variant === 'tertiary'
      ? SaharaColors.tertiaryFixed
      : SaharaColors.primaryFixed;
  const accent =
    variant === 'tertiary'
      ? SaharaColors.tertiary
      : SaharaColors.onPrimaryFixedVariant;

  return (
    <View style={[styles.countdownCard, { backgroundColor: bg }]}>
      <View style={styles.countdownHeader}>
        <SaharaIcon name="timer" size={15} color={accent} />
        <Text style={[styles.countdownTitle, { color: accent }]}>{title}</Text>
      </View>
      <View style={styles.countdownValueRow}>
        <Text style={styles.countdownPrefix}>Tiempo restante:</Text>
        <Text style={[styles.countdownValue, { color: accent }]}>
          {countdown.formattedShort}
        </Text>
      </View>
      {subtitle ? <Text style={styles.countdownSub}>{subtitle}</Text> : null}
    </View>
  );
}

// -----------------------------------------------------------------------------
// 9. RATING STARS (1 a 5 estrellas)
// -----------------------------------------------------------------------------
export function RatingStars({
  rating,
  onChange,
  size = 18,
}: {
  rating: number;
  onChange?: (newRating: number) => void;
  size?: number;
}) {
  if (!onChange) {
    return (
      <View
        accessible={true}
        accessibilityLabel={`Calificación: ${rating.toFixed(1)} de 5 estrellas`}
        style={styles.starsRowReadOnly}>
        {[1, 2, 3, 4, 5].map((star) => {
          const filled = star <= Math.round(rating);
          return (
            <View
              key={star}
              style={[
                styles.starDotReadOnly,
                {
                  width: Math.max(16, size),
                  height: Math.max(16, size),
                  backgroundColor: filled
                    ? SaharaColors.primaryAccessible
                    : SaharaColors.surfaceContainerHigh,
                },
              ]}>
              <Text
                accessible={false}
                style={{
                  fontSize: Math.max(10, Math.round(size * 0.62)),
                  fontWeight: '700',
                  color: filled ? SaharaColors.onPrimary : SaharaColors.secondary,
                }}>
                ★
              </Text>
            </View>
          );
        })}
      </View>
    );
  }

  return (
    <View
      accessibilityRole="radiogroup"
      accessibilityLabel="Selector de calificación de 1 a 5 estrellas"
      style={styles.starsRowInteractive}>
      {[1, 2, 3, 4, 5].map((star) => {
        const filled = star <= Math.round(rating);
        return (
          <Pressable
            key={star}
            accessibilityRole="radio"
            accessibilityState={{ checked: star === rating }}
            accessibilityLabel={`${star} estrellas`}
            onPress={() => onChange(star)}
            style={[
              styles.starBtnInteractive,
              filled
                ? styles.starBtnInteractiveActive
                : styles.starBtnInteractiveInactive,
            ]}>
            <Text
              style={[
                styles.starBtnNumber,
                filled
                  ? { color: SaharaColors.onPrimary }
                  : { color: SaharaColors.onSurface },
              ]}>
              ★ {star}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

// -----------------------------------------------------------------------------
// 10. ATTACHMENT PICKER (JPG, PNG, PDF <= 10 MB, máx 5 archivos)
// -----------------------------------------------------------------------------
export interface AttachmentDraft {
  id: string;
  file_name: string;
  mime_type: 'image/jpeg' | 'image/png' | 'application/pdf';
  size_bytes: number;
}

const PRESET_EVIDENCE_FILES: AttachmentDraft[] = [
  {
    id: 'ev-preset-1',
    file_name: 'evidencia_area_terminada.jpg',
    mime_type: 'image/jpeg',
    size_bytes: 1_840_000,
  },
  {
    id: 'ev-preset-2',
    file_name: 'detalle_entrega_final.png',
    mime_type: 'image/png',
    size_bytes: 1_260_000,
  },
  {
    id: 'ev-preset-3',
    file_name: 'comprobante_actividad.pdf',
    mime_type: 'application/pdf',
    size_bytes: 540_000,
  },
  {
    id: 'ev-preset-4',
    file_name: 'fotografia_respaldo_04.jpg',
    mime_type: 'image/jpeg',
    size_bytes: 2_150_000,
  },
  {
    id: 'ev-preset-5',
    file_name: 'documento_soporte_05.pdf',
    mime_type: 'application/pdf',
    size_bytes: 890_000,
  },
];

export function AttachmentPicker({
  kind,
  items,
  onAdd,
  onRemove,
  errorText,
  onValidationError,
}: {
  kind: AttachmentKind;
  items: AttachmentDraft[];
  onAdd: (file: AttachmentDraft) => void;
  onRemove: (id: string) => void;
  errorText?: string | null;
  onValidationError?: (msg: string) => void;
}) {
  const isMaxed = items.length >= 5;

  const handleAttach = (presetIndex?: number) => {
    const idx = presetIndex ?? items.length % PRESET_EVIDENCE_FILES.length;
    const sample = PRESET_EVIDENCE_FILES[idx] ?? PRESET_EVIDENCE_FILES[0];
    const candidate: CandidateAttachmentFile = {
      file_name: sample.file_name,
      mime_type: sample.mime_type,
      size_bytes: sample.size_bytes,
    };
    const err = validateAttachmentCandidate(candidate, kind, items.length);
    if (err) {
      onValidationError?.(err);
      return;
    }
    onAdd({
      id: `att-${Date.now()}-${items.length}`,
      file_name: candidate.file_name,
      mime_type: candidate.mime_type as AttachmentDraft['mime_type'],
      size_bytes: candidate.size_bytes,
    });
  };

  return (
    <View style={styles.pickerContainer}>
      <View style={styles.pickerHeaderRow}>
        <View>
          <Text style={styles.pickerTitle}>Evidencias y archivos adjuntos</Text>
          <Text style={styles.pickerSubtitle}>
            JPG, PNG o PDF · Máximo 5 archivos (10 MB por archivo)
          </Text>
        </View>
        <View style={styles.counterBadge}>
          <Text style={styles.counterBadgeText}>{items.length} / 5</Text>
        </View>
      </View>

      <Pressable
        accessibilityRole="button"
        disabled={isMaxed}
        onPress={() => handleAttach()}
        style={[styles.dropZone, isMaxed ? { opacity: 0.45 } : undefined]}>
        <View style={styles.dropZoneIconCircle}>
          <SaharaIcon
            name="add_photo_alternate"
            size={18}
            color={SaharaColors.onPrimaryFixedVariant}
          />
        </View>
        <Text style={styles.dropZoneTitle}>
          {isMaxed
            ? 'Límite de 5 archivos alcanzado'
            : '+ Adjuntar fotografía o documento PDF'}
        </Text>
        <Text style={styles.dropZoneHint}>
          Formatos admitidos: JPG, PNG y PDF · Hasta 10 MB
        </Text>
      </Pressable>

      {errorText ? <Text style={styles.errorText}>{errorText}</Text> : null}

      {items.length > 0 ? (
        <View style={{ gap: 8, marginTop: 8 }}>
          {items.map((item) => (
            <View key={item.id} style={styles.attachmentRow}>
              <View style={styles.attachmentRowLeft}>
                <View style={styles.attachmentIconBox}>
                  <SaharaIcon
                    name={
                      item.mime_type === 'application/pdf'
                        ? 'picture_as_pdf'
                        : 'image'
                    }
                    size={14}
                    color={SaharaColors.onPrimaryFixedVariant}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.attachmentName} numberOfLines={1}>
                    {item.file_name}
                  </Text>
                  <Text style={styles.attachmentMeta}>
                    {formatFileSize(item.size_bytes)} · {item.mime_type}
                  </Text>
                </View>
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Quitar ${item.file_name}`}
                onPress={() => onRemove(item.id)}
                style={styles.removeFileBtn}>
                <SaharaIcon name="close" size={14} color={SaharaColors.onSurface} />
              </Pressable>
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
}

// -----------------------------------------------------------------------------
// 11. LOADING / EMPTY / ERROR STATES
// -----------------------------------------------------------------------------
export function LoadingSkeleton({
  message = 'Cargando información...',
  rows = 3,
}: {
  message?: string;
  rows?: number;
}) {
  return (
    <View style={styles.stateBox}>
      <ActivityIndicator size="large" color={SaharaColors.primaryAccessible} />
      <Text style={styles.stateLoadingText}>{message}</Text>
      <View style={{ width: '100%', gap: 12, marginTop: 12 }}>
        {Array.from({ length: rows }).map((_, i) => (
          <View key={i} style={styles.skeletonCard}>
            <View style={styles.skeletonLineShort} />
            <View style={styles.skeletonLineLong} />
            <View style={styles.skeletonLineMedium} />
          </View>
        ))}
      </View>
    </View>
  );
}

export function EmptyState({
  icon = 'inbox',
  title,
  description,
  actionLabel,
  onAction,
}: {
  icon?: string;
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <View style={styles.emptyBox}>
      <View style={styles.emptyIconCircle}>
        <SaharaIcon
          name={icon}
          size={22}
          color={SaharaColors.onPrimaryFixedVariant}
        />
      </View>
      <Text style={styles.emptyTitle}>{title}</Text>
      <Text style={styles.emptyDescription}>{description}</Text>
      {actionLabel && onAction ? (
        <SaharaButton
          label={actionLabel}
          onPress={onAction}
          fullWidth={false}
          style={{ marginTop: 10, paddingHorizontal: 22 }}
        />
      ) : null}
    </View>
  );
}

export function ErrorState({
  message,
  onRetry,
}: {
  message: string;
  onRetry?: () => void;
}) {
  return (
    <View accessibilityRole="alert" style={styles.errorBox}>
      <View style={styles.errorIconCircle}>
        <SaharaIcon name="warning" size={20} color={SaharaColors.error} />
      </View>
      <Text style={styles.errorStateTitle}>Aviso</Text>
      <Text style={styles.errorStateMsg}>{message}</Text>
      {onRetry ? (
        <SaharaButton
          label="Reintentar"
          onPress={onRetry}
          variant="primary"
          size="sm"
          fullWidth={false}
        />
      ) : null}
    </View>
  );
}

// -----------------------------------------------------------------------------
// 12. CONFIRMATION MODAL & FEEDBACK BANNER
// -----------------------------------------------------------------------------
export function ConfirmationModal({
  visible,
  title,
  description,
  highlightText,
  confirmLabel,
  cancelLabel = 'Cancelar',
  variant = 'primary',
  loading = false,
  onConfirm,
  onCancel,
}: {
  visible: boolean;
  title: string;
  description: string;
  highlightText?: string;
  confirmLabel: string;
  cancelLabel?: string;
  variant?: 'primary' | 'danger';
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onCancel}>
      <View style={styles.modalBackdrop}>
        <View style={styles.modalCard}>
          <View style={styles.modalHeaderRow}>
            <View
              style={[
                styles.modalIconBox,
                {
                  backgroundColor:
                    variant === 'danger'
                      ? SaharaColors.errorContainer
                      : SaharaColors.primaryFixed,
                },
              ]}>
              <SaharaIcon
                name={variant === 'danger' ? 'warning' : 'handshake'}
                size={20}
                color={
                  variant === 'danger'
                    ? SaharaColors.error
                    : SaharaColors.onPrimaryFixedVariant
                }
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.modalTitle}>{title}</Text>
            </View>
          </View>

          <Text style={styles.modalDesc}>{description}</Text>

          {highlightText ? (
            <View style={styles.modalHighlightBox}>
              <Text style={styles.modalHighlightText}>{highlightText}</Text>
            </View>
          ) : null}

          <View style={styles.modalActionsRow}>
            <View style={{ flex: 1 }}>
              <SaharaButton
                label={cancelLabel}
                variant="outline"
                disabled={loading}
                onPress={onCancel}
              />
            </View>
            <View style={{ flex: 1 }}>
              <SaharaButton
                label={confirmLabel}
                variant={variant === 'danger' ? 'danger' : 'primary'}
                loading={loading}
                onPress={onConfirm}
              />
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );
}

export function FeedbackBanner({
  tone = 'success',
  message,
  onDismiss,
}: {
  tone?: 'success' | 'error' | 'info' | 'warning';
  message: string;
  onDismiss?: () => void;
}) {
  const map = {
    success: {
      bg: SaharaColors.successContainer,
      fg: SaharaColors.onSuccessContainer,
      icon: 'check_circle',
    },
    error: {
      bg: SaharaColors.errorContainer,
      fg: SaharaColors.onErrorContainer,
      icon: 'warning',
    },
    warning: {
      bg: SaharaColors.warningContainer,
      fg: SaharaColors.onWarningContainer,
      icon: 'warning',
    },
    info: {
      bg: SaharaColors.primaryFixed,
      fg: SaharaColors.onPrimaryFixed,
      icon: 'info',
    },
  }[tone];

  return (
    <View style={[styles.feedbackBanner, { backgroundColor: map.bg }]}>
      <SaharaIcon name={map.icon} size={15} color={map.fg} />
      <Text style={[styles.feedbackText, { color: map.fg }]}>{message}</Text>
      {onDismiss ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Cerrar mensaje"
          onPress={onDismiss}
          style={{ padding: 6 }}>
          <SaharaIcon name="close" size={13} color={map.fg} />
        </Pressable>
      ) : null}
    </View>
  );
}

// -----------------------------------------------------------------------------
// 13. SAHARA HEADER & SCREEN SHELL
// -----------------------------------------------------------------------------
export function SaharaHeader({
  title,
  subtitle,
  onBack,
  rightAction,
  badgeText,
}: {
  title: string;
  subtitle?: string;
  onBack?: () => void;
  rightAction?: React.ReactNode;
  badgeText?: string;
}) {
  return (
    <View style={styles.headerContainer}>
      <View style={styles.headerLeft}>
        {onBack ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Regresar"
            onPress={onBack}
            style={styles.backBtn}>
            <SaharaIcon name="arrow_back" size={18} color={SaharaColors.onSurface} />
          </Pressable>
        ) : (
          <View style={styles.brandBadge}>
            <Text style={styles.brandBadgeLetter}>S</Text>
          </View>
        )}
        <View style={{ flex: 1 }}>
          {subtitle ? <Text style={styles.headerSubtitle}>{subtitle}</Text> : null}
          <Text
            accessibilityRole="header"
            maxFontSizeMultiplier={1.4}
            style={styles.headerTitle}
            numberOfLines={1}>
            {title}
          </Text>
        </View>
      </View>

      <View style={styles.headerRight}>
        {badgeText ? (
          <View style={styles.headerPill}>
            <View style={styles.headerPillDot} />
            <Text style={styles.headerPillText}>{badgeText}</Text>
          </View>
        ) : null}
        {rightAction}
      </View>
    </View>
  );
}

export function SaharaScreenShell({
  children,
  header,
  footer,
  scrollable = true,
  contentContainerStyle,
}: {
  children: React.ReactNode;
  header?: React.ReactNode;
  footer?: React.ReactNode;
  scrollable?: boolean;
  contentContainerStyle?: StyleProp<ViewStyle>;
}) {
  return (
    <SafeAreaView
      style={styles.safeScreen}
      edges={['top', 'left', 'right', 'bottom']}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 12}>
        {header}
        {scrollable ? (
          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={[
              styles.scrollContent,
              contentContainerStyle,
            ]}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}>
            {children}
          </ScrollView>
        ) : (
          <View style={[{ flex: 1 }, contentContainerStyle]}>{children}</View>
        )}
        {footer}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeScreen: {
    flex: 1,
    backgroundColor: SaharaColors.surface,
  },
  scrollContent: {
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.md,
    paddingBottom: 96,
    gap: Spacing.md,
  },
  headerContainer: {
    minHeight: 64,
    paddingHorizontal: Spacing.md,
    paddingVertical: 10,
    backgroundColor: SaharaColors.surface,
    borderBottomWidth: 1,
    borderBottomColor: SaharaColors.borderDefault,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  headerLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  backBtn: {
    width: 44,
    height: 44,
    borderRadius: Radius.full,
    backgroundColor: SaharaColors.surfaceContainerLow,
    alignItems: 'center',
    justifyContent: 'center',
  },
  brandBadge: {
    width: 40,
    height: 40,
    borderRadius: Radius.md,
    backgroundColor: SaharaColors.primaryAccessible,
    alignItems: 'center',
    justifyContent: 'center',
  },
  brandBadgeLetter: {
    fontFamily: Fonts.headline,
    color: SaharaColors.onPrimary,
    fontSize: 18,
    fontWeight: '700',
  },
  headerSubtitle: {
    fontFamily: Fonts.label,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: SaharaColors.secondary,
  },
  headerTitle: {
    fontFamily: Fonts.headline,
    fontSize: 20,
    fontWeight: '600',
    color: SaharaColors.onSurface,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: SaharaColors.primaryFixed,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: Radius.full,
  },
  headerPillDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: SaharaColors.primaryAccessible,
  },
  headerPillText: {
    fontFamily: Fonts.label,
    fontSize: 11,
    fontWeight: '700',
    color: SaharaColors.onPrimaryFixed,
  },
  avatarCircle: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: SaharaColors.borderSubtle,
  },
  avatarInitials: {
    fontFamily: Fonts.headline,
    fontWeight: '700',
  },
  buttonBase: {
    borderRadius: Radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: {
    fontFamily: Fonts.label,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  buttonSublabel: {
    fontFamily: Fonts.body,
    fontSize: 11,
    marginTop: 2,
    textAlign: 'center',
  },
  cardBase: {
    borderRadius: Radius.xl,
    padding: Spacing.md,
    borderWidth: 1,
    overflow: 'hidden',
    position: 'relative',
  },
  cardAccentStripe: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 4,
  },
  inputWrapper: {
    width: '100%',
    gap: 6,
  },
  inputHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  inputLabel: {
    fontFamily: Fonts.label,
    fontSize: 12.5,
    fontWeight: '700',
    color: SaharaColors.onSurface,
  },
  rightBadgePill: {
    backgroundColor: SaharaColors.primaryFixed,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: Radius.full,
  },
  rightBadgeText: {
    fontFamily: Fonts.label,
    fontSize: 10.5,
    fontWeight: '700',
    color: SaharaColors.onPrimaryFixedVariant,
  },
  inputBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: SaharaColors.surfaceContainerLow,
    borderWidth: 1,
    borderColor: SaharaColors.outlineVariant,
    borderRadius: Radius.md,
    paddingHorizontal: 12,
    minHeight: 48,
  },
  inputBoxMultiline: {
    alignItems: 'flex-start',
    paddingVertical: 10,
  },
  inputBoxDisabled: {
    backgroundColor: SaharaColors.surfaceContainer,
    opacity: 0.85,
  },
  inputBoxError: {
    borderColor: SaharaColors.error,
    backgroundColor: SaharaColors.errorContainer,
  },
  inputPrefix: {
    fontFamily: Fonts.headline,
    fontSize: 18,
    fontWeight: '700',
    color: SaharaColors.primaryAccessible,
    marginRight: 6,
  },
  textInput: {
    flex: 1,
    fontFamily: Fonts.body,
    fontSize: 14,
    color: SaharaColors.onSurface,
    paddingVertical: 10,
  },
  helperText: {
    fontFamily: Fonts.body,
    fontSize: 11.5,
    color: SaharaColors.onSurfaceVariant,
  },
  errorText: {
    fontFamily: Fonts.label,
    fontSize: 11.5,
    fontWeight: '600',
    color: SaharaColors.error,
  },
  filterPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: Radius.full,
    borderWidth: 1,
  },
  filterPillActive: {
    backgroundColor: SaharaColors.primaryAccessible,
    borderColor: SaharaColors.primaryAccessible,
  },
  filterPillInactive: {
    backgroundColor: SaharaColors.surfaceContainerLowest,
    borderColor: SaharaColors.borderDefault,
  },
  filterPillText: {
    fontFamily: Fonts.label,
    fontSize: 12.5,
    fontWeight: '600',
    color: SaharaColors.onSurface,
  },
  filterPillTextActive: {
    color: SaharaColors.onPrimary,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  sectionHeaderTitle: {
    fontFamily: Fonts.headline,
    fontSize: 19,
    fontWeight: '600',
    color: SaharaColors.onSurface,
  },
  sectionActionBtn: {
    paddingVertical: 6,
    paddingHorizontal: 8,
  },
  sectionActionText: {
    fontFamily: Fonts.label,
    fontSize: 12.5,
    fontWeight: '700',
    color: SaharaColors.primaryAccessible,
  },
  badgePill: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: Radius.full,
  },
  badgeDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  badgeText: {
    fontFamily: Fonts.label,
    fontSize: 11,
    fontWeight: '700',
  },
  countdownCard: {
    borderRadius: Radius.xl,
    padding: Spacing.md,
    gap: 6,
  },
  countdownHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  countdownTitle: {
    fontFamily: Fonts.label,
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  countdownValueRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 8,
  },
  countdownPrefix: {
    fontFamily: Fonts.body,
    fontSize: 12,
    color: SaharaColors.onSurfaceVariant,
  },
  countdownValue: {
    fontFamily: Fonts.headline,
    fontSize: 22,
    fontWeight: '700',
  },
  countdownSub: {
    fontFamily: Fonts.body,
    fontSize: 12,
    color: SaharaColors.onSurfaceVariant,
    lineHeight: 17,
  },
  starsRowReadOnly: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  starDotReadOnly: {
    borderRadius: Radius.xs,
    alignItems: 'center',
    justifyContent: 'center',
  },
  starsRowInteractive: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  starBtnInteractive: {
    minWidth: 54,
    height: 48,
    paddingHorizontal: 10,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  starBtnInteractiveActive: {
    backgroundColor: SaharaColors.primaryAccessible,
    borderColor: SaharaColors.primaryAccessible,
  },
  starBtnInteractiveInactive: {
    backgroundColor: SaharaColors.surfaceContainerLow,
    borderColor: SaharaColors.outlineVariant,
  },
  starBtnNumber: {
    fontFamily: Fonts.label,
    fontSize: 15,
    fontWeight: '700',
  },
  pickerContainer: {
    gap: 10,
  },
  pickerHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  pickerTitle: {
    fontFamily: Fonts.label,
    fontSize: 13,
    fontWeight: '700',
    color: SaharaColors.onSurface,
  },
  pickerSubtitle: {
    fontFamily: Fonts.body,
    fontSize: 11.5,
    color: SaharaColors.onSurfaceVariant,
  },
  counterBadge: {
    backgroundColor: SaharaColors.primaryFixed,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: Radius.full,
  },
  counterBadgeText: {
    fontFamily: Fonts.label,
    fontSize: 11,
    fontWeight: '700',
    color: SaharaColors.onPrimaryFixed,
  },
  dropZone: {
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: SaharaColors.outlineVariant,
    borderRadius: Radius.xl,
    padding: Spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: SaharaColors.surfaceContainerLow,
    gap: 6,
  },
  dropZoneIconCircle: {
    width: 40,
    height: 40,
    borderRadius: Radius.full,
    backgroundColor: SaharaColors.primaryFixed,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dropZoneTitle: {
    fontFamily: Fonts.label,
    fontSize: 13,
    fontWeight: '700',
    color: SaharaColors.onSurface,
  },
  dropZoneHint: {
    fontFamily: Fonts.body,
    fontSize: 11.5,
    color: SaharaColors.onSurfaceVariant,
  },
  attachmentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 10,
    borderRadius: Radius.md,
    backgroundColor: SaharaColors.surfaceContainerLowest,
    borderWidth: 1,
    borderColor: SaharaColors.borderSubtle,
    gap: 10,
  },
  attachmentRowLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  attachmentIconBox: {
    width: 34,
    height: 34,
    borderRadius: Radius.md,
    backgroundColor: SaharaColors.primaryFixed,
    alignItems: 'center',
    justifyContent: 'center',
  },
  attachmentName: {
    fontFamily: Fonts.label,
    fontSize: 12.5,
    fontWeight: '600',
    color: SaharaColors.onSurface,
  },
  attachmentMeta: {
    fontFamily: Fonts.body,
    fontSize: 11,
    color: SaharaColors.onSurfaceVariant,
  },
  removeFileBtn: {
    width: 36,
    height: 36,
    borderRadius: Radius.full,
    backgroundColor: SaharaColors.surfaceContainerHigh,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stateBox: {
    padding: Spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  stateLoadingText: {
    fontFamily: Fonts.body,
    fontSize: 13,
    color: SaharaColors.onSurfaceVariant,
  },
  skeletonCard: {
    backgroundColor: SaharaColors.surfaceContainerLow,
    borderRadius: Radius.xl,
    padding: Spacing.md,
    gap: 10,
  },
  skeletonLineShort: {
    width: '38%',
    height: 12,
    borderRadius: Radius.xs,
    backgroundColor: SaharaColors.surfaceContainerHighest,
  },
  skeletonLineLong: {
    width: '90%',
    height: 16,
    borderRadius: Radius.xs,
    backgroundColor: SaharaColors.surfaceContainerHighest,
  },
  skeletonLineMedium: {
    width: '65%',
    height: 12,
    borderRadius: Radius.xs,
    backgroundColor: SaharaColors.surfaceContainerHighest,
  },
  emptyBox: {
    padding: Spacing.xl,
    borderRadius: Radius.xl,
    backgroundColor: SaharaColors.surfaceContainerLow,
    borderWidth: 1,
    borderColor: SaharaColors.borderSubtle,
    alignItems: 'center',
    gap: 8,
  },
  emptyIconCircle: {
    width: 52,
    height: 52,
    borderRadius: Radius.full,
    backgroundColor: SaharaColors.primaryFixed,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyTitle: {
    fontFamily: Fonts.headline,
    fontSize: 19,
    fontWeight: '600',
    color: SaharaColors.onSurface,
    textAlign: 'center',
  },
  emptyDescription: {
    fontFamily: Fonts.body,
    fontSize: 13,
    color: SaharaColors.onSurfaceVariant,
    textAlign: 'center',
    lineHeight: 19,
  },
  errorBox: {
    padding: Spacing.lg,
    borderRadius: Radius.xl,
    backgroundColor: SaharaColors.errorContainer,
    borderWidth: 1,
    borderColor: SaharaColors.errorBorderSubtle,
    alignItems: 'center',
    gap: 8,
  },
  errorIconCircle: {
    width: 44,
    height: 44,
    borderRadius: Radius.full,
    backgroundColor: SaharaColors.surfaceContainerLowest,
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorStateTitle: {
    fontFamily: Fonts.headline,
    fontSize: 18,
    fontWeight: '700',
    color: SaharaColors.onErrorContainer,
  },
  errorStateMsg: {
    fontFamily: Fonts.body,
    fontSize: 13,
    color: SaharaColors.onErrorContainer,
    textAlign: 'center',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: SaharaColors.backdropOverlay,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.md,
  },
  modalCard: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: SaharaColors.surfaceContainerLowest,
    borderRadius: Radius.xxl,
    padding: Spacing.lg,
    gap: Spacing.md,
    borderWidth: 1,
    borderColor: SaharaColors.borderDefault,
  },
  modalHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  modalIconBox: {
    width: 42,
    height: 42,
    borderRadius: Radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalTitle: {
    fontFamily: Fonts.headline,
    fontSize: 20,
    fontWeight: '700',
    color: SaharaColors.onSurface,
  },
  modalDesc: {
    fontFamily: Fonts.body,
    fontSize: 13.5,
    color: SaharaColors.onSurfaceVariant,
    lineHeight: 20,
  },
  modalHighlightBox: {
    backgroundColor: SaharaColors.surfaceContainerLow,
    borderRadius: Radius.md,
    padding: 12,
    borderWidth: 1,
    borderColor: SaharaColors.borderSubtle,
  },
  modalHighlightText: {
    fontFamily: Fonts.label,
    fontSize: 12.5,
    fontWeight: '600',
    color: SaharaColors.onSurface,
  },
  modalActionsRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 4,
  },
  feedbackBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: Radius.lg,
  },
  feedbackText: {
    flex: 1,
    fontFamily: Fonts.label,
    fontSize: 12.5,
    fontWeight: '600',
    lineHeight: 18,
  },
});

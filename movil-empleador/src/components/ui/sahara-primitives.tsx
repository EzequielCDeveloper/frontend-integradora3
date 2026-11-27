/**
 * Sahara Atomic UI Components Library (WCAG 2.2 AA & MD3 48dp Hardened — Zero Emojis)
 * Pure presentation components consuming Sahara tokens.
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
// 1. PURE GEOMETRIC / ASCII ICON MAPPER (ZERO EMOJIS, accessible={false})
// -----------------------------------------------------------------------------
const ICON_GLYPHS: Record<string, string> = {
  assured_workload: 'S',
  verified_user: 'OK',
  verified: 'OK',
  notifications: 'AL',
  notifications_active: 'AL',
  person: 'ID',
  account_circle: 'ID',
  lock: 'LK',
  lock_open: 'UL',
  lock_clock: 'TM',
  receipt_long: 'CF',
  receipt: 'CF',
  add: '+',
  add_circle: '+',
  add_a_photo: '+F',
  add_photo_alternate: '+A',
  photo_camera: 'CM',
  image: 'IM',
  picture_as_pdf: 'PDF',
  arrow_back: '<',
  arrow_back_ios_new: '<',
  arrow_forward: '>',
  arrow_forward_ios: '>',
  chevron_right: '>',
  expand_more: 'v',
  close: 'X',
  check: 'OK',
  check_circle: 'OK',
  task_alt: 'OK',
  done_all: 'OK',
  radio_button_unchecked: 'o',
  timer: 'TM',
  schedule: 'HR',
  hourglass_top: 'TM',
  calendar_today: 'FE',
  calendar_month: 'FE',
  event_available: 'FE',
  event_busy: 'FE',
  location_on: 'UB',
  push_pin: 'UB',
  pin_drop: 'UB',
  my_location: 'UB',
  navigation: 'IR',
  star: '*',
  star_outline: '-',
  group: 'EQ',
  work: 'TR',
  business_center: 'TR',
  folder_shared: 'PB',
  folder_open: 'EX',
  handyman: 'MT',
  construction: 'OB',
  cleaning_services: 'LM',
  format_paint: 'PT',
  yard: 'JD',
  local_shipping: 'MD',
  celebration: 'EV',
  bolt: 'EL',
  lightbulb: 'ID',
  chat: 'CH',
  call: 'TL',
  phone_iphone: 'TL',
  mail: 'EM',
  mark_email_unread: 'EM',
  key: 'CL',
  visibility: 'VR',
  visibility_off: 'OC',
  edit: 'ED',
  cancel: 'X',
  warning: '!',
  info: 'i',
  gavel: 'AR',
  balance: 'AR',
  support_agent: 'SP',
  flag: 'RP',
  send: '>',
  content_copy: 'CP',
  account_balance_wallet: 'MX',
  account_balance: 'MX',
  payments: 'MX',
  undo: '<<',
  replay: '<<',
  download: 'DL',
  sim_card_download: 'DL',
  logout: 'SL',
  inbox: 'BZ',
  handshake: 'AC',
  shield: 'GD',
  shield_lock: 'GD',
  shield_person: 'GD',
  domain: 'EM',
  article: 'DC',
  assignment: 'DC',
  history: 'HS',
  publish: 'UP',
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
// 2. SAHARA BUTTON (Enforces minHeight: 48dp & WCAG 2.2 AA contrast >= 4.5:1)
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
    primary: SaharaColors.primaryAccessible, // 5.18:1 with #ffffff (WCAG 1.4.3 AA)
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
    sm: { paddingVertical: 12, paddingHorizontal: 14, minHeight: 48 },
    md: { paddingVertical: 14, paddingHorizontal: 18, minHeight: 48 },
    lg: { paddingVertical: 15, paddingHorizontal: 22, minHeight: 52 },
  }[size];

  const a11yLabel =
    accessibilityLabel ?? (sublabel ? `${label}. ${sublabel}` : label);

  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={a11yLabel}
      accessibilityState={{ disabled: isLocked, busy: loading }}
      disabled={isLocked}
      onPress={onPress}
      style={({ pressed }) => [
        styles.buttonBase,
        paddings,
        {
          backgroundColor: bgColors[variant],
          width: fullWidth ? '100%' : undefined,
          opacity: isLocked ? 0.55 : pressed ? 0.9 : 1,
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
// 3. SAHARA CARD
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
        accessibilityLabel={accessibilityLabel ?? 'Tarjeta interactiva'}
        onPress={onPress}
        style={({ pressed }) => [{ opacity: pressed ? 0.94 : 1 }]}>
        {content}
      </Pressable>
    );
  }
  return content;
}

// -----------------------------------------------------------------------------
// 4. SAHARA INPUT (Enforces minHeight: 48dp, WCAG 1.4.3 placeholder & 1.4.11 border)
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
            multiline ? { minHeight: 80, textAlignVertical: 'top' } : undefined,
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
// 5. STATUS BADGES (WCAG 2.2 AA Contrast >= 4.5:1)
// -----------------------------------------------------------------------------
export function JobStatusBadge({ status }: { status: JobStatus }) {
  const toneMap: Record<
    JobStatus,
    { bg: string; fg: string; dot: string }
  > = {
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
    <View
      accessible={true}
      accessibilityLabel={`Estado del trabajo: ${JOB_STATUS_LABELS[status]}`}
      style={[styles.badgePill, { backgroundColor: tone.bg }]}>
      <View style={[styles.badgeDot, { backgroundColor: tone.dot }]} />
      <Text style={[styles.badgeText, { color: tone.fg }]}>
        {JOB_STATUS_LABELS[status]}
      </Text>
    </View>
  );
}

export function PaymentStatusBadge({ status }: { status: PaymentStatus }) {
  const isPositive =
    status === 'confirmed' ||
    status === 'transferred' ||
    status === 'partial_settlement_completed';
  const isAlert =
    status === 'in_claim' ||
    status === 'failed' ||
    status === 'transfer_failed' ||
    status === 'refund_failed';

  const bg = isPositive
    ? SaharaColors.primaryFixed
    : isAlert
      ? SaharaColors.tertiaryFixed
      : SaharaColors.surfaceContainerHigh;
  const fg = isPositive
    ? SaharaColors.onPrimaryFixed
    : isAlert
      ? SaharaColors.onTertiaryFixedVariant
      : SaharaColors.onSurface;

  return (
    <View
      accessible={true}
      accessibilityLabel={`Estado del pago: ${PAYMENT_STATUS_LABELS[status]}`}
      style={[styles.badgePill, { backgroundColor: bg }]}>
      <SaharaIcon
        name={isPositive ? 'lock' : isAlert ? 'gavel' : 'payments'}
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
  const isAccepted = status === 'accepted';
  const isRejected = status === 'rejected' || status === 'expired';
  const bg = isAccepted
    ? SaharaColors.primaryFixed
    : isRejected
      ? SaharaColors.errorContainer
      : SaharaColors.secondaryContainer;
  const fg = isAccepted
    ? SaharaColors.onPrimaryFixed
    : isRejected
      ? SaharaColors.onErrorContainer
      : SaharaColors.onSecondaryContainer;

  return (
    <View
      accessible={true}
      accessibilityLabel={`Estado de postulación: ${APPLICATION_STATUS_LABELS[status]}`}
      style={[styles.badgePill, { backgroundColor: bg }]}>
      <Text style={[styles.badgeText, { color: fg }]}>
        {APPLICATION_STATUS_LABELS[status]}
      </Text>
    </View>
  );
}

export function CaseStatusBadge({ status }: { status: CaseStatus }) {
  const bg =
    status === 'resolved'
      ? SaharaColors.primaryFixed
      : status === 'in_review'
        ? SaharaColors.secondaryContainer
        : status === 'open'
          ? SaharaColors.tertiaryFixed
          : SaharaColors.surfaceContainerHigh;
  const fg =
    status === 'resolved'
      ? SaharaColors.onPrimaryFixed
      : status === 'in_review'
        ? SaharaColors.onSecondaryContainer
        : status === 'open'
          ? SaharaColors.onTertiaryFixed
          : SaharaColors.onSurface;

  return (
    <View
      accessible={true}
      accessibilityLabel={`Estado del caso: ${CASE_STATUS_LABELS[status]}`}
      style={[styles.badgePill, { backgroundColor: bg }]}>
      <Text style={[styles.badgeText, { color: fg }]}>
        {CASE_STATUS_LABELS[status]}
      </Text>
    </View>
  );
}

// -----------------------------------------------------------------------------
// 6. COUNTDOWN TIMER (Screen-reader friendly grouped label)
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
    <View
      accessible={true}
      accessibilityLabel={`${title}. Tiempo restante: ${countdown.formattedShort}. ${subtitle ?? ''}`}
      style={[styles.countdownCard, { backgroundColor: bg }]}>
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
// 7. RATING STARS (48x48dp touch targets & 8dp gap when interactive; grouped a11y label when read-only; zero emojis)
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
        accessibilityLabel={`Calificación: ${rating.toFixed(1)} de 5`}
        style={styles.starsRowReadOnly}>
        {[1, 2, 3, 4, 5].map((star) => {
          const filled = star <= Math.round(rating);
          return (
            <Text
              key={star}
              accessible={false}
              style={{
                fontSize: Math.max(16, size),
                color: filled
                  ? SaharaColors.primaryAccessible
                  : SaharaColors.surfaceContainerHighest,
                marginRight: 2,
              }}>
              ★
            </Text>
          );
        })}
      </View>
    );
  }

  return (
    <View
      accessibilityRole="radiogroup"
      accessibilityLabel="Selector de calificación de 1 a 5"
      style={styles.starsRowInteractive}>
      {[1, 2, 3, 4, 5].map((star) => {
        const filled = star <= Math.round(rating);
        return (
          <Pressable
            key={star}
            testID={`star-btn-${star}`}
            accessibilityRole="radio"
            accessibilityState={{ checked: star === rating }}
            accessibilityLabel={`${star} de 5 estrellas`}
            onPress={() => onChange(star)}
            style={[
              styles.starBtnInteractive,
              filled
                ? styles.starBtnInteractiveActive
                : styles.starBtnInteractiveInactive,
            ]}>
            <Text
              style={{
                fontSize: Math.max(22, Math.round(size * 0.75)),
                color: filled
                  ? SaharaColors.onPrimary
                  : SaharaColors.onSurfaceVariant,
              }}>
              ★
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

// -----------------------------------------------------------------------------
// 8. ATTACHMENT PICKER (Up to 5 files <= 10MB, 48x48dp remove button)
// -----------------------------------------------------------------------------
export interface AttachmentDraft {
  id: string;
  file_name: string;
  mime_type: 'image/jpeg' | 'image/png' | 'application/pdf';
  size_bytes: number;
}

const SAMPLE_VALID_FILES: Record<AttachmentKind, AttachmentDraft[]> = {
  job_photo: [
    {
      id: 'sample-photo-1',
      file_name: 'vista_general_espacio.jpg',
      mime_type: 'image/jpeg',
      size_bytes: 1_250_000,
    },
    {
      id: 'sample-photo-2',
      file_name: 'detalle_area_trabajo.png',
      mime_type: 'image/png',
      size_bytes: 890_000,
    },
    {
      id: 'sample-photo-3',
      file_name: 'acceso_y_referencia.jpg',
      mime_type: 'image/jpeg',
      size_bytes: 1_540_000,
    },
    {
      id: 'sample-photo-4',
      file_name: 'iluminacion_actual.jpg',
      mime_type: 'image/jpeg',
      size_bytes: 1_120_000,
    },
    {
      id: 'sample-photo-5',
      file_name: 'materiales_disponibles.png',
      mime_type: 'image/png',
      size_bytes: 940_000,
    },
  ],
  case_evidence: [
    {
      id: 'sample-ev-1',
      file_name: 'evidencia_fotografica_sitio.jpg',
      mime_type: 'image/jpeg',
      size_bytes: 1_620_000,
    },
    {
      id: 'sample-ev-2',
      file_name: 'bitacora_acuerdo_firmado.pdf',
      mime_type: 'application/pdf',
      size_bytes: 480_000,
    },
    {
      id: 'sample-ev-3',
      file_name: 'captura_reloj_llegada.png',
      mime_type: 'image/png',
      size_bytes: 720_000,
    },
    {
      id: 'sample-ev-4',
      file_name: 'comprobante_insumos.pdf',
      mime_type: 'application/pdf',
      size_bytes: 590_000,
    },
    {
      id: 'sample-ev-5',
      file_name: 'estado_final_obra.jpg',
      mime_type: 'image/jpeg',
      size_bytes: 1_910_000,
    },
  ],
  completion_evidence: [],
};

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

  const handlePickNext = (customCandidate?: CandidateAttachmentFile) => {
    const samples = SAMPLE_VALID_FILES[kind];
    const nextSample = samples[items.length % samples.length] ?? {
      id: `file-${Date.now()}`,
      file_name: `adjunto_${items.length + 1}.jpg`,
      mime_type: 'image/jpeg' as const,
      size_bytes: 1_100_000,
    };

    const candidate: CandidateAttachmentFile = customCandidate ?? {
      file_name: nextSample.file_name,
      mime_type: nextSample.mime_type,
      size_bytes: nextSample.size_bytes,
    };

    const validationError = validateAttachmentCandidate(
      candidate,
      kind,
      items.length,
    );
    if (validationError) {
      onValidationError?.(validationError);
      return;
    }

    onAdd({
      id: `att-draft-${Date.now()}-${items.length}`,
      file_name: candidate.file_name,
      mime_type: candidate.mime_type as AttachmentDraft['mime_type'],
      size_bytes: candidate.size_bytes,
    });
  };

  return (
    <View style={styles.pickerContainer}>
      <View style={styles.pickerHeaderRow}>
        <View>
          <Text style={styles.pickerTitle}>
            {kind === 'job_photo'
              ? 'Fotografías del espacio'
              : 'Evidencias y adjuntos'}
          </Text>
          <Text style={styles.pickerSubtitle}>
            {kind === 'job_photo'
              ? 'JPG o PNG · Máx. 10 MB por foto'
              : 'JPG, PNG o PDF · Máx. 10 MB por archivo'}
          </Text>
        </View>
        <View style={styles.counterBadge}>
          <Text style={styles.counterBadgeText}>{items.length} / 5</Text>
        </View>
      </View>

      <Pressable
        testID="attachment-picker-add-btn"
        accessibilityRole="button"
        accessibilityLabel={
          isMaxed
            ? 'Límite de 5 archivos alcanzado'
            : kind === 'job_photo'
              ? 'Agregar fotografía del trabajo'
              : 'Adjuntar fotografía o PDF de respaldo'
        }
        accessibilityState={{ disabled: isMaxed }}
        disabled={isMaxed}
        onPress={() => handlePickNext()}
        style={[
          styles.dropZone,
          isMaxed ? { opacity: 0.45 } : undefined,
        ]}>
        <View style={styles.dropZoneIconCircle}>
          <SaharaIcon
            name={kind === 'job_photo' ? 'add_a_photo' : 'add_photo_alternate'}
            size={18}
            color={SaharaColors.onPrimaryFixedVariant}
          />
        </View>
        <Text style={styles.dropZoneTitle}>
          {isMaxed
            ? 'Límite de 5 archivos alcanzado'
            : kind === 'job_photo'
              ? '+ Agregar fotografía del trabajo'
              : '+ Adjuntar fotografía o PDF de respaldo'}
        </Text>
        <Text style={styles.dropZoneHint}>
          Validación automática de seguridad MIME y tamaño (&lt;= 10 MB)
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
                    size={15}
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
                accessibilityLabel={`Eliminar archivo ${item.file_name}`}
                onPress={() => onRemove(item.id)}
                style={styles.removeFileBtn}>
                <SaharaIcon
                  name="close"
                  size={14}
                  color={SaharaColors.onSurface}
                />
              </Pressable>
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
}

// -----------------------------------------------------------------------------
// 9. FOUR MANDATORY SCREEN STATES (LoadingSkeleton, EmptyState, ErrorState)
// -----------------------------------------------------------------------------
export function LoadingSkeleton({
  message = 'Cargando información...',
  rows = 3,
}: {
  message?: string;
  rows?: number;
}) {
  return (
    <View
      accessible={true}
      accessibilityRole="progressbar"
      accessibilityLabel={message}
      style={styles.stateBox}
      testID="loading-skeleton">
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
    <View style={styles.emptyBox} testID="empty-state">
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
  secondaryLabel,
  onSecondaryAction,
}: {
  message: string;
  onRetry?: () => void;
  secondaryLabel?: string;
  onSecondaryAction?: () => void;
}) {
  return (
    <View
      accessible={true}
      accessibilityRole="alert"
      style={styles.errorBox}
      testID="error-state">
      <View style={styles.errorIconCircle}>
        <SaharaIcon name="warning" size={20} color={SaharaColors.error} />
      </View>
      <Text style={styles.errorStateTitle}>Atención Operativa</Text>
      <Text style={styles.errorStateMsg}>{message}</Text>
      <View style={{ flexDirection: 'row', gap: 10, marginTop: 8 }}>
        {onRetry ? (
          <SaharaButton
            label="Reintentar ahora"
            onPress={onRetry}
            variant="primary"
            size="sm"
            fullWidth={false}
          />
        ) : null}
        {secondaryLabel && onSecondaryAction ? (
          <SaharaButton
            label={secondaryLabel}
            onPress={onSecondaryAction}
            variant="outline"
            size="sm"
            fullWidth={false}
          />
        ) : null}
      </View>
    </View>
  );
}

// -----------------------------------------------------------------------------
// 10. CONFIRMATION MODAL (Two-step Poka-Yoke for Financial & Destructive Actions)
// -----------------------------------------------------------------------------
export function ConfirmationModal({
  visible,
  title,
  description,
  highlightText,
  confirmLabel,
  cancelLabel = 'Volver',
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
        <View
          accessible={true}
          accessibilityLabel={`${title}. ${description}`}
          style={styles.modalCard}>
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

// -----------------------------------------------------------------------------
// 11. SAHARA SCREEN SHELL & HEADER BAR (SYS-01 KeyboardAvoidingView + SYS-02 Bottom SafeArea + SYS-03 48x48dp Back Button)
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
            accessibilityLabel="Regresar a la pantalla anterior"
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
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 16}>
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
    paddingBottom: 100,
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
    width: 48,
    height: 48,
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
    paddingVertical: 12,
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
    fontSize: 24,
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
    gap: 4,
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
    gap: 10,
  },
  starBtnInteractive: {
    width: 48,
    height: 48,
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
    fontFamily: Fonts.headline,
    fontSize: 18,
    fontWeight: '700',
  },
  pickerContainer: {
    gap: 8,
  },
  pickerHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  pickerTitle: {
    fontFamily: Fonts.headline,
    fontSize: 17,
    fontWeight: '600',
    color: SaharaColors.onSurface,
  },
  pickerSubtitle: {
    fontFamily: Fonts.body,
    fontSize: 11.5,
    color: SaharaColors.onSurfaceVariant,
  },
  counterBadge: {
    backgroundColor: SaharaColors.surfaceContainer,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: Radius.full,
  },
  counterBadgeText: {
    fontFamily: Fonts.label,
    fontSize: 11,
    fontWeight: '700',
    color: SaharaColors.onPrimaryFixedVariant,
  },
  dropZone: {
    backgroundColor: SaharaColors.surfaceContainerLow,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: SaharaColors.outlineVariant,
    borderRadius: Radius.lg,
    padding: Spacing.md,
    minHeight: 88,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  dropZoneIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: SaharaColors.primaryFixed,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dropZoneTitle: {
    fontFamily: Fonts.label,
    fontSize: 13,
    fontWeight: '700',
    color: SaharaColors.primaryAccessible,
  },
  dropZoneHint: {
    fontFamily: Fonts.body,
    fontSize: 11,
    color: SaharaColors.onSurfaceVariant,
    textAlign: 'center',
  },
  attachmentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: SaharaColors.surfaceContainerLowest,
    borderRadius: Radius.md,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: SaharaColors.borderDefault,
  },
  attachmentRowLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  attachmentIconBox: {
    width: 40,
    height: 40,
    borderRadius: Radius.sm,
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
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: SaharaColors.surfaceContainer,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stateBox: {
    padding: Spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  stateLoadingText: {
    fontFamily: Fonts.label,
    fontSize: 12.5,
    color: SaharaColors.onSurfaceVariant,
    textAlign: 'center',
  },
  skeletonCard: {
    backgroundColor: SaharaColors.surfaceContainerLow,
    borderRadius: Radius.lg,
    padding: Spacing.md,
    gap: 8,
    borderWidth: 1,
    borderColor: SaharaColors.borderSubtle,
  },
  skeletonLineShort: {
    width: '38%',
    height: 10,
    borderRadius: 5,
    backgroundColor: SaharaColors.surfaceContainerHigh,
  },
  skeletonLineLong: {
    width: '85%',
    height: 14,
    borderRadius: 7,
    backgroundColor: SaharaColors.surfaceContainerHigh,
  },
  skeletonLineMedium: {
    width: '60%',
    height: 10,
    borderRadius: 5,
    backgroundColor: SaharaColors.surfaceContainer,
  },
  emptyBox: {
    backgroundColor: SaharaColors.surfaceContainerLow,
    borderRadius: Radius.xl,
    padding: Spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: SaharaColors.borderDefault,
  },
  emptyIconCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: SaharaColors.primaryFixed,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
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
    fontSize: 12.5,
    color: SaharaColors.onSurfaceVariant,
    textAlign: 'center',
    lineHeight: 18,
  },
  errorBox: {
    backgroundColor: SaharaColors.errorContainer,
    borderRadius: Radius.xl,
    padding: Spacing.lg,
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: SaharaColors.errorBorderSubtle,
  },
  errorIconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: SaharaColors.surfaceContainerLowest,
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorStateTitle: {
    fontFamily: Fonts.headline,
    fontSize: 17,
    fontWeight: '700',
    color: SaharaColors.onErrorContainer,
  },
  errorStateMsg: {
    fontFamily: Fonts.body,
    fontSize: 12.5,
    color: SaharaColors.onErrorContainer,
    textAlign: 'center',
    lineHeight: 18,
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
    borderRadius: Radius.xl,
    padding: Spacing.lg,
    gap: 14,
    borderWidth: 1,
    borderColor: SaharaColors.outlineVariant,
  },
  modalHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  modalIconBox: {
    width: 48,
    height: 48,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalTitle: {
    fontFamily: Fonts.headline,
    fontSize: 19,
    fontWeight: '700',
    color: SaharaColors.onSurface,
  },
  modalDesc: {
    fontFamily: Fonts.body,
    fontSize: 13,
    color: SaharaColors.onSurfaceVariant,
    lineHeight: 19,
  },
  modalHighlightBox: {
    backgroundColor: SaharaColors.surfaceContainerLow,
    borderRadius: Radius.md,
    padding: 12,
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
});

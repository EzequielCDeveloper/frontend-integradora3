/**
 * Pure Domain Utilities — Financial rounding (half-up), formatters, labels, Poka-Yoke input masks, and date helpers.
 */
import type {
  ApplicationStatus,
  CaseStatus,
  CaseType,
  JobCategory,
  JobStatus,
  PaymentStatus,
  TicketCategory,
} from '@/types/database';

/**
 * Half-up rounding to 2 decimals matching PostgreSQL `round(job_amount_mxn * 0.10, 2)`
 */
export function roundHalfUpCents(amount: number): number {
  const scaled = Math.round((amount + Number.EPSILON) * 1000);
  const cents = Math.floor((scaled + 5) / 10);
  return cents / 100;
}

export function calculatePlatformFeeMXN(jobAmountMxn: number): number {
  return roundHalfUpCents(jobAmountMxn * 0.1);
}

export function calculateTotalChargedMXN(jobAmountMxn: number): number {
  const fee = calculatePlatformFeeMXN(jobAmountMxn);
  return roundHalfUpCents(jobAmountMxn + fee);
}

export function formatCurrencyMXN(amount: number): string {
  const safe = Number.isFinite(amount) ? amount : 0;
  const fixed = safe.toFixed(2);
  const [intPart, decPart] = fixed.split('.');
  const withCommas = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return `$${withCommas}.${decPart} MXN`;
}

export function formatFolio(id: string, prefix = 'SLZ'): string {
  const clean = id.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
  const suffix = clean.slice(-4).padStart(4, '0');
  return `#${prefix}-${suffix}`;
}

export function formatSpanishDate(dateStr: string): string {
  if (!dateStr) return '';
  const parts = dateStr.split('T')[0].split('-');
  if (parts.length !== 3) return dateStr;
  const months = [
    'Ene',
    'Feb',
    'Mar',
    'Abr',
    'May',
    'Jun',
    'Jul',
    'Ago',
    'Sep',
    'Oct',
    'Nov',
    'Dic',
  ];
  const year = parts[0];
  const monthIdx = Math.max(0, Math.min(11, parseInt(parts[1], 10) - 1));
  const day = parseInt(parts[2], 10);
  return `${day} ${months[monthIdx]} ${year}`;
}

export function formatTimeRange(startTime: string, endTime: string): string {
  return `${startTime.slice(0, 5)} - ${endTime.slice(0, 5)} hrs`;
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Poka-Yoke Input Masks for Non-Technical Users (`PY-SYS-02`)
 */

/**
 * Auto-formats digits into `AAAA-MM-DD`.
 * Also converts `DD/MM/AAAA` or `DD-MM-AAAA` automatically if user starts with 2 digits + separator + 2 digits + 4 digits.
 */
export function formatDateInputMask(raw: string): string {
  const trimmed = raw.trim();
  const dmyMatch = /^(\d{2})[/.-](\d{2})[/.-](\d{4})$/.exec(trimmed);
  if (dmyMatch) {
    return `${dmyMatch[3]}-${dmyMatch[2]}-${dmyMatch[1]}`;
  }
  const digits = raw.replace(/\D/g, '').slice(0, 8);
  if (digits.length <= 4) return digits;
  if (digits.length <= 6) return `${digits.slice(0, 4)}-${digits.slice(4)}`;
  return `${digits.slice(0, 4)}-${digits.slice(4, 6)}-${digits.slice(6, 8)}`;
}

/**
 * Auto-formats digits into `HH:MM` as the user types, or normalizes `9:00` -> `09:00` on blur.
 */
export function formatTimeInputMask(raw: string): string {
  if (raw.includes(':')) {
    const [hPart = '', mPart = ''] = raw.split(':');
    const hDigits = hPart.replace(/\D/g, '').slice(0, 2);
    const mDigits = mPart.replace(/\D/g, '').slice(0, 2);
    return `${hDigits}:${mDigits}`;
  }
  const digits = raw.replace(/\D/g, '').slice(0, 4);
  if (digits.length <= 2) return digits;
  return `${digits.slice(0, 2)}:${digits.slice(2, 4)}`;
}

export function normalizeTimeOnBlur(raw: string): string {
  const trimmed = raw.trim();
  const singleHourMatch = /^(\d):(\d{2})$/.exec(trimmed);
  if (singleHourMatch) {
    return `0${singleHourMatch[1]}:${singleHourMatch[2]}`;
  }
  const onlyHourMatch = /^([01]?\d|2[0-3])$/.exec(trimmed);
  if (onlyHourMatch) {
    return `${onlyHourMatch[1].padStart(2, '0')}:00`;
  }
  return trimmed;
}

/**
 * Strips non-numeric characters (like `$`, commas, spaces) and restricts to max 2 decimals.
 */
export function formatCurrencyInputMask(raw: string): string {
  const cleaned = raw.replace(/[^0-9.]/g, '');
  const parts = cleaned.split('.');
  if (parts.length <= 1) return parts[0].slice(0, 6);
  return `${parts[0].slice(0, 6)}.${parts[1].slice(0, 2)}`;
}

/**
 * Cleans phone input keeping only digits, spaces, and optional leading `+`.
 */
export function formatPhoneInputMask(raw: string): string {
  return raw.replace(/[^0-9+ -]/g, '').slice(0, 20);
}

/**
 * Returns `AAAA-MM-DD` for today + `offsetDays`.
 */
export function getFutureDateYMD(offsetDays: number, baseDate = new Date()): string {
  const d = new Date(baseDate.getTime());
  d.setDate(d.getDate() + offsetDays);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function calculateAgeYears(birthDateYmd: string, referenceDate = new Date()): number {
  const normalized = formatDateInputMask(birthDateYmd);
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(normalized.trim());
  if (!match) return -1;
  const year = parseInt(match[1], 10);
  const month = parseInt(match[2], 10);
  const day = parseInt(match[3], 10);
  const dob = new Date(year, month - 1, day);
  if (
    dob.getFullYear() !== year ||
    dob.getMonth() !== month - 1 ||
    dob.getDate() !== day
  ) {
    return -1;
  }
  let age = referenceDate.getFullYear() - year;
  const mDiff = referenceDate.getMonth() + 1 - month;
  if (mDiff < 0 || (mDiff === 0 && referenceDate.getDate() < day)) {
    age--;
  }
  return age;
}

export const JOB_CATEGORY_LABELS: Record<JobCategory, string> = {
  limpieza: 'Limpieza',
  pintura: 'Pintura',
  jardineria: 'Jardinería',
  mudanzas: 'Mudanzas',
  eventos: 'Eventos',
  otros: 'Otros',
};

export const JOB_CATEGORY_ICONS: Record<JobCategory, string> = {
  limpieza: 'cleaning_services',
  pintura: 'format_paint',
  jardineria: 'yard',
  mudanzas: 'local_shipping',
  eventos: 'celebration',
  otros: 'handyman',
};

export const JOB_STATUS_LABELS: Record<JobStatus, string> = {
  published: 'Publicado',
  has_applications: 'Con candidatos',
  assigned: 'Asignado',
  arrival_registered: 'Ya llegó (Por pagar)',
  in_progress: 'En curso',
  completion_requested: 'Por confirmar cierre',
  in_claim: 'En reclamo',
  completed: 'Terminado',
  cancelled: 'Cancelado',
  expired: 'Vencido',
};

export const PAYMENT_STATUS_LABELS: Record<PaymentStatus, string> = {
  not_started: 'Sin iniciar',
  payment_pending: 'Pago pendiente',
  confirmed: 'Dinero protegido',
  failed: 'Pago rechazado',
  in_claim: 'En revisión (Retenido)',
  transfer_pending: 'Enviando al trabajador',
  transfer_failed: 'Reintentando envío',
  transferred: 'Pagado al trabajador',
  partial_settlement_pending: 'Pago parcial en proceso',
  partial_settlement_failed: 'Pago parcial en reintento',
  partial_settlement_completed: 'Pago parcial entregado',
  refund_failed: 'Reembolso en reintento',
  refunded: 'Dinero devuelto a tu tarjeta',
  cancelled: 'Cancelado sin cobro',
};

export const APPLICATION_STATUS_LABELS: Record<ApplicationStatus, string> = {
  pending: 'Por revisar',
  accepted: 'Elegido',
  rejected: 'Descartado',
  withdrawn: 'Retirado',
  expired: 'Vencido',
};

export const CASE_STATUS_LABELS: Record<CaseStatus, string> = {
  open: 'Abierto',
  pending: 'Pendiente',
  in_review: 'En revisión',
  resolved: 'Resuelto',
  closed: 'Cerrado',
  dismissed: 'Cerrado',
  attended: 'Atendido',
};

export const CASE_TYPE_LABELS: Record<CaseType, string> = {
  claim: 'Reclamo de Trabajo o Pago',
  ticket: 'Consulta de Ayuda',
  report: 'Reporte de Seguridad',
};

export const TICKET_CATEGORY_LABELS: Record<TicketCategory, string> = {
  job: 'Problema con el trabajo o asistencia',
  payment: 'Problema con un pago o cobro',
  publication: 'Duda sobre mi anuncio',
  application: 'Duda sobre candidatos',
  account: 'Mi cuenta o contraseña',
  technical: 'Falla en la aplicación',
};

export const NOTIFICATION_TARGET_LABELS: Record<string, string> = {
  'UI-EMP-02': 'Mis Trabajos',
  'UI-EMP-03': 'Publicar Trabajo',
  'UI-EMP-04': 'Ver Candidatos',
  'UI-EMP-05': 'Ver Perfil del Candidato',
  'UI-EMP-06': 'Ver Trabajo Asignado',
  'UI-EMP-07': 'Ir a Pagar',
  'UI-EMP-08': 'Abrir Chat',
  'UI-EMP-09': 'Ver Código de Cierre',
  'UI-EMP-10': 'Pedir Ayuda',
  'UI-EMP-11': 'Calificar Trabajador',
  'UI-EMP-12': 'Ver Mis Pagos',
  'UI-EMP-13': 'Mi Perfil',
  'UI-EMP-14': 'Ver Mis Casos',
};

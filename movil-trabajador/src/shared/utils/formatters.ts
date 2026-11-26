/**
 * Utilidades de formato, cálculos geográficos Haversine y catálogos en español (MXN).
 */
import type {
  ApplicationStatus,
  CaseStatus,
  CaseType,
  DistanceRangeLabel,
  JobCategory,
  JobStatus,
  PaymentStatus,
  ReportTarget,
  TicketCategory,
} from '@/types/database';

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

export function formatSpanishDateTime(iso: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const datePart = formatSpanishDate(
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`,
  );
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${datePart} · ${hh}:${mm} hrs`;
}

export function formatTimeRange(startTime: string, endTime: string): string {
  return `${startTime.slice(0, 5)} - ${endTime.slice(0, 5)} hrs`;
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

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

export function formatPhoneInputMask(raw: string): string {
  return raw.replace(/[^0-9+ -]/g, '').slice(0, 20);
}

export function getOffsetDateYMD(offsetDays: number, baseDate = new Date()): string {
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

/**
 * Distancia en línea recta (fórmula de Haversine) en kilómetros.
 */
export function calculateHaversineKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Privacidad: convierte distancia exacta en rango estimado.
 * Nunca expone kilómetros numéricos exactos antes de la selección.
 */
export function formatDistanceRange(distanceKm: number): DistanceRangeLabel {
  if (distanceKm < 5) return 'Menos de 5 km';
  if (distanceKm < 10) return '5 a menos de 10 km';
  if (distanceKm < 25) return '10 a menos de 25 km';
  if (distanceKm <= 50) return '25 a 50 km';
  return 'Más de 50 km';
}

export function getInitials(name: string): string {
  const words = name
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (words.length === 0) return 'US';
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return `${words[0][0]}${words[1][0]}`.toUpperCase();
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
  has_applications: 'Con postulaciones',
  assigned: 'Asignado',
  arrival_registered: 'Llegada registrada',
  in_progress: 'En curso',
  completion_requested: 'Finalización solicitada',
  in_claim: 'En reclamación',
  completed: 'Finalizado',
  cancelled: 'Cancelado',
  expired: 'Vencido',
};

export const PAYMENT_STATUS_LABELS: Record<PaymentStatus, string> = {
  not_started: 'No iniciado',
  payment_pending: 'Pendiente de cobro',
  confirmed: 'Confirmado',
  failed: 'Fallido',
  in_claim: 'En reclamación',
  transfer_pending: 'Pendiente de transferencia',
  transfer_failed: 'Transferencia fallida',
  transferred: 'Transferido',
  partial_settlement_pending: 'Liquidación parcial pendiente',
  partial_settlement_failed: 'Liquidación parcial fallida',
  partial_settlement_completed: 'Liquidación parcial completada',
  refund_failed: 'Reembolso fallido',
  refunded: 'Reembolsado',
  cancelled: 'Cancelado',
};

export const APPLICATION_STATUS_LABELS: Record<ApplicationStatus, string> = {
  pending: 'Pendiente',
  accepted: 'Aceptada',
  rejected: 'Rechazada',
  withdrawn: 'Retirada',
  expired: 'Expirada',
};

export const CASE_STATUS_LABELS: Record<CaseStatus, string> = {
  open: 'Abierto',
  pending: 'Pendiente',
  in_review: 'En revisión',
  resolved: 'Resuelto',
  closed: 'Cerrado',
  dismissed: 'Desestimado',
  attended: 'Atendido',
};

export const CASE_TYPE_LABELS: Record<CaseType, string> = {
  ticket: 'Ticket de soporte',
  claim: 'Reclamación',
  report: 'Reporte',
};

export const TICKET_CATEGORY_LABELS: Record<TicketCategory, string> = {
  account: 'Cuenta',
  publication: 'Publicación',
  application: 'Postulación',
  job: 'Trabajo',
  payment: 'Pago',
  technical: 'Técnica',
};

export const REPORT_TARGET_LABELS: Record<ReportTarget, string> = {
  job: 'Publicación',
  application: 'Postulación',
  user: 'Cuenta',
  chat_message: 'Mensaje del chat',
  review: 'Reseña',
};

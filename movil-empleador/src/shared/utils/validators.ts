/**
 * Client-Side Validation Matrix (Zero-Guesswork Poka-Yoke for Non-Technical Users)
 * Source of Truth: AGENTS.md Section 6.1 & /docs/001_trabajos_temporales.sql
 */
import type { AttachmentKind, CaseType, JobCategory, TicketCategory } from '@/types/database';
import {
  calculateAgeYears,
  formatDateInputMask,
  normalizeTimeOnBlur,
} from './formatters';

export type FieldErrors<T extends string = string> = Partial<Record<T, string>>;

export const VALID_JOB_CATEGORIES: readonly JobCategory[] = [
  'limpieza',
  'pintura',
  'jardineria',
  'mudanzas',
  'eventos',
  'otros',
] as const;

export const VALID_TICKET_CATEGORIES: readonly TicketCategory[] = [
  'account',
  'publication',
  'application',
  'job',
  'payment',
  'technical',
] as const;

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const PHONE_REGEX = /^[0-9+() -]{8,20}$/;

export function validateFullName(value: string): string | null {
  const trimmed = value.trim();
  if (trimmed.length < 2 || trimmed.length > 150) {
    return 'Escribe tu nombre completo (al menos 2 letras).';
  }
  return null;
}

export function validateEmail(value: string): string | null {
  const trimmed = value.trim().toLowerCase();
  if (!trimmed || !EMAIL_REGEX.test(trimmed)) {
    return 'Escribe un correo válido (ejemplo: nombre@correo.com).';
  }
  return null;
}

export interface PasswordChecklist {
  minLength: boolean;
  hasUpper: boolean;
  hasLower: boolean;
  hasNumber: boolean;
}

export function getPasswordChecklist(value: string): PasswordChecklist {
  return {
    minLength: value.length >= 8,
    hasUpper: /[A-Z]/.test(value),
    hasLower: /[a-z]/.test(value),
    hasNumber: /[0-9]/.test(value),
  };
}

export function validatePassword(value: string): string | null {
  const check = getPasswordChecklist(value);
  if (!check.minLength || !check.hasUpper || !check.hasLower || !check.hasNumber) {
    return 'Tu contraseña necesita al menos 8 caracteres, una mayúscula, una minúscula y un número.';
  }
  return null;
}

export function getPasswordStrength(value: string): {
  level: 0 | 1 | 2 | 3 | 4;
  label: string;
} {
  if (!value) return { level: 0, label: 'Escribe tu contraseña' };
  const check = getPasswordChecklist(value);
  const score =
    (check.minLength ? 1 : 0) +
    (check.hasUpper ? 1 : 0) +
    (check.hasLower ? 1 : 0) +
    (check.hasNumber ? 1 : 0);
  const labels: Record<number, string> = {
    0: 'Faltan 4 requisitos',
    1: 'Faltan 3 requisitos',
    2: 'Faltan 2 requisitos',
    3: 'Falta 1 requisito',
    4: 'Contraseña lista y segura',
  };
  return { level: score as 0 | 1 | 2 | 3 | 4, label: labels[score] ?? 'Incompleta' };
}

export function validatePhone(value: string): string | null {
  const trimmed = value.trim();
  const digitCount = trimmed.replace(/\D/g, '').length;
  if (!PHONE_REGEX.test(trimmed) || digitCount < 8) {
    return 'Escribe un teléfono válido de al menos 10 números.';
  }
  return null;
}

export function validateBirthDateAdult(value: string, now = new Date()): string | null {
  const normalized = formatDateInputMask(value);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(normalized)) {
    return 'Escribe tu fecha con 4 números de año, 2 de mes y 2 de día (ejemplo: 1988-08-14).';
  }
  const age = calculateAgeYears(normalized, now);
  if (age < 0) {
    return 'Esa fecha no existe en el calendario. Revisa el mes y el día.';
  }
  if (age < 18) {
    return 'Debes tener 18 años o más para usar la aplicación.';
  }
  return null;
}

export function validateTermsAndPrivacy(terms: boolean, privacy: boolean): string | null {
  if (!terms || !privacy) {
    return 'Marca las dos casillas de Términos y Privacidad para crear tu cuenta.';
  }
  return null;
}

export interface RegisterFormInput {
  full_name: string;
  email: string;
  phone: string;
  birth_date: string;
  password: string;
  accept_terms: boolean;
  accept_privacy: boolean;
}

export function validateRegisterForm(
  input: RegisterFormInput,
  now = new Date(),
): FieldErrors<keyof RegisterFormInput> {
  const errors: FieldErrors<keyof RegisterFormInput> = {};
  const nameErr = validateFullName(input.full_name);
  if (nameErr) errors.full_name = nameErr;

  const emailErr = validateEmail(input.email);
  if (emailErr) errors.email = emailErr;

  const phoneErr = validatePhone(input.phone);
  if (phoneErr) errors.phone = phoneErr;

  const dobErr = validateBirthDateAdult(input.birth_date, now);
  if (dobErr) errors.birth_date = dobErr;

  const passErr = validatePassword(input.password);
  if (passErr) errors.password = passErr;

  const termsErr = validateTermsAndPrivacy(input.accept_terms, input.accept_privacy);
  if (termsErr) {
    errors.accept_terms = termsErr;
  }
  return errors;
}

export interface JobFormInput {
  title: string;
  description: string;
  category: JobCategory;
  fixed_payment_mxn: string;
  job_date: string;
  start_time: string;
  end_time: string;
  conditions: string;
  neighborhood: string;
  exact_address: string;
  exact_latitude: number;
  exact_longitude: number;
}

export function validateJobForm(
  input: JobFormInput,
  now = new Date(),
): FieldErrors<keyof JobFormInput> {
  const errors: FieldErrors<keyof JobFormInput> = {};

  const title = input.title.trim();
  if (title.length < 3 || title.length > 150) {
    errors.title = 'Escribe un título corto para el trabajo (mínimo 3 letras).';
  }

  const description = input.description.trim();
  if (description.length < 10) {
    errors.description = 'Explica brevemente qué se va a hacer (mínimo 10 letras).';
  }

  if (!VALID_JOB_CATEGORIES.includes(input.category)) {
    errors.category = 'Elige una categoría tocando uno de los botones.';
  }

  const paymentNum = Number(input.fixed_payment_mxn);
  if (
    !input.fixed_payment_mxn.trim() ||
    !Number.isFinite(paymentNum) ||
    paymentNum < 10 ||
    paymentNum > 100000
  ) {
    errors.fixed_payment_mxn =
      'Escribe un pago entre $10.00 y $100,000.00 MXN.';
  }

  const neighborhood = input.neighborhood.trim();
  if (neighborhood.length < 3 || neighborhood.length > 150) {
    errors.neighborhood = 'Escribe la colonia o zona del trabajo.';
  }

  const exactAddress = input.exact_address.trim();
  if (exactAddress.length < 3 || exactAddress.length > 150) {
    errors.exact_address = 'Escribe la calle, número y alguna referencia para llegar.';
  }

  if (
    !Number.isFinite(input.exact_latitude) ||
    input.exact_latitude < -90 ||
    input.exact_latitude > 90 ||
    !Number.isFinite(input.exact_longitude) ||
    input.exact_longitude < -180 ||
    input.exact_longitude > 180
  ) {
    errors.exact_latitude = 'Elige una zona de referencia en el mapa.';
  }

  // Separate Date, Start Time, and End Time validation for clear Poka-Yoke feedback (`PY-SYS-04`)
  const normalizedDate = formatDateInputMask(input.job_date.trim());
  const normalizedStart = normalizeTimeOnBlur(input.start_time.trim());
  const normalizedEnd = normalizeTimeOnBlur(input.end_time.trim());

  const dateMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(normalizedDate);
  const startMatch = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(normalizedStart);
  const endMatch = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(normalizedEnd);

  if (!dateMatch) {
    errors.job_date = 'Elige un día en los botones rápidos o escribe Año-Mes-Día.';
  }
  if (!startMatch) {
    errors.start_time = 'Escribe la hora de entrada (ejemplo: 09:00).';
  }
  if (!endMatch) {
    errors.end_time = 'Escribe la hora de salida (ejemplo: 14:00).';
  }

  if (dateMatch && startMatch && endMatch) {
    const startMinutes = parseInt(startMatch[1], 10) * 60 + parseInt(startMatch[2], 10);
    const endMinutes = parseInt(endMatch[1], 10) * 60 + parseInt(endMatch[2], 10);

    const startDate = new Date(
      parseInt(dateMatch[1], 10),
      parseInt(dateMatch[2], 10) - 1,
      parseInt(dateMatch[3], 10),
      parseInt(startMatch[1], 10),
      parseInt(startMatch[2], 10),
      0,
    );

    if (startDate.getTime() <= now.getTime()) {
      errors.job_date = 'La fecha y hora de inicio deben ser posteriores al momento actual.';
    }
    if (endMinutes <= startMinutes) {
      errors.end_time = 'La hora de salida debe ser después de la hora de entrada.';
    }
  }

  return errors;
}

export function validateChatMessageBody(body: string): string | null {
  const trimmed = body.trim();
  if (trimmed.length < 1) {
    return 'Escribe un mensaje antes de tocar Enviar.';
  }
  if (trimmed.length > 2000) {
    return 'Tu mensaje es muy largo (máximo 2,000 letras).';
  }
  return null;
}

export function validateCaseMessageBody(body: string): string | null {
  const trimmed = body.trim();
  if (trimmed.length < 1) {
    return 'Escribe una explicación antes de enviar.';
  }
  if (trimmed.length > 4000) {
    return 'El texto es demasiado largo (máximo 4,000 letras).';
  }
  return null;
}

export interface OpenCaseFormInput {
  case_type: CaseType;
  job_id: string | null;
  ticket_category: TicketCategory | null;
  description: string;
}

export function validateOpenCaseForm(
  input: OpenCaseFormInput,
): FieldErrors<keyof OpenCaseFormInput> {
  const errors: FieldErrors<keyof OpenCaseFormInput> = {};

  if (input.case_type === 'claim' && !input.job_id) {
    errors.job_id = 'Toca el trabajo con el que tuviste el problema.';
  }
  if (
    input.case_type === 'ticket' &&
    (!input.ticket_category || !VALID_TICKET_CATEGORIES.includes(input.ticket_category))
  ) {
    errors.ticket_category = 'Elige el tema de tu consulta.';
  }

  const msgErr = validateCaseMessageBody(input.description);
  if (msgErr) {
    errors.description = msgErr;
  }

  return errors;
}

export function validateReviewInput(
  rating: number,
  comment: string,
  selectedTags: string[] = [],
): string | null {
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    return 'Elige una calificación del 1 al 5.';
  }
  const effectiveText =
    selectedTags.length > 0
      ? `[Aspectos: ${selectedTags.join(', ')}] ${comment.trim()}`.trim()
      : comment.trim();
  if (effectiveText.length < 10) {
    return 'Elige al menos un aspecto destacado arriba o escribe un comentario corto (10 letras o más).';
  }
  if (comment.trim().length > 500) {
    return 'Tu comentario no puede pasar de 500 letras.';
  }
  return null;
}

export interface CandidateAttachmentFile {
  file_name: string;
  mime_type: string;
  size_bytes: number;
}

export function validateAttachmentCandidate(
  file: CandidateAttachmentFile,
  kind: AttachmentKind,
  existingCount: number,
): string | null {
  if (existingCount >= 5) {
    return 'Ya agregaste el máximo de 5 archivos. Borra uno si deseas cambiarlo.';
  }
  if (
    file.file_name.includes('..') ||
    file.file_name.includes('/') ||
    file.file_name.includes('\\') ||
    /\.(svg|html|htm|js|exe|sh|php)$/i.test(file.file_name.trim())
  ) {
    return 'Nombre de archivo no permitido. Elige una foto JPG, PNG o un documento PDF.';
  }

  if (file.size_bytes <= 0 || file.size_bytes > 10_485_760) {
    return 'Este archivo pesa más de 10 MB. Elige una foto o archivo más ligero.';
  }

  const allowedMimes =
    kind === 'job_photo'
      ? ['image/jpeg', 'image/png']
      : ['image/jpeg', 'image/png', 'application/pdf'];

  if (!allowedMimes.includes(file.mime_type)) {
    return kind === 'job_photo'
      ? 'Solo se permiten fotos en formato JPG o PNG.'
      : 'Solo se permiten fotos (JPG, PNG) o archivos PDF.';
  }

  return null;
}

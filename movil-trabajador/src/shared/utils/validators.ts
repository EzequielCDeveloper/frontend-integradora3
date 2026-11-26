/**
 * Validaciones del lado del cliente — Aplicación Móvil del Trabajador
 */
import type { AttachmentKind, CaseType, JobCategory, TicketCategory } from '@/types/database';
import { calculateAgeYears, formatDateInputMask } from './formatters';

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
    return 'Escribe tu nombre completo (al menos 2 caracteres).';
  }
  return null;
}

export function validateEmail(value: string): string | null {
  const trimmed = value.trim().toLowerCase();
  if (!trimmed || !EMAIL_REGEX.test(trimmed)) {
    return 'Ingresa un correo electrónico válido (ejemplo: nombre@correo.mx).';
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
    return 'La contraseña debe tener mínimo 8 caracteres e incluir mayúscula, minúscula y número.';
  }
  return null;
}

export function getPasswordStrength(value: string): {
  level: 0 | 1 | 2 | 3 | 4;
  label: string;
} {
  if (!value) return { level: 0, label: 'Ingresa una contraseña' };
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
    4: 'Contraseña válida y segura',
  };
  return { level: score as 0 | 1 | 2 | 3 | 4, label: labels[score] ?? 'Incompleta' };
}

export function validatePhone(value: string): string | null {
  const trimmed = value.trim();
  const digitCount = trimmed.replace(/\D/g, '').length;
  if (!PHONE_REGEX.test(trimmed) || digitCount < 10) {
    return 'Ingresa un número de teléfono válido de al menos 10 dígitos.';
  }
  return null;
}

export function validateBirthDateAdult(value: string, now = new Date()): string | null {
  const normalized = formatDateInputMask(value);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(normalized)) {
    return 'Escribe tu fecha de nacimiento en formato AAAA-MM-DD (ejemplo: 1995-04-22).';
  }
  const age = calculateAgeYears(normalized, now);
  if (age < 0) {
    return 'La fecha ingresada no es válida. Verifica el mes y el día.';
  }
  if (age < 18) {
    return 'Debes tener al menos 18 años para registrarte como trabajador.';
  }
  return null;
}

export function validateTermsAndPrivacy(terms: boolean, privacy: boolean): string | null {
  if (!terms || !privacy) {
    return 'Debes aceptar los Términos de Uso y el Aviso de Privacidad para continuar.';
  }
  return null;
}

export function validateWorkerBioField(value: string, fieldName: string): string | null {
  if (value.trim().length > 300) {
    return `${fieldName} no puede exceder los 300 caracteres.`;
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
  if (termsErr) errors.accept_terms = termsErr;

  return errors;
}

export function validateCompletionCodeFormat(code: string): string | null {
  const cleaned = code.trim();
  if (!/^\d{6}$/.test(cleaned)) {
    return 'El código debe contener exactamente 6 dígitos numéricos.';
  }
  return null;
}

export function validateChatMessageBody(body: string): string | null {
  const trimmed = body.trim();
  if (trimmed.length < 1) {
    return 'Escribe un mensaje antes de enviar.';
  }
  if (trimmed.length > 2000) {
    return 'El mensaje no puede superar los 2,000 caracteres.';
  }
  return null;
}

export function validateCaseMessageBody(body: string): string | null {
  const trimmed = body.trim();
  if (trimmed.length < 10) {
    return 'Describe la situación con al menos 10 caracteres.';
  }
  if (trimmed.length > 4000) {
    return 'La descripción no puede superar los 4,000 caracteres.';
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
    errors.job_id = 'Selecciona el trabajo relacionado con tu reclamación.';
  }
  if (
    input.case_type === 'ticket' &&
    (!input.ticket_category || !VALID_TICKET_CATEGORIES.includes(input.ticket_category))
  ) {
    errors.ticket_category = 'Selecciona la categoría de tu ticket.';
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
): string | null {
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    return 'Selecciona una calificación de 1 a 5 estrellas.';
  }
  if (comment.trim().length < 5) {
    return 'Escribe un breve comentario sobre tu experiencia (mínimo 5 caracteres).';
  }
  if (comment.trim().length > 500) {
    return 'El comentario no puede exceder los 500 caracteres.';
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
    return 'Has alcanzado el máximo de 5 archivos permitidos.';
  }
  if (
    file.file_name.includes('..') ||
    file.file_name.includes('/') ||
    file.file_name.includes('\\') ||
    /\.(svg|html|htm|js|exe|sh|php)$/i.test(file.file_name.trim())
  ) {
    return 'Tipo de archivo no permitido. Usa únicamente JPG, PNG o PDF.';
  }

  if (file.size_bytes <= 0 || file.size_bytes > 10_485_760) {
    return 'Cada archivo debe pesar máximo 10 MB.';
  }

  const allowedMimes =
    kind === 'job_photo'
      ? ['image/jpeg', 'image/png']
      : ['image/jpeg', 'image/png', 'application/pdf'];

  if (!allowedMimes.includes(file.mime_type)) {
    return kind === 'job_photo'
      ? 'Solo se permiten imágenes JPG o PNG.'
      : 'Solo se permiten archivos JPG, PNG o PDF.';
  }

  return null;
}

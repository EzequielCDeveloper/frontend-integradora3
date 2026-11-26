/**
 * Exhaustive Domain Error Code Dictionary & Mapper (Plain Spanish for Non-Technical Users)
 * Source of Truth: AGENTS.md Section 6.2 & /docs/001_trabajos_temporales.sql
 */

export type DomainErrorCode =
  | 'ERR_NOT_AUTHENTICATED'
  | 'ERR_NO_PROFILE'
  | 'ERR_ACCOUNT_RESTRICTED'
  | 'ERR_FORBIDDEN'
  | 'ERR_UNDERAGE'
  | 'ERR_INVALID_ROLE'
  | 'ERR_INVALID_PHONE'
  | 'ERR_INVALID_NAME'
  | 'ERR_PROFILE_EXISTS'
  | 'ERR_INVALID_CREDENTIALS'
  | 'ERR_EMAIL_NOT_VERIFIED'
  | 'ERR_NO_REFERENCE_POINT'
  | 'ERR_LOCATION_LIMIT'
  | 'ERR_DATE_IN_PAST'
  | 'ERR_NEIGHBORHOOD_REQUIRED'
  | 'ERR_JOB_NOT_EDITABLE'
  | 'ERR_USE_CASE_INSTEAD'
  | 'ERR_JOB_NOT_AVAILABLE'
  | 'ERR_JOB_NOT_SELECTABLE'
  | 'ERR_ALREADY_APPLIED'
  | 'ERR_NOT_PENDING'
  | 'ERR_SELECTION_EXPIRED'
  | 'ERR_OUTSIDE_ARRIVAL_WINDOW'
  | 'ERR_CONDITIONS_NOT_ACCEPTED'
  | 'ERR_STRIPE_ONBOARDING_INCOMPLETE'
  | 'ERR_CODE_STILL_VALID'
  | 'ERR_ATTACHMENT_LIMIT'
  | 'ERR_INVALID_ATTACHMENT'
  | 'ERR_DECISION_REQUIRED'
  | 'ERR_DECISION_AMOUNTS'
  | 'ERR_INVALID_TRANSITION'
  | 'ERR_INVALID_STATE'
  | 'ERR_NOT_AVAILABLE'
  | 'ERR_NOT_FOUND'
  | 'ERR_PAYMENT_WINDOW_EXPIRED'
  | 'ERR_PAYMENT_ATTEMPTS_EXCEEDED'
  | 'ERR_PAYMENT_DECLINED'
  | 'ERR_OBJECTION_WINDOW_EXPIRED'
  | 'ERR_CLAIM_ALREADY_OPEN'
  | 'ERR_ALREADY_REVIEWED'
  | 'ERR_NETWORK';

export class DomainError extends Error {
  public readonly code: DomainErrorCode;

  constructor(code: DomainErrorCode, customMessage?: string) {
    super(customMessage ?? DOMAIN_ERROR_MESSAGES[code] ?? code);
    this.name = 'DomainError';
    this.code = code;
  }
}

export const DOMAIN_ERROR_MESSAGES: Record<DomainErrorCode, string> = {
  ERR_NOT_AUTHENTICATED: 'Tu sesión terminó. Por favor vuelve a entrar con tu correo.',
  ERR_NO_PROFILE: 'Completa tus datos básicos para continuar.',
  ERR_ACCOUNT_RESTRICTED:
    'Tu cuenta está pausada temporalmente. Revisa tus avisos o pide ayuda en la sección Casos.',
  ERR_FORBIDDEN: 'No tienes permiso para realizar esta acción.',
  ERR_UNDERAGE: 'Debes tener 18 años o más para usar la aplicación.',
  ERR_INVALID_ROLE: 'Esta aplicación es exclusiva para empleadores que publican trabajos.',
  ERR_INVALID_PHONE: 'Escribe un número de teléfono válido de al menos 10 dígitos.',
  ERR_INVALID_NAME: 'Escribe tu nombre completo.',
  ERR_PROFILE_EXISTS: 'Este correo ya está registrado. Usa la pestaña Entrar.',
  ERR_INVALID_CREDENTIALS: 'El correo o la contraseña no coinciden. Revísalos e intenta de nuevo.',
  ERR_EMAIL_NOT_VERIFIED: 'Primero confirma tu correo electrónico con el mensaje que te enviamos.',
  ERR_NO_REFERENCE_POINT:
    'Elige primero un punto en el mapa para ubicar el trabajo.',
  ERR_LOCATION_LIMIT:
    'Ya cambiaste tu ubicación 3 veces hoy. Podrás cambiarla de nuevo mañana.',
  ERR_DATE_IN_PAST: 'La fecha u hora elegida ya pasó. Elige un horario futuro.',
  ERR_NEIGHBORHOOD_REQUIRED: 'Escribe la colonia o zona del trabajo.',
  ERR_JOB_NOT_EDITABLE:
    'Ya no puedes modificar este anuncio porque ya elegiste a un trabajador o el trabajo terminó.',
  ERR_USE_CASE_INSTEAD:
    'Como ya elegiste a un trabajador, usa el botón "Pedir ayuda o abrir reclamo" para cancelar.',
  ERR_JOB_NOT_AVAILABLE: 'Este trabajo ya no está disponible.',
  ERR_JOB_NOT_SELECTABLE: 'Este trabajo ya no permite elegir candidatos.',
  ERR_ALREADY_APPLIED: 'Esta persona ya se había postulado a este trabajo.',
  ERR_NOT_PENDING: 'El estado de este candidato cambió recientemente.',
  ERR_SELECTION_EXPIRED: 'Pasaron las 24 horas para confirmar. Puedes elegir a otro candidato.',
  ERR_OUTSIDE_ARRIVAL_WINDOW:
    'El trabajador solo puede registrar su llegada desde 30 minutos antes de la hora de inicio.',
  ERR_CONDITIONS_NOT_ACCEPTED:
    'Tanto tú como el trabajador deben tocar "Aceptar condiciones" antes de iniciar.',
  ERR_STRIPE_ONBOARDING_INCOMPLETE:
    'El trabajador aún está terminando de registrar su cuenta bancaria para recibir pagos.',
  ERR_CODE_STILL_VALID: 'El código de 6 números todavía sirve y tiene intentos disponibles.',
  ERR_ATTACHMENT_LIMIT: 'Solo puedes subir hasta 5 fotos o archivos.',
  ERR_INVALID_ATTACHMENT:
    'Puedes subir máximo 5 archivos de hasta 10 MB cada uno (fotos JPG/PNG o PDF).',
  ERR_DECISION_REQUIRED: 'Los montos no coinciden con el dinero guardado del trabajo.',
  ERR_DECISION_AMOUNTS: 'Los montos no coinciden con el dinero guardado del trabajo.',
  ERR_INVALID_TRANSITION:
    'Este paso aún no corresponde al estado actual del trabajo. Actualizando pantalla...',
  ERR_INVALID_STATE:
    'Este paso aún no corresponde al estado actual del trabajo. Actualizando pantalla...',
  ERR_NOT_AVAILABLE:
    'El teléfono y dirección exacta se muestran en cuanto eliges al trabajador.',
  ERR_NOT_FOUND: 'No encontramos la información solicitada.',
  ERR_PAYMENT_WINDOW_EXPIRED:
    'Pasaron los 30 minutos para realizar el pago y el trabajo se canceló automáticamente.',
  ERR_PAYMENT_ATTEMPTS_EXCEEDED:
    'Se rechazó la tarjeta 3 veces seguidas. Por seguridad el trabajo fue cancelado.',
  ERR_PAYMENT_DECLINED:
    'Tu banco rechazó la tarjeta. Elige otra tarjeta e intenta de nuevo.',
  ERR_OBJECTION_WINDOW_EXPIRED:
    'Pasaron los 7 días para responder a la resolución y el caso quedó cerrado.',
  ERR_CLAIM_ALREADY_OPEN: 'Ya tienes un reclamo abierto para este trabajo.',
  ERR_ALREADY_REVIEWED: 'Ya enviaste tu calificación para este trabajador.',
  ERR_NETWORK: 'No pudimos conectar. Revisa tu internet e intenta otra vez.',
};

export interface MappedUIError {
  code: DomainErrorCode;
  message: string;
  requiresLoginRedirect: boolean;
  requiresCaseRedirect: boolean;
  isAccountRestricted: boolean;
}

export function mapDomainErrorToUI(error: unknown): MappedUIError {
  if (error instanceof DomainError) {
    return {
      code: error.code,
      message: DOMAIN_ERROR_MESSAGES[error.code] ?? error.message,
      requiresLoginRedirect: error.code === 'ERR_NOT_AUTHENTICATED',
      requiresCaseRedirect: error.code === 'ERR_USE_CASE_INSTEAD',
      isAccountRestricted: error.code === 'ERR_ACCOUNT_RESTRICTED',
    };
  }

  if (error instanceof Error) {
    const knownCode = (Object.keys(DOMAIN_ERROR_MESSAGES) as DomainErrorCode[]).find((code) =>
      error.message.includes(code),
    );
    if (knownCode) {
      return {
        code: knownCode,
        message: DOMAIN_ERROR_MESSAGES[knownCode],
        requiresLoginRedirect: knownCode === 'ERR_NOT_AUTHENTICATED',
        requiresCaseRedirect: knownCode === 'ERR_USE_CASE_INSTEAD',
        isAccountRestricted: knownCode === 'ERR_ACCOUNT_RESTRICTED',
      };
    }
  }

  return {
    code: 'ERR_NETWORK',
    message: DOMAIN_ERROR_MESSAGES.ERR_NETWORK,
    requiresLoginRedirect: false,
    requiresCaseRedirect: false,
    isAccountRestricted: false,
  };
}

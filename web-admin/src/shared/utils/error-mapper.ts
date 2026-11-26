export type DomainErrorCode =
  | 'ERR_NOT_AUTHENTICATED'
  | 'ERR_INVALID_CREDENTIALS'
  | 'ERR_FORBIDDEN'
  | 'ERR_ACCOUNT_RESTRICTED'
  | 'ERR_NOT_FOUND'
  | 'ERR_INVALID_TRANSITION'
  | 'ERR_DECISION_REQUIRED'
  | 'ERR_DECISION_AMOUNTS'
  | 'ERR_REASON_REQUIRED'
  | 'ERR_CHAT_RLS_UNASSIGNED'
  | 'ERR_ATTACHMENT_LIMIT'
  | 'ERR_ATTACHMENT_INVALID'
  | 'ERR_MAX_ATTEMPTS'
  | 'ERR_CONFLICT'
  | 'ERR_VALIDATION'
  | 'ERR_NETWORK'
  | 'ERR_UNKNOWN'

export class DomainError extends Error {
  readonly code: DomainErrorCode
  readonly details?: string

  constructor(code: DomainErrorCode, message?: string, details?: string) {
    super(message ?? DOMAIN_ERROR_MESSAGES[code])
    this.name = 'DomainError'
    this.code = code
    this.details = details
  }
}

export const DOMAIN_ERROR_MESSAGES: Record<DomainErrorCode, string> = {
  ERR_NOT_AUTHENTICATED:
    'Tu sesión se cerró por seguridad. Vuelve a iniciar sesión para continuar.',
  ERR_INVALID_CREDENTIALS:
    'El correo o la contraseña no coinciden. Revísalos e inténtalo de nuevo.',
  ERR_FORBIDDEN:
    'Esta cuenta no tiene permiso de administrador para entrar o realizar esta acción.',
  ERR_ACCOUNT_RESTRICTED:
    'Tu cuenta administrativa está suspendida o desactivada. Contacta al responsable del sistema.',
  ERR_NOT_FOUND: 'No encontramos el registro que buscas. Es posible que ya no esté disponible.',
  ERR_INVALID_TRANSITION:
    'Este cambio de estado no está permitido en la etapa actual del caso.',
  ERR_DECISION_REQUIRED:
    'Elige una decisión y escribe la explicación antes de resolver la reclamación.',
  ERR_DECISION_AMOUNTS:
    'Los montos no cuadran: al dividir el pago, ambos montos deben ser mayores a $0.00 y sumar exactamente el total cobrado.',
  ERR_REASON_REQUIRED:
    'Debes escribir el motivo de esta acción para que quede guardado en el historial.',
  ERR_CHAT_RLS_UNASSIGNED:
    'Por privacidad, primero debes asignarte esta reclamación para poder leer la conversación entre las partes.',
  ERR_ATTACHMENT_LIMIT:
    'Ya alcanzaste el máximo de 5 archivos adjuntos permitidos en este caso.',
  ERR_ATTACHMENT_INVALID:
    'Archivo no permitido. Solo puedes subir imágenes (JPG o PNG) o documentos PDF de máximo 10 MB.',
  ERR_MAX_ATTEMPTS:
    'Este pago ya alcanzó el máximo de 5 reintentos permitidos.',
  ERR_CONFLICT:
    'Esta acción ya se había realizado hace un momento. Actualiza la pantalla para ver el estado más reciente.',
  ERR_VALIDATION:
    'Hay datos incompletos o incorrectos en el formulario. Revisa los campos marcados en rojo.',
  ERR_NETWORK:
    'No fue posible conectar con el servicio. Revisa tu conexión a internet e intenta de nuevo.',
  ERR_UNKNOWN:
    'Ocurrió un problema inesperado. Intenta de nuevo en unos segundos.',
}

export interface UIErrorResult {
  code: DomainErrorCode
  title: string
  message: string
  shouldLogout: boolean
  retryable: boolean
}

export function mapDomainErrorToUI(error: unknown): UIErrorResult {
  if (error instanceof DomainError) {
    const shouldLogout =
      error.code === 'ERR_NOT_AUTHENTICATED' ||
      error.code === 'ERR_ACCOUNT_RESTRICTED'
    const retryable =
      error.code === 'ERR_NETWORK' || error.code === 'ERR_UNKNOWN'
    return {
      code: error.code,
      title: shouldLogout ? 'Acceso restringido' : 'No se pudo completar la acción',
      message: error.message || DOMAIN_ERROR_MESSAGES[error.code],
      shouldLogout,
      retryable,
    }
  }

  if (error instanceof Error && /network|fetch|timeout/i.test(error.message)) {
    return {
      code: 'ERR_NETWORK',
      title: 'Sin conexión',
      message: DOMAIN_ERROR_MESSAGES.ERR_NETWORK,
      shouldLogout: false,
      retryable: true,
    }
  }

  return {
    code: 'ERR_UNKNOWN',
    title: 'Ocurrió un problema',
    message: DOMAIN_ERROR_MESSAGES.ERR_UNKNOWN,
    shouldLogout: false,
    retryable: true,
  }
}

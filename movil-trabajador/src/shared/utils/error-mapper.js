"use strict";
/**
 * Catálogo de errores de dominio en español claro — App Trabajador
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.DOMAIN_ERROR_MESSAGES = exports.DomainError = void 0;
exports.mapDomainErrorToMessage = mapDomainErrorToMessage;
class DomainError extends Error {
    constructor(code, customMessage) {
        super(customMessage ?? exports.DOMAIN_ERROR_MESSAGES[code] ?? code);
        this.name = 'DomainError';
        this.code = code;
    }
}
exports.DomainError = DomainError;
exports.DOMAIN_ERROR_MESSAGES = {
    ERR_NOT_AUTHENTICATED: 'Tu sesión expiró. Inicia sesión nuevamente.',
    ERR_FORBIDDEN: 'No tienes permiso para realizar esta acción.',
    ERR_UNDERAGE: 'Debes tener al menos 18 años para registrarte.',
    ERR_INVALID_ROLE: 'Esta aplicación es exclusiva para trabajadores.',
    ERR_PROFILE_EXISTS: 'Este correo ya está registrado. Inicia sesión con tu cuenta.',
    ERR_INVALID_CREDENTIALS: 'El correo o la contraseña son incorrectos.',
    ERR_LOCATION_LIMIT: 'Has alcanzado el máximo de 3 cambios de ubicación en las últimas 24 horas.',
    ERR_JOB_NOT_AVAILABLE: 'Esta oportunidad ya no está disponible para postulación.',
    ERR_ALREADY_APPLIED: 'Ya te postulaste anteriormente a esta oportunidad.',
    ERR_NOT_PENDING: 'Solo puedes retirar postulaciones que estén en estado pendiente.',
    ERR_OUTSIDE_ARRIVAL_WINDOW: 'El registro de llegada solo está disponible desde 30 minutos antes de la hora de inicio hasta la hora de finalización.',
    ERR_CONDITIONS_NOT_ACCEPTED: 'Ambas partes deben aceptar las condiciones del trabajo antes de registrar la llegada.',
    ERR_STRIPE_ONBOARDING_INCOMPLETE: 'Completa el alta de tu cuenta conectada para poder registrar tu llegada.',
    ERR_CODE_INVALID: 'El código ingresado no coincide. Verifica con el empleador.',
    ERR_CODE_BLOCKED: 'El código quedó bloqueado tras 5 intentos fallidos. Utiliza la finalización sin código.',
    ERR_CODE_EXPIRED: 'El código venció tras 24 horas. Puedes solicitar un único código de reemplazo.',
    ERR_CODE_RENEWAL_LIMIT: 'Ya solicitaste el reemplazo de código permitido para este trabajo.',
    ERR_ATTACHMENT_LIMIT: 'Puedes adjuntar un máximo de 5 archivos.',
    ERR_INVALID_ATTACHMENT: 'Solo se admiten archivos JPG, PNG o PDF de máximo 10 MB cada uno.',
    ERR_INVALID_TRANSITION: 'Esta acción no corresponde al estado actual del trabajo.',
    ERR_NOT_FOUND: 'No se encontró la información solicitada.',
    ERR_CLAIM_ALREADY_OPEN: 'Ya existe una reclamación abierta para este trabajo.',
    ERR_ALREADY_REVIEWED: 'Ya enviaste tu evaluación para este empleador en este trabajo.',
    ERR_OBJECTION_WINDOW_EXPIRED: 'El plazo de 7 días para objetar esta resolución ha finalizado.',
    ERR_VALIDATION: 'Revisa los campos del formulario antes de continuar.',
};
function mapDomainErrorToMessage(error) {
    if (error instanceof DomainError) {
        return error.message;
    }
    if (error instanceof Error) {
        return error.message;
    }
    return 'Ocurrió un inconveniente inesperado. Intenta nuevamente.';
}

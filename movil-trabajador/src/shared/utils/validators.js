"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.VALID_TICKET_CATEGORIES = exports.VALID_JOB_CATEGORIES = void 0;
exports.validateFullName = validateFullName;
exports.validateEmail = validateEmail;
exports.getPasswordChecklist = getPasswordChecklist;
exports.validatePassword = validatePassword;
exports.getPasswordStrength = getPasswordStrength;
exports.validatePhone = validatePhone;
exports.validateBirthDateAdult = validateBirthDateAdult;
exports.validateTermsAndPrivacy = validateTermsAndPrivacy;
exports.validateWorkerBioField = validateWorkerBioField;
exports.validateRegisterForm = validateRegisterForm;
exports.validateCompletionCodeFormat = validateCompletionCodeFormat;
exports.validateChatMessageBody = validateChatMessageBody;
exports.validateCaseMessageBody = validateCaseMessageBody;
exports.validateOpenCaseForm = validateOpenCaseForm;
exports.validateReviewInput = validateReviewInput;
exports.validateAttachmentCandidate = validateAttachmentCandidate;
const formatters_1 = require("./formatters");
exports.VALID_JOB_CATEGORIES = [
    'limpieza',
    'pintura',
    'jardineria',
    'mudanzas',
    'eventos',
    'otros',
];
exports.VALID_TICKET_CATEGORIES = [
    'account',
    'publication',
    'application',
    'job',
    'payment',
    'technical',
];
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const PHONE_REGEX = /^[0-9+() -]{8,20}$/;
function validateFullName(value) {
    const trimmed = value.trim();
    if (trimmed.length < 2 || trimmed.length > 150) {
        return 'Escribe tu nombre completo (al menos 2 caracteres).';
    }
    return null;
}
function validateEmail(value) {
    const trimmed = value.trim().toLowerCase();
    if (!trimmed || !EMAIL_REGEX.test(trimmed)) {
        return 'Ingresa un correo electrónico válido (ejemplo: nombre@correo.mx).';
    }
    return null;
}
function getPasswordChecklist(value) {
    return {
        minLength: value.length >= 8,
        hasUpper: /[A-Z]/.test(value),
        hasLower: /[a-z]/.test(value),
        hasNumber: /[0-9]/.test(value),
    };
}
function validatePassword(value) {
    const check = getPasswordChecklist(value);
    if (!check.minLength || !check.hasUpper || !check.hasLower || !check.hasNumber) {
        return 'La contraseña debe tener mínimo 8 caracteres e incluir mayúscula, minúscula y número.';
    }
    return null;
}
function getPasswordStrength(value) {
    if (!value)
        return { level: 0, label: 'Ingresa una contraseña' };
    const check = getPasswordChecklist(value);
    const score = (check.minLength ? 1 : 0) +
        (check.hasUpper ? 1 : 0) +
        (check.hasLower ? 1 : 0) +
        (check.hasNumber ? 1 : 0);
    const labels = {
        0: 'Faltan 4 requisitos',
        1: 'Faltan 3 requisitos',
        2: 'Faltan 2 requisitos',
        3: 'Falta 1 requisito',
        4: 'Contraseña válida y segura',
    };
    return { level: score, label: labels[score] ?? 'Incompleta' };
}
function validatePhone(value) {
    const trimmed = value.trim();
    const digitCount = trimmed.replace(/\D/g, '').length;
    if (!PHONE_REGEX.test(trimmed) || digitCount < 10) {
        return 'Ingresa un número de teléfono válido de al menos 10 dígitos.';
    }
    return null;
}
function validateBirthDateAdult(value, now = new Date()) {
    const normalized = (0, formatters_1.formatDateInputMask)(value);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(normalized)) {
        return 'Escribe tu fecha de nacimiento en formato AAAA-MM-DD (ejemplo: 1995-04-22).';
    }
    const age = (0, formatters_1.calculateAgeYears)(normalized, now);
    if (age < 0) {
        return 'La fecha ingresada no es válida. Verifica el mes y el día.';
    }
    if (age < 18) {
        return 'Debes tener al menos 18 años para registrarte como trabajador.';
    }
    return null;
}
function validateTermsAndPrivacy(terms, privacy) {
    if (!terms || !privacy) {
        return 'Debes aceptar los Términos de Uso y el Aviso de Privacidad para continuar.';
    }
    return null;
}
function validateWorkerBioField(value, fieldName) {
    if (value.trim().length > 300) {
        return `${fieldName} no puede exceder los 300 caracteres.`;
    }
    return null;
}
function validateRegisterForm(input, now = new Date()) {
    const errors = {};
    const nameErr = validateFullName(input.full_name);
    if (nameErr)
        errors.full_name = nameErr;
    const emailErr = validateEmail(input.email);
    if (emailErr)
        errors.email = emailErr;
    const phoneErr = validatePhone(input.phone);
    if (phoneErr)
        errors.phone = phoneErr;
    const dobErr = validateBirthDateAdult(input.birth_date, now);
    if (dobErr)
        errors.birth_date = dobErr;
    const passErr = validatePassword(input.password);
    if (passErr)
        errors.password = passErr;
    const termsErr = validateTermsAndPrivacy(input.accept_terms, input.accept_privacy);
    if (termsErr)
        errors.accept_terms = termsErr;
    return errors;
}
function validateCompletionCodeFormat(code) {
    const cleaned = code.trim();
    if (!/^\d{6}$/.test(cleaned)) {
        return 'El código debe contener exactamente 6 dígitos numéricos.';
    }
    return null;
}
function validateChatMessageBody(body) {
    const trimmed = body.trim();
    if (trimmed.length < 1) {
        return 'Escribe un mensaje antes de enviar.';
    }
    if (trimmed.length > 2000) {
        return 'El mensaje no puede superar los 2,000 caracteres.';
    }
    return null;
}
function validateCaseMessageBody(body) {
    const trimmed = body.trim();
    if (trimmed.length < 10) {
        return 'Describe la situación con al menos 10 caracteres.';
    }
    if (trimmed.length > 4000) {
        return 'La descripción no puede superar los 4,000 caracteres.';
    }
    return null;
}
function validateOpenCaseForm(input) {
    const errors = {};
    if (input.case_type === 'claim' && !input.job_id) {
        errors.job_id = 'Selecciona el trabajo relacionado con tu reclamación.';
    }
    if (input.case_type === 'ticket' &&
        (!input.ticket_category || !exports.VALID_TICKET_CATEGORIES.includes(input.ticket_category))) {
        errors.ticket_category = 'Selecciona la categoría de tu ticket.';
    }
    const msgErr = validateCaseMessageBody(input.description);
    if (msgErr) {
        errors.description = msgErr;
    }
    return errors;
}
function validateReviewInput(rating, comment) {
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
function validateAttachmentCandidate(file, kind, existingCount) {
    if (existingCount >= 5) {
        return 'Has alcanzado el máximo de 5 archivos permitidos.';
    }
    if (file.file_name.includes('..') ||
        file.file_name.includes('/') ||
        file.file_name.includes('\\') ||
        /\.(svg|html|htm|js|exe|sh|php)$/i.test(file.file_name.trim())) {
        return 'Tipo de archivo no permitido. Usa únicamente JPG, PNG o PDF.';
    }
    if (file.size_bytes <= 0 || file.size_bytes > 10485760) {
        return 'Cada archivo debe pesar máximo 10 MB.';
    }
    const allowedMimes = kind === 'job_photo'
        ? ['image/jpeg', 'image/png']
        : ['image/jpeg', 'image/png', 'application/pdf'];
    if (!allowedMimes.includes(file.mime_type)) {
        return kind === 'job_photo'
            ? 'Solo se permiten imágenes JPG o PNG.'
            : 'Solo se permiten archivos JPG, PNG o PDF.';
    }
    return null;
}

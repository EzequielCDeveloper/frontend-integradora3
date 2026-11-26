"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.runWorkerValidationSuite = runWorkerValidationSuite;
/**
 * Suite de validación integral — Aplicación Móvil del Trabajador
 * Verifica los 22 escenarios críticos de negocio, validaciones y privacidad.
 */
const worker_store_1 = require("@/services/worker-store");
const formatters_1 = require("@/shared/utils/formatters");
const validators_1 = require("@/shared/utils/validators");
function assert(condition, message) {
    if (!condition) {
        throw new Error(`FALLA DE VALIDACIÓN: ${message}`);
    }
}
function runWorkerValidationSuite() {
    const details = [];
    let passed = 0;
    const pass = (name) => {
        passed += 1;
        details.push(`PASS: ${name}`);
    };
    // 1. Validación de contraseña y mayoría de edad
    assert((0, validators_1.validatePassword)('abc12345') !== null, 'Debe exigir mayúscula');
    assert((0, validators_1.validatePassword)('Abcdefgh') !== null, 'Debe exigir número');
    assert((0, validators_1.validatePassword)('Abc1234') !== null, 'Debe exigir >= 8 caracteres');
    assert((0, validators_1.validatePassword)('Solidez2026') === null, 'Contraseña válida');
    assert((0, validators_1.validateBirthDateAdult)('2012-05-10', new Date('2026-11-26')) !== null, 'Menor de 18 debe ser rechazado');
    assert((0, validators_1.validateBirthDateAdult)('1998-05-10', new Date('2026-11-26')) === null, 'Mayor de 18 aceptado');
    pass('Validación de contraseña y mayoría de edad (>=18)');
    // 2. Registro, cierre de sesión e inicio de sesión
    worker_store_1.workerStore.reset({ authenticated: false });
    let underageThrew = false;
    try {
        worker_store_1.workerStore.registerWorker({
            full_name: 'Luis Joven',
            email: 'joven@correo.mx',
            phone: '5512345678',
            birth_date: '2012-01-01',
            password: 'Password123',
            accept_terms: true,
            accept_privacy: true,
        });
    }
    catch {
        underageThrew = true;
    }
    assert(underageThrew, 'Registro de menor de edad bloqueado');
    const newWorker = worker_store_1.workerStore.registerWorker({
        full_name: 'Andrea López Ramírez',
        email: 'andrea.lopez@correo.mx',
        phone: '+52 55 9876 5432',
        birth_date: '1996-04-12',
        password: 'Password123',
        accept_terms: true,
        accept_privacy: true,
        skills: 'Limpieza residencial y apoyo en eventos',
        availability: 'Lunes a sábado',
    });
    assert(newWorker.role === 'worker', 'Nuevo perfil creado con rol trabajador');
    worker_store_1.workerStore.logout();
    assert(worker_store_1.workerStore.getState().activeWorkerId === null, 'Sesión cerrada');
    const logged = worker_store_1.workerStore.login('carlos.mendoza@correo.mx', 'Solidez2026');
    assert(logged.full_name === 'Carlos Mendoza Ríos', 'Login correcto');
    pass('Registro, cierre de sesión e inicio de sesión');
    // 3. Edición de perfil y límite de 300 caracteres
    const updated = worker_store_1.workerStore.updateWorkerProfile({
        full_name: 'Carlos Mendoza Ríos',
        phone: '+52 55 4182 9099',
        skills: 'Pintura profesional, limpieza profunda y jardinería.',
        availability: 'Lunes a domingo de 08:00 a 18:00 hrs.',
    });
    assert(updated.phone === '+52 55 4182 9099', 'Teléfono actualizado');
    let bioOverflowThrew = false;
    try {
        worker_store_1.workerStore.updateWorkerProfile({
            full_name: 'Carlos Mendoza Ríos',
            phone: '+52 55 4182 9099',
            skills: 'a'.repeat(301),
            availability: 'Disponible',
        });
    }
    catch {
        bioOverflowThrew = true;
    }
    assert(bioOverflowThrew, 'Habilidades > 300 chars bloqueado');
    pass('Edición de perfil y límite de 300 caracteres');
    // 4. Ubicación manual, radio y límite de 3 cambios en 24h
    worker_store_1.workerStore.reset({ authenticated: true });
    assert(worker_store_1.workerStore.getWorkerLocation().search_radius_km === 10, 'Radio inicial de 10 km');
    worker_store_1.workerStore.saveWorkerLocation({
        label: 'Del Valle Centro, CDMX',
        latitude: 19.3834,
        longitude: -99.1645,
        search_radius_km: 10,
    });
    worker_store_1.workerStore.saveWorkerLocation({
        label: 'Polanco, CDMX',
        latitude: 19.4338,
        longitude: -99.1945,
        search_radius_km: 25,
    });
    worker_store_1.workerStore.saveWorkerLocation({
        label: 'Coyoacán, CDMX',
        latitude: 19.3467,
        longitude: -99.1617,
        search_radius_km: 5,
    });
    assert(worker_store_1.workerStore.getRemainingLocationChanges().remaining === 0, '0 cambios restantes tras 3 modificaciones en 24h');
    let fourthChangeThrew = false;
    try {
        worker_store_1.workerStore.saveWorkerLocation({
            label: 'Santa Fe, CDMX',
            latitude: 19.3659,
            longitude: -99.2615,
            search_radius_km: 10,
        });
    }
    catch {
        fourthChangeThrew = true;
    }
    assert(fourthChangeThrew, '4to cambio de ubicación en 24h bloqueado');
    // Cambiar solo radio sigue permitido
    worker_store_1.workerStore.updateSearchRadius(50);
    assert(worker_store_1.workerStore.getWorkerLocation().search_radius_km === 50, 'Radio actualizado');
    pass('Configuración de ubicación manual, cambio de radio y límite 3/24h');
    // 5. Búsqueda, orden por distancia, privacidad pre-selección y máx 10 fuera de alcance
    worker_store_1.workerStore.reset({ authenticated: true });
    const opps = worker_store_1.workerStore.listOpportunities();
    assert(opps.withinRadius.length > 0, 'Existen trabajos dentro del radio');
    assert(opps.outOfRange.length <= 10, 'Máximo 10 trabajos fuera de alcance');
    assert(opps.outOfRange.every((o) => o.is_out_of_range), 'Trabajos fuera del radio etiquetados correctamente');
    const detail = worker_store_1.workerStore.getOpportunityDetail('job-opp-06');
    assert(detail !== null, 'Detalle de oportunidad cargado');
    assert(detail.employer_rating === null && detail.employer_review_count === 0, 'Empleador sin evaluaciones detectado correctamente');
    assert(!('exact_address' in detail), 'Sin domicilio exacto pre-selección');
    assert((0, formatters_1.formatDistanceRange)((0, formatters_1.calculateHaversineKm)(19.4194, -99.162, 19.4208, -99.1605)) ===
        'Menos de 5 km', 'Rango de distancia calculado con Haversine');
    pass('Búsqueda, filtrado, privacidad pre-selección y rango de distancia');
    // 6. Postulación única y retiro de postulación pendiente
    worker_store_1.workerStore.applyToJob('job-opp-01');
    let dupApplyThrew = false;
    try {
        worker_store_1.workerStore.applyToJob('job-opp-01');
    }
    catch {
        dupApplyThrew = true;
    }
    assert(dupApplyThrew, 'Postulación duplicada bloqueada');
    const myApps = worker_store_1.workerStore.listMyApplications();
    const opp1App = myApps.find((a) => a.job_id === 'job-opp-01');
    assert(opp1App?.status === 'pending', 'Postulación en estado pendiente');
    worker_store_1.workerStore.withdrawApplication(opp1App.id);
    const afterWithdraw = worker_store_1.workerStore
        .listMyApplications()
        .find((a) => a.id === opp1App.id);
    assert(afterWithdraw?.status === 'withdrawn', 'Postulación retirada');
    pass('Postulación única y retiro con actualización de estado');
    // 7. Aceptación de condiciones, registro de llegada y transición a En curso
    worker_store_1.workerStore.acceptJobConditions('job-my-assigned-pending');
    const pendingDetail = worker_store_1.workerStore.getAssignedJobDetail('job-my-assigned-pending');
    assert(pendingDetail.worker_confirmed, 'Condiciones aceptadas');
    assert(!worker_store_1.workerStore.getArrivalWindowStatus(pendingDetail).canRegister, 'Llegada bloqueada antes de la ventana de 30 min');
    worker_store_1.workerStore.registerArrival('job-my-assigned-ready');
    const arrivedDetail = worker_store_1.workerStore.getAssignedJobDetail('job-my-assigned-ready');
    assert(arrivedDetail.job.status === 'arrival_registered', 'Estado actualizado a arrival_registered');
    worker_store_1.workerStore.refreshPaymentAndStartJob('job-my-assigned-ready');
    assert(worker_store_1.workerStore.getAssignedJobDetail('job-my-assigned-ready').job.status ===
        'in_progress', 'Trabajo iniciado tras confirmación de pago');
    pass('Aceptación de condiciones, ventana de llegada sin GPS e inicio de trabajo');
    // 8. Finalización con código (5 intentos + bloqueo + reemplazo único) y sin código
    let lastRes = worker_store_1.workerStore.verifyCompletionCode('job-my-in-progress', '000001');
    assert(lastRes.status === 'invalid' && lastRes.remainingAttempts === 4, 'Intento 1 fallido');
    for (let i = 0; i < 4; i += 1) {
        lastRes = worker_store_1.workerStore.verifyCompletionCode('job-my-in-progress', '000002');
    }
    assert(lastRes.status === 'blocked' && lastRes.remainingAttempts === 0, 'Bloqueo tras 5 intentos');
    worker_store_1.workerStore.requestReplacementCode('job-my-in-progress');
    let secondReplaceThrew = false;
    try {
        worker_store_1.workerStore.requestReplacementCode('job-my-in-progress');
    }
    catch {
        secondReplaceThrew = true;
    }
    assert(secondReplaceThrew, 'Solo se permite 1 reemplazo de código');
    const okCode = worker_store_1.workerStore.verifyCompletionCode('job-my-in-progress', '731942');
    assert(okCode.status === 'ok', 'Finalización exitosa con código de reemplazo');
    // Finalización sin código con evidencias
    assert((0, validators_1.validateAttachmentCandidate)({ file_name: 'foto.jpg', mime_type: 'image/jpeg', size_bytes: 12000000 }, 'completion_evidence', 0) !== null, 'Archivo > 10MB rechazado');
    worker_store_1.workerStore.requestCompletionWithoutCode('job-my-assigned-ready', [
        { file_name: 'entrega.jpg', mime_type: 'image/jpeg', size_bytes: 1200000 },
    ]);
    assert(worker_store_1.workerStore.getAssignedJobDetail('job-my-assigned-ready').job.status ===
        'completion_requested', 'Solicitud sin código registrada');
    pass('Finalización con código (5 intentos/bloqueo/1 reemplazo) y sin código con evidencias');
    // 9. Chat, pagos, notificaciones, casos, reportes y evaluación
    worker_store_1.workerStore.sendChatMessage('job-my-assigned-pending', 'Confirmado, nos vemos mañana puntual.');
    const thread = worker_store_1.workerStore.getChatThread('job-my-assigned-pending');
    assert(thread.messages[thread.messages.length - 1].body.includes('Confirmado'), 'Mensaje enviado en chat');
    const payments = worker_store_1.workerStore.getPaymentsSummaryAndHistory();
    assert(payments.totalTransferredMxn > 0, 'Resumen de ingresos transferidos');
    worker_store_1.workerStore.markAllNotificationsRead();
    assert(worker_store_1.workerStore.listNotifications().every((n) => n.read_at !== null), 'Notificaciones marcadas como leídas');
    const caseId = worker_store_1.workerStore.createCase({
        case_type: 'ticket',
        ticket_category: 'technical',
        description: 'Consulta sobre actualización de horarios en mi perfil.',
    });
    worker_store_1.workerStore.addCaseReply(caseId, 'Gracias por la atención, quedo al pendiente.');
    assert(worker_store_1.workerStore.listMyCases().some((c) => c.id === caseId), 'Ticket creado y respondido');
    worker_store_1.workerStore.submitEmployerReview('job-my-completed-unrated', 5, 'Muy buen trato y excelente claridad en las condiciones del trabajo.');
    let dupReviewThrew = false;
    try {
        worker_store_1.workerStore.submitEmployerReview('job-my-completed-unrated', 4, 'Intento duplicado');
    }
    catch {
        dupReviewThrew = true;
    }
    assert(dupReviewThrew, 'Evaluación duplicada bloqueada');
    pass('Chat, pagos, notificaciones, tickets/reportes y evaluación única');
    return { passed, details };
}

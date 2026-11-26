"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.workerStore = void 0;
exports.useWorkerStore = useWorkerStore;
/**
 * Store reactivo centralizado de la Aplicación Móvil del Trabajador
 * Gestiona autenticación, ubicación/radio, búsqueda, postulaciones, trabajos asignados,
 * confirmación de condiciones, llegada, finalización (con/sin código), chat, pagos,
 * notificaciones, casos/soporte/reportes, evaluaciones y perfil.
 */
const react_1 = require("react");
const worker_seed_1 = require("./worker-seed");
const error_mapper_1 = require("@/shared/utils/error-mapper");
const formatters_1 = require("@/shared/utils/formatters");
const validators_1 = require("@/shared/utils/validators");
const HOURS_24_MS = 24 * 60 * 60 * 1000;
const MINUTES_30_MS = 30 * 60 * 1000;
class WorkerStoreManager {
    constructor() {
        this.listeners = new Set();
        this.getState = () => this.state;
        this.subscribe = (listener) => {
            this.listeners.add(listener);
            return () => {
                this.listeners.delete(listener);
            };
        };
        const db = (0, worker_seed_1.createInitialWorkerDatabase)();
        this.state = {
            db,
            activeWorkerId: db.currentWorkerId,
            version: 1,
        };
    }
    notify() {
        this.state = {
            ...this.state,
            version: this.state.version + 1,
        };
        this.listeners.forEach((l) => l());
    }
    reset(options) {
        const db = (0, worker_seed_1.createInitialWorkerDatabase)();
        this.state = {
            db,
            activeWorkerId: options?.authenticated === false ? null : db.currentWorkerId,
            version: this.state.version + 1,
        };
        this.listeners.forEach((l) => l());
    }
    requireWorker() {
        const id = this.state.activeWorkerId;
        if (!id)
            throw new error_mapper_1.DomainError('ERR_NOT_AUTHENTICATED');
        const profile = this.state.db.profiles.find((p) => p.id === id);
        if (!profile)
            throw new error_mapper_1.DomainError('ERR_NOT_AUTHENTICATED');
        if (profile.role !== 'worker')
            throw new error_mapper_1.DomainError('ERR_INVALID_ROLE');
        return profile;
    }
    pushNotification(params) {
        this.state.db.notifications.unshift({
            id: `notif-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
            user_id: params.userId,
            event_type: params.eventType,
            title: params.title,
            body: params.body,
            category: params.category,
            target_route: params.targetRoute,
            read_at: null,
            created_at: new Date().toISOString(),
        });
    }
    getEmployerStats(employerId) {
        const emp = this.state.db.profiles.find((p) => p.id === employerId);
        const empReviews = this.state.db.reviews
            .filter((r) => r.reviewee_id === employerId && r.moderation_status === 'visible')
            .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
        const avg = empReviews.length > 0
            ? empReviews.reduce((acc, r) => acc + r.rating, 0) / empReviews.length
            : null;
        const projections = empReviews.map((r) => {
            const reviewer = this.state.db.profiles.find((p) => p.id === r.reviewer_id);
            const job = this.state.db.jobs.find((j) => j.id === r.job_id);
            return {
                id: r.id,
                job_id: r.job_id,
                job_title: job?.title ?? 'Trabajo temporal completado',
                reviewer_name: reviewer?.full_name ?? 'Trabajador verificado',
                rating: r.rating,
                comment: r.comment,
                created_at: r.created_at,
            };
        });
        return {
            name: emp?.full_name ?? 'Empleador verificado',
            rating: avg,
            reviewCount: empReviews.length,
            reviews: projections,
        };
    }
    // ---------------------------------------------------------------------------
    // MÓDULO 1: AUTENTICACIÓN
    // ---------------------------------------------------------------------------
    login(email, password) {
        const normalized = email.trim().toLowerCase();
        const emailErr = (0, validators_1.validateEmail)(normalized);
        if (emailErr)
            throw new error_mapper_1.DomainError('ERR_VALIDATION', emailErr);
        if (!password.trim()) {
            throw new error_mapper_1.DomainError('ERR_INVALID_CREDENTIALS');
        }
        const profile = this.state.db.profiles.find((p) => p.email.toLowerCase() === normalized);
        if (!profile) {
            throw new error_mapper_1.DomainError('ERR_INVALID_CREDENTIALS');
        }
        if (profile.role !== 'worker') {
            throw new error_mapper_1.DomainError('ERR_INVALID_ROLE');
        }
        const expectedPass = this.state.db.passwordsByEmail[normalized];
        if (expectedPass && expectedPass !== password) {
            throw new error_mapper_1.DomainError('ERR_INVALID_CREDENTIALS');
        }
        this.state.activeWorkerId = profile.id;
        this.notify();
        return profile;
    }
    registerWorker(input) {
        const errors = (0, validators_1.validateRegisterForm)(input);
        const firstErr = Object.values(errors)[0];
        if (firstErr) {
            if (errors.birth_date && errors.birth_date.includes('18')) {
                throw new error_mapper_1.DomainError('ERR_UNDERAGE', errors.birth_date);
            }
            throw new error_mapper_1.DomainError('ERR_VALIDATION', firstErr);
        }
        const normalizedEmail = input.email.trim().toLowerCase();
        const exists = this.state.db.profiles.some((p) => p.email.toLowerCase() === normalizedEmail);
        if (exists) {
            throw new error_mapper_1.DomainError('ERR_PROFILE_EXISTS');
        }
        const nowIso = new Date().toISOString();
        const newId = `usr-trab-${Date.now()}`;
        const newProfile = {
            id: newId,
            role: 'worker',
            full_name: input.full_name.trim(),
            email: normalizedEmail,
            phone: input.phone.trim(),
            birth_date: input.birth_date.trim(),
            photo_path: null,
            avatar_initials: (0, formatters_1.getInitials)(input.full_name),
            avatar_tone: '#fbe8d8',
            skills: input.skills?.trim().slice(0, 300) || null,
            availability: input.availability?.trim().slice(0, 300) || null,
            stripe_account_id: null,
            stripe_onboarding_complete: false,
            account_status: 'active',
            suspended_until: null,
            created_at: nowIso,
            updated_at: nowIso,
        };
        this.state.db.profiles.push(newProfile);
        this.state.db.passwordsByEmail[normalizedEmail] = input.password;
        this.state.db.termsAcceptances.push({
            id: `ta-t-${Date.now()}`,
            user_id: newId,
            document: 'terms',
            version: '2.0',
            accepted_at: nowIso,
        }, {
            id: `ta-p-${Date.now()}`,
            user_id: newId,
            document: 'privacy',
            version: '2.0',
            accepted_at: nowIso,
        });
        this.state.db.workerLocations.push({
            worker_id: newId,
            label: 'Roma Norte, CDMX',
            latitude: 19.4194,
            longitude: -99.162,
            search_radius_km: 10,
            initialized: false,
            recent_changes: [],
            updated_at: nowIso,
        });
        this.pushNotification({
            userId: newId,
            eventType: 'account_welcome',
            title: 'Bienvenido a Solidez MX',
            body: 'Configura tu punto de referencia en el mapa para descubrir oportunidades cercanas a ti.',
            category: 'cuenta',
            targetRoute: '/(main)/location',
        });
        this.state.activeWorkerId = newId;
        this.notify();
        return newProfile;
    }
    requestPasswordRecovery(email) {
        const err = (0, validators_1.validateEmail)(email);
        if (err)
            throw new error_mapper_1.DomainError('ERR_VALIDATION', err);
        return `Si el correo ${email.trim().toLowerCase()} está registrado, recibirás un enlace para restablecer tu contraseña en los próximos minutos.`;
    }
    logout() {
        this.state.activeWorkerId = null;
        this.notify();
    }
    // ---------------------------------------------------------------------------
    // MÓDULO 3: UBICACIÓN Y RADIO DE BÚSQUEDA (Sin GPS, máx 3 cambios / 24h)
    // ---------------------------------------------------------------------------
    getWorkerLocation() {
        const worker = this.requireWorker();
        let loc = this.state.db.workerLocations.find((l) => l.worker_id === worker.id);
        if (!loc) {
            loc = {
                worker_id: worker.id,
                label: 'Roma Norte, CDMX',
                latitude: 19.4194,
                longitude: -99.162,
                search_radius_km: 10,
                initialized: false,
                recent_changes: [],
                updated_at: new Date().toISOString(),
            };
            this.state.db.workerLocations.push(loc);
        }
        return loc;
    }
    getRemainingLocationChanges(nowMs = Date.now()) {
        const loc = this.getWorkerLocation();
        const activeChanges = loc.recent_changes.filter((iso) => nowMs - new Date(iso).getTime() < HOURS_24_MS);
        const used = activeChanges.length;
        const remaining = Math.max(0, 3 - used);
        const oldest = activeChanges.sort()[0];
        const nextSlotIso = remaining === 0 && oldest
            ? new Date(new Date(oldest).getTime() + HOURS_24_MS).toISOString()
            : null;
        return { used, remaining, maxChanges: 3, nextSlotIso };
    }
    saveWorkerLocation(params) {
        const loc = this.getWorkerLocation();
        const nowMs = Date.now();
        const nowIso = new Date(nowMs).toISOString();
        const pointChanged = Math.abs(loc.latitude - params.latitude) > 0.0002 ||
            Math.abs(loc.longitude - params.longitude) > 0.0002;
        // Filtrar cambios activos en ventana móvil de 24 h
        const validRecent = loc.recent_changes.filter((iso) => nowMs - new Date(iso).getTime() < HOURS_24_MS);
        if (loc.initialized && pointChanged) {
            if (validRecent.length >= 3) {
                throw new error_mapper_1.DomainError('ERR_LOCATION_LIMIT');
            }
            validRecent.push(nowIso);
        }
        loc.label = params.label.trim() || loc.label;
        loc.latitude = params.latitude;
        loc.longitude = params.longitude;
        loc.search_radius_km = params.search_radius_km;
        loc.initialized = true;
        loc.recent_changes = validRecent;
        loc.updated_at = nowIso;
        this.notify();
        return { ...loc };
    }
    updateSearchRadius(radiusKm) {
        const loc = this.getWorkerLocation();
        loc.search_radius_km = radiusKm;
        loc.updated_at = new Date().toISOString();
        this.notify();
        return { ...loc };
    }
    // ---------------------------------------------------------------------------
    // MÓDULOS 2, 4 Y 5: EXPLORAR, BUSCAR Y DETALLE DE OPORTUNIDAD
    // ---------------------------------------------------------------------------
    listOpportunities(filters) {
        const worker = this.requireWorker();
        const loc = this.getWorkerLocation();
        const queryNorm = filters?.query?.trim().toLowerCase() ?? '';
        const category = filters?.category ?? 'all';
        const dateFrom = filters?.dateFrom?.trim() ?? '';
        const dateTo = filters?.dateTo?.trim() ?? '';
        const openStatuses = new Set(['published', 'has_applications']);
        const mapped = this.state.db.jobs
            .filter((j) => {
            if (j.moderation_status !== 'visible')
                return false;
            if (!openStatuses.has(j.status))
                return false;
            if (j.selected_worker_id !== null)
                return false;
            if (category !== 'all' && j.category !== category)
                return false;
            if (dateFrom && j.job_date < dateFrom)
                return false;
            if (dateTo && j.job_date > dateTo)
                return false;
            if (queryNorm) {
                const emp = this.state.db.profiles.find((p) => p.id === j.employer_id);
                const haystack = `${j.title} ${j.description} ${j.neighborhood} ${j.category} ${emp?.full_name ?? ''}`.toLowerCase();
                if (!haystack.includes(queryNorm))
                    return false;
            }
            return true;
        })
            .map((j) => {
            const priv = this.state.db.jobsPrivate.find((p) => p.job_id === j.id);
            const distKm = priv
                ? (0, formatters_1.calculateHaversineKm)(loc.latitude, loc.longitude, priv.exact_latitude, priv.exact_longitude)
                : 8;
            const empStats = this.getEmployerStats(j.employer_id);
            const myApp = this.state.db.applications.find((a) => a.job_id === j.id && a.worker_id === worker.id);
            const photoCount = this.state.db.attachments.filter((a) => a.job_id === j.id && a.kind === 'job_photo').length;
            return {
                id: j.id,
                title: j.title,
                description: j.description,
                category: j.category,
                fixed_payment_mxn: j.fixed_payment_mxn,
                job_date: j.job_date,
                start_time: j.start_time,
                end_time: j.end_time,
                start_at: j.start_at,
                end_at: j.end_at,
                neighborhood: j.neighborhood,
                status: j.status,
                employer_id: j.employer_id,
                employer_name: empStats.name,
                employer_rating: empStats.rating,
                employer_review_count: empStats.reviewCount,
                distance_range: (0, formatters_1.formatDistanceRange)(distKm),
                is_out_of_range: distKm > loc.search_radius_km,
                _sort_distance_km: distKm,
                has_applied: Boolean(myApp && myApp.status !== 'withdrawn'),
                my_application_status: myApp?.status ?? null,
                photo_count: photoCount,
                created_at: j.created_at,
            };
        })
            .sort((a, b) => a._sort_distance_km - b._sort_distance_km);
        const withinRadius = mapped.filter((m) => !m.is_out_of_range);
        // Regla estricta: máximo 10 trabajos fuera del radio
        const outOfRange = mapped.filter((m) => m.is_out_of_range).slice(0, 10);
        return {
            withinRadius,
            outOfRange,
            all: [...withinRadius, ...outOfRange],
        };
    }
    getOpportunityDetail(jobId) {
        const worker = this.requireWorker();
        const job = this.state.db.jobs.find((j) => j.id === jobId);
        if (!job || job.moderation_status !== 'visible')
            return null;
        const loc = this.getWorkerLocation();
        const priv = this.state.db.jobsPrivate.find((p) => p.job_id === job.id);
        const distKm = priv
            ? (0, formatters_1.calculateHaversineKm)(loc.latitude, loc.longitude, priv.exact_latitude, priv.exact_longitude)
            : 8;
        const empStats = this.getEmployerStats(job.employer_id);
        const myApp = this.state.db.applications.find((a) => a.job_id === job.id && a.worker_id === worker.id);
        const photos = this.state.db.attachments.filter((a) => a.job_id === job.id && a.kind === 'job_photo');
        return {
            id: job.id,
            title: job.title,
            description: job.description,
            category: job.category,
            fixed_payment_mxn: job.fixed_payment_mxn,
            job_date: job.job_date,
            start_time: job.start_time,
            end_time: job.end_time,
            start_at: job.start_at,
            end_at: job.end_at,
            conditions: job.conditions,
            neighborhood: job.neighborhood,
            status: job.status,
            employer_id: job.employer_id,
            employer_name: empStats.name,
            employer_rating: empStats.rating,
            employer_review_count: empStats.reviewCount,
            employer_reviews: empStats.reviews,
            distance_range: (0, formatters_1.formatDistanceRange)(distKm),
            is_out_of_range: distKm > loc.search_radius_km,
            _sort_distance_km: distKm,
            has_applied: Boolean(myApp && myApp.status !== 'withdrawn'),
            my_application_status: myApp?.status ?? null,
            my_application_id: myApp?.id ?? null,
            photo_count: photos.length,
            photos,
            created_at: job.created_at,
        };
    }
    // ---------------------------------------------------------------------------
    // MÓDULO 6: POSTULACIONES
    // ---------------------------------------------------------------------------
    applyToJob(jobId) {
        const worker = this.requireWorker();
        const job = this.state.db.jobs.find((j) => j.id === jobId);
        if (!job || !['published', 'has_applications'].includes(job.status)) {
            throw new error_mapper_1.DomainError('ERR_JOB_NOT_AVAILABLE');
        }
        const existing = this.state.db.applications.find((a) => a.job_id === jobId && a.worker_id === worker.id);
        if (existing) {
            throw new error_mapper_1.DomainError('ERR_ALREADY_APPLIED');
        }
        const nowIso = new Date().toISOString();
        this.state.db.applications.unshift({
            id: `app-${Date.now()}`,
            job_id: jobId,
            worker_id: worker.id,
            status: 'pending',
            created_at: nowIso,
            updated_at: nowIso,
        });
        if (job.status === 'published') {
            job.status = 'has_applications';
            job.updated_at = nowIso;
        }
        this.pushNotification({
            userId: worker.id,
            eventType: 'application_created',
            title: 'Postulación enviada',
            body: `Tu solicitud para "${job.title}" quedó registrada como pendiente.`,
            category: 'postulaciones',
            targetRoute: '/(main)/applications',
        });
        this.notify();
    }
    withdrawApplication(applicationId) {
        const worker = this.requireWorker();
        const app = this.state.db.applications.find((a) => a.id === applicationId && a.worker_id === worker.id);
        if (!app)
            throw new error_mapper_1.DomainError('ERR_NOT_FOUND');
        if (app.status !== 'pending')
            throw new error_mapper_1.DomainError('ERR_NOT_PENDING');
        const nowIso = new Date().toISOString();
        app.status = 'withdrawn';
        app.updated_at = nowIso;
        const job = this.state.db.jobs.find((j) => j.id === app.job_id);
        this.pushNotification({
            userId: worker.id,
            eventType: 'application_withdrawn',
            title: 'Postulación retirada',
            body: `Retiraste tu postulación para "${job?.title ?? 'la oportunidad'}".`,
            category: 'postulaciones',
            targetRoute: '/(main)/applications',
        });
        this.notify();
    }
    listMyApplications() {
        const worker = this.requireWorker();
        const loc = this.getWorkerLocation();
        return this.state.db.applications
            .filter((a) => a.worker_id === worker.id)
            .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
            .map((a) => {
            const job = this.state.db.jobs.find((j) => j.id === a.job_id);
            const empStats = job
                ? this.getEmployerStats(job.employer_id)
                : { name: 'Empleador', rating: null, reviewCount: 0, reviews: [] };
            const priv = this.state.db.jobsPrivate.find((p) => p.job_id === a.job_id);
            const distKm = priv
                ? (0, formatters_1.calculateHaversineKm)(loc.latitude, loc.longitude, priv.exact_latitude, priv.exact_longitude)
                : 6;
            return {
                id: a.id,
                job_id: a.job_id,
                status: a.status,
                created_at: a.created_at,
                updated_at: a.updated_at,
                job_title: job?.title ?? 'Trabajo temporal',
                job_category: job?.category ?? 'otros',
                job_date: job?.job_date ?? '',
                start_time: job?.start_time ?? '09:00',
                end_time: job?.end_time ?? '14:00',
                fixed_payment_mxn: job?.fixed_payment_mxn ?? 0,
                neighborhood: job?.neighborhood ?? '',
                employer_name: empStats.name,
                employer_rating: empStats.rating,
                job_status: job?.status ?? 'published',
                distance_range: (0, formatters_1.formatDistanceRange)(distKm),
                is_selected_worker: job?.selected_worker_id === worker.id,
            };
        });
    }
    // ---------------------------------------------------------------------------
    // MÓDULOS 7, 8 Y 9: MIS TRABAJOS, CONDICIONES, LLEGADA Y FINALIZACIÓN
    // ---------------------------------------------------------------------------
    listMyJobs() {
        const worker = this.requireWorker();
        return this.state.db.jobs
            .filter((j) => j.selected_worker_id === worker.id)
            .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
            .map((j) => this.buildAssignedJobDetail(j.id, worker))
            .filter((d) => d !== null);
    }
    getAssignedJobDetail(jobId) {
        const worker = this.requireWorker();
        return this.buildAssignedJobDetail(jobId, worker);
    }
    buildAssignedJobDetail(jobId, worker) {
        const job = this.state.db.jobs.find((j) => j.id === jobId && j.selected_worker_id === worker.id);
        if (!job)
            return null;
        const emp = this.state.db.profiles.find((p) => p.id === job.employer_id);
        const empStats = this.getEmployerStats(job.employer_id);
        const priv = this.state.db.jobsPrivate.find((p) => p.job_id === job.id);
        const photos = this.state.db.attachments.filter((a) => a.job_id === job.id && a.kind === 'job_photo');
        const completionEvidence = this.state.db.attachments.filter((a) => a.job_id === job.id && a.kind === 'completion_evidence');
        const roundConfirmations = this.state.db.confirmations.filter((c) => c.job_id === job.id && c.selection_round === job.selection_round);
        const workerConfirmed = roundConfirmations.some((c) => c.user_id === worker.id);
        const employerConfirmed = roundConfirmations.some((c) => c.user_id === job.employer_id);
        const payment = this.state.db.payments.find((p) => p.job_id === job.id && p.worker_id === worker.id) ?? null;
        const comp = this.state.db.jobCompletions.find((c) => c.job_id === job.id);
        const nowMs = Date.now();
        const completionMeta = comp
            ? {
                code_expires_at: comp.code_expires_at,
                attempts: comp.attempts,
                max_attempts: 5,
                renewals: comp.renewals,
                max_renewals: 1,
                is_blocked: comp.attempts >= 5,
                is_expired: new Date(comp.code_expires_at).getTime() <= nowMs,
                used_at: comp.used_at,
            }
            : null;
        const workerReview = this.state.db.reviews.find((r) => r.job_id === job.id && r.reviewer_id === worker.id) ?? null;
        const openClaim = this.state.db.cases.find((c) => c.case_type === 'claim' &&
            c.job_id === job.id &&
            c.status !== 'closed');
        return {
            job: { ...job },
            employer_name: empStats.name,
            employer_phone: emp?.phone ?? '',
            employer_rating: empStats.rating,
            employer_review_count: empStats.reviewCount,
            exact_address: priv?.exact_address ?? job.neighborhood,
            exact_latitude: priv?.exact_latitude ?? 19.4194,
            exact_longitude: priv?.exact_longitude ?? -99.162,
            photos,
            completion_evidence: completionEvidence,
            worker_confirmed: workerConfirmed,
            employer_confirmed: employerConfirmed,
            worker_stripe_ready: worker.stripe_onboarding_complete,
            payment: payment ? { ...payment } : null,
            completion_meta: completionMeta,
            worker_reviewed: Boolean(workerReview),
            worker_review: workerReview,
            open_claim_id: openClaim?.id ?? null,
        };
    }
    acceptJobConditions(jobId) {
        const worker = this.requireWorker();
        const job = this.state.db.jobs.find((j) => j.id === jobId && j.selected_worker_id === worker.id);
        if (!job)
            throw new error_mapper_1.DomainError('ERR_NOT_FOUND');
        if (job.status !== 'assigned') {
            throw new error_mapper_1.DomainError('ERR_INVALID_TRANSITION');
        }
        const already = this.state.db.confirmations.some((c) => c.job_id === job.id &&
            c.user_id === worker.id &&
            c.selection_round === job.selection_round);
        if (!already) {
            this.state.db.confirmations.push({
                id: `conf-${Date.now()}`,
                job_id: job.id,
                user_id: worker.id,
                selection_round: job.selection_round,
                confirmed_at: new Date().toISOString(),
            });
            job.updated_at = new Date().toISOString();
            this.pushNotification({
                userId: worker.id,
                eventType: 'conditions_confirmed',
                title: 'Condiciones aceptadas',
                body: `Confirmaste las condiciones para "${job.title}".`,
                category: 'trabajos',
                targetRoute: `/(main)/job/${job.id}`,
            });
            this.notify();
        }
    }
    completeStripeOnboarding() {
        const worker = this.requireWorker();
        worker.stripe_account_id =
            worker.stripe_account_id ?? `acct_1Solidez${worker.id.slice(-6)}`;
        worker.stripe_onboarding_complete = true;
        worker.updated_at = new Date().toISOString();
        this.pushNotification({
            userId: worker.id,
            eventType: 'stripe_ready',
            title: 'Cuenta conectada verificada',
            body: 'Tu alta para recibir pagos se encuentra completa y activa.',
            category: 'cuenta',
            targetRoute: '/(main)/profile',
        });
        this.notify();
        return { ...worker };
    }
    getArrivalWindowStatus(detail, nowMs = Date.now()) {
        const startMs = new Date(detail.job.start_at).getTime();
        const endMs = new Date(detail.job.end_at).getTime();
        const windowOpensMs = startMs - MINUTES_30_MS;
        const windowOpensIso = new Date(windowOpensMs).toISOString();
        if (detail.job.status !== 'assigned') {
            return {
                canRegister: false,
                reason: 'La llegada ya fue registrada o el trabajo cambió de estado.',
                windowOpensIso,
            };
        }
        if (!detail.worker_confirmed || !detail.employer_confirmed) {
            return {
                canRegister: false,
                reason: 'Ambas partes deben aceptar las condiciones del trabajo.',
                windowOpensIso,
            };
        }
        if (!detail.worker_stripe_ready) {
            return {
                canRegister: false,
                reason: 'Completa el alta de tu cuenta conectada de Stripe Connect.',
                windowOpensIso,
            };
        }
        if (nowMs < windowOpensMs) {
            return {
                canRegister: false,
                reason: 'Disponible a partir de 30 minutos antes de la hora de inicio programada.',
                windowOpensIso,
            };
        }
        if (nowMs > endMs) {
            return {
                canRegister: false,
                reason: 'La hora de finalización del trabajo ya pasó; el registro de llegada quedó cerrado.',
                windowOpensIso,
            };
        }
        return {
            canRegister: true,
            reason: null,
            windowOpensIso,
        };
    }
    registerArrival(jobId) {
        const worker = this.requireWorker();
        const detail = this.getAssignedJobDetail(jobId);
        if (!detail)
            throw new error_mapper_1.DomainError('ERR_NOT_FOUND');
        const check = this.getArrivalWindowStatus(detail);
        if (!check.canRegister) {
            if (!detail.worker_confirmed || !detail.employer_confirmed) {
                throw new error_mapper_1.DomainError('ERR_CONDITIONS_NOT_ACCEPTED');
            }
            if (!detail.worker_stripe_ready) {
                throw new error_mapper_1.DomainError('ERR_STRIPE_ONBOARDING_INCOMPLETE');
            }
            throw new error_mapper_1.DomainError('ERR_OUTSIDE_ARRIVAL_WINDOW', check.reason ?? undefined);
        }
        const job = this.state.db.jobs.find((j) => j.id === jobId);
        const nowIso = new Date().toISOString();
        job.status = 'arrival_registered';
        job.arrived_at = nowIso;
        job.updated_at = nowIso;
        const fee = Math.round(job.fixed_payment_mxn * 0.1 * 100) / 100;
        const existingPayment = this.state.db.payments.find((p) => p.job_id === job.id && p.worker_id === worker.id);
        if (!existingPayment) {
            this.state.db.payments.unshift({
                id: `pay-${Date.now()}`,
                job_id: job.id,
                employer_id: job.employer_id,
                worker_id: worker.id,
                job_amount_mxn: job.fixed_payment_mxn,
                platform_fee_mxn: fee,
                total_charged_mxn: job.fixed_payment_mxn + fee,
                stripe_payment_intent_id: null,
                stripe_transfer_id: null,
                status: 'payment_pending',
                payment_attempts: 0,
                created_at: nowIso,
                updated_at: nowIso,
            });
        }
        this.pushNotification({
            userId: worker.id,
            eventType: 'arrival_registered',
            title: 'Llegada registrada',
            body: `Registraste tu llegada en "${job.title}". En cuanto se confirme el pago podrás comenzar la jornada.`,
            category: 'trabajos',
            targetRoute: `/(main)/job/${job.id}`,
        });
        this.notify();
    }
    /**
     * Actualiza estado cuando el pago del empleador queda confirmado y el trabajo pasa a En curso.
     */
    refreshPaymentAndStartJob(jobId) {
        const worker = this.requireWorker();
        const job = this.state.db.jobs.find((j) => j.id === jobId && j.selected_worker_id === worker.id);
        if (!job || job.status !== 'arrival_registered') {
            throw new error_mapper_1.DomainError('ERR_INVALID_TRANSITION');
        }
        const nowIso = new Date().toISOString();
        job.status = 'in_progress';
        job.updated_at = nowIso;
        const payment = this.state.db.payments.find((p) => p.job_id === job.id && p.worker_id === worker.id);
        if (payment) {
            payment.status = 'confirmed';
            payment.stripe_payment_intent_id = `pi_3Solidez${Date.now().toString().slice(-5)}`;
            payment.payment_attempts = 1;
            payment.updated_at = nowIso;
        }
        const existsComp = this.state.db.jobCompletions.find((c) => c.job_id === job.id);
        if (!existsComp) {
            this.state.db.jobCompletions.push({
                job_id: job.id,
                code: '639204',
                code_expires_at: new Date(Date.now() + HOURS_24_MS).toISOString(),
                attempts: 0,
                renewals: 0,
                used_at: null,
            });
        }
        this.pushNotification({
            userId: worker.id,
            eventType: 'payment_confirmed',
            title: 'Pago confirmado · Trabajo en curso',
            body: `El pago de "${job.title}" fue confirmado. Ya puedes continuar con el trabajo.`,
            category: 'pagos',
            targetRoute: `/(main)/job/${job.id}`,
        });
        this.notify();
    }
    // MÓDULO 9A: FINALIZACIÓN CON CÓDIGO (6 dígitos, máx 5 intentos, vence en 24h, máx 1 reemplazo)
    verifyCompletionCode(jobId, code) {
        const worker = this.requireWorker();
        const job = this.state.db.jobs.find((j) => j.id === jobId && j.selected_worker_id === worker.id);
        if (!job)
            throw new error_mapper_1.DomainError('ERR_NOT_FOUND');
        if (job.status !== 'in_progress') {
            throw new error_mapper_1.DomainError('ERR_INVALID_TRANSITION');
        }
        const formatErr = (0, validators_1.validateCompletionCodeFormat)(code);
        if (formatErr)
            throw new error_mapper_1.DomainError('ERR_VALIDATION', formatErr);
        let comp = this.state.db.jobCompletions.find((c) => c.job_id === job.id);
        if (!comp) {
            comp = {
                job_id: job.id,
                code: '482915',
                code_expires_at: new Date(Date.now() + HOURS_24_MS).toISOString(),
                attempts: 0,
                renewals: 0,
                used_at: null,
            };
            this.state.db.jobCompletions.push(comp);
        }
        if (comp.attempts >= 5) {
            return {
                status: 'blocked',
                remainingAttempts: 0,
                message: 'El código fue bloqueado tras 5 intentos incorrectos. Continúa con la finalización sin código.',
            };
        }
        if (new Date(comp.code_expires_at).getTime() <= Date.now()) {
            return {
                status: 'expired',
                remainingAttempts: Math.max(0, 5 - comp.attempts),
                message: 'El código de 6 dígitos ha vencido tras 24 horas. Puedes solicitar un reemplazo una sola vez.',
            };
        }
        if (code.trim() !== comp.code) {
            comp.attempts += 1;
            const remaining = Math.max(0, 5 - comp.attempts);
            this.notify();
            if (comp.attempts >= 5) {
                return {
                    status: 'blocked',
                    remainingAttempts: 0,
                    message: 'Has alcanzado los 5 intentos permitidos y el código quedó bloqueado. Usa la finalización sin código.',
                };
            }
            return {
                status: 'invalid',
                remainingAttempts: remaining,
                message: `El código no coincide. Te ${remaining === 1 ? 'queda 1 intento' : `quedan ${remaining} intentos`}.`,
            };
        }
        const nowIso = new Date().toISOString();
        comp.used_at = nowIso;
        job.status = 'completed';
        job.completion_method = 'with_code';
        job.completion_requested_at = nowIso;
        job.completed_at = nowIso;
        job.closed_at = nowIso;
        job.updated_at = nowIso;
        const payment = this.state.db.payments.find((p) => p.job_id === job.id && p.worker_id === worker.id);
        if (payment) {
            payment.status = 'transferred';
            payment.stripe_transfer_id = `tr_3Solidez${Date.now().toString().slice(-5)}`;
            payment.updated_at = nowIso;
        }
        this.pushNotification({
            userId: worker.id,
            eventType: 'job_completed',
            title: 'Trabajo finalizado correctamente',
            body: `"${job.title}" fue cerrado con código. Ya puedes evaluar al empleador.`,
            category: 'trabajos',
            targetRoute: `/(main)/job/${job.id}/review`,
        });
        this.notify();
        return {
            status: 'ok',
            remainingAttempts: Math.max(0, 5 - comp.attempts),
            message: 'Código validado. El trabajo quedó finalizado correctamente.',
        };
    }
    requestReplacementCode(jobId) {
        const worker = this.requireWorker();
        const job = this.state.db.jobs.find((j) => j.id === jobId && j.selected_worker_id === worker.id);
        if (!job || job.status !== 'in_progress') {
            throw new error_mapper_1.DomainError('ERR_INVALID_TRANSITION');
        }
        let comp = this.state.db.jobCompletions.find((c) => c.job_id === job.id);
        if (!comp) {
            comp = {
                job_id: job.id,
                code: '482915',
                code_expires_at: new Date(Date.now() + HOURS_24_MS).toISOString(),
                attempts: 0,
                renewals: 0,
                used_at: null,
            };
            this.state.db.jobCompletions.push(comp);
        }
        if (comp.renewals >= 1) {
            throw new error_mapper_1.DomainError('ERR_CODE_RENEWAL_LIMIT');
        }
        comp.renewals = 1;
        comp.attempts = 0;
        comp.code = '731942';
        comp.code_expires_at = new Date(Date.now() + HOURS_24_MS).toISOString();
        this.pushNotification({
            userId: worker.id,
            eventType: 'code_replaced',
            title: 'Código de reemplazo generado',
            body: `Se solicitó un nuevo código al empleador para "${job.title}" con vigencia de 24 horas.`,
            category: 'trabajos',
            targetRoute: `/(main)/job/${job.id}/completion`,
        });
        this.notify();
        return 'Se solicitó un código de reemplazo al empleador (vigente por 24 horas). Pídelo por chat o en persona.';
    }
    // MÓDULO 9B: FINALIZACIÓN SIN CÓDIGO (hasta 5 evidencias JPG/PNG/PDF <= 10 MB, 24h espera)
    requestCompletionWithoutCode(jobId, evidences, notes) {
        const worker = this.requireWorker();
        const job = this.state.db.jobs.find((j) => j.id === jobId && j.selected_worker_id === worker.id);
        if (!job)
            throw new error_mapper_1.DomainError('ERR_NOT_FOUND');
        if (job.status !== 'in_progress') {
            throw new error_mapper_1.DomainError('ERR_INVALID_TRANSITION');
        }
        if (evidences.length > 5) {
            throw new error_mapper_1.DomainError('ERR_ATTACHMENT_LIMIT');
        }
        for (let i = 0; i < evidences.length; i += 1) {
            const err = (0, validators_1.validateAttachmentCandidate)(evidences[i], 'completion_evidence', i);
            if (err)
                throw new error_mapper_1.DomainError('ERR_INVALID_ATTACHMENT', err);
        }
        const nowIso = new Date().toISOString();
        evidences.forEach((f, idx) => {
            this.state.db.attachments.push({
                id: `att-comp-${Date.now()}-${idx}`,
                owner_id: worker.id,
                kind: 'completion_evidence',
                job_id: job.id,
                case_id: null,
                storage_path: `/completion/${job.id}/${f.file_name}`,
                file_name: f.file_name,
                mime_type: f.mime_type,
                size_bytes: f.size_bytes,
                caption: notes?.trim() || undefined,
                created_at: nowIso,
            });
        });
        job.status = 'completion_requested';
        job.completion_method = 'without_code';
        job.completion_requested_at = nowIso;
        job.updated_at = nowIso;
        const payment = this.state.db.payments.find((p) => p.job_id === job.id && p.worker_id === worker.id);
        if (payment && payment.status === 'confirmed') {
            payment.status = 'transfer_pending';
            payment.updated_at = nowIso;
        }
        this.pushNotification({
            userId: worker.id,
            eventType: 'completion_requested',
            title: 'Solicitud de finalización enviada',
            body: `Tu solicitud para "${job.title}" queda pendiente de confirmación del empleador por hasta 24 horas.`,
            category: 'trabajos',
            targetRoute: `/(main)/job/${job.id}`,
        });
        this.notify();
    }
    // ---------------------------------------------------------------------------
    // MÓDULO 10: CHAT CON EMPLEADORES (Solo trabajos seleccionados, sin adjuntos)
    // ---------------------------------------------------------------------------
    listChatThreads() {
        const worker = this.requireWorker();
        const myJobs = this.state.db.jobs.filter((j) => j.selected_worker_id === worker.id &&
            j.status !== 'published' &&
            j.status !== 'has_applications');
        return myJobs
            .map((job) => {
            const emp = this.state.db.profiles.find((p) => p.id === job.employer_id);
            const msgs = this.state.db.chatMessages
                .filter((m) => m.job_id === job.id &&
                m.worker_id === worker.id &&
                m.moderation_status === 'visible')
                .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
            const last = msgs[msgs.length - 1];
            const unreadCount = msgs.filter((m) => m.sender_id !== worker.id && !m.read_by_worker).length;
            return {
                job_id: job.id,
                job_title: job.title,
                job_status: job.status,
                employer_id: job.employer_id,
                employer_name: emp?.full_name ?? 'Empleador',
                employer_initials: emp?.avatar_initials ?? (0, formatters_1.getInitials)(emp?.full_name ?? 'EM'),
                employer_tone: emp?.avatar_tone ?? '#fbe8d8',
                last_message: last?.body ?? 'Conversación habilitada para coordinar tu trabajo.',
                last_message_at: last?.created_at ?? job.assigned_at ?? job.updated_at,
                unread_count: unreadCount,
                messages: msgs,
            };
        })
            .sort((a, b) => new Date(b.last_message_at).getTime() -
            new Date(a.last_message_at).getTime());
    }
    getChatThread(jobId) {
        return this.listChatThreads().find((t) => t.job_id === jobId) ?? null;
    }
    markThreadRead(jobId) {
        const worker = this.requireWorker();
        let changed = false;
        this.state.db.chatMessages.forEach((m) => {
            if (m.job_id === jobId &&
                m.worker_id === worker.id &&
                m.sender_id !== worker.id &&
                !m.read_by_worker) {
                m.read_by_worker = true;
                changed = true;
            }
        });
        if (changed)
            this.notify();
    }
    sendChatMessage(jobId, body) {
        const worker = this.requireWorker();
        const job = this.state.db.jobs.find((j) => j.id === jobId && j.selected_worker_id === worker.id);
        if (!job)
            throw new error_mapper_1.DomainError('ERR_FORBIDDEN');
        const err = (0, validators_1.validateChatMessageBody)(body);
        if (err)
            throw new error_mapper_1.DomainError('ERR_VALIDATION', err);
        this.state.db.chatMessages.push({
            id: `msg-${Date.now()}`,
            job_id: job.id,
            worker_id: worker.id,
            sender_id: worker.id,
            body: body.trim(),
            moderation_status: 'visible',
            read_by_worker: true,
            created_at: new Date().toISOString(),
        });
        this.notify();
    }
    // ---------------------------------------------------------------------------
    // MÓDULO 11: PAGOS E INGRESOS
    // ---------------------------------------------------------------------------
    getPaymentsSummaryAndHistory() {
        const worker = this.requireWorker();
        const myPayments = this.state.db.payments
            .filter((p) => p.worker_id === worker.id)
            .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());
        const items = myPayments.map((p) => {
            const job = this.state.db.jobs.find((j) => j.id === p.job_id);
            const emp = this.state.db.profiles.find((u) => u.id === p.employer_id);
            const linkedCase = this.state.db.cases.find((c) => c.case_type === 'claim' && c.job_id === p.job_id);
            return {
                id: p.id,
                job_id: p.job_id,
                folio: (0, formatters_1.formatFolio)(p.id, 'PAG'),
                job_title: job?.title ?? 'Trabajo temporal',
                category: job?.category ?? 'otros',
                employer_name: emp?.full_name ?? 'Empleador',
                job_date: job?.job_date ?? p.created_at.slice(0, 10),
                job_status: job?.status ?? 'completed',
                job_amount_mxn: p.job_amount_mxn,
                status: p.status,
                stripe_transfer_id: p.stripe_transfer_id,
                case_id: linkedCase?.id ?? null,
                case_decision: linkedCase?.decision ?? null,
                approved_transfer_amount: linkedCase?.approved_transfer_amount ?? null,
                resolution_notes: linkedCase?.resolution_notes ?? null,
                updated_at: p.updated_at,
            };
        });
        const totalTransferredMxn = items.reduce((sum, item) => {
            if (item.status === 'transferred')
                return sum + item.job_amount_mxn;
            if (item.status === 'partial_settlement_completed') {
                return sum + (item.approved_transfer_amount ?? item.job_amount_mxn);
            }
            return sum;
        }, 0);
        const totalPendingMxn = items.reduce((sum, item) => {
            if (item.status === 'confirmed' ||
                item.status === 'payment_pending' ||
                item.status === 'transfer_pending' ||
                item.status === 'transfer_failed' ||
                item.status === 'partial_settlement_pending') {
                return sum + item.job_amount_mxn;
            }
            return sum;
        }, 0);
        const totalInClaimMxn = items.reduce((sum, item) => {
            if (item.status === 'in_claim')
                return sum + item.job_amount_mxn;
            return sum;
        }, 0);
        return {
            totalTransferredMxn,
            totalPendingMxn,
            totalInClaimMxn,
            items,
        };
    }
    // ---------------------------------------------------------------------------
    // MÓDULO 12: NOTIFICACIONES
    // ---------------------------------------------------------------------------
    listNotifications() {
        const worker = this.requireWorker();
        return this.state.db.notifications
            .filter((n) => n.user_id === worker.id)
            .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    }
    markNotificationRead(notificationId) {
        const worker = this.requireWorker();
        const item = this.state.db.notifications.find((n) => n.id === notificationId && n.user_id === worker.id);
        if (item && !item.read_at) {
            item.read_at = new Date().toISOString();
            this.notify();
        }
    }
    markAllNotificationsRead() {
        const worker = this.requireWorker();
        const nowIso = new Date().toISOString();
        let changed = false;
        this.state.db.notifications.forEach((n) => {
            if (n.user_id === worker.id && !n.read_at) {
                n.read_at = nowIso;
                changed = true;
            }
        });
        if (changed)
            this.notify();
    }
    // ---------------------------------------------------------------------------
    // MÓDULO 13: CASOS, RECLAMACIONES, REPORTES Y SOPORTE
    // ---------------------------------------------------------------------------
    listMyCases() {
        const worker = this.requireWorker();
        return this.state.db.cases
            .filter((c) => c.reporter_id === worker.id)
            .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
            .map((c) => {
            const job = c.job_id
                ? this.state.db.jobs.find((j) => j.id === c.job_id)
                : null;
            const msgs = this.state.db.caseMessages
                .filter((m) => m.case_id === c.id && !m.is_internal)
                .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
                .map((m) => {
                const author = this.state.db.profiles.find((p) => p.id === m.author_id);
                return {
                    ...m,
                    author_name: author?.full_name ?? 'Soporte',
                    author_role: author?.role ?? 'admin',
                };
            });
            const atts = this.state.db.attachments.filter((a) => a.case_id === c.id);
            return {
                ...c,
                folio: (0, formatters_1.formatFolio)(c.id, c.case_type === 'claim'
                    ? 'REC'
                    : c.case_type === 'report'
                        ? 'REP'
                        : 'TKT'),
                job_title: job?.title ?? null,
                job_folio: job ? (0, formatters_1.formatFolio)(job.id, 'TRB') : null,
                job_amount_mxn: job?.fixed_payment_mxn ?? null,
                messages: msgs,
                attachments: atts,
            };
        });
    }
    createCase(input) {
        const worker = this.requireWorker();
        const errors = (0, validators_1.validateOpenCaseForm)({
            case_type: input.case_type,
            job_id: input.job_id ?? null,
            ticket_category: input.ticket_category ?? null,
            description: input.description,
        });
        const firstErr = Object.values(errors)[0];
        if (firstErr)
            throw new error_mapper_1.DomainError('ERR_VALIDATION', firstErr);
        const files = input.attachments ?? [];
        if (files.length > 5)
            throw new error_mapper_1.DomainError('ERR_ATTACHMENT_LIMIT');
        for (let i = 0; i < files.length; i += 1) {
            const err = (0, validators_1.validateAttachmentCandidate)(files[i], 'case_evidence', i);
            if (err)
                throw new error_mapper_1.DomainError('ERR_INVALID_ATTACHMENT', err);
        }
        if (input.case_type === 'claim' && input.job_id) {
            const alreadyOpen = this.state.db.cases.some((c) => c.case_type === 'claim' &&
                c.job_id === input.job_id &&
                c.status !== 'closed');
            if (alreadyOpen)
                throw new error_mapper_1.DomainError('ERR_CLAIM_ALREADY_OPEN');
        }
        const nowIso = new Date().toISOString();
        const caseId = `case-${input.case_type}-${Date.now()}`;
        const initialStatus = input.case_type === 'report' ? 'pending' : 'open';
        this.state.db.cases.unshift({
            id: caseId,
            case_type: input.case_type,
            status: initialStatus,
            source: 'user',
            reporter_id: worker.id,
            job_id: input.job_id ?? null,
            reported_user_id: input.reported_user_id ?? null,
            target_type: input.target_type ?? null,
            target_id: input.target_id ?? null,
            ticket_category: input.case_type === 'ticket' ? (input.ticket_category ?? 'job') : null,
            description: input.description.trim(),
            decision: null,
            approved_transfer_amount: null,
            approved_refund_amount: null,
            resolution_notes: null,
            assigned_admin_id: 'usr-adm-soporte',
            resolved_at: null,
            closed_at: null,
            auto_close_deadline: null,
            created_at: nowIso,
            updated_at: nowIso,
        });
        files.forEach((f, idx) => {
            this.state.db.attachments.push({
                id: `att-case-${Date.now()}-${idx}`,
                owner_id: worker.id,
                kind: 'case_evidence',
                job_id: input.job_id ?? null,
                case_id: caseId,
                storage_path: `/cases/${caseId}/${f.file_name}`,
                file_name: f.file_name,
                mime_type: f.mime_type,
                size_bytes: f.size_bytes,
                created_at: nowIso,
            });
        });
        if (input.case_type === 'claim' && input.job_id) {
            const job = this.state.db.jobs.find((j) => j.id === input.job_id);
            if (job && !['completed', 'cancelled', 'expired'].includes(job.status)) {
                job.status = 'in_claim';
                job.updated_at = nowIso;
            }
            const payment = this.state.db.payments.find((p) => p.job_id === input.job_id && p.worker_id === worker.id);
            if (payment) {
                payment.status = 'in_claim';
                payment.updated_at = nowIso;
            }
        }
        const titleMap = {
            ticket: 'Ticket de soporte registrado',
            claim: 'Reclamación abierta',
            report: 'Reporte enviado',
        };
        this.pushNotification({
            userId: worker.id,
            eventType: `${input.case_type}_created`,
            title: titleMap[input.case_type],
            body: input.case_type === 'claim'
                ? 'Tu reclamación quedó registrada. Los fondos permanecen bloqueados mientras el caso esté abierto.'
                : 'Registramos tu solicitud y te avisaremos cuando reciba actualización.',
            category: 'casos',
            targetRoute: '/(main)/cases',
        });
        this.notify();
        return caseId;
    }
    addCaseReply(caseId, body) {
        const worker = this.requireWorker();
        const target = this.state.db.cases.find((c) => c.id === caseId && c.reporter_id === worker.id);
        if (!target)
            throw new error_mapper_1.DomainError('ERR_NOT_FOUND');
        const err = (0, validators_1.validateCaseMessageBody)(body);
        if (err)
            throw new error_mapper_1.DomainError('ERR_VALIDATION', err);
        const nowIso = new Date().toISOString();
        this.state.db.caseMessages.push({
            id: `cmsg-${Date.now()}`,
            case_id: caseId,
            author_id: worker.id,
            body: body.trim(),
            is_internal: false,
            created_at: nowIso,
        });
        target.updated_at = nowIso;
        this.notify();
    }
    objectCaseResolution(caseId, reason) {
        const worker = this.requireWorker();
        const target = this.state.db.cases.find((c) => c.id === caseId && c.reporter_id === worker.id);
        if (!target)
            throw new error_mapper_1.DomainError('ERR_NOT_FOUND');
        if (target.status !== 'resolved') {
            throw new error_mapper_1.DomainError('ERR_INVALID_TRANSITION');
        }
        if (target.auto_close_deadline &&
            new Date(target.auto_close_deadline).getTime() <= Date.now()) {
            throw new error_mapper_1.DomainError('ERR_OBJECTION_WINDOW_EXPIRED');
        }
        const err = (0, validators_1.validateCaseMessageBody)(reason);
        if (err)
            throw new error_mapper_1.DomainError('ERR_VALIDATION', err);
        const nowIso = new Date().toISOString();
        target.status = 'in_review';
        target.updated_at = nowIso;
        this.state.db.caseMessages.push({
            id: `cmsg-obj-${Date.now()}`,
            case_id: caseId,
            author_id: worker.id,
            body: `Objeción a la resolución: ${reason.trim()}`,
            is_internal: false,
            created_at: nowIso,
        });
        this.notify();
    }
    // ---------------------------------------------------------------------------
    // MÓDULO 14: EVALUACIONES AL EMPLEADOR
    // ---------------------------------------------------------------------------
    submitEmployerReview(jobId, rating, comment) {
        const worker = this.requireWorker();
        const job = this.state.db.jobs.find((j) => j.id === jobId && j.selected_worker_id === worker.id);
        if (!job)
            throw new error_mapper_1.DomainError('ERR_NOT_FOUND');
        if (job.status !== 'completed') {
            throw new error_mapper_1.DomainError('ERR_INVALID_TRANSITION', 'Solo puedes evaluar empleadores con los que hayas finalizado un trabajo.');
        }
        const exists = this.state.db.reviews.some((r) => r.job_id === jobId && r.reviewer_id === worker.id);
        if (exists)
            throw new error_mapper_1.DomainError('ERR_ALREADY_REVIEWED');
        const err = (0, validators_1.validateReviewInput)(rating, comment);
        if (err)
            throw new error_mapper_1.DomainError('ERR_VALIDATION', err);
        const review = {
            id: `rev-${Date.now()}`,
            job_id: job.id,
            reviewer_id: worker.id,
            reviewee_id: job.employer_id,
            rating,
            comment: comment.trim(),
            moderation_status: 'visible',
            created_at: new Date().toISOString(),
        };
        this.state.db.reviews.unshift(review);
        this.pushNotification({
            userId: worker.id,
            eventType: 'review_submitted',
            title: 'Evaluación publicada',
            body: `Tu calificación para "${job.title}" fue guardada correctamente.`,
            category: 'trabajos',
            targetRoute: `/(main)/job/${job.id}`,
        });
        this.notify();
        return review;
    }
    // ---------------------------------------------------------------------------
    // MÓDULO 15: PERFIL Y CONFIGURACIÓN DEL TRABAJADOR
    // ---------------------------------------------------------------------------
    updateWorkerProfile(input) {
        const worker = this.requireWorker();
        const nameErr = (0, validators_1.validateFullName)(input.full_name);
        if (nameErr)
            throw new error_mapper_1.DomainError('ERR_VALIDATION', nameErr);
        const phoneErr = (0, validators_1.validatePhone)(input.phone);
        if (phoneErr)
            throw new error_mapper_1.DomainError('ERR_VALIDATION', phoneErr);
        const skillsErr = (0, validators_1.validateWorkerBioField)(input.skills, 'Habilidades');
        if (skillsErr)
            throw new error_mapper_1.DomainError('ERR_VALIDATION', skillsErr);
        const availErr = (0, validators_1.validateWorkerBioField)(input.availability, 'Disponibilidad');
        if (availErr)
            throw new error_mapper_1.DomainError('ERR_VALIDATION', availErr);
        worker.full_name = input.full_name.trim();
        worker.phone = input.phone.trim();
        worker.skills = input.skills.trim() || null;
        worker.availability = input.availability.trim() || null;
        worker.avatar_initials = (0, formatters_1.getInitials)(worker.full_name);
        if (input.avatar_tone)
            worker.avatar_tone = input.avatar_tone;
        if (input.photo_path !== undefined)
            worker.photo_path = input.photo_path;
        worker.updated_at = new Date().toISOString();
        this.notify();
        return { ...worker };
    }
    getWorkerReceivedReviews() {
        const worker = this.requireWorker();
        return this.state.db.reviews
            .filter((r) => r.reviewee_id === worker.id && r.moderation_status === 'visible')
            .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
            .map((r) => {
            const reviewer = this.state.db.profiles.find((p) => p.id === r.reviewer_id);
            const job = this.state.db.jobs.find((j) => j.id === r.job_id);
            return {
                id: r.id,
                job_id: r.job_id,
                job_title: job?.title ?? 'Trabajo temporal',
                reviewer_name: reviewer?.full_name ?? 'Empleador',
                rating: r.rating,
                comment: r.comment,
                created_at: r.created_at,
            };
        });
    }
}
exports.workerStore = new WorkerStoreManager();
function useWorkerStore(selector) {
    return (0, react_1.useSyncExternalStore)(exports.workerStore.subscribe, () => selector(exports.workerStore.getState()), () => selector(exports.workerStore.getState()));
}

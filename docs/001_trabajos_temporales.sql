-- =============================================================================
-- SISTEMA DE TRABAJOS TEMPORALES - MIGRACION 001 (v2)
-- PostgreSQL 15+ / Supabase. SRS de referencia: v1.4 (18/11/2026) y decisiones
-- D-01..D-11 confirmadas por Eber (19/11/2026).
--
-- FUENTE UNICA DE VERDAD del esquema: este archivo. El ERD y los tipos de
-- TypeScript se generan a partir de la base (supabase gen types), no se copian.
--
-- Principios de esta version:
--  * Los clientes (rol authenticated) solo LEEN tablas con RLS estricta. Toda
--    escritura sensible pasa por funciones RPC (SECURITY DEFINER) que validan
--    rol, estado, plazos y hora del servidor.
--  * Lo privado (domicilio exacto, codigo de finalizacion, telefono) vive en
--    tablas o funciones separadas; nunca en la tabla que ven los trabajadores.
--  * Las transiciones de estado se validan en la base (tabla state_transitions).
--
-- Zona horaria del proyecto: America/Hermosillo (PENDIENTE DE CONFIRMAR, ver
-- app.tz()). Cambiarla requiere recrear las columnas start_at / end_at.
-- =============================================================================

BEGIN;

CREATE SCHEMA IF NOT EXISTS app;

-- -----------------------------------------------------------------------------
-- 1. TIPOS ENUMERADOS
-- (Para agregar valores: ALTER TYPE ... ADD VALUE en una migracion propia.)
-- -----------------------------------------------------------------------------
CREATE TYPE user_role AS ENUM ('employer', 'worker', 'admin');
CREATE TYPE account_status AS ENUM ('active', 'warned', 'suspended', 'blocked', 'soft_deleted');
CREATE TYPE job_category AS ENUM ('limpieza', 'pintura', 'jardineria', 'mudanzas', 'eventos', 'otros');

-- job_status: 'expired' = Vencido (trabajo). application_status: 'expired' = Expirada.
CREATE TYPE job_status AS ENUM (
    'published', 'has_applications', 'assigned', 'arrival_registered', 'in_progress',
    'completion_requested', 'in_claim', 'completed', 'cancelled', 'expired'
);
CREATE TYPE application_status AS ENUM ('pending', 'accepted', 'rejected', 'withdrawn', 'expired');
CREATE TYPE completion_method AS ENUM ('with_code', 'without_code');

CREATE TYPE payment_status AS ENUM (
    'not_started', 'payment_pending', 'confirmed', 'failed', 'in_claim',
    'transfer_pending', 'transfer_failed', 'transferred',
    'partial_settlement_pending', 'partial_settlement_failed', 'partial_settlement_completed',
    'refund_failed',            -- D-05: reembolso total fallido
    'refunded', 'cancelled'
);
CREATE TYPE payment_operation_type AS ENUM ('charge', 'transfer', 'refund');
CREATE TYPE payment_operation_status AS ENUM ('pending', 'succeeded', 'failed');

CREATE TYPE case_type AS ENUM ('ticket', 'claim', 'report');
-- ticket/claim: open -> in_review -> resolved -> closed. report: pending -> in_review -> attended | dismissed
CREATE TYPE case_status AS ENUM ('open', 'pending', 'in_review', 'resolved', 'closed', 'dismissed', 'attended');
CREATE TYPE case_decision AS ENUM ('transfer_full', 'refund_full', 'partial');
CREATE TYPE case_source AS ENUM ('user', 'system');
CREATE TYPE ticket_category AS ENUM ('account', 'publication', 'application', 'job', 'payment', 'technical');
CREATE TYPE report_target AS ENUM ('user', 'job', 'application', 'review', 'chat_message');

CREATE TYPE moderation_status AS ENUM ('visible', 'hidden', 'removed');
CREATE TYPE sanction_type AS ENUM ('warning', 'suspension_1d', 'suspension_7d', 'suspension_30d', 'permanent_block', 'soft_delete');
CREATE TYPE attachment_kind AS ENUM ('job_photo', 'completion_evidence', 'case_evidence');

-- -----------------------------------------------------------------------------
-- 2. FUNCIONES AUXILIARES SIN DEPENDENCIA DE TABLAS (schema app, no expuesto)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION app.tz() RETURNS text
LANGUAGE sql IMMUTABLE PARALLEL SAFE AS $$ SELECT 'America/Hermosillo'::text $$;

CREATE OR REPLACE FUNCTION app.haversine_km(lat1 float8, lon1 float8, lat2 float8, lon2 float8)
RETURNS float8 LANGUAGE sql IMMUTABLE PARALLEL SAFE AS $$
    SELECT 2 * 6371 * asin(least(1, sqrt(
        power(sin(radians(lat2 - lat1) / 2), 2) +
        cos(radians(lat1)) * cos(radians(lat2)) * power(sin(radians(lon2 - lon1) / 2), 2)
    )))
$$;

-- Codigo de 6 digitos a partir de gen_random_uuid() (fuente criptografica).
CREATE OR REPLACE FUNCTION app.gen_code() RETURNS text
LANGUAGE sql VOLATILE AS $$
    SELECT lpad((('x' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 8))::bit(32)::bigint % 1000000)::text, 6, '0')
$$;

CREATE OR REPLACE FUNCTION app.touch_updated_at() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
    NEW.updated_at := now();
    RETURN NEW;
END;
$$;

-- -----------------------------------------------------------------------------
-- 3. TABLAS
-- -----------------------------------------------------------------------------

-- 3.1 Perfiles. Se crean con complete_profile() (RF-03), nunca por INSERT directo.
CREATE TABLE public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE RESTRICT,
    role user_role NOT NULL,
    full_name VARCHAR(150) NOT NULL,
    phone VARCHAR(20) NOT NULL,
    birth_date DATE NOT NULL,
    photo_path TEXT,                       -- ruta en Storage (JPG/PNG <= 10 MB)
    skills VARCHAR(300),                   -- solo trabajador
    availability VARCHAR(300),             -- solo trabajador
    stripe_account_id VARCHAR(255),        -- RF-19: solo identificador y estado
    stripe_onboarding_complete BOOLEAN NOT NULL DEFAULT FALSE,
    account_status account_status NOT NULL DEFAULT 'active',
    suspended_until TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT check_minimum_age CHECK (birth_date <= (CURRENT_DATE - INTERVAL '18 years')::date),
    CONSTRAINT check_worker_only_fields CHECK (role = 'worker' OR (skills IS NULL AND availability IS NULL))
);

-- 3.2 Aceptacion de terminos y aviso de privacidad (RF-33). Solo INSERT via RPC.
CREATE TABLE public.terms_acceptances (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id),
    document TEXT NOT NULL CHECK (document IN ('terms', 'privacy')),
    version VARCHAR(20) NOT NULL,
    accepted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (user_id, document, version)
);

-- 3.3 Ubicacion de referencia del trabajador (RF-08). Solo via save_worker_location().
-- recent_changes guarda los ultimos cambios de coordenadas: ventana REAL de 24 h.
CREATE TABLE public.worker_locations (
    worker_id UUID PRIMARY KEY REFERENCES public.profiles(id),
    latitude NUMERIC(10, 8) NOT NULL CHECK (latitude BETWEEN -90 AND 90),
    longitude NUMERIC(11, 8) NOT NULL CHECK (longitude BETWEEN -180 AND 180),
    search_radius_km INT NOT NULL DEFAULT 10 CHECK (search_radius_km IN (5, 10, 25, 50)),
    recent_changes TIMESTAMPTZ[] NOT NULL DEFAULT '{}',
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3.4 Trabajos. Solo datos NO sensibles; lo privado esta en job_private / job_completion.
CREATE TABLE public.jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    employer_id UUID NOT NULL REFERENCES public.profiles(id),
    title VARCHAR(150) NOT NULL,
    description TEXT NOT NULL,
    category job_category NOT NULL,
    fixed_payment_mxn NUMERIC(10, 2) NOT NULL,
    job_date DATE NOT NULL,
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    start_at TIMESTAMPTZ GENERATED ALWAYS AS (((job_date + start_time) AT TIME ZONE app.tz())) STORED,
    end_at TIMESTAMPTZ GENERATED ALWAYS AS (((job_date + end_time) AT TIME ZONE app.tz())) STORED,
    conditions TEXT,
    neighborhood VARCHAR(150) NOT NULL,                -- colonia/localidad publica
    status job_status NOT NULL DEFAULT 'published',
    moderation_status moderation_status NOT NULL DEFAULT 'visible',
    -- Ronda de seleccion: cada seleccion nueva incrementa el contador (B-1)
    selected_worker_id UUID REFERENCES public.profiles(id),
    selection_round INT NOT NULL DEFAULT 0,
    selection_expires_at TIMESTAMPTZ,
    assigned_at TIMESTAMPTZ,
    arrived_at TIMESTAMPTZ,                            -- inicia plazo de cobro de 30 min
    completion_method completion_method,
    completion_requested_at TIMESTAMPTZ,               -- inicia plazo de 24 h sin codigo
    completed_at TIMESTAMPTZ,
    closed_at TIMESTAMPTZ,                             -- entrada a estado terminal
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT check_payment_range CHECK (fixed_payment_mxn >= 10.00 AND fixed_payment_mxn <= 100000.00),
    CONSTRAINT check_time_order CHECK (end_time > start_time)  -- sin cruce de medianoche
);

-- 3.5 Datos privados del trabajo (RNF-06): domicilio, referencia y pin exactos.
CREATE TABLE public.job_private (
    job_id UUID PRIMARY KEY REFERENCES public.jobs(id) ON DELETE CASCADE,
    exact_address TEXT NOT NULL,
    exact_latitude NUMERIC(10, 8) NOT NULL CHECK (exact_latitude BETWEEN -90 AND 90),
    exact_longitude NUMERIC(11, 8) NOT NULL CHECK (exact_longitude BETWEEN -180 AND 180)
);

-- 3.6 Codigo de finalizacion (RF-21). Lo lee SOLO el empleador; el trabajador lo
-- valida con verify_completion_code() y nunca lo ve.
CREATE TABLE public.job_completion (
    job_id UUID PRIMARY KEY REFERENCES public.jobs(id) ON DELETE CASCADE,
    code VARCHAR(6) NOT NULL,
    code_expires_at TIMESTAMPTZ NOT NULL,
    attempts INT NOT NULL DEFAULT 0 CHECK (attempts BETWEEN 0 AND 5),
    renewals INT NOT NULL DEFAULT 0 CHECK (renewals BETWEEN 0 AND 1),
    used_at TIMESTAMPTZ
);

-- 3.7 Postulaciones (RF-11, RF-12)
CREATE TABLE public.job_applications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    job_id UUID NOT NULL REFERENCES public.jobs(id),
    worker_id UUID NOT NULL REFERENCES public.profiles(id),
    status application_status NOT NULL DEFAULT 'pending',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT unique_worker_job_application UNIQUE (job_id, worker_id)
);

-- 3.8 Aceptacion de condiciones, por ronda de seleccion (RF-16, B-1)
CREATE TABLE public.job_confirmations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    job_id UUID NOT NULL REFERENCES public.jobs(id),
    user_id UUID NOT NULL REFERENCES public.profiles(id),
    selection_round INT NOT NULL,
    confirmed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT unique_job_user_round UNIQUE (job_id, user_id, selection_round)
);

-- 3.9 Pagos (RF-17, RF-18). Comision y total GENERADOS: no pueden divergir.
-- Se crea al registrar la llegada (register_arrival).
CREATE TABLE public.payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    job_id UUID NOT NULL UNIQUE REFERENCES public.jobs(id),
    employer_id UUID NOT NULL REFERENCES public.profiles(id),
    worker_id UUID NOT NULL REFERENCES public.profiles(id),
    job_amount_mxn NUMERIC(10, 2) NOT NULL CHECK (job_amount_mxn >= 10.00),
    platform_fee_mxn NUMERIC(10, 2) GENERATED ALWAYS AS (round(job_amount_mxn * 0.10, 2)) STORED,
    total_charged_mxn NUMERIC(10, 2) GENERATED ALWAYS AS (job_amount_mxn + round(job_amount_mxn * 0.10, 2)) STORED,
    stripe_payment_intent_id VARCHAR(255),
    status payment_status NOT NULL DEFAULT 'payment_pending',
    payment_attempts INT NOT NULL DEFAULT 0 CHECK (payment_attempts BETWEEN 0 AND 3),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3.10 Operaciones contra Stripe: una fila por intento, con llave de idempotencia (B-3).
CREATE TABLE public.payment_operations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    payment_id UUID NOT NULL REFERENCES public.payments(id),
    op_type payment_operation_type NOT NULL,
    amount_mxn NUMERIC(10, 2) NOT NULL CHECK (amount_mxn > 0),
    idempotency_key TEXT NOT NULL UNIQUE,
    status payment_operation_status NOT NULL DEFAULT 'pending',
    stripe_object_id VARCHAR(255),
    error_message TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3.11 Eventos de webhook de Stripe: idempotencia y auditoria (RNF-07, UI-ADM-07)
CREATE TABLE public.stripe_events (
    id TEXT PRIMARY KEY,                    -- evt_...
    event_type TEXT NOT NULL,
    payload JSONB NOT NULL,
    received_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    processed_at TIMESTAMPTZ,
    error_message TEXT
);

-- 3.12 Chat (RF-14). Una conversacion por (trabajo, trabajador): evita fuga entre rondas (S-1).
CREATE TABLE public.chat_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    job_id UUID NOT NULL REFERENCES public.jobs(id),
    worker_id UUID NOT NULL REFERENCES public.profiles(id),
    sender_id UUID NOT NULL REFERENCES public.profiles(id),
    body TEXT NOT NULL CHECK (length(body) BETWEEN 1 AND 2000),
    moderation_status moderation_status NOT NULL DEFAULT 'visible',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3.13 Casos unificados (RF-25..RF-29)
CREATE TABLE public.cases (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    case_type case_type NOT NULL,
    status case_status NOT NULL,
    source case_source NOT NULL DEFAULT 'user',         -- B-5: tickets generados por el sistema
    reporter_id UUID REFERENCES public.profiles(id),
    job_id UUID REFERENCES public.jobs(id),
    reported_user_id UUID REFERENCES public.profiles(id),
    target_type report_target,                          -- I-1: objeto reportado
    target_id UUID,
    ticket_category ticket_category,
    description TEXT NOT NULL,
    decision case_decision,
    approved_transfer_amount NUMERIC(10, 2) CHECK (approved_transfer_amount >= 0),
    approved_refund_amount NUMERIC(10, 2) CHECK (approved_refund_amount >= 0),
    resolution_notes TEXT,
    assigned_admin_id UUID REFERENCES public.profiles(id),
    resolved_at TIMESTAMPTZ,
    closed_at TIMESTAMPTZ,
    auto_close_deadline TIMESTAMPTZ,                    -- resolved_at + 7 dias
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT check_reporter CHECK (source = 'system' OR reporter_id IS NOT NULL),
    CONSTRAINT check_claim_job CHECK (case_type <> 'claim' OR job_id IS NOT NULL),
    CONSTRAINT check_ticket_category CHECK (case_type <> 'ticket' OR ticket_category IS NOT NULL),
    CONSTRAINT check_report_target CHECK (case_type <> 'report' OR (target_type IS NOT NULL AND target_id IS NOT NULL)),
    CONSTRAINT check_status_by_type CHECK (
        (case_type = 'report' AND status IN ('pending', 'in_review', 'attended', 'dismissed')) OR
        (case_type <> 'report' AND status IN ('open', 'in_review', 'resolved', 'closed'))
    ),
    CONSTRAINT check_decision_amounts CHECK (
        (decision IS NULL AND approved_transfer_amount IS NULL AND approved_refund_amount IS NULL) OR
        (decision IS NOT NULL AND approved_transfer_amount IS NOT NULL AND approved_refund_amount IS NOT NULL)
    )
);
-- Una sola reclamacion abierta por trabajo (B-2)
CREATE UNIQUE INDEX one_open_claim_per_job ON public.cases (job_id)
    WHERE case_type = 'claim' AND status <> 'closed';

CREATE TABLE public.case_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    case_id UUID NOT NULL REFERENCES public.cases(id),
    author_id UUID NOT NULL REFERENCES public.profiles(id),
    body TEXT NOT NULL CHECK (length(body) BETWEEN 1 AND 4000),
    is_internal BOOLEAN NOT NULL DEFAULT FALSE,         -- nota solo para administradores
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3.14 Evaluaciones (RF-31). Se crean con submit_review().
CREATE TABLE public.reviews (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    job_id UUID NOT NULL REFERENCES public.jobs(id),
    reviewer_id UUID NOT NULL REFERENCES public.profiles(id),
    reviewee_id UUID NOT NULL REFERENCES public.profiles(id),
    rating INT NOT NULL CHECK (rating BETWEEN 1 AND 5),
    comment TEXT,
    moderation_status moderation_status NOT NULL DEFAULT 'visible',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT unique_job_reviewer UNIQUE (job_id, reviewer_id),
    CONSTRAINT check_not_self_review CHECK (reviewer_id <> reviewee_id)
);

-- 3.15 Sanciones (RF-29, RF-30) y bitacora de moderacion (UI-ADM-05)
CREATE TABLE public.user_sanctions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id),
    admin_id UUID NOT NULL REFERENCES public.profiles(id),
    sanction sanction_type NOT NULL,
    reason TEXT NOT NULL,
    case_id UUID REFERENCES public.cases(id),
    expires_at TIMESTAMPTZ,
    revoked_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.moderation_actions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    admin_id UUID NOT NULL REFERENCES public.profiles(id),
    case_id UUID REFERENCES public.cases(id),
    target_type report_target NOT NULL,
    target_id UUID NOT NULL,
    action TEXT NOT NULL CHECK (action IN ('hide', 'remove', 'restore', 'dismiss')),
    reason TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3.16 Archivos (RF-04, RF-05, RF-23, RF-26, RNF-10). Rutas de Storage, no URLs.
CREATE TABLE public.attachments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id UUID NOT NULL DEFAULT auth.uid() REFERENCES public.profiles(id),
    kind attachment_kind NOT NULL,
    job_id UUID REFERENCES public.jobs(id),
    case_id UUID REFERENCES public.cases(id),
    storage_path TEXT NOT NULL UNIQUE,
    mime_type TEXT NOT NULL,
    size_bytes BIGINT NOT NULL CHECK (size_bytes > 0 AND size_bytes <= 10485760),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT check_attachment_owner_ref CHECK (
        (kind IN ('job_photo', 'completion_evidence') AND job_id IS NOT NULL AND case_id IS NULL) OR
        (kind = 'case_evidence' AND case_id IS NOT NULL AND job_id IS NULL)
    ),
    CONSTRAINT check_attachment_mime CHECK (
        (kind = 'job_photo' AND mime_type IN ('image/jpeg', 'image/png')) OR
        (kind <> 'job_photo' AND mime_type IN ('image/jpeg', 'image/png', 'application/pdf'))
    )
);

-- 3.17 Notificaciones push (RF-15, RNF-05): solo tipo de evento y destino interno.
CREATE TABLE public.notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id),
    event_type TEXT NOT NULL,
    target_screen TEXT,
    target_id UUID,
    read_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.device_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL DEFAULT auth.uid() REFERENCES public.profiles(id),
    token TEXT NOT NULL UNIQUE,
    platform TEXT NOT NULL DEFAULT 'android',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3.18 Historial de cambios de estado (RF-16 "actor, metodo y fecha/hora", RF-25)
CREATE TABLE public.status_history (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    entity TEXT NOT NULL,                   -- job | payment | application | case
    entity_id UUID NOT NULL,
    from_state TEXT,
    to_state TEXT NOT NULL,
    actor_id UUID,                          -- NULL = sistema
    method TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3.19 Maquina de estados como datos (M-2): una sola fuente para BD y frontend.
CREATE TABLE public.state_transitions (
    entity TEXT NOT NULL,                   -- job | payment | application | case_ticket | case_claim | case_report
    from_state TEXT NOT NULL,
    to_state TEXT NOT NULL,
    PRIMARY KEY (entity, from_state, to_state)
);

INSERT INTO public.state_transitions (entity, from_state, to_state) VALUES
 -- Trabajo (RF-16)
 ('job', 'published', 'has_applications'), ('job', 'published', 'assigned'),
 ('job', 'published', 'cancelled'), ('job', 'published', 'expired'),
 ('job', 'has_applications', 'published'), ('job', 'has_applications', 'assigned'),
 ('job', 'has_applications', 'cancelled'), ('job', 'has_applications', 'expired'),
 ('job', 'assigned', 'has_applications'),        -- expira la seleccion de 24 h
 ('job', 'assigned', 'arrival_registered'),
 ('job', 'assigned', 'expired'),                 -- D-03: llego la hora de fin sin llegada
 ('job', 'assigned', 'cancelled'),               -- decision administrativa
 ('job', 'arrival_registered', 'in_progress'),   -- solo con pago confirmado
 ('job', 'arrival_registered', 'cancelled'),     -- 30 min sin cobro
 ('job', 'in_progress', 'completion_requested'),
 ('job', 'in_progress', 'in_claim'),
 ('job', 'in_progress', 'cancelled'),
 ('job', 'completion_requested', 'completed'),
 ('job', 'completion_requested', 'in_claim'),
 ('job', 'in_claim', 'completed'), ('job', 'in_claim', 'cancelled'),
 -- Pago (RF-18)
 ('payment', 'not_started', 'payment_pending'),
 ('payment', 'payment_pending', 'confirmed'), ('payment', 'payment_pending', 'failed'),
 ('payment', 'payment_pending', 'cancelled'),
 ('payment', 'failed', 'payment_pending'), ('payment', 'failed', 'cancelled'),
 ('payment', 'confirmed', 'transfer_pending'),
 ('payment', 'transfer_pending', 'transferred'), ('payment', 'transfer_pending', 'transfer_failed'),
 ('payment', 'transfer_pending', 'in_claim'),
 ('payment', 'transfer_failed', 'transfer_pending'),
 ('payment', 'in_claim', 'transfer_pending'),    -- decision: transferencia completa
 ('payment', 'in_claim', 'refunded'), ('payment', 'in_claim', 'refund_failed'),
 ('payment', 'in_claim', 'partial_settlement_pending'),
 ('payment', 'refund_failed', 'refunded'),
 ('payment', 'partial_settlement_pending', 'partial_settlement_completed'),
 ('payment', 'partial_settlement_pending', 'partial_settlement_failed'),
 ('payment', 'partial_settlement_failed', 'partial_settlement_pending'),
 -- Postulacion (RF-11)
 ('application', 'pending', 'accepted'), ('application', 'pending', 'rejected'),
 ('application', 'pending', 'withdrawn'), ('application', 'pending', 'expired'),
 ('application', 'accepted', 'expired'),
 -- Casos (RF-25)
 ('case_ticket', 'open', 'in_review'), ('case_ticket', 'in_review', 'resolved'),
 ('case_ticket', 'resolved', 'closed'), ('case_ticket', 'resolved', 'in_review'),
 ('case_claim', 'open', 'in_review'), ('case_claim', 'in_review', 'resolved'),
 ('case_claim', 'resolved', 'closed'), ('case_claim', 'resolved', 'in_review'),
 ('case_report', 'pending', 'in_review'),
 ('case_report', 'in_review', 'attended'), ('case_report', 'in_review', 'dismissed');

-- -----------------------------------------------------------------------------
-- 4. INDICES (I-8): todas las llaves foraneas usadas por RLS y consultas
-- -----------------------------------------------------------------------------
CREATE INDEX idx_jobs_employer ON public.jobs (employer_id);
CREATE INDEX idx_jobs_selected_worker ON public.jobs (selected_worker_id) WHERE selected_worker_id IS NOT NULL;
CREATE INDEX idx_jobs_status_date ON public.jobs (status, job_date);
CREATE INDEX idx_jobs_open_end ON public.jobs (end_at) WHERE status IN ('published', 'has_applications', 'assigned');
CREATE INDEX idx_jobs_selection_expiry ON public.jobs (selection_expires_at) WHERE status = 'assigned';
CREATE INDEX idx_applications_worker ON public.job_applications (worker_id);
CREATE INDEX idx_confirmations_job ON public.job_confirmations (job_id);
CREATE INDEX idx_payments_employer ON public.payments (employer_id);
CREATE INDEX idx_payments_worker ON public.payments (worker_id);
CREATE INDEX idx_payment_ops_payment ON public.payment_operations (payment_id);
CREATE INDEX idx_chat_thread ON public.chat_messages (job_id, worker_id, created_at);
CREATE INDEX idx_cases_status_type ON public.cases (status, case_type);
CREATE INDEX idx_cases_reporter ON public.cases (reporter_id);
CREATE INDEX idx_cases_job ON public.cases (job_id);
CREATE INDEX idx_case_messages_case ON public.case_messages (case_id, created_at);
CREATE INDEX idx_reviews_reviewee ON public.reviews (reviewee_id);
CREATE INDEX idx_sanctions_user ON public.user_sanctions (user_id);
CREATE INDEX idx_attachments_job ON public.attachments (job_id) WHERE job_id IS NOT NULL;
CREATE INDEX idx_attachments_case ON public.attachments (case_id) WHERE case_id IS NOT NULL;
CREATE INDEX idx_notifications_user ON public.notifications (user_id, created_at DESC);
CREATE INDEX idx_status_history_entity ON public.status_history (entity, entity_id, created_at);

-- -----------------------------------------------------------------------------
-- 5. FUNCIONES AUXILIARES DE SEGURIDAD (SECURITY DEFINER: evitan recursion de RLS)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION app.my_role() RETURNS user_role
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
    SELECT p.role FROM public.profiles p WHERE p.id = (SELECT auth.uid())
$$;

CREATE OR REPLACE FUNCTION app.is_admin() RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.id = (SELECT auth.uid()) AND p.role = 'admin'
          AND p.account_status IN ('active', 'warned')
    )
$$;

-- Puede crear/modificar (RF-30): activo, advertido, o suspension ya vencida.
CREATE OR REPLACE FUNCTION app.can_write() RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.id = (SELECT auth.uid())
          AND (p.account_status IN ('active', 'warned')
               OR (p.account_status = 'suspended' AND p.suspended_until IS NOT NULL AND p.suspended_until <= now()))
    )
$$;

CREATE OR REPLACE FUNCTION app.is_job_employer(p_job uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
    SELECT EXISTS (SELECT 1 FROM public.jobs j WHERE j.id = p_job AND j.employer_id = (SELECT auth.uid()))
$$;

CREATE OR REPLACE FUNCTION app.is_job_selected_worker(p_job uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
    SELECT EXISTS (SELECT 1 FROM public.jobs j WHERE j.id = p_job AND j.selected_worker_id = (SELECT auth.uid()))
$$;

CREATE OR REPLACE FUNCTION app.has_applied(p_job uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
    SELECT EXISTS (SELECT 1 FROM public.job_applications a WHERE a.job_id = p_job AND a.worker_id = (SELECT auth.uid()))
$$;

CREATE OR REPLACE FUNCTION app.job_is_open(p_job uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
    SELECT EXISTS (SELECT 1 FROM public.jobs j
                   WHERE j.id = p_job AND j.status IN ('published', 'has_applications') AND j.moderation_status = 'visible')
$$;

CREATE OR REPLACE FUNCTION app.can_see_case(p_case uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
    SELECT app.is_admin() OR EXISTS (
        SELECT 1 FROM public.cases c
        WHERE c.id = p_case
          AND (c.reporter_id = (SELECT auth.uid())
               OR (c.case_type = 'claim' AND c.job_id IS NOT NULL
                   AND EXISTS (SELECT 1 FROM public.jobs j WHERE j.id = c.job_id
                               AND (j.employer_id = (SELECT auth.uid()) OR j.selected_worker_id = (SELECT auth.uid())))))
    )
$$;

-- RF-14: el admin solo revisa mensajes si atiende un caso relacionado con el trabajo.
CREATE OR REPLACE FUNCTION app.admin_attends_job(p_job uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
    SELECT app.is_admin() AND EXISTS (
        SELECT 1 FROM public.cases c WHERE c.job_id = p_job AND c.assigned_admin_id = (SELECT auth.uid())
    )
$$;

-- -----------------------------------------------------------------------------
-- 6. TRIGGERS DE INTEGRIDAD Y AUDITORIA
-- -----------------------------------------------------------------------------
CREATE TRIGGER trg_profiles_touch BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION app.touch_updated_at();
CREATE TRIGGER trg_jobs_touch BEFORE UPDATE ON public.jobs FOR EACH ROW EXECUTE FUNCTION app.touch_updated_at();
CREATE TRIGGER trg_applications_touch BEFORE UPDATE ON public.job_applications FOR EACH ROW EXECUTE FUNCTION app.touch_updated_at();
CREATE TRIGGER trg_payments_touch BEFORE UPDATE ON public.payments FOR EACH ROW EXECUTE FUNCTION app.touch_updated_at();
CREATE TRIGGER trg_payment_ops_touch BEFORE UPDATE ON public.payment_operations FOR EACH ROW EXECUTE FUNCTION app.touch_updated_at();
CREATE TRIGGER trg_cases_touch BEFORE UPDATE ON public.cases FOR EACH ROW EXECUTE FUNCTION app.touch_updated_at();
CREATE TRIGGER trg_worker_locations_touch BEFORE UPDATE ON public.worker_locations FOR EACH ROW EXECUTE FUNCTION app.touch_updated_at();

-- Guardia de transiciones: cualquier UPDATE de status debe existir en state_transitions.
CREATE OR REPLACE FUNCTION app.guard_status() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
    v_entity text := TG_ARGV[0];
BEGIN
    IF TG_TABLE_NAME = 'cases' THEN
        v_entity := 'case_' || NEW.case_type::text;
    END IF;
    IF NEW.status::text IS DISTINCT FROM OLD.status::text THEN
        IF NOT EXISTS (SELECT 1 FROM public.state_transitions t
                       WHERE t.entity = v_entity AND t.from_state = OLD.status::text AND t.to_state = NEW.status::text) THEN
            RAISE EXCEPTION 'ERR_INVALID_TRANSITION: % % -> %', v_entity, OLD.status, NEW.status
                USING ERRCODE = 'P0001';
        END IF;
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_jobs_guard BEFORE UPDATE OF status ON public.jobs FOR EACH ROW EXECUTE FUNCTION app.guard_status('job');
CREATE TRIGGER trg_payments_guard BEFORE UPDATE OF status ON public.payments FOR EACH ROW EXECUTE FUNCTION app.guard_status('payment');
CREATE TRIGGER trg_applications_guard BEFORE UPDATE OF status ON public.job_applications FOR EACH ROW EXECUTE FUNCTION app.guard_status('application');
CREATE TRIGGER trg_cases_guard BEFORE UPDATE OF status ON public.cases FOR EACH ROW EXECUTE FUNCTION app.guard_status('case');

-- closed_at al entrar a estado terminal del trabajo
CREATE OR REPLACE FUNCTION app.set_job_closed_at() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
    IF NEW.status IN ('completed', 'cancelled', 'expired') AND OLD.status NOT IN ('completed', 'cancelled', 'expired') THEN
        NEW.closed_at := now();
        IF NEW.status = 'completed' AND NEW.completed_at IS NULL THEN
            NEW.completed_at := now();
        END IF;
    END IF;
    RETURN NEW;
END;
$$;
CREATE TRIGGER trg_jobs_closed BEFORE UPDATE OF status ON public.jobs FOR EACH ROW EXECUTE FUNCTION app.set_job_closed_at();

-- Historial automatico: actor = usuario de la sesion (NULL si lo hace el sistema).
CREATE OR REPLACE FUNCTION app.log_status() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        INSERT INTO public.status_history (entity, entity_id, from_state, to_state, actor_id, method)
        VALUES (TG_ARGV[0], NEW.id, NULL, NEW.status::text, (SELECT auth.uid()), current_setting('app.action_method', true));
    ELSIF NEW.status::text IS DISTINCT FROM OLD.status::text THEN
        INSERT INTO public.status_history (entity, entity_id, from_state, to_state, actor_id, method)
        VALUES (TG_ARGV[0], NEW.id, OLD.status::text, NEW.status::text, (SELECT auth.uid()), current_setting('app.action_method', true));
    END IF;
    RETURN NEW;
END;
$$;
CREATE TRIGGER trg_jobs_log AFTER INSERT OR UPDATE OF status ON public.jobs FOR EACH ROW EXECUTE FUNCTION app.log_status('job');
CREATE TRIGGER trg_payments_log AFTER INSERT OR UPDATE OF status ON public.payments FOR EACH ROW EXECUTE FUNCTION app.log_status('payment');
CREATE TRIGGER trg_applications_log AFTER INSERT OR UPDATE OF status ON public.job_applications FOR EACH ROW EXECUTE FUNCTION app.log_status('application');
CREATE TRIGGER trg_cases_log AFTER INSERT OR UPDATE OF status ON public.cases FOR EACH ROW EXECUTE FUNCTION app.log_status('case');

-- Limite de archivos: 5 por trabajo/tipo y 5 por caso (RF-05, RF-23, RF-26)
CREATE OR REPLACE FUNCTION app.check_attachment_limit() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
    v_count int;
BEGIN
    IF NEW.job_id IS NOT NULL THEN
        SELECT count(*) INTO v_count FROM public.attachments a WHERE a.job_id = NEW.job_id AND a.kind = NEW.kind;
    ELSE
        SELECT count(*) INTO v_count FROM public.attachments a WHERE a.case_id = NEW.case_id;
    END IF;
    IF v_count >= 5 THEN
        RAISE EXCEPTION 'ERR_ATTACHMENT_LIMIT' USING ERRCODE = 'P0001';
    END IF;
    RETURN NEW;
END;
$$;
CREATE TRIGGER trg_attachments_limit BEFORE INSERT ON public.attachments FOR EACH ROW EXECUTE FUNCTION app.check_attachment_limit();

-- La decision de una reclamacion debe cuadrar con el cobro (RF-17, RF-26, D-02):
--  transfer_full: trabajador recibe el pago del trabajo; la plataforma conserva la comision.
--  refund_full:   el empleador recibe el total cobrado (trabajo + comision).
--  partial:       transferencia + reembolso = total cobrado (sin comision retenida).
CREATE OR REPLACE FUNCTION app.validate_case_decision() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
    p public.payments%ROWTYPE;
BEGIN
    IF NEW.case_type = 'claim' AND NEW.status = 'resolved' THEN
        IF NEW.decision IS NULL THEN
            RAISE EXCEPTION 'ERR_DECISION_REQUIRED' USING ERRCODE = 'P0001';
        END IF;
        SELECT * INTO p FROM public.payments WHERE job_id = NEW.job_id;
        IF NOT FOUND THEN
            RAISE EXCEPTION 'ERR_NO_PAYMENT' USING ERRCODE = 'P0001';
        END IF;
        IF NEW.decision = 'transfer_full' AND NOT (NEW.approved_transfer_amount = p.job_amount_mxn AND NEW.approved_refund_amount = 0) THEN
            RAISE EXCEPTION 'ERR_DECISION_AMOUNTS' USING ERRCODE = 'P0001';
        ELSIF NEW.decision = 'refund_full' AND NOT (NEW.approved_transfer_amount = 0 AND NEW.approved_refund_amount = p.total_charged_mxn) THEN
            RAISE EXCEPTION 'ERR_DECISION_AMOUNTS' USING ERRCODE = 'P0001';
        ELSIF NEW.decision = 'partial' AND NOT (NEW.approved_transfer_amount > 0 AND NEW.approved_refund_amount > 0
                 AND NEW.approved_transfer_amount + NEW.approved_refund_amount = p.total_charged_mxn) THEN
            RAISE EXCEPTION 'ERR_DECISION_AMOUNTS' USING ERRCODE = 'P0001';
        END IF;
    END IF;
    RETURN NEW;
END;
$$;
CREATE TRIGGER trg_cases_decision BEFORE UPDATE OF status, decision, approved_transfer_amount, approved_refund_amount
    ON public.cases FOR EACH ROW EXECUTE FUNCTION app.validate_case_decision();

-- -----------------------------------------------------------------------------
-- 7. PRIVILEGIOS Y RLS
-- Se retira todo a anon/authenticated y se concede solo lo necesario.
-- -----------------------------------------------------------------------------
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon, authenticated;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM anon, authenticated;

GRANT USAGE ON SCHEMA app TO authenticated;

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.terms_acceptances ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.worker_locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.job_private ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.job_completion ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.job_applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.job_confirmations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_operations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stripe_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.case_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_sanctions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.moderation_actions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.device_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.status_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.state_transitions ENABLE ROW LEVEL SECURITY;

-- profiles: cada usuario ve SOLO su fila (los datos de otros salen por RPC).
GRANT SELECT ON public.profiles TO authenticated;
GRANT UPDATE (full_name, phone, photo_path, skills, availability) ON public.profiles TO authenticated;
CREATE POLICY profiles_select ON public.profiles FOR SELECT TO authenticated
    USING (id = (SELECT auth.uid()) OR app.is_admin());
CREATE POLICY profiles_update_own ON public.profiles FOR UPDATE TO authenticated
    USING (id = (SELECT auth.uid()) AND app.can_write())
    WITH CHECK (id = (SELECT auth.uid()));

GRANT SELECT ON public.terms_acceptances TO authenticated;
CREATE POLICY terms_select ON public.terms_acceptances FOR SELECT TO authenticated
    USING (user_id = (SELECT auth.uid()) OR app.is_admin());

GRANT SELECT ON public.worker_locations TO authenticated;
CREATE POLICY worker_locations_select ON public.worker_locations FOR SELECT TO authenticated
    USING (worker_id = (SELECT auth.uid()));

-- jobs: dueño, trabajador seleccionado, quien se postulo, admin. Los demas usan search_jobs().
GRANT SELECT ON public.jobs TO authenticated;
CREATE POLICY jobs_select ON public.jobs FOR SELECT TO authenticated
    USING (employer_id = (SELECT auth.uid()) OR selected_worker_id = (SELECT auth.uid())
           OR app.has_applied(id) OR app.is_admin());

GRANT SELECT ON public.job_private TO authenticated;
CREATE POLICY job_private_select ON public.job_private FOR SELECT TO authenticated
    USING (app.is_job_employer(job_id) OR app.is_job_selected_worker(job_id) OR app.is_admin());

GRANT SELECT ON public.job_completion TO authenticated;
CREATE POLICY job_completion_select ON public.job_completion FOR SELECT TO authenticated
    USING (app.is_job_employer(job_id));   -- NUNCA el trabajador

GRANT SELECT ON public.job_applications TO authenticated;
CREATE POLICY applications_select ON public.job_applications FOR SELECT TO authenticated
    USING (worker_id = (SELECT auth.uid()) OR app.is_job_employer(job_id) OR app.is_admin());

GRANT SELECT ON public.job_confirmations TO authenticated;
CREATE POLICY confirmations_select ON public.job_confirmations FOR SELECT TO authenticated
    USING (app.is_job_employer(job_id) OR app.is_job_selected_worker(job_id) OR app.is_admin());

GRANT SELECT ON public.payments TO authenticated;
CREATE POLICY payments_select ON public.payments FOR SELECT TO authenticated
    USING (employer_id = (SELECT auth.uid()) OR worker_id = (SELECT auth.uid()) OR app.is_admin());

GRANT SELECT ON public.payment_operations TO authenticated;
CREATE POLICY payment_ops_select ON public.payment_operations FOR SELECT TO authenticated
    USING (app.is_admin());

GRANT SELECT ON public.stripe_events TO authenticated;
CREATE POLICY stripe_events_select ON public.stripe_events FOR SELECT TO authenticated
    USING (app.is_admin());

-- chat: por hilo (trabajo, trabajador); solo INSERT y SELECT; sin UPDATE/DELETE.
GRANT SELECT ON public.chat_messages TO authenticated;
GRANT INSERT (job_id, worker_id, sender_id, body) ON public.chat_messages TO authenticated;
CREATE POLICY chat_select ON public.chat_messages FOR SELECT TO authenticated
    USING ((worker_id = (SELECT auth.uid()) OR app.is_job_employer(job_id) OR app.admin_attends_job(job_id))
           AND (moderation_status = 'visible' OR app.is_admin()));
CREATE POLICY chat_insert ON public.chat_messages FOR INSERT TO authenticated
    WITH CHECK (
        sender_id = (SELECT auth.uid()) AND app.can_write()
        AND (sender_id = worker_id OR app.is_job_employer(job_id))
        AND EXISTS (SELECT 1 FROM public.jobs j
                    WHERE j.id = job_id AND j.selected_worker_id = worker_id
                      AND j.status IN ('assigned', 'arrival_registered', 'in_progress', 'completion_requested', 'in_claim'))
    );

GRANT SELECT ON public.cases TO authenticated;
CREATE POLICY cases_select ON public.cases FOR SELECT TO authenticated
    USING (reporter_id = (SELECT auth.uid())
           OR (case_type = 'claim' AND (app.is_job_employer(job_id) OR app.is_job_selected_worker(job_id)))
           OR app.is_admin());

GRANT SELECT ON public.case_messages TO authenticated;
CREATE POLICY case_messages_select ON public.case_messages FOR SELECT TO authenticated
    USING (app.is_admin() OR (NOT is_internal AND app.can_see_case(case_id)));

-- reviews: las visibles son publicas para usuarios autenticados (RF-31).
GRANT SELECT ON public.reviews TO authenticated;
CREATE POLICY reviews_select ON public.reviews FOR SELECT TO authenticated
    USING (moderation_status = 'visible' OR reviewer_id = (SELECT auth.uid()) OR app.is_admin());

GRANT SELECT ON public.user_sanctions TO authenticated;
CREATE POLICY sanctions_select ON public.user_sanctions FOR SELECT TO authenticated
    USING (user_id = (SELECT auth.uid()) OR app.is_admin());

GRANT SELECT ON public.moderation_actions TO authenticated;
CREATE POLICY moderation_select ON public.moderation_actions FOR SELECT TO authenticated
    USING (app.is_admin());

-- attachments: el cliente sube a Storage y registra el archivo aqui.
GRANT SELECT, DELETE ON public.attachments TO authenticated;
GRANT INSERT (kind, job_id, case_id, storage_path, mime_type, size_bytes) ON public.attachments TO authenticated;
CREATE POLICY attachments_select ON public.attachments FOR SELECT TO authenticated
    USING (
        app.is_admin() OR owner_id = (SELECT auth.uid())
        OR (kind = 'job_photo' AND (app.job_is_open(job_id) OR app.is_job_employer(job_id) OR app.is_job_selected_worker(job_id) OR app.has_applied(job_id)))
        OR (kind = 'completion_evidence' AND app.is_job_employer(job_id))
        OR (kind = 'case_evidence' AND app.can_see_case(case_id))
    );
CREATE POLICY attachments_insert ON public.attachments FOR INSERT TO authenticated
    WITH CHECK (
        owner_id = (SELECT auth.uid()) AND app.can_write()
        AND (
            (kind = 'job_photo' AND app.is_job_employer(job_id)
                AND EXISTS (SELECT 1 FROM public.jobs j WHERE j.id = job_id AND j.status IN ('published', 'has_applications')))
            OR (kind = 'completion_evidence' AND app.is_job_selected_worker(job_id)
                AND EXISTS (SELECT 1 FROM public.jobs j WHERE j.id = job_id AND j.status IN ('in_progress', 'completion_requested')))
            OR (kind = 'case_evidence' AND app.can_see_case(case_id))
        )
    );
CREATE POLICY attachments_delete ON public.attachments FOR DELETE TO authenticated
    USING (owner_id = (SELECT auth.uid()) AND kind = 'job_photo'
           AND EXISTS (SELECT 1 FROM public.jobs j WHERE j.id = job_id AND j.status IN ('published', 'has_applications')));

GRANT SELECT ON public.notifications TO authenticated;
GRANT UPDATE (read_at) ON public.notifications TO authenticated;
CREATE POLICY notifications_select ON public.notifications FOR SELECT TO authenticated USING (user_id = (SELECT auth.uid()));
CREATE POLICY notifications_update ON public.notifications FOR UPDATE TO authenticated
    USING (user_id = (SELECT auth.uid())) WITH CHECK (user_id = (SELECT auth.uid()));

GRANT SELECT, DELETE ON public.device_tokens TO authenticated;
GRANT INSERT (token, platform) ON public.device_tokens TO authenticated;
CREATE POLICY device_tokens_select ON public.device_tokens FOR SELECT TO authenticated USING (user_id = (SELECT auth.uid()));
CREATE POLICY device_tokens_insert ON public.device_tokens FOR INSERT TO authenticated WITH CHECK (user_id = (SELECT auth.uid()));
CREATE POLICY device_tokens_delete ON public.device_tokens FOR DELETE TO authenticated USING (user_id = (SELECT auth.uid()));

GRANT SELECT ON public.status_history TO authenticated;
CREATE POLICY status_history_select ON public.status_history FOR SELECT TO authenticated USING (app.is_admin());

GRANT SELECT ON public.state_transitions TO authenticated;   -- el frontend puede leerla
CREATE POLICY state_transitions_select ON public.state_transitions FOR SELECT TO authenticated USING (true);

-- -----------------------------------------------------------------------------
-- 8. FUNCIONES INTERNAS DE NEGOCIO (no expuestas)
-- -----------------------------------------------------------------------------
-- Vencimiento de la seleccion de 24 h (RF-12): la postulacion pasa a Expirada y el
-- trabajo vuelve a Con postulaciones con recepcion abierta.
CREATE OR REPLACE FUNCTION app.expire_selection(p_job uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
    UPDATE public.job_applications SET status = 'expired'
     WHERE job_id = p_job AND status = 'accepted';
    UPDATE public.jobs SET status = 'has_applications', selected_worker_id = NULL,
           selection_expires_at = NULL, assigned_at = NULL
     WHERE id = p_job AND status = 'assigned';
END;
$$;

-- -----------------------------------------------------------------------------
-- 9. RPC EXPUESTAS A LA APP (SECURITY DEFINER; mensajes de error ERR_* para el cliente)
-- -----------------------------------------------------------------------------

-- Perfil (RF-02, RF-03, RF-04). Rol solo employer|worker; admins los crea el equipo.
CREATE OR REPLACE FUNCTION public.complete_profile(p_role user_role, p_full_name text, p_phone text, p_birth_date date)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
    v_uid uuid := auth.uid();
BEGIN
    IF v_uid IS NULL THEN RAISE EXCEPTION 'ERR_NOT_AUTHENTICATED'; END IF;
    IF p_role NOT IN ('employer', 'worker') THEN RAISE EXCEPTION 'ERR_INVALID_ROLE'; END IF;
    IF p_birth_date > (CURRENT_DATE - INTERVAL '18 years')::date THEN RAISE EXCEPTION 'ERR_UNDERAGE'; END IF;
    IF p_phone !~ '^[0-9+() -]{8,20}$' THEN RAISE EXCEPTION 'ERR_INVALID_PHONE'; END IF;
    IF length(trim(p_full_name)) < 2 THEN RAISE EXCEPTION 'ERR_INVALID_NAME'; END IF;
    IF EXISTS (SELECT 1 FROM public.profiles WHERE id = v_uid) THEN RAISE EXCEPTION 'ERR_PROFILE_EXISTS'; END IF;
    INSERT INTO public.profiles (id, role, full_name, phone, birth_date)
    VALUES (v_uid, p_role, trim(p_full_name), p_phone, p_birth_date);
END;
$$;

-- Solo service_role / SQL del equipo (RF-02: el equipo crea las cuentas de administrador).
CREATE OR REPLACE FUNCTION public.admin_create_profile(p_user uuid, p_full_name text, p_phone text, p_birth_date date)
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = public, pg_temp AS $$
    INSERT INTO public.profiles (id, role, full_name, phone, birth_date) VALUES (p_user, 'admin', p_full_name, p_phone, p_birth_date)
$$;

CREATE OR REPLACE FUNCTION public.accept_terms(p_document text, p_version text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
    IF app.my_role() IS NULL THEN RAISE EXCEPTION 'ERR_NO_PROFILE'; END IF;
    INSERT INTO public.terms_acceptances (user_id, document, version)
    VALUES (auth.uid(), p_document, p_version)
    ON CONFLICT (user_id, document, version) DO NOTHING;
END;
$$;

-- Ubicacion de referencia (RF-08): maximo 3 cambios de coordenadas en CUALQUIER periodo
-- de 24 h (ventana movil real). Guardar el punto inicial y cambiar solo el radio no cuentan.
CREATE OR REPLACE FUNCTION public.save_worker_location(p_lat numeric, p_lng numeric, p_radius int DEFAULT 10)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
    v_uid uuid := auth.uid();
    cur public.worker_locations%ROWTYPE;
    v_recent timestamptz[];
BEGIN
    IF app.my_role() IS DISTINCT FROM 'worker' THEN RAISE EXCEPTION 'ERR_FORBIDDEN'; END IF;
    IF NOT app.can_write() THEN RAISE EXCEPTION 'ERR_ACCOUNT_RESTRICTED'; END IF;
    IF p_radius NOT IN (5, 10, 25, 50) THEN RAISE EXCEPTION 'ERR_INVALID_RADIUS'; END IF;

    SELECT * INTO cur FROM public.worker_locations WHERE worker_id = v_uid FOR UPDATE;
    IF NOT FOUND THEN
        INSERT INTO public.worker_locations (worker_id, latitude, longitude, search_radius_km)
        VALUES (v_uid, p_lat, p_lng, p_radius);
        RETURN;
    END IF;

    v_recent := ARRAY(SELECT t FROM unnest(cur.recent_changes) t WHERE t > now() - INTERVAL '24 hours' ORDER BY t);
    IF p_lat IS DISTINCT FROM cur.latitude OR p_lng IS DISTINCT FROM cur.longitude THEN
        IF coalesce(array_length(v_recent, 1), 0) >= 3 THEN
            RAISE EXCEPTION 'ERR_LOCATION_LIMIT';
        END IF;
        v_recent := v_recent || now();
    END IF;
    UPDATE public.worker_locations
       SET latitude = p_lat, longitude = p_lng, search_radius_km = p_radius, recent_changes = v_recent
     WHERE worker_id = v_uid;
END;
$$;

-- Publicar (RF-05). Atomico: trabajo + datos privados.
CREATE OR REPLACE FUNCTION public.create_job(
    p_title text, p_description text, p_category job_category, p_payment numeric,
    p_date date, p_start time, p_end time, p_conditions text, p_neighborhood text,
    p_address text, p_lat numeric, p_lng numeric)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
    v_id uuid;
    v_start timestamptz := (p_date + p_start) AT TIME ZONE app.tz();
BEGIN
    IF app.my_role() IS DISTINCT FROM 'employer' THEN RAISE EXCEPTION 'ERR_FORBIDDEN'; END IF;
    IF NOT app.can_write() THEN RAISE EXCEPTION 'ERR_ACCOUNT_RESTRICTED'; END IF;
    IF v_start <= now() THEN RAISE EXCEPTION 'ERR_DATE_IN_PAST'; END IF;
    IF coalesce(trim(p_neighborhood), '') = '' THEN RAISE EXCEPTION 'ERR_NEIGHBORHOOD_REQUIRED'; END IF;
    INSERT INTO public.jobs (employer_id, title, description, category, fixed_payment_mxn, job_date, start_time, end_time, conditions, neighborhood)
    VALUES (auth.uid(), p_title, p_description, p_category, p_payment, p_date, p_start, p_end, p_conditions, trim(p_neighborhood))
    RETURNING id INTO v_id;
    INSERT INTO public.job_private (job_id, exact_address, exact_latitude, exact_longitude)
    VALUES (v_id, p_address, p_lat, p_lng);
    RETURN v_id;
END;
$$;

-- Editar (RF-06): solo sin trabajador seleccionado.
CREATE OR REPLACE FUNCTION public.update_job(
    p_job uuid, p_title text, p_description text, p_category job_category, p_payment numeric,
    p_date date, p_start time, p_end time, p_conditions text, p_neighborhood text,
    p_address text, p_lat numeric, p_lng numeric)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
    j public.jobs%ROWTYPE;
BEGIN
    SELECT * INTO j FROM public.jobs WHERE id = p_job FOR UPDATE;
    IF NOT FOUND OR j.employer_id <> auth.uid() THEN RAISE EXCEPTION 'ERR_FORBIDDEN'; END IF;
    IF NOT app.can_write() THEN RAISE EXCEPTION 'ERR_ACCOUNT_RESTRICTED'; END IF;
    IF j.status NOT IN ('published', 'has_applications') OR j.selected_worker_id IS NOT NULL THEN
        RAISE EXCEPTION 'ERR_JOB_NOT_EDITABLE';
    END IF;
    IF ((p_date + p_start) AT TIME ZONE app.tz()) <= now() THEN RAISE EXCEPTION 'ERR_DATE_IN_PAST'; END IF;
    UPDATE public.jobs SET title = p_title, description = p_description, category = p_category,
           fixed_payment_mxn = p_payment, job_date = p_date, start_time = p_start, end_time = p_end,
           conditions = p_conditions, neighborhood = trim(p_neighborhood)
     WHERE id = p_job;
    UPDATE public.job_private SET exact_address = p_address, exact_latitude = p_lat, exact_longitude = p_lng
     WHERE job_id = p_job;
END;
$$;

-- Cancelacion directa solo antes de seleccionar (RF-06, RF-27).
CREATE OR REPLACE FUNCTION public.cancel_job(p_job uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
    j public.jobs%ROWTYPE;
BEGIN
    SELECT * INTO j FROM public.jobs WHERE id = p_job FOR UPDATE;
    IF NOT FOUND OR j.employer_id <> auth.uid() THEN RAISE EXCEPTION 'ERR_FORBIDDEN'; END IF;
    IF j.status NOT IN ('published', 'has_applications') OR j.selected_worker_id IS NOT NULL THEN
        RAISE EXCEPTION 'ERR_USE_CASE_INSTEAD';
    END IF;
    UPDATE public.job_applications SET status = 'rejected' WHERE job_id = p_job AND status = 'pending';
    UPDATE public.jobs SET status = 'cancelled' WHERE id = p_job;
END;
$$;

-- Explorador (RF-07, RF-09): distancia con coordenadas exactas calculada en el servidor;
-- el cliente solo recibe colonia y RANGO. Dentro del radio primero; hasta 10 fuera.
CREATE OR REPLACE FUNCTION public.search_jobs(
    p_category job_category DEFAULT NULL, p_from date DEFAULT NULL, p_to date DEFAULT NULL,
    p_limit int DEFAULT 20, p_offset int DEFAULT 0)
RETURNS TABLE (job_id uuid, title varchar, category job_category, fixed_payment_mxn numeric,
               job_date date, start_time time, end_time time, neighborhood varchar,
               distance_range text, out_of_range boolean,
               employer_id uuid, employer_name varchar, employer_rating numeric, employer_review_count int)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
#variable_conflict use_column
DECLARE
    v_lat numeric; v_lng numeric; v_radius int;
BEGIN
    IF app.my_role() IS DISTINCT FROM 'worker' THEN RAISE EXCEPTION 'ERR_FORBIDDEN'; END IF;
    SELECT wl.latitude, wl.longitude, wl.search_radius_km INTO v_lat, v_lng, v_radius
      FROM public.worker_locations wl WHERE wl.worker_id = auth.uid();
    IF NOT FOUND THEN RAISE EXCEPTION 'ERR_NO_REFERENCE_POINT'; END IF;

    RETURN QUERY
    WITH cand AS (
        SELECT j.id AS jid, j.title AS jtitle, j.category AS jcat, j.fixed_payment_mxn AS jpay, j.job_date AS jdate,
               j.start_time AS jstart, j.end_time AS jend, j.neighborhood AS jnb,
               j.employer_id AS jemp, e.full_name AS jename, d.km,
               rt.avg_rating, rt.cnt
          FROM public.jobs j
          JOIN public.job_private jp ON jp.job_id = j.id
          JOIN public.profiles e ON e.id = j.employer_id
          CROSS JOIN LATERAL (SELECT app.haversine_km(v_lat::float8, v_lng::float8,
                                     jp.exact_latitude::float8, jp.exact_longitude::float8) AS km) d
          LEFT JOIN LATERAL (SELECT round(avg(rv.rating), 2) AS avg_rating, count(*)::int AS cnt
                               FROM public.reviews rv
                              WHERE rv.reviewee_id = j.employer_id AND rv.moderation_status = 'visible') rt ON true
         WHERE j.status IN ('published', 'has_applications')
           AND j.moderation_status = 'visible'
           AND j.start_at > now()
           AND e.account_status IN ('active', 'warned')
           AND (p_category IS NULL OR j.category = p_category)
           AND (p_from IS NULL OR j.job_date >= p_from)
           AND (p_to IS NULL OR j.job_date <= p_to)
    ), ranked AS (
        SELECT c.*, (c.km <= v_radius) AS inside,
               row_number() OVER (PARTITION BY (c.km <= v_radius) ORDER BY c.km) AS rn
          FROM cand c
    )
    SELECT r.jid, r.jtitle, r.jcat, r.jpay, r.jdate, r.jstart, r.jend, r.jnb,
           CASE WHEN r.km < 5 THEN 'lt_5' WHEN r.km < 10 THEN '5_10' WHEN r.km < 25 THEN '10_25'
                WHEN r.km <= 50 THEN '25_50' ELSE 'gt_50' END,
           NOT r.inside, r.jemp, r.jename, r.avg_rating, coalesce(r.cnt, 0)
      FROM ranked r
     WHERE r.inside OR r.rn <= 10
     ORDER BY r.inside DESC, r.km
     LIMIT p_limit OFFSET p_offset;
END;
$$;

-- Detalle previo a postularse (RF-10): sin domicilio, coordenadas, pin ni distancia exacta.
CREATE OR REPLACE FUNCTION public.get_job_public(p_job uuid)
RETURNS TABLE (job_id uuid, title varchar, description text, category job_category, fixed_payment_mxn numeric,
               job_date date, start_time time, end_time time, conditions text, neighborhood varchar,
               status job_status, distance_range text, out_of_range boolean,
               employer_id uuid, employer_name varchar, employer_rating numeric, employer_review_count int,
               already_applied boolean)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
#variable_conflict use_column
DECLARE
    v_lat numeric; v_lng numeric; v_radius int;
BEGIN
    IF app.my_role() IS DISTINCT FROM 'worker' THEN RAISE EXCEPTION 'ERR_FORBIDDEN'; END IF;
    SELECT wl.latitude, wl.longitude, wl.search_radius_km INTO v_lat, v_lng, v_radius
      FROM public.worker_locations wl WHERE wl.worker_id = auth.uid();
    RETURN QUERY
    SELECT j.id, j.title, j.description, j.category, j.fixed_payment_mxn, j.job_date, j.start_time, j.end_time,
           j.conditions, j.neighborhood, j.status,
           CASE WHEN v_lat IS NULL THEN NULL
                WHEN d.km < 5 THEN 'lt_5' WHEN d.km < 10 THEN '5_10' WHEN d.km < 25 THEN '10_25'
                WHEN d.km <= 50 THEN '25_50' ELSE 'gt_50' END,
           CASE WHEN v_lat IS NULL THEN NULL ELSE d.km > v_radius END,
           j.employer_id, e.full_name, rt.avg_rating, coalesce(rt.cnt, 0),
           app.has_applied(j.id)
      FROM public.jobs j
      JOIN public.job_private jp ON jp.job_id = j.id
      JOIN public.profiles e ON e.id = j.employer_id
      CROSS JOIN LATERAL (SELECT CASE WHEN v_lat IS NULL THEN 0::float8
                              ELSE app.haversine_km(v_lat::float8, v_lng::float8, jp.exact_latitude::float8, jp.exact_longitude::float8) END AS km) d
      LEFT JOIN LATERAL (SELECT round(avg(rv.rating), 2) AS avg_rating, count(*)::int AS cnt
                           FROM public.reviews rv
                          WHERE rv.reviewee_id = j.employer_id AND rv.moderation_status = 'visible') rt ON true
     WHERE j.id = p_job
       AND ((j.status IN ('published', 'has_applications') AND j.moderation_status = 'visible') OR app.has_applied(j.id));
END;
$$;

-- Postulantes visibles para el empleador (RF-12): sin telefono ni ubicacion.
CREATE OR REPLACE FUNCTION public.get_applicants(p_job uuid)
RETURNS TABLE (application_id uuid, worker_id uuid, status application_status, applied_at timestamptz,
               full_name varchar, photo_path text, skills varchar, availability varchar,
               rating numeric, review_count int)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
#variable_conflict use_column
BEGIN
    IF NOT app.is_job_employer(p_job) THEN RAISE EXCEPTION 'ERR_FORBIDDEN'; END IF;
    RETURN QUERY
    SELECT a.id, a.worker_id, a.status, a.created_at, w.full_name, w.photo_path, w.skills, w.availability,
           rt.avg_rating, coalesce(rt.cnt, 0)
      FROM public.job_applications a
      JOIN public.profiles w ON w.id = a.worker_id
      LEFT JOIN LATERAL (SELECT round(avg(rv.rating), 2) AS avg_rating, count(*)::int AS cnt
                           FROM public.reviews rv
                          WHERE rv.reviewee_id = a.worker_id AND rv.moderation_status = 'visible') rt ON true
     WHERE a.job_id = p_job
     ORDER BY a.created_at;
END;
$$;

-- Telefono de la contraparte: solo despues de la seleccion y solo entre las partes (RF-12).
CREATE OR REPLACE FUNCTION public.get_counterpart_contact(p_job uuid)
RETURNS TABLE (full_name varchar, phone varchar)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
#variable_conflict use_column
DECLARE
    j public.jobs%ROWTYPE;
    v_other uuid;
BEGIN
    SELECT * INTO j FROM public.jobs WHERE id = p_job;
    IF NOT FOUND OR j.selected_worker_id IS NULL
       OR j.status NOT IN ('assigned', 'arrival_registered', 'in_progress', 'completion_requested', 'in_claim', 'completed') THEN
        RAISE EXCEPTION 'ERR_NOT_AVAILABLE';
    END IF;
    IF auth.uid() = j.employer_id THEN v_other := j.selected_worker_id;
    ELSIF auth.uid() = j.selected_worker_id THEN v_other := j.employer_id;
    ELSE RAISE EXCEPTION 'ERR_FORBIDDEN'; END IF;
    RETURN QUERY SELECT p.full_name, p.phone FROM public.profiles p WHERE p.id = v_other;
END;
$$;

-- Postulacion (RF-11)
CREATE OR REPLACE FUNCTION public.apply_to_job(p_job uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
    j public.jobs%ROWTYPE;
    v_id uuid;
BEGIN
    IF app.my_role() IS DISTINCT FROM 'worker' THEN RAISE EXCEPTION 'ERR_FORBIDDEN'; END IF;
    IF NOT app.can_write() THEN RAISE EXCEPTION 'ERR_ACCOUNT_RESTRICTED'; END IF;
    SELECT * INTO j FROM public.jobs WHERE id = p_job FOR UPDATE;
    IF NOT FOUND OR j.status NOT IN ('published', 'has_applications') OR j.moderation_status <> 'visible'
       OR j.start_at <= now() THEN
        RAISE EXCEPTION 'ERR_JOB_NOT_AVAILABLE';
    END IF;
    BEGIN
        INSERT INTO public.job_applications (job_id, worker_id) VALUES (p_job, auth.uid()) RETURNING id INTO v_id;
    EXCEPTION WHEN unique_violation THEN
        RAISE EXCEPTION 'ERR_ALREADY_APPLIED';
    END;
    IF j.status = 'published' THEN
        UPDATE public.jobs SET status = 'has_applications' WHERE id = p_job;
    END IF;
    RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.withdraw_application(p_app uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
    a public.job_applications%ROWTYPE;
BEGIN
    SELECT * INTO a FROM public.job_applications WHERE id = p_app;
    IF NOT FOUND OR a.worker_id <> auth.uid() THEN RAISE EXCEPTION 'ERR_FORBIDDEN'; END IF;
    PERFORM 1 FROM public.jobs WHERE id = a.job_id FOR UPDATE;
    SELECT * INTO a FROM public.job_applications WHERE id = p_app FOR UPDATE;
    IF a.status <> 'pending' THEN RAISE EXCEPTION 'ERR_NOT_PENDING'; END IF;
    UPDATE public.job_applications SET status = 'withdrawn' WHERE id = p_app;
    IF NOT EXISTS (SELECT 1 FROM public.job_applications WHERE job_id = a.job_id AND status = 'pending') THEN
        UPDATE public.jobs SET status = 'published' WHERE id = a.job_id AND status = 'has_applications';
    END IF;
END;
$$;

-- PROPUESTA (confirmar con Eber): accion explicita de rechazar (RF-11 define "Rechazada", RF-15 la notifica).
CREATE OR REPLACE FUNCTION public.reject_application(p_app uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
    a public.job_applications%ROWTYPE;
BEGIN
    SELECT * INTO a FROM public.job_applications WHERE id = p_app;
    IF NOT FOUND OR NOT app.is_job_employer(a.job_id) THEN RAISE EXCEPTION 'ERR_FORBIDDEN'; END IF;
    PERFORM 1 FROM public.jobs WHERE id = a.job_id FOR UPDATE;
    SELECT * INTO a FROM public.job_applications WHERE id = p_app FOR UPDATE;
    IF a.status <> 'pending' THEN RAISE EXCEPTION 'ERR_NOT_PENDING'; END IF;
    UPDATE public.job_applications SET status = 'rejected' WHERE id = p_app;
    IF NOT EXISTS (SELECT 1 FROM public.job_applications WHERE job_id = a.job_id AND status = 'pending') THEN
        UPDATE public.jobs SET status = 'published' WHERE id = a.job_id AND status = 'has_applications';
    END IF;
END;
$$;

-- Seleccion (RF-12): inicia el plazo de 24 h y una NUEVA RONDA. Las demas postulaciones
-- siguen pendientes para poder reabrir si la seleccion expira.
CREATE OR REPLACE FUNCTION public.select_worker(p_app uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
    a public.job_applications%ROWTYPE;
    j public.jobs%ROWTYPE;
BEGIN
    SELECT * INTO a FROM public.job_applications WHERE id = p_app;
    IF NOT FOUND OR NOT app.is_job_employer(a.job_id) THEN RAISE EXCEPTION 'ERR_FORBIDDEN'; END IF;
    IF NOT app.can_write() THEN RAISE EXCEPTION 'ERR_ACCOUNT_RESTRICTED'; END IF;
    SELECT * INTO j FROM public.jobs WHERE id = a.job_id FOR UPDATE;
    SELECT * INTO a FROM public.job_applications WHERE id = p_app FOR UPDATE;
    IF j.status NOT IN ('published', 'has_applications') OR j.selected_worker_id IS NOT NULL THEN
        RAISE EXCEPTION 'ERR_JOB_NOT_SELECTABLE';
    END IF;
    IF a.status <> 'pending' THEN RAISE EXCEPTION 'ERR_NOT_PENDING'; END IF;
    IF j.start_at <= now() THEN RAISE EXCEPTION 'ERR_DATE_IN_PAST'; END IF;
    UPDATE public.job_applications SET status = 'accepted' WHERE id = p_app;
    UPDATE public.jobs SET status = 'assigned', selected_worker_id = a.worker_id,
           selection_round = selection_round + 1, assigned_at = now(),
           selection_expires_at = now() + INTERVAL '24 hours'
     WHERE id = j.id;
END;
$$;

-- "Acepto las condiciones" (RF-16): por separado, dentro del plazo y de la ronda vigente.
CREATE OR REPLACE FUNCTION public.confirm_conditions(p_job uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
    j public.jobs%ROWTYPE;
BEGIN
    SELECT * INTO j FROM public.jobs WHERE id = p_job FOR UPDATE;
    IF NOT FOUND OR auth.uid() NOT IN (j.employer_id, coalesce(j.selected_worker_id, '00000000-0000-0000-0000-000000000000'::uuid)) THEN
        RAISE EXCEPTION 'ERR_FORBIDDEN';
    END IF;
    IF NOT app.can_write() THEN RAISE EXCEPTION 'ERR_ACCOUNT_RESTRICTED'; END IF;
    IF j.status <> 'assigned' THEN RAISE EXCEPTION 'ERR_INVALID_STATE'; END IF;
    IF j.selection_expires_at <= now() THEN
        PERFORM app.expire_selection(p_job);
        RAISE EXCEPTION 'ERR_SELECTION_EXPIRED';
    END IF;
    INSERT INTO public.job_confirmations (job_id, user_id, selection_round)
    VALUES (p_job, auth.uid(), j.selection_round)
    ON CONFLICT (job_id, user_id, selection_round) DO NOTHING;
END;
$$;

-- Llegada (RF-16): ventana [inicio-30 min, fin], ambas aceptaciones de LA RONDA, alta Stripe completa.
-- Crea el pago con plazo de cobro de 30 min desde arrived_at.
CREATE OR REPLACE FUNCTION public.register_arrival(p_job uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
    j public.jobs%ROWTYPE;
BEGIN
    SELECT * INTO j FROM public.jobs WHERE id = p_job FOR UPDATE;
    IF NOT FOUND OR j.selected_worker_id IS DISTINCT FROM auth.uid() THEN RAISE EXCEPTION 'ERR_FORBIDDEN'; END IF;
    IF NOT app.can_write() THEN RAISE EXCEPTION 'ERR_ACCOUNT_RESTRICTED'; END IF;
    IF j.status <> 'assigned' THEN RAISE EXCEPTION 'ERR_INVALID_STATE'; END IF;
    IF j.selection_expires_at <= now() THEN
        PERFORM app.expire_selection(p_job);
        RAISE EXCEPTION 'ERR_SELECTION_EXPIRED';
    END IF;
    IF now() < j.start_at - INTERVAL '30 minutes' OR now() > j.end_at THEN RAISE EXCEPTION 'ERR_OUTSIDE_ARRIVAL_WINDOW'; END IF;
    IF (SELECT count(*) FROM public.job_confirmations c
         WHERE c.job_id = p_job AND c.selection_round = j.selection_round
           AND c.user_id IN (j.employer_id, j.selected_worker_id)) < 2 THEN
        RAISE EXCEPTION 'ERR_CONDITIONS_NOT_ACCEPTED';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND stripe_onboarding_complete) THEN
        RAISE EXCEPTION 'ERR_STRIPE_ONBOARDING_INCOMPLETE';
    END IF;
    PERFORM set_config('app.action_method', 'button', true);
    UPDATE public.jobs SET status = 'arrival_registered', arrived_at = now() WHERE id = p_job;
    INSERT INTO public.payments (job_id, employer_id, worker_id, job_amount_mxn, status)
    VALUES (p_job, j.employer_id, j.selected_worker_id, j.fixed_payment_mxn, 'payment_pending');
END;
$$;

-- Finalizacion (RF-16, RF-21, RF-23). Con codigo: genera el codigo que ve el empleador.
CREATE OR REPLACE FUNCTION public.request_completion(p_job uuid, p_method completion_method)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
    j public.jobs%ROWTYPE;
BEGIN
    SELECT * INTO j FROM public.jobs WHERE id = p_job FOR UPDATE;
    IF NOT FOUND OR j.selected_worker_id IS DISTINCT FROM auth.uid() THEN RAISE EXCEPTION 'ERR_FORBIDDEN'; END IF;
    IF j.status <> 'in_progress' THEN RAISE EXCEPTION 'ERR_INVALID_STATE'; END IF;
    PERFORM set_config('app.action_method', p_method::text, true);
    UPDATE public.jobs SET status = 'completion_requested', completion_method = p_method,
           completion_requested_at = now() WHERE id = p_job;
    IF p_method = 'with_code' THEN
        INSERT INTO public.job_completion (job_id, code, code_expires_at)
        VALUES (p_job, app.gen_code(), now() + INTERVAL '24 hours')
        ON CONFLICT (job_id) DO UPDATE SET code = excluded.code, code_expires_at = excluded.code_expires_at,
                                           attempts = 0, renewals = 0, used_at = NULL;
    END IF;
END;
$$;

-- Validacion del codigo (RF-22). Devuelve estado en lugar de lanzar error para que el
-- conteo de intentos se confirme (un RAISE revertiria el incremento).
-- Resultados: ok | invalid | blocked | expired
-- D-04: al 5.o intento fallido se pasa a la ruta sin codigo (RF-23/RF-24).
CREATE OR REPLACE FUNCTION public.verify_completion_code(p_job uuid, p_code text)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
    j public.jobs%ROWTYPE;
    c public.job_completion%ROWTYPE;
BEGIN
    SELECT * INTO j FROM public.jobs WHERE id = p_job FOR UPDATE;
    IF NOT FOUND OR j.selected_worker_id IS DISTINCT FROM auth.uid() THEN RAISE EXCEPTION 'ERR_FORBIDDEN'; END IF;
    IF j.status <> 'completion_requested' OR j.completion_method IS DISTINCT FROM 'with_code' THEN
        RAISE EXCEPTION 'ERR_INVALID_STATE';
    END IF;
    SELECT * INTO c FROM public.job_completion WHERE job_id = p_job FOR UPDATE;
    IF c.used_at IS NOT NULL THEN RAISE EXCEPTION 'ERR_INVALID_STATE'; END IF;
    IF c.attempts >= 5 THEN RETURN 'blocked'; END IF;
    IF c.code_expires_at <= now() THEN RETURN 'expired'; END IF;
    IF c.code = p_code THEN
        PERFORM set_config('app.action_method', 'with_code', true);
        UPDATE public.job_completion SET used_at = now() WHERE job_id = p_job;
        UPDATE public.jobs SET status = 'completed' WHERE id = p_job;
        RETURN 'ok';
    END IF;
    UPDATE public.job_completion SET attempts = attempts + 1 WHERE job_id = p_job;
    IF c.attempts + 1 >= 5 THEN
        UPDATE public.jobs SET completion_method = 'without_code', completion_requested_at = now() WHERE id = p_job;
        RETURN 'blocked';
    END IF;
    RETURN 'invalid';
END;
$$;

-- Codigo nuevo tras vencer (RF-21): una vez; tras el segundo vencimiento, ruta sin codigo.
-- Resultados: renewed | without_code
CREATE OR REPLACE FUNCTION public.renew_completion_code(p_job uuid)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
    j public.jobs%ROWTYPE;
    c public.job_completion%ROWTYPE;
BEGIN
    SELECT * INTO j FROM public.jobs WHERE id = p_job FOR UPDATE;
    IF NOT FOUND OR j.selected_worker_id IS DISTINCT FROM auth.uid() THEN RAISE EXCEPTION 'ERR_FORBIDDEN'; END IF;
    IF j.status <> 'completion_requested' OR j.completion_method IS DISTINCT FROM 'with_code' THEN
        RAISE EXCEPTION 'ERR_INVALID_STATE';
    END IF;
    SELECT * INTO c FROM public.job_completion WHERE job_id = p_job FOR UPDATE;
    IF c.code_expires_at > now() AND c.attempts < 5 THEN RAISE EXCEPTION 'ERR_CODE_STILL_VALID'; END IF;
    IF c.renewals >= 1 THEN
        UPDATE public.jobs SET completion_method = 'without_code', completion_requested_at = now() WHERE id = p_job;
        RETURN 'without_code';
    END IF;
    UPDATE public.job_completion SET code = app.gen_code(), code_expires_at = now() + INTERVAL '24 hours',
           attempts = 0, renewals = renewals + 1 WHERE job_id = p_job;
    RETURN 'renewed';
END;
$$;

-- -----------------------------------------------------------------------------
-- 10. FUNCIONES SOLO PARA service_role (Edge Functions, webhooks, cron)
-- -----------------------------------------------------------------------------
-- Webhook payment_intent.succeeded ya validado (firma + idempotencia por stripe_events).
CREATE OR REPLACE FUNCTION public.service_confirm_payment(p_payment uuid, p_payment_intent text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
    pay public.payments%ROWTYPE;
BEGIN
    SELECT * INTO pay FROM public.payments WHERE id = p_payment FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'ERR_NOT_FOUND'; END IF;
    IF pay.status IN ('confirmed', 'transfer_pending') THEN RETURN; END IF;   -- idempotente
    PERFORM set_config('app.action_method', 'stripe_webhook', true);
    UPDATE public.payments SET status = 'confirmed', stripe_payment_intent_id = coalesce(p_payment_intent, stripe_payment_intent_id) WHERE id = p_payment;
    UPDATE public.payments SET status = 'transfer_pending' WHERE id = p_payment;
    UPDATE public.jobs SET status = 'in_progress' WHERE id = pay.job_id AND status = 'arrival_registered';
END;
$$;

-- Cron (cada minuto): vencimientos automaticos del SRS. Devuelve conteos por regla.
CREATE OR REPLACE FUNCTION public.expire_overdue()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
    r record;
    n_end_assigned int := 0; n_sel int := 0; n_end_open int := 0; n_pay int := 0;
    n_nocode int := 0; n_code2 int := 0; n_cases int := 0; n_chat int := 0;
BEGIN
    PERFORM set_config('app.action_method', 'system', true);

    -- D-03: llego la hora de fin sin llegada -> Vencido (se conserva el trabajador para el ticket por ausencia)
    FOR r IN SELECT id FROM public.jobs WHERE status = 'assigned' AND end_at < now() FOR UPDATE SKIP LOCKED LOOP
        UPDATE public.job_applications SET status = 'expired' WHERE job_id = r.id AND status IN ('accepted', 'pending');
        UPDATE public.jobs SET status = 'expired' WHERE id = r.id;
        n_end_assigned := n_end_assigned + 1;
    END LOOP;

    -- RF-12: vence la seleccion de 24 h
    FOR r IN SELECT id FROM public.jobs WHERE status = 'assigned' AND selection_expires_at < now() FOR UPDATE SKIP LOCKED LOOP
        PERFORM app.expire_selection(r.id);
        n_sel := n_sel + 1;
    END LOOP;

    -- Sin asignacion al terminar fecha y hora -> Vencido (RF-16)
    FOR r IN SELECT id FROM public.jobs WHERE status IN ('published', 'has_applications') AND end_at < now() FOR UPDATE SKIP LOCKED LOOP
        UPDATE public.job_applications SET status = 'expired' WHERE job_id = r.id AND status = 'pending';
        UPDATE public.jobs SET status = 'expired' WHERE id = r.id;
        n_end_open := n_end_open + 1;
    END LOOP;

    -- RF-18: 30 min desde la llegada sin cobro confirmado, o 3 intentos agotados -> Cancelado
    FOR r IN SELECT j.id AS job_id, p.id AS payment_id
               FROM public.jobs j JOIN public.payments p ON p.job_id = j.id
              WHERE j.status = 'arrival_registered' AND p.status IN ('payment_pending', 'failed')
                AND (j.arrived_at + INTERVAL '30 minutes' < now() OR (p.status = 'failed' AND p.payment_attempts >= 3))
                FOR UPDATE OF j, p SKIP LOCKED LOOP
        UPDATE public.payments SET status = 'cancelled' WHERE id = r.payment_id;
        UPDATE public.jobs SET status = 'cancelled' WHERE id = r.job_id;
        n_pay := n_pay + 1;
    END LOOP;

    -- RF-21: segundo vencimiento del codigo -> ruta sin codigo
    FOR r IN SELECT j.id FROM public.jobs j JOIN public.job_completion c ON c.job_id = j.id
              WHERE j.status = 'completion_requested' AND j.completion_method = 'with_code'
                AND c.used_at IS NULL AND c.renewals >= 1 AND c.code_expires_at < now()
                FOR UPDATE OF j SKIP LOCKED LOOP
        UPDATE public.jobs SET completion_method = 'without_code', completion_requested_at = now() WHERE id = r.id;
        n_code2 := n_code2 + 1;
    END LOOP;

    -- RF-24: sin respuesta ni caso en 24 h -> finalizacion aceptada automaticamente
    FOR r IN SELECT j.id FROM public.jobs j
              WHERE j.status = 'completion_requested' AND j.completion_method = 'without_code'
                AND j.completion_requested_at + INTERVAL '24 hours' < now()
                AND NOT EXISTS (SELECT 1 FROM public.cases c WHERE c.job_id = j.id AND c.status <> 'closed')
                FOR UPDATE OF j SKIP LOCKED LOOP
        UPDATE public.jobs SET status = 'completed' WHERE id = r.id;
        n_nocode := n_nocode + 1;
    END LOOP;

    -- RF-25: 7 dias sin objecion -> Cerrado (la ejecucion financiera la hace la Edge Function)
    FOR r IN SELECT id FROM public.cases WHERE status = 'resolved' AND auto_close_deadline < now() FOR UPDATE SKIP LOCKED LOOP
        UPDATE public.cases SET status = 'closed', closed_at = now() WHERE id = r.id;
        n_cases := n_cases + 1;
    END LOOP;

    -- RF-14: purga de mensajes 12 meses despues del cierre del trabajo
    DELETE FROM public.chat_messages m USING public.jobs j
     WHERE j.id = m.job_id AND j.closed_at IS NOT NULL AND j.closed_at < now() - INTERVAL '12 months';
    GET DIAGNOSTICS n_chat = ROW_COUNT;

    RETURN jsonb_build_object('assigned_end', n_end_assigned, 'selection', n_sel, 'open_end', n_end_open,
        'payment_timeout', n_pay, 'code_second_expiry', n_code2, 'auto_accepted', n_nocode,
        'cases_closed', n_cases, 'chat_purged', n_chat);
END;
$$;

-- Permisos de ejecucion. PostgreSQL concede EXECUTE a PUBLIC por defecto a cada funcion
-- nueva; por eso se revoca AQUI, cuando ya existen todas (una revocacion anterior no
-- cubre las funciones creadas despues). Las pruebas lo verifican.
REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA public FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA app FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION app.my_role(), app.is_admin(), app.can_write(), app.is_job_employer(uuid),
    app.is_job_selected_worker(uuid), app.has_applied(uuid), app.job_is_open(uuid), app.can_see_case(uuid),
    app.admin_attends_job(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION
    public.complete_profile(user_role, text, text, date), public.accept_terms(text, text),
    public.save_worker_location(numeric, numeric, int),
    public.create_job(text, text, job_category, numeric, date, time, time, text, text, text, numeric, numeric),
    public.update_job(uuid, text, text, job_category, numeric, date, time, time, text, text, text, numeric, numeric),
    public.cancel_job(uuid),
    public.search_jobs(job_category, date, date, int, int), public.get_job_public(uuid),
    public.get_applicants(uuid), public.get_counterpart_contact(uuid),
    public.apply_to_job(uuid), public.withdraw_application(uuid), public.reject_application(uuid),
    public.select_worker(uuid), public.confirm_conditions(uuid), public.register_arrival(uuid),
    public.request_completion(uuid, completion_method), public.verify_completion_code(uuid, text),
    public.renew_completion_code(uuid)
TO authenticated;

-- service_role puede todo lo demas (Edge Functions, cron, SQL del equipo)
GRANT USAGE ON SCHEMA app TO service_role;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO service_role;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA app TO service_role;

-- Realtime solo para chat y notificaciones (nunca jobs: replicaria filas completas).
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_messages, public.notifications;
    END IF;
END;
$$;

-- Cron (requiere habilitar pg_cron en Supabase). Ejecutar manualmente despues de la migracion:
--   SELECT cron.schedule('expire-overdue', '* * * * *', 'SELECT public.expire_overdue()');

COMMIT;

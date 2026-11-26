/**
 * Canonical Domain Types — Solidez MX (Aplicación Móvil del Trabajador)
 */

export type UserRole = 'employer' | 'worker' | 'admin';

export type AccountStatus = 'active' | 'warned' | 'suspended' | 'blocked' | 'soft_deleted';

export type JobCategory =
  | 'limpieza'
  | 'pintura'
  | 'jardineria'
  | 'mudanzas'
  | 'eventos'
  | 'otros';

export type JobStatus =
  | 'published'
  | 'has_applications'
  | 'assigned'
  | 'arrival_registered'
  | 'in_progress'
  | 'completion_requested'
  | 'in_claim'
  | 'completed'
  | 'cancelled'
  | 'expired';

export type ApplicationStatus =
  | 'pending'
  | 'accepted'
  | 'rejected'
  | 'withdrawn'
  | 'expired';

export type CompletionMethod = 'with_code' | 'without_code';

export type PaymentStatus =
  | 'not_started'
  | 'payment_pending'
  | 'confirmed'
  | 'failed'
  | 'in_claim'
  | 'transfer_pending'
  | 'transfer_failed'
  | 'transferred'
  | 'partial_settlement_pending'
  | 'partial_settlement_failed'
  | 'partial_settlement_completed'
  | 'refund_failed'
  | 'refunded'
  | 'cancelled';

export type CaseType = 'ticket' | 'claim' | 'report';
export type CaseStatus =
  | 'open'
  | 'pending'
  | 'in_review'
  | 'resolved'
  | 'closed'
  | 'dismissed'
  | 'attended';
export type CaseDecision = 'transfer_full' | 'refund_full' | 'partial';
export type CaseSource = 'user' | 'system';
export type TicketCategory =
  | 'account'
  | 'publication'
  | 'application'
  | 'job'
  | 'payment'
  | 'technical';
export type ReportTarget =
  | 'user'
  | 'job'
  | 'application'
  | 'review'
  | 'chat_message';

export type ModerationStatus = 'visible' | 'hidden' | 'removed';
export type AttachmentKind = 'job_photo' | 'completion_evidence' | 'case_evidence';

export type SearchRadiusKm = 5 | 10 | 25 | 50;

export type DistanceRangeLabel =
  | 'Menos de 5 km'
  | '5 a menos de 10 km'
  | '10 a menos de 25 km'
  | '25 a 50 km'
  | 'Más de 50 km';

export interface Profile {
  id: string;
  role: UserRole;
  full_name: string;
  email: string;
  phone: string;
  birth_date: string; // YYYY-MM-DD
  photo_path: string | null;
  avatar_initials?: string;
  avatar_tone?: string;
  skills: string | null; // <= 300 chars
  availability: string | null; // <= 300 chars
  stripe_account_id: string | null;
  stripe_onboarding_complete: boolean;
  account_status: AccountStatus;
  suspended_until: string | null;
  created_at: string;
  updated_at: string;
}

export interface WorkerLocation {
  worker_id: string;
  label: string;
  latitude: number;
  longitude: number;
  search_radius_km: SearchRadiusKm;
  initialized: boolean;
  /** Timestamps ISO de los cambios realizados después de guardar el punto inicial */
  recent_changes: string[];
  updated_at: string;
}

export interface TermsAcceptance {
  id: string;
  user_id: string;
  document: 'terms' | 'privacy';
  version: string;
  accepted_at: string;
}

export interface Job {
  id: string;
  employer_id: string;
  title: string;
  description: string;
  category: JobCategory;
  fixed_payment_mxn: number;
  job_date: string; // YYYY-MM-DD
  start_time: string; // HH:mm
  end_time: string; // HH:mm
  start_at: string; // ISO
  end_at: string; // ISO
  conditions: string | null;
  neighborhood: string;
  status: JobStatus;
  moderation_status: ModerationStatus;
  selected_worker_id: string | null;
  selection_round: number;
  selection_expires_at: string | null;
  assigned_at: string | null;
  arrived_at: string | null;
  completion_method: CompletionMethod | null;
  completion_requested_at: string | null;
  completed_at: string | null;
  closed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface JobPrivate {
  job_id: string;
  exact_address: string;
  exact_latitude: number;
  exact_longitude: number;
}

export interface JobCompletion {
  job_id: string;
  code: string; // 6 dígitos — nunca mostrado en claro al trabajador
  code_expires_at: string;
  attempts: number; // 0..5
  renewals: number; // 0..1
  used_at: string | null;
}

export interface JobApplication {
  id: string;
  job_id: string;
  worker_id: string;
  status: ApplicationStatus;
  created_at: string;
  updated_at: string;
}

export interface JobConfirmation {
  id: string;
  job_id: string;
  user_id: string;
  selection_round: number;
  confirmed_at: string;
}

export interface Payment {
  id: string;
  job_id: string;
  employer_id: string;
  worker_id: string;
  job_amount_mxn: number;
  platform_fee_mxn: number;
  total_charged_mxn: number;
  stripe_payment_intent_id: string | null;
  stripe_transfer_id: string | null;
  status: PaymentStatus;
  payment_attempts: number;
  created_at: string;
  updated_at: string;
}

export interface ChatMessage {
  id: string;
  job_id: string;
  worker_id: string;
  sender_id: string;
  body: string;
  moderation_status: ModerationStatus;
  read_by_worker: boolean;
  created_at: string;
}

export interface Case {
  id: string;
  case_type: CaseType;
  status: CaseStatus;
  source: CaseSource;
  reporter_id: string | null;
  job_id: string | null;
  reported_user_id: string | null;
  target_type: ReportTarget | null;
  target_id: string | null;
  ticket_category: TicketCategory | null;
  description: string;
  decision: CaseDecision | null;
  approved_transfer_amount: number | null;
  approved_refund_amount: number | null;
  resolution_notes: string | null;
  assigned_admin_id: string | null;
  resolved_at: string | null;
  closed_at: string | null;
  auto_close_deadline: string | null;
  created_at: string;
  updated_at: string;
}

export interface CaseMessage {
  id: string;
  case_id: string;
  author_id: string;
  body: string;
  is_internal: boolean;
  created_at: string;
}

export interface Review {
  id: string;
  job_id: string;
  reviewer_id: string;
  reviewee_id: string;
  rating: number; // 1..5
  comment: string | null;
  moderation_status: ModerationStatus;
  created_at: string;
}

export interface Attachment {
  id: string;
  owner_id: string;
  kind: AttachmentKind;
  job_id: string | null;
  case_id: string | null;
  storage_path: string;
  file_name: string;
  mime_type: 'image/jpeg' | 'image/png' | 'application/pdf';
  size_bytes: number;
  caption?: string;
  created_at: string;
}

export type NotificationCategory =
  | 'postulaciones'
  | 'trabajos'
  | 'mensajes'
  | 'pagos'
  | 'casos'
  | 'cuenta';

export interface Notification {
  id: string;
  user_id: string;
  event_type: string;
  title: string;
  body: string;
  category: NotificationCategory;
  target_route: string | null;
  read_at: string | null;
  created_at: string;
}

// -----------------------------------------------------------------------------
// PROYECCIONES PARA LA APP DEL TRABAJADOR
// -----------------------------------------------------------------------------

export interface EmployerReviewProjection {
  id: string;
  job_id: string;
  job_title: string;
  reviewer_name: string;
  rating: number;
  comment: string | null;
  created_at: string;
}

/** Tarjeta pública de oportunidad (NUNCA incluye domicilio exacto, coordenadas ni km exactos) */
export interface WorkerOpportunityCard {
  id: string;
  title: string;
  description: string;
  category: JobCategory;
  fixed_payment_mxn: number;
  job_date: string;
  start_time: string;
  end_time: string;
  start_at: string;
  end_at: string;
  neighborhood: string;
  status: JobStatus;
  employer_id: string;
  employer_name: string;
  employer_rating: number | null;
  employer_review_count: number;
  distance_range: DistanceRangeLabel;
  is_out_of_range: boolean;
  /** Solo para ordenamiento interno, jamás renderizado al usuario antes de selección */
  _sort_distance_km: number;
  has_applied: boolean;
  my_application_status: ApplicationStatus | null;
  photo_count: number;
  created_at: string;
}

export interface WorkerOpportunityDetail extends WorkerOpportunityCard {
  conditions: string | null;
  photos: Attachment[];
  employer_reviews: EmployerReviewProjection[];
  my_application_id: string | null;
}

export interface WorkerApplicationItem {
  id: string;
  job_id: string;
  status: ApplicationStatus;
  created_at: string;
  updated_at: string;
  job_title: string;
  job_category: JobCategory;
  job_date: string;
  start_time: string;
  end_time: string;
  fixed_payment_mxn: number;
  neighborhood: string;
  employer_name: string;
  employer_rating: number | null;
  job_status: JobStatus;
  distance_range: DistanceRangeLabel;
  is_selected_worker: boolean;
}

export interface WorkerAssignedJobDetail {
  job: Job;
  employer_name: string;
  employer_phone: string;
  employer_rating: number | null;
  employer_review_count: number;
  exact_address: string;
  exact_latitude: number;
  exact_longitude: number;
  photos: Attachment[];
  completion_evidence: Attachment[];
  worker_confirmed: boolean;
  employer_confirmed: boolean;
  worker_stripe_ready: boolean;
  payment: Payment | null;
  completion_meta: {
    code_expires_at: string;
    attempts: number;
    max_attempts: number;
    renewals: number;
    max_renewals: number;
    is_blocked: boolean;
    is_expired: boolean;
    used_at: string | null;
  } | null;
  worker_reviewed: boolean;
  worker_review: Review | null;
  open_claim_id: string | null;
}

export interface WorkerChatThread {
  job_id: string;
  job_title: string;
  job_status: JobStatus;
  employer_id: string;
  employer_name: string;
  employer_initials: string;
  employer_tone: string;
  last_message: string;
  last_message_at: string;
  unread_count: number;
  messages: ChatMessage[];
}

export interface WorkerPaymentItem {
  id: string;
  job_id: string;
  folio: string;
  job_title: string;
  category: JobCategory;
  employer_name: string;
  job_date: string;
  job_status: JobStatus;
  job_amount_mxn: number;
  status: PaymentStatus;
  stripe_transfer_id: string | null;
  case_id: string | null;
  case_decision: CaseDecision | null;
  approved_transfer_amount: number | null;
  resolution_notes: string | null;
  updated_at: string;
}

export interface WorkerCaseWithThread extends Case {
  folio: string;
  job_title: string | null;
  job_folio: string | null;
  job_amount_mxn: number | null;
  messages: (CaseMessage & {
    author_name: string;
    author_role: UserRole;
  })[];
  attachments: Attachment[];
}

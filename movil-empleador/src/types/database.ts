/**
 * Canonical Database & Domain Types — Solidez MX
 * Source of Truth: /docs/001_trabajos_temporales.sql & /docs/Especificacion_de_Arquitectura_de_Software_v2.md
 */

// -----------------------------------------------------------------------------
// 1. ENUMS
// -----------------------------------------------------------------------------
export type UserRole = 'employer' | 'worker' | 'admin';

export type AccountStatus = 'active' | 'warned' | 'suspended' | 'blocked' | 'soft_deleted';

export type JobCategory = 'limpieza' | 'pintura' | 'jardineria' | 'mudanzas' | 'eventos' | 'otros';

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

export type ApplicationStatus = 'pending' | 'accepted' | 'rejected' | 'withdrawn' | 'expired';

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

export type PaymentOperationType = 'charge' | 'transfer' | 'refund';
export type PaymentOperationStatus = 'pending' | 'succeeded' | 'failed';

export type CaseType = 'ticket' | 'claim' | 'report';
export type CaseStatus = 'open' | 'pending' | 'in_review' | 'resolved' | 'closed' | 'dismissed' | 'attended';
export type CaseDecision = 'transfer_full' | 'refund_full' | 'partial';
export type CaseSource = 'user' | 'system';
export type TicketCategory = 'account' | 'publication' | 'application' | 'job' | 'payment' | 'technical';
export type ReportTarget = 'user' | 'job' | 'application' | 'review' | 'chat_message';

export type ModerationStatus = 'visible' | 'hidden' | 'removed';
export type SanctionType =
  | 'warning'
  | 'suspension_1d'
  | 'suspension_7d'
  | 'suspension_30d'
  | 'permanent_block'
  | 'soft_delete';
export type AttachmentKind = 'job_photo' | 'completion_evidence' | 'case_evidence';

// -----------------------------------------------------------------------------
// 2. DATABASE TABLES
// -----------------------------------------------------------------------------
export interface Profile {
  id: string;
  role: UserRole;
  full_name: string;
  email: string; // Associated via auth.users
  phone: string;
  birth_date: string; // YYYY-MM-DD
  photo_path: string | null;
  skills: string | null; // Worker only (<= 300 chars)
  availability: string | null; // Worker only (<= 300 chars)
  stripe_account_id: string | null;
  stripe_onboarding_complete: boolean;
  account_status: AccountStatus;
  suspended_until: string | null;
  created_at: string;
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
  start_at: string; // ISO timestamptz
  end_at: string; // ISO timestamptz
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
  code: string; // 6 digits — strictly employer-only in RLS
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
  platform_fee_mxn: number; // round(job_amount_mxn * 0.10, 2)
  total_charged_mxn: number; // job_amount_mxn + platform_fee_mxn
  stripe_payment_intent_id: string | null;
  status: PaymentStatus;
  payment_attempts: number; // 0..3
  created_at: string;
  updated_at: string;
}

export interface PaymentOperation {
  id: string;
  payment_id: string;
  op_type: PaymentOperationType;
  amount_mxn: number;
  idempotency_key: string;
  status: PaymentOperationStatus;
  stripe_object_id: string | null;
  error_message: string | null;
  created_at: string;
  updated_at: string;
}

export interface ChatMessage {
  id: string;
  job_id: string;
  worker_id: string;
  sender_id: string;
  body: string; // 1..2000 chars
  moderation_status: ModerationStatus;
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
  auto_close_deadline: string | null; // resolved_at + 7 days
  created_at: string;
  updated_at: string;
}

export interface CaseMessage {
  id: string;
  case_id: string;
  author_id: string;
  body: string; // 1..4000 chars
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
  size_bytes: number; // > 0 and <= 10485760 (10 MB)
  created_at: string;
}

export interface Notification {
  id: string;
  user_id: string;
  event_type: string;
  title: string;
  body: string;
  category: 'asignaciones' | 'pagos' | 'casos';
  target_screen: string | null;
  target_id: string | null;
  read_at: string | null;
  created_at: string;
}

export interface DeviceToken {
  id: string;
  user_id: string;
  token: string;
  platform: 'android' | 'ios' | 'web';
  created_at: string;
}

export interface StateTransition {
  entity: 'job' | 'payment' | 'application' | 'case_ticket' | 'case_claim' | 'case_report';
  from_state: string;
  to_state: string;
}

// -----------------------------------------------------------------------------
// 3. COMPOSITE / RPC PROJECTION TYPES FOR EMPLOYER FRONTEND
// -----------------------------------------------------------------------------
export interface ApplicantSummary {
  application_id: string;
  worker_id: string;
  status: ApplicationStatus;
  applied_at: string;
  full_name: string;
  photo_path: string | null;
  skills: string | null;
  availability: string | null;
  rating: number;
  review_count: number;
  stripe_onboarding_complete: boolean;
}

export interface ApplicantPublicProfile extends ApplicantSummary {
  reviews: {
    id: string;
    job_id: string;
    job_title: string;
    reviewer_name: string;
    rating: number;
    comment: string | null;
    created_at: string;
  }[];
}

export interface CounterpartContact {
  full_name: string;
  phone: string;
}

export interface EmployerJobCardItem extends Job {
  applicant_count: number;
  pending_applicant_count: number;
  selected_worker_name: string | null;
  selected_worker_rating: number | null;
  selected_worker_photo: string | null;
  payment_status: PaymentStatus;
  total_charged_mxn: number;
  platform_fee_mxn: number;
}

export interface EmployerJobDetailView extends EmployerJobCardItem {
  private_data: JobPrivate;
  photos: Attachment[];
  completion_evidence: Attachment[];
  employer_confirmed: boolean;
  worker_confirmed: boolean;
  worker_stripe_ready: boolean;
  employer_reviewed: boolean;
}

export interface PaymentBreakdown {
  job_id: string;
  payment_id: string | null;
  job_amount_mxn: number;
  platform_fee_mxn: number;
  total_charged_mxn: number;
  status: PaymentStatus;
  payment_attempts: number;
  arrived_at: string | null;
  expires_at: string | null; // arrived_at + 30 min
}

export interface EmployerPaymentHistoryItem {
  job_id: string;
  folio: string;
  title: string;
  category: JobCategory;
  job_date: string;
  job_status: JobStatus;
  worker_id: string | null;
  worker_name: string | null;
  worker_rating: number | null;
  job_amount_mxn: number;
  platform_fee_mxn: number;
  total_charged_mxn: number;
  payment_status: PaymentStatus;
  stripe_payment_intent_id: string | null;
  employer_review_rating: number | null;
  case_id: string | null;
  case_decision: CaseDecision | null;
  approved_transfer_amount: number | null;
  approved_refund_amount: number | null;
  resolution_notes: string | null;
  updated_at: string;
}

export interface CaseWithThread extends Case {
  folio: string;
  job_title: string | null;
  job_folio: string | null;
  total_charged_mxn: number | null;
  messages: (CaseMessage & {
    author_name: string;
    author_role: UserRole;
  })[];
  attachments: Attachment[];
}

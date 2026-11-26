/**
 * Canonical Domain Types aligned 1:1 with docs/001_trabajos_temporales.sql
 * and docs/Especificacion_de_Arquitectura_de_Software_v2.md.
 */

export type UserRole = 'employer' | 'worker' | 'admin'

export type AccountStatus =
  | 'active'
  | 'warned'
  | 'suspended'
  | 'blocked'
  | 'soft_deleted'

export type JobCategory =
  | 'limpieza'
  | 'pintura'
  | 'jardineria'
  | 'mudanzas'
  | 'eventos'
  | 'otros'

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
  | 'expired'

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
  | 'cancelled'

export type PaymentOperationType = 'charge' | 'transfer' | 'refund'
export type PaymentOperationStatus = 'pending' | 'succeeded' | 'failed'

export type CaseType = 'ticket' | 'claim' | 'report'

export type TicketOrClaimStatus = 'open' | 'in_review' | 'resolved' | 'closed'
export type ReportStatus = 'pending' | 'in_review' | 'attended' | 'dismissed'
export type CaseStatus = TicketOrClaimStatus | ReportStatus

export type CaseDecision = 'transfer_full' | 'refund_full' | 'partial'
export type CaseSource = 'user' | 'system'

export type TicketCategory =
  | 'account'
  | 'publication'
  | 'application'
  | 'job'
  | 'payment'
  | 'technical'

export type ReportTarget =
  | 'user'
  | 'job'
  | 'application'
  | 'review'
  | 'chat_message'

export type ModerationStatus = 'visible' | 'hidden' | 'removed'
export type ModerationActionType = 'hide' | 'remove' | 'restore' | 'dismiss'

export type SanctionType =
  | 'warning'
  | 'suspension_1d'
  | 'suspension_7d'
  | 'suspension_30d'
  | 'permanent_block'
  | 'soft_delete'

export type AttachmentKind =
  | 'job_photo'
  | 'completion_evidence'
  | 'case_evidence'

export interface Profile {
  id: string
  code: string
  role: UserRole
  full_name: string
  email: string
  phone: string
  birth_date: string
  photo_path: string | null
  skills: string | null
  availability: string | null
  stripe_account_id: string | null
  stripe_onboarding_complete: boolean
  account_status: AccountStatus
  suspended_until: string | null
  rating_avg: number
  completed_jobs_count: number
  transacted_volume_mxn: number
  stripe_customer_id: string | null
  last_activity_at: string
  created_at: string
  updated_at: string
}

export interface Job {
  id: string
  folio: string
  employer_id: string
  worker_id: string | null
  title: string
  description: string
  category: JobCategory
  status: JobStatus
  moderation_status: ModerationStatus
  location_label: string
  scheduled_start_at: string
  scheduled_end_at: string
  payment_amount_mxn: number
  created_at: string
  updated_at: string
}

export interface ReviewRecord {
  id: string
  job_id: string
  author_id: string
  target_user_id: string
  rating: number
  comment: string
  moderation_status: ModerationStatus
  created_at: string
}

export interface ChatMessage {
  id: string
  job_id: string
  sender_id: string
  sender_role: 'employer' | 'worker'
  sender_name: string
  body: string
  moderation_status: ModerationStatus
  created_at: string
}

export interface Attachment {
  id: string
  job_id: string | null
  case_id: string | null
  uploaded_by: string
  uploaded_by_role: UserRole
  kind: AttachmentKind
  file_name: string
  mime_type: 'image/jpeg' | 'image/png' | 'application/pdf'
  size_bytes: number
  preview_url: string
  created_at: string
}

export interface StatusHistoryEntry {
  id: string
  entity: 'job' | 'payment' | 'case'
  entity_id: string
  from_state: string | null
  to_state: string
  actor_id: string | null
  actor_label: string
  method: string
  notes: string | null
  created_at: string
}

export interface Payment {
  id: string
  job_id: string
  employer_id: string
  worker_id: string
  job_amount_mxn: number
  platform_fee_mxn: number
  total_charged_mxn: number
  stripe_payment_intent_id: string
  status: PaymentStatus
  payment_attempts: number
  beneficiary_name: string
  case_folio: string | null
  failure_reason: string | null
  created_at: string
  updated_at: string
}

export interface PaymentOperation {
  id: string
  payment_id: string
  op_type: PaymentOperationType
  amount_mxn: number
  idempotency_key: string
  status: PaymentOperationStatus
  stripe_object_id: string | null
  error_message: string | null
  created_at: string
  updated_at: string
}

export interface StripeEvent {
  id: string
  event_type: string
  payment_intent_id: string | null
  signature_verified: boolean
  http_status: number
  summary: string
  payload: Record<string, unknown>
  received_at: string
  processed_at: string | null
  error_message: string | null
}

export interface CaseRecord {
  id: string
  folio: string
  case_type: CaseType
  status: CaseStatus
  source: CaseSource
  reporter_id: string | null
  job_id: string | null
  reported_user_id: string | null
  target_type: ReportTarget | null
  target_id: string | null
  ticket_category: TicketCategory | null
  subject: string
  description: string
  decision: CaseDecision | null
  approved_transfer_amount: number | null
  approved_refund_amount: number | null
  resolution_notes: string | null
  assigned_admin_id: string | null
  resolved_at: string | null
  closed_at: string | null
  auto_close_deadline: string | null
  created_at: string
  updated_at: string
}

export interface CaseMessage {
  id: string
  case_id: string
  author_id: string | null
  author_name: string
  author_role: UserRole | 'system'
  body: string
  is_internal: boolean
  attachments: Attachment[]
  created_at: string
}

export interface ModerationActionRecord {
  id: string
  admin_id: string
  admin_name: string
  case_id: string
  case_folio: string
  target_type: ReportTarget
  target_id: string
  action: ModerationActionType
  resulting_status: ModerationStatus | null
  reason: string
  created_at: string
}

export interface UserSanctionRecord {
  id: string
  user_id: string
  admin_id: string
  admin_name: string
  sanction: SanctionType
  reason: string
  case_id: string | null
  expires_at: string | null
  revoked_at: string | null
  created_at: string
}

export interface AdminSession {
  admin: Profile
  access_token: string
  issued_at: string
}

/** Composite projections returned by repository methods */

export interface CaseListItem extends CaseRecord {
  reporter: Profile | null
  assigned_admin: Profile | null
  reported_user: Profile | null
  job: Job | null
}

export interface ClaimArbitrationDossier {
  caseRecord: CaseRecord
  job: Job
  employer: Profile
  worker: Profile
  payment: Payment
  assignedAdmin: Profile | null
  statusHistory: StatusHistoryEntry[]
  /** Null when current admin is NOT assigned to this case (RLS app.admin_attends_job) */
  chatMessages: ChatMessage[] | null
  chatLockedByRls: boolean
  attachments: Attachment[]
  caseMessages: CaseMessage[]
}

export interface SupportTicketDetail {
  ticket: CaseListItem
  messages: CaseMessage[]
  linkedPayment: Payment | null
  linkedJob: Job | null
  requesterTickets: CaseRecord[]
}

export interface ModerationReportDetail {
  report: CaseListItem
  targetContentText: string
  targetContentImageUrl: string | null
  targetModerationStatus: ModerationStatus
  offender: Profile | null
  offenderSanctionsCount: number
  offenderReportsCount: number
  actionsHistory: ModerationActionRecord[]
}

export interface AccountDetail {
  profile: Profile
  reportsAgainst: CaseRecord[]
  sanctions: UserSanctionRecord[]
}

export interface StripeMonitorSnapshot {
  escrowTotalMxn: number
  escrowCount: number
  completedTotalMxn: number
  completedCount: number
  successRatePct: number
  failedCount: number
  failedRetainedMxn: number
  payments: Payment[]
  operations: PaymentOperation[]
  webhooks: StripeEvent[]
}

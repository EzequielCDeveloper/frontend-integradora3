import type {
  AccountDetail,
  AccountStatus,
  AdminSession,
  Attachment,
  CaseDecision,
  CaseListItem,
  CaseMessage,
  CaseStatus,
  CaseType,
  ClaimArbitrationDossier,
  ModerationActionRecord,
  ModerationActionType,
  ModerationReportDetail,
  Payment,
  Profile,
  ReportStatus,
  SanctionType,
  StripeMonitorSnapshot,
  SupportTicketDetail,
  TicketCategory,
  TicketOrClaimStatus,
  UserRole,
  UserSanctionRecord,
} from '@/shared/types/domain.types'

export type DateRangeFilter = 'all' | 'today' | '7d' | '30d'

export interface CasesFilterParams {
  caseType?: CaseType | 'all'
  status?: CaseStatus | 'all'
  dateRange?: DateRangeFilter
  assignedAdminId?: string | 'all' | 'unassigned'
  search?: string
}

export interface CreateAdminCaseInput {
  case_type: CaseType
  subject: string
  description: string
  reporter_id: string | null
  ticket_category?: TicketCategory | null
  assigned_admin_id?: string | null
  idempotency_key: string
}

export interface ResolveClaimInput {
  case_id: string
  decision: CaseDecision
  approved_transfer_amount: number
  approved_refund_amount: number
  resolution_notes: string
  idempotency_key: string
}

export interface CloseClaimInput {
  case_id: string
  idempotency_key: string
}

export interface TicketFilterParams {
  category?: TicketCategory | 'all'
  status?: TicketOrClaimStatus | 'all'
  dateRange?: DateRangeFilter
  search?: string
}

export interface ReplyTicketInput {
  case_id: string
  body: string
  is_internal: boolean
  next_status?: TicketOrClaimStatus
  attachment?: Pick<Attachment, 'file_name' | 'mime_type' | 'size_bytes' | 'preview_url'> | null
  idempotency_key: string
}

export interface ModerateContentInput {
  case_id: string
  action: ModerationActionType
  reason: string
  idempotency_key: string
}

export interface AccountsFilterParams {
  search?: string
  role?: Exclude<UserRole, 'admin'> | 'all'
  status?: AccountStatus | 'all'
}

export interface ApplySanctionInput {
  user_id: string
  sanction: SanctionType
  reason: string
  case_id?: string | null
  idempotency_key: string
}

export interface RevokeSanctionInput {
  sanction_id: string
  reason: string
  idempotency_key: string
}

export interface RetryStripePaymentInput {
  payment_id: string
  idempotency_key: string
}

export interface IAdminRepository {
  // UI-ADM-01: Auth
  login(email: string, password: string): Promise<AdminSession>
  requestPasswordReset(email: string): Promise<{ message: string }>
  logout(): Promise<void>
  getActiveAdmins(): Promise<Profile[]>

  // UI-ADM-02: Cases Inbox
  listCases(filters?: CasesFilterParams): Promise<CaseListItem[]>
  assignCase(
    caseId: string,
    adminId: string | null,
    idempotencyKey: string,
  ): Promise<CaseListItem>
  quickResolveCase(
    caseId: string,
    resolutionNotes: string,
    idempotencyKey: string,
  ): Promise<CaseListItem>
  createCase(input: CreateAdminCaseInput): Promise<CaseListItem>

  // UI-ADM-03: Claim Arbitration
  listClaims(): Promise<CaseListItem[]>
  getClaimDossier(caseId: string): Promise<ClaimArbitrationDossier>
  resolveClaim(input: ResolveClaimInput): Promise<ClaimArbitrationDossier>
  closeClaimAndExecutePayout(input: CloseClaimInput): Promise<ClaimArbitrationDossier>
  simulateClaimObjection(caseId: string, idempotencyKey: string): Promise<ClaimArbitrationDossier>

  // UI-ADM-04: Support Tickets
  listSupportTickets(filters?: TicketFilterParams): Promise<CaseListItem[]>
  getSupportTicketDetail(caseId: string): Promise<SupportTicketDetail>
  replyToSupportTicket(input: ReplyTicketInput): Promise<CaseMessage>

  // UI-ADM-05: Content Moderation
  listModerationReports(status?: ReportStatus | 'all'): Promise<ModerationReportDetail[]>
  getModerationAuditLog(): Promise<ModerationActionRecord[]>
  applyModerationAction(input: ModerateContentInput): Promise<ModerationReportDetail>

  // UI-ADM-06: Account Sanctions
  listAccounts(filters?: AccountsFilterParams): Promise<AccountDetail[]>
  getAccountDetail(userId: string): Promise<AccountDetail>
  applySanction(input: ApplySanctionInput): Promise<UserSanctionRecord>
  revokeSanction(input: RevokeSanctionInput): Promise<UserSanctionRecord>

  // UI-ADM-07: Stripe Financial Monitor
  getStripeMonitorSnapshot(statusFilter?: Payment['status'] | 'all'): Promise<StripeMonitorSnapshot>
  retryStripeOperation(input: RetryStripePaymentInput): Promise<Payment>
  syncStripeEvents(): Promise<StripeMonitorSnapshot>
}

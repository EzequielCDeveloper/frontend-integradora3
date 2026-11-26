import { create } from 'zustand'
import type {
  AccountDetail,
  AccountStatus,
  AdminSession,
  CaseDecision,
  CaseListItem,
  CaseMessage,
  CaseRecord,
  CaseStatus,
  ClaimArbitrationDossier,
  ModerationActionRecord,
  ModerationReportDetail,
  ModerationStatus,
  Payment,
  PaymentOperation,
  PaymentStatus,
  Profile,
  ReportStatus,
  SanctionType,
  StripeMonitorSnapshot,
  SupportTicketDetail,
  TicketOrClaimStatus,
  UserSanctionRecord,
} from '@/shared/types/domain.types'
import type {
  AccountsFilterParams,
  ApplySanctionInput,
  CasesFilterParams,
  CloseClaimInput,
  CreateAdminCaseInput,
  DateRangeFilter,
  ModerateContentInput,
  ReplyTicketInput,
  ResolveClaimInput,
  RetryStripePaymentInput,
  RevokeSanctionInput,
  TicketFilterParams,
} from '@/shared/services/admin-repository.contract'
import { DomainError, type DomainErrorCode } from '@/shared/utils/error-mapper'
import { roundToCents } from '@/shared/utils/format'
import { createInitialMockBackendSeed, type MockBackendData } from './mock-backend.seed'

/**
 * Exact SQL state_transitions tables from docs/001_trabajos_temporales.sql
 */
export const TICKET_CLAIM_TRANSITIONS: Record<TicketOrClaimStatus, readonly TicketOrClaimStatus[]> =
  {
    open: ['in_review'],
    in_review: ['resolved'],
    resolved: ['closed', 'in_review'],
    closed: [],
  }

export const REPORT_TRANSITIONS: Record<ReportStatus, readonly ReportStatus[]> = {
  pending: ['in_review', 'attended', 'dismissed'],
  in_review: ['attended', 'dismissed'],
  attended: [],
  dismissed: [],
}

export const RETRYABLE_PAYMENT_STATUSES: readonly PaymentStatus[] = [
  'transfer_failed',
  'refund_failed',
  'partial_settlement_failed',
]

export function validateCaseDecisionAmounts(
  decision: CaseDecision,
  transferAmount: number,
  refundAmount: number,
  payment: Pick<Payment, 'job_amount_mxn' | 'total_charged_mxn'>,
): void {
  const transfer = roundToCents(transferAmount)
  const refund = roundToCents(refundAmount)
  const jobAmount = roundToCents(payment.job_amount_mxn)
  const totalCharged = roundToCents(payment.total_charged_mxn)

  if (!Number.isFinite(transfer) || !Number.isFinite(refund) || transfer < 0 || refund < 0) {
    throw new DomainError('ERR_DECISION_AMOUNTS')
  }

  if (decision === 'transfer_full') {
    if (transfer !== jobAmount || refund !== 0) {
      throw new DomainError('ERR_DECISION_AMOUNTS')
    }
    return
  }

  if (decision === 'refund_full') {
    if (transfer !== 0 || refund !== totalCharged) {
      throw new DomainError('ERR_DECISION_AMOUNTS')
    }
    return
  }

  // SQL D-02 partial rule: transfer > 0, refund > 0, transfer + refund === total_charged_mxn
  if (transfer <= 0 || refund <= 0 || roundToCents(transfer + refund) !== totalCharged) {
    throw new DomainError('ERR_DECISION_AMOUNTS')
  }
}

function matchesDateRange(iso: string, range: DateRangeFilter | undefined): boolean {
  if (!range || range === 'all') return true
  const diffMs = Date.now() - new Date(iso).getTime()
  if (range === 'today') return diffMs <= 86_400_000
  if (range === '7d') return diffMs <= 7 * 86_400_000
  if (range === '30d') return diffMs <= 30 * 86_400_000
  return true
}

function sanctionToAccountStatus(sanction: SanctionType): AccountStatus {
  switch (sanction) {
    case 'warning':
      return 'warned'
    case 'suspension_1d':
    case 'suspension_7d':
    case 'suspension_30d':
      return 'suspended'
    case 'permanent_block':
      return 'blocked'
    case 'soft_delete':
      return 'soft_deleted'
  }
}

function sanctionDurationDays(sanction: SanctionType): number | null {
  if (sanction === 'suspension_1d') return 1
  if (sanction === 'suspension_7d') return 7
  if (sanction === 'suspension_30d') return 30
  return null
}

function makeId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
}

interface MockBackendStoreState {
  db: MockBackendData
  session: AdminSession | null
  simulatedLatencyMs: number
  nextSimulatedError: DomainErrorCode | null
  processedIdempotencyKeys: Record<string, unknown>

  // Test & Dev Controls
  resetMockDb: (options?: {
    authenticated?: boolean
    adminEmail?: string
    latencyMs?: number
  }) => void
  setNextSimulatedError: (code: DomainErrorCode | null) => void
  setSimulatedLatency: (ms: number) => void

  // Auth
  login: (email: string, password: string) => Promise<AdminSession>
  requestPasswordReset: (email: string) => Promise<{ message: string }>
  logout: () => Promise<void>
  getActiveAdmins: () => Promise<Profile[]>

  // Cases Inbox
  listCases: (filters?: CasesFilterParams) => Promise<CaseListItem[]>
  assignCase: (
    caseId: string,
    adminId: string | null,
    idempotencyKey: string,
  ) => Promise<CaseListItem>
  quickResolveCase: (
    caseId: string,
    resolutionNotes: string,
    idempotencyKey: string,
  ) => Promise<CaseListItem>
  createCase: (input: CreateAdminCaseInput) => Promise<CaseListItem>

  // Claim Arbitration
  listClaims: () => Promise<CaseListItem[]>
  getClaimDossier: (caseId: string) => Promise<ClaimArbitrationDossier>
  resolveClaim: (input: ResolveClaimInput) => Promise<ClaimArbitrationDossier>
  closeClaimAndExecutePayout: (input: CloseClaimInput) => Promise<ClaimArbitrationDossier>
  simulateClaimObjection: (
    caseId: string,
    idempotencyKey: string,
  ) => Promise<ClaimArbitrationDossier>

  // Support Tickets
  listSupportTickets: (filters?: TicketFilterParams) => Promise<CaseListItem[]>
  getSupportTicketDetail: (caseId: string) => Promise<SupportTicketDetail>
  replyToSupportTicket: (input: ReplyTicketInput) => Promise<CaseMessage>

  // Content Moderation
  listModerationReports: (status?: ReportStatus | 'all') => Promise<ModerationReportDetail[]>
  getModerationAuditLog: () => Promise<ModerationActionRecord[]>
  applyModerationAction: (input: ModerateContentInput) => Promise<ModerationReportDetail>

  // Account Sanctions
  listAccounts: (filters?: AccountsFilterParams) => Promise<AccountDetail[]>
  getAccountDetail: (userId: string) => Promise<AccountDetail>
  applySanction: (input: ApplySanctionInput) => Promise<UserSanctionRecord>
  revokeSanction: (input: RevokeSanctionInput) => Promise<UserSanctionRecord>

  // Stripe Monitor
  getStripeMonitorSnapshot: (
    statusFilter?: PaymentStatus | 'all',
  ) => Promise<StripeMonitorSnapshot>
  retryStripeOperation: (input: RetryStripePaymentInput) => Promise<Payment>
  syncStripeEvents: () => Promise<StripeMonitorSnapshot>
}

const SESSION_STORAGE_KEY = 'solidez_web_admin_session_v1'

function loadPersistedSession(): AdminSession | null {
  try {
    const raw = window.sessionStorage.getItem(SESSION_STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as AdminSession
    if (parsed?.admin?.role === 'admin' && parsed?.admin?.account_status === 'active') {
      return parsed
    }
    return null
  } catch {
    return null
  }
}

function persistSession(session: AdminSession | null): void {
  try {
    if (!session) {
      window.sessionStorage.removeItem(SESSION_STORAGE_KEY)
    } else {
      window.sessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session))
    }
  } catch {
    // Ignore storage errors in restricted environments
  }
}

async function simulateNetwork<T>(
  get: () => MockBackendStoreState,
  set: (partial: Partial<MockBackendStoreState>) => void,
  fn: () => T,
): Promise<T> {
  const { simulatedLatencyMs, nextSimulatedError } = get()
  if (simulatedLatencyMs > 0) {
    await new Promise((resolve) => setTimeout(resolve, simulatedLatencyMs))
  }
  if (nextSimulatedError) {
    set({ nextSimulatedError: null })
    throw new DomainError(nextSimulatedError)
  }
  return fn()
}

function requireActiveAdmin(get: () => MockBackendStoreState): Profile {
  const { session, db } = get()
  if (!session) {
    throw new DomainError('ERR_NOT_AUTHENTICATED')
  }
  const latest = db.profiles.find((p) => p.id === session.admin.id)
  if (!latest) {
    throw new DomainError('ERR_NOT_AUTHENTICATED')
  }
  if (latest.role !== 'admin') {
    throw new DomainError('ERR_FORBIDDEN')
  }
  if (latest.account_status !== 'active') {
    throw new DomainError('ERR_ACCOUNT_RESTRICTED')
  }
  return latest
}

function hydrateCaseListItem(db: MockBackendData, c: CaseRecord): CaseListItem {
  return {
    ...c,
    reporter: c.reporter_id
      ? db.profiles.find((p) => p.id === c.reporter_id) ?? null
      : null,
    assigned_admin: c.assigned_admin_id
      ? db.profiles.find((p) => p.id === c.assigned_admin_id) ?? null
      : null,
    reported_user: c.reported_user_id
      ? db.profiles.find((p) => p.id === c.reported_user_id) ?? null
      : null,
    job: c.job_id ? db.jobs.find((j) => j.id === c.job_id) ?? null : null,
  }
}

function buildModerationDetail(
  db: MockBackendData,
  report: CaseRecord,
): ModerationReportDetail {
  const hydrated = hydrateCaseListItem(db, report)
  let targetContentText = report.description
  let targetContentImageUrl: string | null = null
  let targetModerationStatus: ModerationStatus = 'visible'

  if (report.target_type === 'job' && report.target_id) {
    const job = db.jobs.find((j) => j.id === report.target_id)
    if (job) {
      targetContentText = `${job.title} — ${job.description}`
      targetModerationStatus = job.moderation_status
      targetContentImageUrl =
        'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=800&q=80'
    }
  } else if (report.target_type === 'review' && report.target_id) {
    const review = db.reviews.find((r) => r.id === report.target_id)
    if (review) {
      targetContentText = `Reseña (${review.rating}★): "${review.comment}"`
      targetModerationStatus = review.moderation_status
    }
  } else if (report.target_type === 'chat_message' && report.target_id) {
    const msg = db.chatMessages.find((m) => m.id === report.target_id)
    if (msg) {
      targetContentText = `Mensaje de ${msg.sender_name}: "${msg.body}"`
      targetModerationStatus = msg.moderation_status
    }
  } else if (report.target_type === 'user' && report.target_id) {
    const user = db.profiles.find((p) => p.id === report.target_id)
    if (user) {
      targetContentText = `Perfil reportado: ${user.full_name} (${user.email}) — Estado: ${user.account_status}`
    }
  }

  const offender = report.reported_user_id
    ? db.profiles.find((p) => p.id === report.reported_user_id) ?? null
    : null
  const offenderSanctionsCount = offender
    ? db.userSanctions.filter((s) => s.user_id === offender.id && !s.revoked_at).length
    : 0
  const offenderReportsCount = offender
    ? db.cases.filter(
        (c) => c.case_type === 'report' && c.reported_user_id === offender.id,
      ).length
    : 0

  return {
    report: hydrated,
    targetContentText,
    targetContentImageUrl,
    targetModerationStatus,
    offender,
    offenderSanctionsCount,
    offenderReportsCount,
    actionsHistory: db.moderationActions.filter((a) => a.case_id === report.id),
  }
}

function buildClaimDossier(
  db: MockBackendData,
  caseId: string,
  currentAdmin: Profile,
): ClaimArbitrationDossier {
  const caseRecord = db.cases.find(
    (c) => c.id === caseId && c.case_type === 'claim',
  )
  if (!caseRecord || !caseRecord.job_id) {
    throw new DomainError('ERR_NOT_FOUND', 'No se encontró la reclamación solicitada.')
  }
  const job = db.jobs.find((j) => j.id === caseRecord.job_id)
  if (!job) {
    throw new DomainError('ERR_NOT_FOUND', 'No se encontró el trabajo asociado a la reclamación.')
  }
  const employer = db.profiles.find((p) => p.id === job.employer_id)
  const worker = job.worker_id
    ? db.profiles.find((p) => p.id === job.worker_id)
    : undefined
  const payment = db.payments.find((p) => p.job_id === job.id)

  if (!employer || !worker || !payment) {
    throw new DomainError('ERR_NOT_FOUND', 'Expediente incompleto para el arbitraje.')
  }

  const assignedAdmin = caseRecord.assigned_admin_id
    ? db.profiles.find((p) => p.id === caseRecord.assigned_admin_id) ?? null
    : null

  // SQL RLS app.admin_attends_job: admin reads chat ONLY when assigned to a case for this job
  const canReadChat = caseRecord.assigned_admin_id === currentAdmin.id

  return {
    caseRecord,
    job,
    employer,
    worker,
    payment,
    assignedAdmin,
    statusHistory: db.statusHistory
      .filter(
        (h) =>
          (h.entity === 'job' && h.entity_id === job.id) ||
          (h.entity === 'payment' && h.entity_id === payment.id) ||
          (h.entity === 'case' && h.entity_id === caseRecord.id),
      )
      .sort((a, b) => a.created_at.localeCompare(b.created_at)),
    chatMessages: canReadChat
      ? db.chatMessages
          .filter((m) => m.job_id === job.id)
          .sort((a, b) => a.created_at.localeCompare(b.created_at))
      : null,
    chatLockedByRls: !canReadChat,
    attachments: db.attachments.filter(
      (a) => a.case_id === caseRecord.id || a.job_id === job.id,
    ),
    caseMessages: db.caseMessages.filter((m) => m.case_id === caseRecord.id),
  }
}

function buildStripeSnapshot(
  db: MockBackendData,
  statusFilter: PaymentStatus | 'all' = 'all',
): StripeMonitorSnapshot {
  const escrowPayments = db.payments.filter((p) =>
    ['confirmed', 'in_claim', 'transfer_pending', 'partial_settlement_pending'].includes(
      p.status,
    ),
  )
  const completedPayments = db.payments.filter((p) =>
    ['transferred', 'partial_settlement_completed'].includes(p.status),
  )
  const failedPayments = db.payments.filter((p) =>
    RETRYABLE_PAYMENT_STATUSES.includes(p.status),
  )

  const escrowTotalMxn = roundToCents(
    escrowPayments.reduce((sum, p) => sum + p.total_charged_mxn, 0),
  )
  const completedTotalMxn = roundToCents(
    completedPayments.reduce((sum, p) => sum + p.job_amount_mxn, 0),
  )
  const failedRetainedMxn = roundToCents(
    failedPayments.reduce((sum, p) => sum + p.total_charged_mxn, 0),
  )
  const terminalTotal = completedPayments.length + failedPayments.length
  const successRatePct =
    terminalTotal === 0
      ? 100
      : roundToCents((completedPayments.length / terminalTotal) * 100)

  const filteredPayments =
    statusFilter === 'all'
      ? [...db.payments]
      : db.payments.filter((p) => p.status === statusFilter)

  return {
    escrowTotalMxn,
    escrowCount: escrowPayments.length,
    completedTotalMxn,
    completedCount: completedPayments.length,
    successRatePct,
    failedCount: failedPayments.length,
    failedRetainedMxn,
    payments: filteredPayments.sort((a, b) => b.updated_at.localeCompare(a.updated_at)),
    operations: [...db.paymentOperations].sort((a, b) =>
      b.created_at.localeCompare(a.created_at),
    ),
    webhooks: [...db.stripeEvents].sort((a, b) =>
      b.received_at.localeCompare(a.received_at),
    ),
  }
}

export const useMockBackendStore = create<MockBackendStoreState>((set, get) => ({
  db: createInitialMockBackendSeed(),
  session: loadPersistedSession(),
  simulatedLatencyMs: 320,
  nextSimulatedError: null,
  processedIdempotencyKeys: {},

  resetMockDb: (options) => {
    const freshDb = createInitialMockBackendSeed()
    let nextSession: AdminSession | null = null
    if (options?.authenticated) {
      const targetEmail = (options.adminEmail ?? 'admin@solidez.mx').toLowerCase()
      const cred = freshDb.credentials[targetEmail]
      const admin = cred
        ? freshDb.profiles.find((p) => p.id === cred.profile_id) ?? null
        : freshDb.profiles.find((p) => p.role === 'admin' && p.account_status === 'active') ??
          null
      if (admin) {
        nextSession = {
          admin,
          access_token: `mock-jwt-${admin.id}`,
          issued_at: new Date().toISOString(),
        }
      }
    }
    persistSession(nextSession)
    set({
      db: freshDb,
      session: nextSession,
      simulatedLatencyMs: options?.latencyMs ?? 320,
      nextSimulatedError: null,
      processedIdempotencyKeys: {},
    })
  },

  setNextSimulatedError: (code) => set({ nextSimulatedError: code }),
  setSimulatedLatency: (ms) => set({ simulatedLatencyMs: Math.max(0, ms) }),

  login: (email, password) =>
    simulateNetwork(get, set, () => {
      const normalized = email.trim().toLowerCase()
      const cred = get().db.credentials[normalized]
      if (!cred || cred.password !== password) {
        throw new DomainError('ERR_INVALID_CREDENTIALS')
      }
      const profile = get().db.profiles.find((p) => p.id === cred.profile_id)
      if (!profile) {
        throw new DomainError('ERR_INVALID_CREDENTIALS')
      }
      if (profile.role !== 'admin') {
        throw new DomainError('ERR_FORBIDDEN')
      }
      if (profile.account_status !== 'active') {
        throw new DomainError('ERR_ACCOUNT_RESTRICTED')
      }
      const session: AdminSession = {
        admin: profile,
        access_token: `mock-jwt-${profile.id}-${Date.now()}`,
        issued_at: new Date().toISOString(),
      }
      persistSession(session)
      set({ session })
      return session
    }),

  requestPasswordReset: (email) =>
    simulateNetwork(get, set, () => {
      const normalized = email.trim().toLowerCase()
      if (!normalized || !normalized.includes('@')) {
        throw new DomainError('ERR_VALIDATION', 'Ingresa un correo electrónico corporativo válido.')
      }
      // Generic non-enumerating security response (OWASP)
      return {
        message:
          'Si el correo pertenece a una cuenta administrativa activa, recibirás instrucciones de restablecimiento en los próximos minutos.',
      }
    }),

  logout: () =>
    simulateNetwork(get, set, () => {
      persistSession(null)
      set({ session: null })
    }),

  getActiveAdmins: () =>
    simulateNetwork(get, set, () => {
      requireActiveAdmin(get)
      return get().db.profiles.filter(
        (p) => p.role === 'admin' && p.account_status === 'active',
      )
    }),

  listCases: (filters) =>
    simulateNetwork(get, set, () => {
      requireActiveAdmin(get)
      const { db } = get()
      const q = filters?.search?.trim().toLowerCase() ?? ''

      return db.cases
        .map((c) => hydrateCaseListItem(db, c))
        .filter((item) => {
          if (filters?.caseType && filters.caseType !== 'all' && item.case_type !== filters.caseType) {
            return false
          }
          if (filters?.status && filters.status !== 'all' && item.status !== filters.status) {
            return false
          }
          if (!matchesDateRange(item.created_at, filters?.dateRange)) {
            return false
          }
          if (filters?.assignedAdminId && filters.assignedAdminId !== 'all') {
            if (filters.assignedAdminId === 'unassigned') {
              if (item.assigned_admin_id !== null) return false
            } else if (item.assigned_admin_id !== filters.assignedAdminId) {
              return false
            }
          }
          if (q) {
            const haystack = [
              item.folio,
              item.subject,
              item.description,
              item.reporter?.full_name ?? 'sistema',
              item.reporter?.email ?? '',
              item.assigned_admin?.full_name ?? '',
            ]
              .join(' ')
              .toLowerCase()
            if (!haystack.includes(q)) return false
          }
          return true
        })
        .sort((a, b) => b.created_at.localeCompare(a.created_at))
    }),

  assignCase: (caseId, adminId, idempotencyKey) =>
    simulateNetwork(get, set, () => {
      requireActiveAdmin(get)
      const cached = get().processedIdempotencyKeys[idempotencyKey]
      if (cached) return cached as CaseListItem

      const { db } = get()
      const existing = db.cases.find((c) => c.id === caseId)
      if (!existing) throw new DomainError('ERR_NOT_FOUND')

      if (adminId !== null) {
        const targetAdmin = db.profiles.find(
          (p) => p.id === adminId && p.role === 'admin' && p.account_status === 'active',
        )
        if (!targetAdmin) {
          throw new DomainError('ERR_FORBIDDEN', 'Solo se puede asignar a un administrador activo.')
        }
      }

      const now = new Date().toISOString()
      let nextStatus: CaseStatus = existing.status
      if (adminId && existing.status === 'open') {
        nextStatus = 'in_review'
      } else if (adminId && existing.status === 'pending') {
        nextStatus = 'in_review'
      }

      const updatedCase: CaseRecord = {
        ...existing,
        assigned_admin_id: adminId,
        status: nextStatus,
        updated_at: now,
      }

      const nextDb: MockBackendData = {
        ...db,
        cases: db.cases.map((c) => (c.id === caseId ? updatedCase : c)),
      }
      const result = hydrateCaseListItem(nextDb, updatedCase)
      set({
        db: nextDb,
        processedIdempotencyKeys: {
          ...get().processedIdempotencyKeys,
          [idempotencyKey]: result,
        },
      })
      return result
    }),

  quickResolveCase: (caseId, resolutionNotes, idempotencyKey) =>
    simulateNetwork(get, set, () => {
      const admin = requireActiveAdmin(get)
      const cached = get().processedIdempotencyKeys[idempotencyKey]
      if (cached) return cached as CaseListItem

      const trimmed = resolutionNotes.trim()
      if (!trimmed) {
        throw new DomainError('ERR_REASON_REQUIRED')
      }

      const { db } = get()
      const existing = db.cases.find((c) => c.id === caseId)
      if (!existing) throw new DomainError('ERR_NOT_FOUND')

      if (existing.case_type === 'claim') {
        throw new DomainError(
          'ERR_DECISION_REQUIRED',
          'Las reclamaciones deben resolverse desde el Panel de Arbitraje (UI-ADM-03) indicando la distribución Escrow D-02.',
        )
      }

      const now = new Date().toISOString()
      let nextStatus: CaseStatus
      if (existing.case_type === 'report') {
        const current = existing.status as ReportStatus
        if (!REPORT_TRANSITIONS[current].includes('attended')) {
          throw new DomainError('ERR_INVALID_TRANSITION')
        }
        nextStatus = 'attended'
      } else {
        const current = existing.status as TicketOrClaimStatus
        if (current === 'open') {
          // Allowed quick step open -> in_review -> resolved for tickets
          nextStatus = 'resolved'
        } else if (TICKET_CLAIM_TRANSITIONS[current].includes('resolved')) {
          nextStatus = 'resolved'
        } else {
          throw new DomainError('ERR_INVALID_TRANSITION')
        }
      }

      const updated: CaseRecord = {
        ...existing,
        status: nextStatus,
        assigned_admin_id: existing.assigned_admin_id ?? admin.id,
        resolution_notes: trimmed,
        resolved_at: now,
        auto_close_deadline:
          existing.case_type === 'ticket'
            ? new Date(Date.now() + 7 * 86_400_000).toISOString()
            : existing.auto_close_deadline,
        updated_at: now,
      }

      const nextDb: MockBackendData = {
        ...db,
        cases: db.cases.map((c) => (c.id === caseId ? updated : c)),
      }
      const result = hydrateCaseListItem(nextDb, updated)
      set({
        db: nextDb,
        processedIdempotencyKeys: {
          ...get().processedIdempotencyKeys,
          [idempotencyKey]: result,
        },
      })
      return result
    }),

  createCase: (input) =>
    simulateNetwork(get, set, () => {
      const admin = requireActiveAdmin(get)
      const cached = get().processedIdempotencyKeys[input.idempotency_key]
      if (cached) return cached as CaseListItem

      const subject = input.subject.trim()
      const description = input.description.trim()
      if (!subject || !description) {
        throw new DomainError('ERR_VALIDATION', 'El asunto y la descripción son obligatorios.')
      }

      const { db } = get()
      const now = new Date().toISOString()
      const prefix =
        input.case_type === 'ticket'
          ? 'TCK'
          : input.case_type === 'claim'
            ? 'ARB'
            : 'REP'
      const folio = `#${prefix}-${Math.floor(2100 + Math.random() * 7800)}`
      const initialStatus: CaseStatus =
        input.case_type === 'report' ? 'pending' : 'open'

      const newCase: CaseRecord = {
        id: makeId('cas'),
        folio,
        case_type: input.case_type,
        status: initialStatus,
        source: input.reporter_id ? 'user' : 'system',
        reporter_id: input.reporter_id,
        job_id: null,
        reported_user_id: null,
        target_type: input.case_type === 'report' ? 'user' : null,
        target_id: input.case_type === 'report' ? input.reporter_id : null,
        ticket_category:
          input.case_type === 'ticket' ? input.ticket_category ?? 'technical' : null,
        subject,
        description,
        decision: null,
        approved_transfer_amount: null,
        approved_refund_amount: null,
        resolution_notes: null,
        assigned_admin_id: input.assigned_admin_id ?? admin.id,
        resolved_at: null,
        closed_at: null,
        auto_close_deadline: null,
        created_at: now,
        updated_at: now,
      }

      const nextDb: MockBackendData = {
        ...db,
        cases: [newCase, ...db.cases],
      }
      const result = hydrateCaseListItem(nextDb, newCase)
      set({
        db: nextDb,
        processedIdempotencyKeys: {
          ...get().processedIdempotencyKeys,
          [input.idempotency_key]: result,
        },
      })
      return result
    }),

  listClaims: () =>
    simulateNetwork(get, set, () => {
      requireActiveAdmin(get)
      const { db } = get()
      return db.cases
        .filter((c) => c.case_type === 'claim')
        .map((c) => hydrateCaseListItem(db, c))
        .sort((a, b) => b.created_at.localeCompare(a.created_at))
    }),

  getClaimDossier: (caseId) =>
    simulateNetwork(get, set, () => {
      const admin = requireActiveAdmin(get)
      return buildClaimDossier(get().db, caseId, admin)
    }),

  resolveClaim: (input) =>
    simulateNetwork(get, set, () => {
      const admin = requireActiveAdmin(get)
      const cached = get().processedIdempotencyKeys[input.idempotency_key]
      if (cached) return cached as ClaimArbitrationDossier

      const notes = input.resolution_notes.trim()
      if (!notes) {
        throw new DomainError('ERR_DECISION_REQUIRED')
      }

      const { db } = get()
      const existing = db.cases.find(
        (c) => c.id === input.case_id && c.case_type === 'claim',
      )
      if (!existing || !existing.job_id) {
        throw new DomainError('ERR_NOT_FOUND')
      }

      const currentStatus = existing.status as TicketOrClaimStatus
      if (currentStatus !== 'in_review') {
        throw new DomainError(
          'ERR_INVALID_TRANSITION',
          'La reclamación debe estar asignada y en revisión (in_review) antes de emitir una resolución.',
        )
      }

      const payment = db.payments.find((p) => p.job_id === existing.job_id)
      if (!payment) throw new DomainError('ERR_NOT_FOUND')

      validateCaseDecisionAmounts(
        input.decision,
        input.approved_transfer_amount,
        input.approved_refund_amount,
        payment,
      )

      const now = new Date().toISOString()
      const autoCloseDeadline = new Date(Date.now() + 7 * 86_400_000).toISOString()

      const updatedCase: CaseRecord = {
        ...existing,
        status: 'resolved',
        assigned_admin_id: existing.assigned_admin_id ?? admin.id,
        decision: input.decision,
        approved_transfer_amount: roundToCents(input.approved_transfer_amount),
        approved_refund_amount: roundToCents(input.approved_refund_amount),
        resolution_notes: notes,
        resolved_at: now,
        auto_close_deadline: autoCloseDeadline,
        updated_at: now,
      }

      const historyEntry = {
        id: makeId('sh'),
        entity: 'case' as const,
        entity_id: existing.id,
        from_state: 'in_review',
        to_state: 'resolved',
        actor_id: admin.id,
        actor_label: admin.full_name,
        method: `resolve_claim:${input.decision}`,
        notes: `Resolución emitida (${input.decision}). Ventana de objeción de 7 días iniciada.`,
        created_at: now,
      }

      const nextDb: MockBackendData = {
        ...db,
        cases: db.cases.map((c) => (c.id === existing.id ? updatedCase : c)),
        statusHistory: [...db.statusHistory, historyEntry],
      }

      const dossier = buildClaimDossier(nextDb, existing.id, admin)
      set({
        db: nextDb,
        processedIdempotencyKeys: {
          ...get().processedIdempotencyKeys,
          [input.idempotency_key]: dossier,
        },
      })
      return dossier
    }),

  simulateClaimObjection: (caseId, idempotencyKey) =>
    simulateNetwork(get, set, () => {
      const admin = requireActiveAdmin(get)
      const cached = get().processedIdempotencyKeys[idempotencyKey]
      if (cached) return cached as ClaimArbitrationDossier

      const { db } = get()
      const existing = db.cases.find(
        (c) => c.id === caseId && c.case_type === 'claim',
      )
      if (!existing) throw new DomainError('ERR_NOT_FOUND')
      if (existing.status !== 'resolved') {
        throw new DomainError('ERR_INVALID_TRANSITION')
      }

      const now = new Date().toISOString()
      const updatedCase: CaseRecord = {
        ...existing,
        status: 'in_review',
        auto_close_deadline: null,
        updated_at: now,
      }

      const nextDb: MockBackendData = {
        ...db,
        cases: db.cases.map((c) => (c.id === caseId ? updatedCase : c)),
        statusHistory: [
          ...db.statusHistory,
          {
            id: makeId('sh'),
            entity: 'case',
            entity_id: existing.id,
            from_state: 'resolved',
            to_state: 'in_review',
            actor_id: existing.reporter_id,
            actor_label: 'Parte inconforme',
            method: 'object_claim_resolution',
            notes: 'Objeción registrada dentro de la ventana de 7 días. Los fondos permanecen en Escrow.',
            created_at: now,
          },
        ],
      }

      const dossier = buildClaimDossier(nextDb, caseId, admin)
      set({
        db: nextDb,
        processedIdempotencyKeys: {
          ...get().processedIdempotencyKeys,
          [idempotencyKey]: dossier,
        },
      })
      return dossier
    }),

  closeClaimAndExecutePayout: (input) =>
    simulateNetwork(get, set, () => {
      const admin = requireActiveAdmin(get)
      const cached = get().processedIdempotencyKeys[input.idempotency_key]
      if (cached) return cached as ClaimArbitrationDossier

      const { db } = get()
      const existing = db.cases.find(
        (c) => c.id === input.case_id && c.case_type === 'claim',
      )
      if (!existing || !existing.job_id) throw new DomainError('ERR_NOT_FOUND')
      if (existing.status !== 'resolved' || !existing.decision) {
        throw new DomainError(
          'ERR_INVALID_TRANSITION',
          'Solo se puede cerrar y ejecutar pago de una reclamación en estado resuelto.',
        )
      }

      const payment = db.payments.find((p) => p.job_id === existing.job_id)
      const job = db.jobs.find((j) => j.id === existing.job_id)
      if (!payment || !job) throw new DomainError('ERR_NOT_FOUND')

      const now = new Date().toISOString()
      const nextPaymentStatus: PaymentStatus =
        existing.decision === 'transfer_full'
          ? 'transfer_pending'
          : existing.decision === 'refund_full'
            ? 'refunded'
            : 'partial_settlement_pending'
      const nextJobStatus =
        existing.decision === 'refund_full' ? 'cancelled' : 'completed'

      const newOps: PaymentOperation[] = []
      if ((existing.approved_transfer_amount ?? 0) > 0) {
        newOps.push({
          id: makeId('pop'),
          payment_id: payment.id,
          op_type: 'transfer',
          amount_mxn: existing.approved_transfer_amount ?? 0,
          idempotency_key: `${input.idempotency_key}:transfer`,
          status: 'pending',
          stripe_object_id: `tr_${Math.random().toString(36).slice(2, 12)}`,
          error_message: null,
          created_at: now,
          updated_at: now,
        })
      }
      if ((existing.approved_refund_amount ?? 0) > 0) {
        newOps.push({
          id: makeId('pop'),
          payment_id: payment.id,
          op_type: 'refund',
          amount_mxn: existing.approved_refund_amount ?? 0,
          idempotency_key: `${input.idempotency_key}:refund`,
          status: existing.decision === 'refund_full' ? 'succeeded' : 'pending',
          stripe_object_id: `re_${Math.random().toString(36).slice(2, 12)}`,
          error_message: null,
          created_at: now,
          updated_at: now,
        })
      }

      const updatedCase: CaseRecord = {
        ...existing,
        status: 'closed',
        closed_at: now,
        updated_at: now,
      }

      const nextDb: MockBackendData = {
        ...db,
        cases: db.cases.map((c) => (c.id === existing.id ? updatedCase : c)),
        jobs: db.jobs.map((j) =>
          j.id === job.id ? { ...j, status: nextJobStatus, updated_at: now } : j,
        ),
        payments: db.payments.map((p) =>
          p.id === payment.id
            ? { ...p, status: nextPaymentStatus, updated_at: now }
            : p,
        ),
        paymentOperations: [...newOps, ...db.paymentOperations],
        statusHistory: [
          ...db.statusHistory,
          {
            id: makeId('sh'),
            entity: 'case',
            entity_id: existing.id,
            from_state: 'resolved',
            to_state: 'closed',
            actor_id: admin.id,
            actor_label: admin.full_name,
            method: 'close_claim_execute_payout',
            notes: `Caso cerrado definitivamente. Pago actualizado a ${nextPaymentStatus}.`,
            created_at: now,
          },
        ],
      }

      const dossier = buildClaimDossier(nextDb, existing.id, admin)
      set({
        db: nextDb,
        processedIdempotencyKeys: {
          ...get().processedIdempotencyKeys,
          [input.idempotency_key]: dossier,
        },
      })
      return dossier
    }),

  listSupportTickets: (filters) =>
    simulateNetwork(get, set, () => {
      requireActiveAdmin(get)
      const { db } = get()
      const q = filters?.search?.trim().toLowerCase() ?? ''

      return db.cases
        .filter((c) => c.case_type === 'ticket')
        .map((c) => hydrateCaseListItem(db, c))
        .filter((item) => {
          if (
            filters?.category &&
            filters.category !== 'all' &&
            item.ticket_category !== filters.category
          ) {
            return false
          }
          if (filters?.status && filters.status !== 'all' && item.status !== filters.status) {
            return false
          }
          if (!matchesDateRange(item.created_at, filters?.dateRange)) {
            return false
          }
          if (q) {
            const haystack = [
              item.folio,
              item.subject,
              item.description,
              item.reporter?.full_name ?? 'sistema',
              item.reporter?.email ?? '',
            ]
              .join(' ')
              .toLowerCase()
            if (!haystack.includes(q)) return false
          }
          return true
        })
        .sort((a, b) => b.updated_at.localeCompare(a.updated_at))
    }),

  getSupportTicketDetail: (caseId) =>
    simulateNetwork(get, set, () => {
      requireActiveAdmin(get)
      const { db } = get()
      const ticket = db.cases.find(
        (c) => c.id === caseId && c.case_type === 'ticket',
      )
      if (!ticket) throw new DomainError('ERR_NOT_FOUND')

      const hydrated = hydrateCaseListItem(db, ticket)
      const linkedJob = ticket.job_id
        ? db.jobs.find((j) => j.id === ticket.job_id) ?? null
        : null
      const linkedPayment = ticket.job_id
        ? db.payments.find((p) => p.job_id === ticket.job_id) ?? null
        : null
      const requesterTickets = ticket.reporter_id
        ? db.cases.filter(
            (c) =>
              c.case_type === 'ticket' &&
              c.reporter_id === ticket.reporter_id &&
              c.id !== ticket.id,
          )
        : []

      return {
        ticket: hydrated,
        messages: db.caseMessages
          .filter((m) => m.case_id === ticket.id)
          .sort((a, b) => a.created_at.localeCompare(b.created_at)),
        linkedPayment,
        linkedJob,
        requesterTickets,
      }
    }),

  replyToSupportTicket: (input) =>
    simulateNetwork(get, set, () => {
      const admin = requireActiveAdmin(get)
      const cached = get().processedIdempotencyKeys[input.idempotency_key]
      if (cached) return cached as CaseMessage

      const body = input.body.trim()
      if (!body || body.length > 4000) {
        throw new DomainError(
          'ERR_VALIDATION',
          'El mensaje debe tener entre 1 y 4000 caracteres.',
        )
      }

      const { db } = get()
      const ticket = db.cases.find(
        (c) => c.id === input.case_id && c.case_type === 'ticket',
      )
      if (!ticket) throw new DomainError('ERR_NOT_FOUND')

      const currentStatus = ticket.status as TicketOrClaimStatus
      let targetStatus: TicketOrClaimStatus = currentStatus

      if (input.next_status && input.next_status !== currentStatus) {
        const allowed = TICKET_CLAIM_TRANSITIONS[currentStatus]
        if (!allowed.includes(input.next_status)) {
          throw new DomainError(
            'ERR_INVALID_TRANSITION',
            `Transición inválida de "${currentStatus}" a "${input.next_status}".`,
          )
        }
        targetStatus = input.next_status
      } else if (currentStatus === 'open') {
        targetStatus = 'in_review'
      }

      const existingCaseAttachments = db.caseMessages
        .filter((m) => m.case_id === ticket.id)
        .reduce((acc, m) => acc + m.attachments.length, 0)

      if (input.attachment && existingCaseAttachments >= 5) {
        throw new DomainError('ERR_ATTACHMENT_LIMIT')
      }

      const now = new Date().toISOString()
      const newMessage: CaseMessage = {
        id: makeId('cmsg'),
        case_id: ticket.id,
        author_id: admin.id,
        author_name: admin.full_name,
        author_role: 'admin',
        body,
        is_internal: input.is_internal,
        attachments: input.attachment
          ? [
              {
                id: makeId('att'),
                job_id: ticket.job_id,
                case_id: ticket.id,
                uploaded_by: admin.id,
                uploaded_by_role: 'admin',
                kind: 'case_evidence',
                file_name: input.attachment.file_name,
                mime_type: input.attachment.mime_type,
                size_bytes: input.attachment.size_bytes,
                preview_url: input.attachment.preview_url,
                created_at: now,
              },
            ]
          : [],
        created_at: now,
      }

      const updatedTicket: CaseRecord = {
        ...ticket,
        status: targetStatus,
        assigned_admin_id: ticket.assigned_admin_id ?? admin.id,
        resolved_at: targetStatus === 'resolved' ? now : ticket.resolved_at,
        closed_at: targetStatus === 'closed' ? now : ticket.closed_at,
        auto_close_deadline:
          targetStatus === 'resolved'
            ? new Date(Date.now() + 7 * 86_400_000).toISOString()
            : targetStatus === 'in_review'
              ? null
              : ticket.auto_close_deadline,
        updated_at: now,
      }

      const nextDb: MockBackendData = {
        ...db,
        cases: db.cases.map((c) => (c.id === ticket.id ? updatedTicket : c)),
        caseMessages: [...db.caseMessages, newMessage],
      }

      set({
        db: nextDb,
        processedIdempotencyKeys: {
          ...get().processedIdempotencyKeys,
          [input.idempotency_key]: newMessage,
        },
      })
      return newMessage
    }),

  listModerationReports: (status = 'all') =>
    simulateNetwork(get, set, () => {
      requireActiveAdmin(get)
      const { db } = get()
      return db.cases
        .filter(
          (c) =>
            c.case_type === 'report' &&
            (status === 'all' || c.status === status),
        )
        .sort((a, b) => b.created_at.localeCompare(a.created_at))
        .map((r) => buildModerationDetail(db, r))
    }),

  getModerationAuditLog: () =>
    simulateNetwork(get, set, () => {
      requireActiveAdmin(get)
      return [...get().db.moderationActions].sort((a, b) =>
        b.created_at.localeCompare(a.created_at),
      )
    }),

  applyModerationAction: (input) =>
    simulateNetwork(get, set, () => {
      const admin = requireActiveAdmin(get)
      const cached = get().processedIdempotencyKeys[input.idempotency_key]
      if (cached) return cached as ModerationReportDetail

      const reason = input.reason.trim()
      if (!reason) {
        throw new DomainError('ERR_REASON_REQUIRED')
      }

      const { db } = get()
      const report = db.cases.find(
        (c) => c.id === input.case_id && c.case_type === 'report',
      )
      if (!report || !report.target_type || !report.target_id) {
        throw new DomainError('ERR_NOT_FOUND')
      }

      const nextModStatus: ModerationStatus | null =
        input.action === 'hide'
          ? 'hidden'
          : input.action === 'remove'
            ? 'removed'
            : input.action === 'restore'
              ? 'visible'
              : null

      const nextReportStatus: ReportStatus =
        input.action === 'dismiss' ? 'dismissed' : 'attended'

      const now = new Date().toISOString()

      const nextJobs =
        nextModStatus && report.target_type === 'job'
          ? db.jobs.map((j) =>
              j.id === report.target_id
                ? { ...j, moderation_status: nextModStatus, updated_at: now }
                : j,
            )
          : db.jobs

      const nextReviews =
        nextModStatus && report.target_type === 'review'
          ? db.reviews.map((r) =>
              r.id === report.target_id
                ? { ...r, moderation_status: nextModStatus }
                : r,
            )
          : db.reviews

      const nextChats =
        nextModStatus && report.target_type === 'chat_message'
          ? db.chatMessages.map((m) =>
              m.id === report.target_id
                ? { ...m, moderation_status: nextModStatus }
                : m,
            )
          : db.chatMessages

      const updatedReport: CaseRecord = {
        ...report,
        status: nextReportStatus,
        assigned_admin_id: admin.id,
        resolution_notes: reason,
        resolved_at: now,
        updated_at: now,
      }

      const actionLog: ModerationActionRecord = {
        id: makeId('mod'),
        admin_id: admin.id,
        admin_name: admin.full_name,
        case_id: report.id,
        case_folio: report.folio,
        target_type: report.target_type,
        target_id: report.target_id,
        action: input.action,
        resulting_status: nextModStatus,
        reason,
        created_at: now,
      }

      const nextDb: MockBackendData = {
        ...db,
        jobs: nextJobs,
        reviews: nextReviews,
        chatMessages: nextChats,
        cases: db.cases.map((c) => (c.id === report.id ? updatedReport : c)),
        moderationActions: [actionLog, ...db.moderationActions],
      }

      const detail = buildModerationDetail(nextDb, updatedReport)
      set({
        db: nextDb,
        processedIdempotencyKeys: {
          ...get().processedIdempotencyKeys,
          [input.idempotency_key]: detail,
        },
      })
      return detail
    }),

  listAccounts: (filters) =>
    simulateNetwork(get, set, () => {
      requireActiveAdmin(get)
      const { db } = get()
      const q = filters?.search?.trim().toLowerCase() ?? ''

      return db.profiles
        .filter((p) => p.role !== 'admin')
        .filter((p) => {
          if (filters?.role && filters.role !== 'all' && p.role !== filters.role) {
            return false
          }
          if (
            filters?.status &&
            filters.status !== 'all' &&
            p.account_status !== filters.status
          ) {
            return false
          }
          if (q) {
            const haystack = [p.full_name, p.email, p.code, p.id]
              .join(' ')
              .toLowerCase()
            if (!haystack.includes(q)) return false
          }
          return true
        })
        .map((profile) => ({
          profile,
          reportsAgainst: db.cases.filter(
            (c) => c.reported_user_id === profile.id,
          ),
          sanctions: db.userSanctions
            .filter((s) => s.user_id === profile.id)
            .sort((a, b) => b.created_at.localeCompare(a.created_at)),
        }))
        .sort((a, b) =>
          b.profile.last_activity_at.localeCompare(a.profile.last_activity_at),
        )
    }),

  getAccountDetail: (userId) =>
    simulateNetwork(get, set, () => {
      requireActiveAdmin(get)
      const { db } = get()
      const profile = db.profiles.find((p) => p.id === userId && p.role !== 'admin')
      if (!profile) throw new DomainError('ERR_NOT_FOUND')
      return {
        profile,
        reportsAgainst: db.cases.filter((c) => c.reported_user_id === profile.id),
        sanctions: db.userSanctions
          .filter((s) => s.user_id === profile.id)
          .sort((a, b) => b.created_at.localeCompare(a.created_at)),
      }
    }),

  applySanction: (input) =>
    simulateNetwork(get, set, () => {
      const admin = requireActiveAdmin(get)
      const cached = get().processedIdempotencyKeys[input.idempotency_key]
      if (cached) return cached as UserSanctionRecord

      const reason = input.reason.trim()
      if (!reason) {
        throw new DomainError('ERR_REASON_REQUIRED')
      }

      const { db } = get()
      const profile = db.profiles.find((p) => p.id === input.user_id)
      if (!profile) throw new DomainError('ERR_NOT_FOUND')
      if (profile.role === 'admin') {
        throw new DomainError(
          'ERR_FORBIDDEN',
          'No es posible sancionar cuentas administrativas desde este módulo.',
        )
      }

      const now = new Date().toISOString()
      const days = sanctionDurationDays(input.sanction)
      const expiresAt = days
        ? new Date(Date.now() + days * 86_400_000).toISOString()
        : null
      const nextStatus = sanctionToAccountStatus(input.sanction)

      const record: UserSanctionRecord = {
        id: makeId('snc'),
        user_id: profile.id,
        admin_id: admin.id,
        admin_name: admin.full_name,
        sanction: input.sanction,
        reason,
        case_id: input.case_id ?? null,
        expires_at: expiresAt,
        revoked_at: null,
        created_at: now,
      }

      const nextDb: MockBackendData = {
        ...db,
        profiles: db.profiles.map((p) =>
          p.id === profile.id
            ? {
                ...p,
                account_status: nextStatus,
                suspended_until: expiresAt,
                updated_at: now,
              }
            : p,
        ),
        userSanctions: [record, ...db.userSanctions],
      }

      set({
        db: nextDb,
        processedIdempotencyKeys: {
          ...get().processedIdempotencyKeys,
          [input.idempotency_key]: record,
        },
      })
      return record
    }),

  revokeSanction: (input) =>
    simulateNetwork(get, set, () => {
      requireActiveAdmin(get)
      const cached = get().processedIdempotencyKeys[input.idempotency_key]
      if (cached) return cached as UserSanctionRecord

      const reason = input.reason.trim()
      if (!reason) throw new DomainError('ERR_REASON_REQUIRED')

      const { db } = get()
      const existing = db.userSanctions.find((s) => s.id === input.sanction_id)
      if (!existing) throw new DomainError('ERR_NOT_FOUND')
      if (existing.revoked_at) {
        throw new DomainError('ERR_CONFLICT', 'Esta sanción ya fue revocada.')
      }

      const now = new Date().toISOString()
      const updatedSanction: UserSanctionRecord = {
        ...existing,
        revoked_at: now,
        reason: `${existing.reason} [Revocada por apelación: ${reason}]`,
      }

      const remainingActive = db.userSanctions.filter(
        (s) => s.user_id === existing.user_id && s.id !== existing.id && !s.revoked_at,
      )
      const nextStatus: AccountStatus =
        remainingActive.length > 0
          ? sanctionToAccountStatus(remainingActive[0].sanction)
          : 'active'

      const nextDb: MockBackendData = {
        ...db,
        userSanctions: db.userSanctions.map((s) =>
          s.id === existing.id ? updatedSanction : s,
        ),
        profiles: db.profiles.map((p) =>
          p.id === existing.user_id
            ? {
                ...p,
                account_status: nextStatus,
                suspended_until:
                  nextStatus === 'suspended' ? p.suspended_until : null,
                updated_at: now,
              }
            : p,
        ),
      }

      set({
        db: nextDb,
        processedIdempotencyKeys: {
          ...get().processedIdempotencyKeys,
          [input.idempotency_key]: updatedSanction,
        },
      })
      return updatedSanction
    }),

  getStripeMonitorSnapshot: (statusFilter = 'all') =>
    simulateNetwork(get, set, () => {
      requireActiveAdmin(get)
      return buildStripeSnapshot(get().db, statusFilter)
    }),

  retryStripeOperation: (input) =>
    simulateNetwork(get, set, () => {
      const admin = requireActiveAdmin(get)
      const cached = get().processedIdempotencyKeys[input.idempotency_key]
      if (cached) return cached as Payment

      const { db } = get()
      const payment = db.payments.find((p) => p.id === input.payment_id)
      if (!payment) throw new DomainError('ERR_NOT_FOUND')

      if (!RETRYABLE_PAYMENT_STATUSES.includes(payment.status)) {
        throw new DomainError(
          'ERR_INVALID_TRANSITION',
          'Solo las operaciones en estado fallido pueden reintentarse manualmente.',
        )
      }

      if (payment.payment_attempts >= 5) {
        throw new DomainError('ERR_MAX_ATTEMPTS')
      }

      const now = new Date().toISOString()
      const nextStatus: PaymentStatus =
        payment.status === 'transfer_failed'
          ? 'transfer_pending'
          : payment.status === 'refund_failed'
            ? 'refunded'
            : 'partial_settlement_pending'

      const updatedPayment: Payment = {
        ...payment,
        status: nextStatus,
        payment_attempts: payment.payment_attempts + 1,
        failure_reason: null,
        updated_at: now,
      }

      const newOp: PaymentOperation = {
        id: makeId('pop'),
        payment_id: payment.id,
        op_type: payment.status === 'refund_failed' ? 'refund' : 'transfer',
        amount_mxn:
          payment.status === 'refund_failed'
            ? payment.total_charged_mxn
            : payment.job_amount_mxn,
        idempotency_key: input.idempotency_key,
        status: nextStatus === 'refunded' ? 'succeeded' : 'pending',
        stripe_object_id: `retry_${Math.random().toString(36).slice(2, 10)}`,
        error_message: null,
        created_at: now,
        updated_at: now,
      }

      const newEvent = {
        id: `evt_retry_${Math.random().toString(36).slice(2, 12)}`,
        event_type:
          payment.status === 'refund_failed'
            ? 'charge.refund.updated'
            : 'transfer.created',
        payment_intent_id: payment.stripe_payment_intent_id,
        signature_verified: true,
        http_status: 200,
        summary: `Reintento manual iniciado por ${admin.full_name} · Idempotency-Key verificada`,
        payload: {
          payment_intent: payment.stripe_payment_intent_id,
          idempotency_key: input.idempotency_key,
          attempt: updatedPayment.payment_attempts,
          next_status: nextStatus,
        },
        received_at: now,
        processed_at: now,
        error_message: null,
      }

      const nextDb: MockBackendData = {
        ...db,
        payments: db.payments.map((p) => (p.id === payment.id ? updatedPayment : p)),
        paymentOperations: [newOp, ...db.paymentOperations],
        stripeEvents: [newEvent, ...db.stripeEvents],
      }

      set({
        db: nextDb,
        processedIdempotencyKeys: {
          ...get().processedIdempotencyKeys,
          [input.idempotency_key]: updatedPayment,
        },
      })
      return updatedPayment
    }),

  syncStripeEvents: () =>
    simulateNetwork(get, set, () => {
      requireActiveAdmin(get)
      return buildStripeSnapshot(get().db, 'all')
    }),
}))

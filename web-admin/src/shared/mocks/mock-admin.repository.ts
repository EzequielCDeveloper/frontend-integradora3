import type { IAdminRepository } from '@/shared/services/admin-repository.contract'
import { useMockBackendStore } from './mock-backend.store'

/**
 * Mock implementation of IAdminRepository backed exclusively by the centralized
 * in-memory Zustand store (mock-backend.store.ts).
 */
export const mockAdminRepository: IAdminRepository = {
  login: (email, password) => useMockBackendStore.getState().login(email, password),
  requestPasswordReset: (email) =>
    useMockBackendStore.getState().requestPasswordReset(email),
  logout: () => useMockBackendStore.getState().logout(),
  getActiveAdmins: () => useMockBackendStore.getState().getActiveAdmins(),

  listCases: (filters) => useMockBackendStore.getState().listCases(filters),
  assignCase: (caseId, adminId, idempotencyKey) =>
    useMockBackendStore.getState().assignCase(caseId, adminId, idempotencyKey),
  quickResolveCase: (caseId, resolutionNotes, idempotencyKey) =>
    useMockBackendStore
      .getState()
      .quickResolveCase(caseId, resolutionNotes, idempotencyKey),
  createCase: (input) => useMockBackendStore.getState().createCase(input),

  listClaims: () => useMockBackendStore.getState().listClaims(),
  getClaimDossier: (caseId) =>
    useMockBackendStore.getState().getClaimDossier(caseId),
  resolveClaim: (input) => useMockBackendStore.getState().resolveClaim(input),
  closeClaimAndExecutePayout: (input) =>
    useMockBackendStore.getState().closeClaimAndExecutePayout(input),
  simulateClaimObjection: (caseId, idempotencyKey) =>
    useMockBackendStore
      .getState()
      .simulateClaimObjection(caseId, idempotencyKey),

  listSupportTickets: (filters) =>
    useMockBackendStore.getState().listSupportTickets(filters),
  getSupportTicketDetail: (caseId) =>
    useMockBackendStore.getState().getSupportTicketDetail(caseId),
  replyToSupportTicket: (input) =>
    useMockBackendStore.getState().replyToSupportTicket(input),

  listModerationReports: (status) =>
    useMockBackendStore.getState().listModerationReports(status),
  getModerationAuditLog: () =>
    useMockBackendStore.getState().getModerationAuditLog(),
  applyModerationAction: (input) =>
    useMockBackendStore.getState().applyModerationAction(input),

  listAccounts: (filters) => useMockBackendStore.getState().listAccounts(filters),
  getAccountDetail: (userId) =>
    useMockBackendStore.getState().getAccountDetail(userId),
  applySanction: (input) => useMockBackendStore.getState().applySanction(input),
  revokeSanction: (input) =>
    useMockBackendStore.getState().revokeSanction(input),

  getStripeMonitorSnapshot: (statusFilter) =>
    useMockBackendStore.getState().getStripeMonitorSnapshot(statusFilter),
  retryStripeOperation: (input) =>
    useMockBackendStore.getState().retryStripeOperation(input),
  syncStripeEvents: () => useMockBackendStore.getState().syncStripeEvents(),
}

export function getAdminRepository(): IAdminRepository {
  return mockAdminRepository
}

import fc from 'fast-check'
import { beforeEach, describe, expect, it } from 'vitest'
import {
  useMockBackendStore,
  validateCaseDecisionAmounts,
} from '@/shared/mocks/mock-backend.store'
import { buildCsvContent } from '@/shared/utils/csv-export'
import { DomainError, mapDomainErrorToUI } from '@/shared/utils/error-mapper'
import {
  MAX_ATTACHMENT_BYTES,
  validateAttachmentFile,
} from '@/shared/utils/file-validator'
import {
  calculatePlatformFee,
  calculateTotalCharged,
  roundToCents,
} from '@/shared/utils/format'
import { isSafeExternalUrl } from '@/shared/utils/safe-url'

describe('Adversarial Domain Suite (Fuzzing, D-02, State Machines, Idempotency, OWASP)', () => {
  beforeEach(() => {
    useMockBackendStore.getState().resetMockDb({
      authenticated: true,
      latencyMs: 0,
    })
  })

  describe('Category 1: Boundary & Fuzzing (fast-check)', () => {
    it('computes 10% platform fee with exact half-up cent rounding', () => {
      expect(calculatePlatformFee(19.99)).toBe(2)
      expect(calculateTotalCharged(19.99)).toBe(21.99)
      expect(calculatePlatformFee(850)).toBe(85)
      expect(calculateTotalCharged(850)).toBe(935)

      fc.assert(
        fc.property(fc.integer({ min: 1000, max: 1_000_000 }), (cents) => {
          const jobAmount = cents / 100
          const fee = calculatePlatformFee(jobAmount)
          const total = calculateTotalCharged(jobAmount)
          expect(total).toBe(roundToCents(jobAmount + fee))
          expect(fee).toBeGreaterThanOrEqual(1)
        }),
      )
    })

    it('enforces SQL D-02 partial settlement rule across fuzzed currency pairs', () => {
      const payment = { job_amount_mxn: 850, total_charged_mxn: 935 }

      // Valid exact splits summing to total_charged_mxn (935.00) must succeed
      fc.assert(
        fc.property(fc.integer({ min: 1, max: 93499 }), (transferCents) => {
          const transfer = transferCents / 100
          const refund = roundToCents(935 - transfer)
          expect(() =>
            validateCaseDecisionAmounts('partial', transfer, refund, payment),
          ).not.toThrow()
        }),
      )

      // Any mismatching sum or non-positive side must throw ERR_DECISION_AMOUNTS
      fc.assert(
        fc.property(
          fc.integer({ min: -5000, max: 150000 }),
          fc.integer({ min: -5000, max: 150000 }),
          (aCents, bCents) => {
            const transfer = aCents / 100
            const refund = bCents / 100
            const isValid =
              transfer > 0 &&
              refund > 0 &&
              roundToCents(transfer + refund) === 935
            if (!isValid) {
              expect(() =>
                validateCaseDecisionAmounts('partial', transfer, refund, payment),
              ).toThrow(DomainError)
            }
          },
        ),
      )

      // Dividing only job_amount_mxn (850) instead of total_charged_mxn (935) MUST fail D-02
      expect(() =>
        validateCaseDecisionAmounts('partial', 650, 200, payment),
      ).toThrowError(DomainError)
    })

    it('rejects empty, whitespace-only, or >4000-char ticket replies', async () => {
      const store = useMockBackendStore.getState()
      await expect(
        store.replyToSupportTicket({
          case_id: 'cas-002',
          body: '     \n\t   ',
          is_internal: false,
          idempotency_key: 'empty-body',
        }),
      ).rejects.toMatchObject({ code: 'ERR_VALIDATION' })

      await expect(
        store.replyToSupportTicket({
          case_id: 'cas-002',
          body: 'A'.repeat(4001),
          is_internal: false,
          idempotency_key: 'overflow-body',
        }),
      ).rejects.toMatchObject({ code: 'ERR_VALIDATION' })
    })

    it('neutralizes CSV formula injection payloads', () => {
      const csv = buildCsvContent(
        ['Folio', 'Asunto'],
        [
          ['#CAS-1', '=CMD("calc")'],
          ['#CAS-2', '+1+1'],
          ['#CAS-3', '@SUM(A1:A2)'],
        ],
      )
      expect(csv).toContain(`'=CMD(""calc"")`)
      expect(csv).toContain(`'+1+1`)
      expect(csv).toContain(`'@SUM(A1:A2)`)
    })
  })

  describe('Category 2: Concurrency & Idempotency Guarantees', () => {
    it('deduplicates repeated sanctions and Stripe retries with same idempotency key', async () => {
      const store = useMockBackendStore.getState()
      const first = await store.applySanction({
        user_id: 'usr-emp-01',
        sanction: 'warning',
        reason: 'Incumplimiento de lineamientos de publicación',
        idempotency_key: 'idem-snc-1',
      })
      const second = await store.applySanction({
        user_id: 'usr-emp-01',
        sanction: 'warning',
        reason: 'Incumplimiento de lineamientos de publicación',
        idempotency_key: 'idem-snc-1',
      })
      expect(first.id).toBe(second.id)
      const detail = await store.getAccountDetail('usr-emp-01')
      expect(detail.sanctions.filter((s) => s.id === first.id)).toHaveLength(1)

      const retry1 = await store.retryStripeOperation({
        payment_id: 'pay-004',
        idempotency_key: 'idem-retry-1',
      })
      const retry2 = await store.retryStripeOperation({
        payment_id: 'pay-004',
        idempotency_key: 'idem-retry-1',
      })
      expect(retry1.payment_attempts).toBe(retry2.payment_attempts)
      expect(retry1.status).toBe('transfer_pending')
    })
  })

  describe('Category 3: State Machine & Temporal Torture', () => {
    it('rejects illegal ticket and claim state transitions', async () => {
      const store = useMockBackendStore.getState()

      // Cannot resolve a claim while still open (must be in_review first)
      await expect(
        store.resolveClaim({
          case_id: 'cas-004',
          decision: 'refund_full',
          approved_transfer_amount: 0,
          approved_refund_amount: 1320,
          resolution_notes: 'Intento ilegal desde estado open',
          idempotency_key: 'illegal-open-resolve',
        }),
      ).rejects.toMatchObject({ code: 'ERR_INVALID_TRANSITION' })

      // Cannot reopen an already closed ticket
      await expect(
        store.replyToSupportTicket({
          case_id: 'cas-008',
          body: 'Intentando reabrir ticket cerrado',
          is_internal: false,
          next_status: 'in_review',
          idempotency_key: 'illegal-reopen-closed',
        }),
      ).rejects.toMatchObject({ code: 'ERR_INVALID_TRANSITION' })

      // Cannot retry a payment that is not in a failed state
      await expect(
        store.retryStripeOperation({
          payment_id: 'pay-005',
          idempotency_key: 'illegal-retry-transferred',
        }),
      ).rejects.toMatchObject({ code: 'ERR_INVALID_TRANSITION' })
    })

    it('supports full arbitration lifecycle: resolve -> objection reopen -> re-resolve -> close payout', async () => {
      const store = useMockBackendStore.getState()

      const resolved = await store.resolveClaim({
        case_id: 'cas-001',
        decision: 'partial',
        approved_transfer_amount: 600,
        approved_refund_amount: 335,
        resolution_notes: 'Evidencia parcial acreditada por ambas partes.',
        idempotency_key: 'arb-res-1',
      })
      expect(resolved.caseRecord.status).toBe('resolved')
      expect(resolved.caseRecord.auto_close_deadline).toBeTruthy()

      const objected = await store.simulateClaimObjection('cas-001', 'arb-obj-1')
      expect(objected.caseRecord.status).toBe('in_review')
      expect(objected.caseRecord.auto_close_deadline).toBeNull()

      await store.resolveClaim({
        case_id: 'cas-001',
        decision: 'transfer_full',
        approved_transfer_amount: 850,
        approved_refund_amount: 0,
        resolution_notes: 'Segunda revisión confirma cumplimiento completo.',
        idempotency_key: 'arb-res-2',
      })

      const closed = await store.closeClaimAndExecutePayout({
        case_id: 'cas-001',
        idempotency_key: 'arb-close-1',
      })
      expect(closed.caseRecord.status).toBe('closed')
      expect(closed.job.status).toBe('completed')
      expect(closed.payment.status).toBe('transfer_pending')
    })
  })

  describe('Category 5: Privacy, RLS & OWASP Escalation', () => {
    it('blocks non-admin and suspended admin logins', async () => {
      const store = useMockBackendStore.getState()
      await store.logout()

      await expect(
        store.login('c.mendoza@correo.mx', 'User2025!'),
      ).rejects.toMatchObject({ code: 'ERR_FORBIDDEN' })

      await expect(
        store.login('suspendido@solidez.mx', 'Admin2025!'),
      ).rejects.toMatchObject({ code: 'ERR_ACCOUNT_RESTRICTED' })

      expect(
        mapDomainErrorToUI(new DomainError('ERR_ACCOUNT_RESTRICTED')).shouldLogout,
      ).toBe(true)
    })

    it('enforces RLS chat lock when admin is not assigned to claim', async () => {
      const store = useMockBackendStore.getState()
      const lockedDossier = await store.getClaimDossier('cas-004')
      expect(lockedDossier.chatLockedByRls).toBe(true)
      expect(lockedDossier.chatMessages).toBeNull()

      await store.assignCase('cas-004', 'adm-001', 'assign-rls-1')
      const unlockedDossier = await store.getClaimDossier('cas-004')
      expect(unlockedDossier.chatLockedByRls).toBe(false)
      expect(unlockedDossier.chatMessages?.length).toBeGreaterThan(0)
    })

    it('blocks dangerous file uploads and malicious URL schemes', () => {
      expect(
        validateAttachmentFile({
          name: 'payload.svg',
          type: 'image/svg+xml',
          size: 512,
        }).valid,
      ).toBe(false)
      expect(
        validateAttachmentFile({
          name: '../../etc/passwd.pdf',
          type: 'application/pdf',
          size: 1024,
        }).valid,
      ).toBe(false)
      expect(
        validateAttachmentFile({
          name: 'giant.png',
          type: 'image/png',
          size: MAX_ATTACHMENT_BYTES + 1,
        }).valid,
      ).toBe(false)
      expect(
        validateAttachmentFile(
          { name: 'sixth.jpg', type: 'image/jpeg', size: 1024 },
          5,
        ).errorCode,
      ).toBe('ERR_ATTACHMENT_LIMIT')
      expect(
        validateAttachmentFile({
          name: 'evidencia_ok.pdf',
          type: 'application/pdf',
          size: 2048,
        }).valid,
      ).toBe(true)

      expect(isSafeExternalUrl('javascript:alert(1)')).toBe(false)
      expect(isSafeExternalUrl('data:text/html,<script>alert(1)</script>')).toBe(
        false,
      )
      expect(isSafeExternalUrl('https://solidez.mx/docs/evidencia.pdf')).toBe(
        true,
      )
    })
  })
})

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { getAdminRepository } from '@/shared/mocks/mock-admin.repository'
import type { RetryStripePaymentInput } from '@/shared/services/admin-repository.contract'
import type { PaymentStatus } from '@/shared/types/domain.types'

export function useStripeMonitorSnapshot(statusFilter: PaymentStatus | 'all') {
  return useQuery({
    queryKey: ['stripe', 'monitor', statusFilter],
    queryFn: () => getAdminRepository().getStripeMonitorSnapshot(statusFilter),
  })
}

export function useRetryStripeOperation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: RetryStripePaymentInput) =>
      getAdminRepository().retryStripeOperation(input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['stripe'] })
      void queryClient.invalidateQueries({ queryKey: ['claims'] })
    },
  })
}

export function useSyncStripeEvents() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: () => getAdminRepository().syncStripeEvents(),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['stripe'] })
    },
  })
}

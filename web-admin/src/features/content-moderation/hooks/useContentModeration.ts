import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { getAdminRepository } from '@/shared/mocks/mock-admin.repository'
import type { ModerateContentInput } from '@/shared/services/admin-repository.contract'
import type { ReportStatus } from '@/shared/types/domain.types'

export function useModerationReports(status: ReportStatus | 'all') {
  return useQuery({
    queryKey: ['moderation', 'reports', status],
    queryFn: () => getAdminRepository().listModerationReports(status),
  })
}

export function useModerationAuditLog() {
  return useQuery({
    queryKey: ['moderation', 'audit-log'],
    queryFn: () => getAdminRepository().getModerationAuditLog(),
  })
}

export function useApplyModerationAction() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: ModerateContentInput) =>
      getAdminRepository().applyModerationAction(input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['moderation'] })
      void queryClient.invalidateQueries({ queryKey: ['cases'] })
    },
  })
}

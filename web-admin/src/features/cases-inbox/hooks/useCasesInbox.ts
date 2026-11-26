import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { getAdminRepository } from '@/shared/mocks/mock-admin.repository'
import type {
  CasesFilterParams,
  CreateAdminCaseInput,
} from '@/shared/services/admin-repository.contract'

export function useCasesList(filters: CasesFilterParams) {
  return useQuery({
    queryKey: ['cases', filters],
    queryFn: () => getAdminRepository().listCases(filters),
  })
}

export function useAllCasesSummary() {
  return useQuery({
    queryKey: ['cases', 'all-summary'],
    queryFn: () => getAdminRepository().listCases({}),
  })
}

export function useActiveAdmins() {
  return useQuery({
    queryKey: ['admins', 'active'],
    queryFn: () => getAdminRepository().getActiveAdmins(),
  })
}

export function useAssignCase() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({
      caseId,
      adminId,
      idempotencyKey,
    }: {
      caseId: string
      adminId: string | null
      idempotencyKey: string
    }) => getAdminRepository().assignCase(caseId, adminId, idempotencyKey),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['cases'] })
      void queryClient.invalidateQueries({ queryKey: ['claims'] })
      void queryClient.invalidateQueries({ queryKey: ['tickets'] })
      void queryClient.invalidateQueries({ queryKey: ['moderation'] })
    },
  })
}

export function useQuickResolveCase() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({
      caseId,
      resolutionNotes,
      idempotencyKey,
    }: {
      caseId: string
      resolutionNotes: string
      idempotencyKey: string
    }) =>
      getAdminRepository().quickResolveCase(
        caseId,
        resolutionNotes,
        idempotencyKey,
      ),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['cases'] })
      void queryClient.invalidateQueries({ queryKey: ['tickets'] })
      void queryClient.invalidateQueries({ queryKey: ['moderation'] })
    },
  })
}

export function useCreateCase() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: CreateAdminCaseInput) =>
      getAdminRepository().createCase(input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['cases'] })
      void queryClient.invalidateQueries({ queryKey: ['tickets'] })
      void queryClient.invalidateQueries({ queryKey: ['moderation'] })
    },
  })
}

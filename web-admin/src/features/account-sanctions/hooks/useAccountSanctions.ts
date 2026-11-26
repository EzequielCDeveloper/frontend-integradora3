import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { getAdminRepository } from '@/shared/mocks/mock-admin.repository'
import type {
  AccountsFilterParams,
  ApplySanctionInput,
  RevokeSanctionInput,
} from '@/shared/services/admin-repository.contract'

export function useAccountsList(filters: AccountsFilterParams) {
  return useQuery({
    queryKey: ['accounts', 'list', filters],
    queryFn: () => getAdminRepository().listAccounts(filters),
  })
}

export function useAllAccountsSummary() {
  return useQuery({
    queryKey: ['accounts', 'all-summary'],
    queryFn: () => getAdminRepository().listAccounts({}),
  })
}

export function useApplySanction() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: ApplySanctionInput) =>
      getAdminRepository().applySanction(input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['accounts'] })
      void queryClient.invalidateQueries({ queryKey: ['moderation'] })
    },
  })
}

export function useRevokeSanction() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: RevokeSanctionInput) =>
      getAdminRepository().revokeSanction(input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['accounts'] })
    },
  })
}

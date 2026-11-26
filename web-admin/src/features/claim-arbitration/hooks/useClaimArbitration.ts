import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { getAdminRepository } from '@/shared/mocks/mock-admin.repository'
import type {
  CloseClaimInput,
  ResolveClaimInput,
} from '@/shared/services/admin-repository.contract'

export function useClaimsList() {
  return useQuery({
    queryKey: ['claims', 'list'],
    queryFn: () => getAdminRepository().listClaims(),
  })
}

export function useClaimDossier(caseId: string | undefined) {
  return useQuery({
    queryKey: ['claims', 'dossier', caseId],
    queryFn: () => getAdminRepository().getClaimDossier(caseId!),
    enabled: Boolean(caseId),
  })
}

export function useAssignClaimToAdmin() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({
      caseId,
      adminId,
      idempotencyKey,
    }: {
      caseId: string
      adminId: string
      idempotencyKey: string
    }) => getAdminRepository().assignCase(caseId, adminId, idempotencyKey),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['claims'] })
      void queryClient.invalidateQueries({ queryKey: ['cases'] })
    },
  })
}

export function useResolveClaim() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: ResolveClaimInput) =>
      getAdminRepository().resolveClaim(input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['claims'] })
      void queryClient.invalidateQueries({ queryKey: ['cases'] })
    },
  })
}

export function useCloseClaimAndExecutePayout() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: CloseClaimInput) =>
      getAdminRepository().closeClaimAndExecutePayout(input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['claims'] })
      void queryClient.invalidateQueries({ queryKey: ['cases'] })
      void queryClient.invalidateQueries({ queryKey: ['stripe'] })
    },
  })
}

export function useSimulateClaimObjection() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({
      caseId,
      idempotencyKey,
    }: {
      caseId: string
      idempotencyKey: string
    }) => getAdminRepository().simulateClaimObjection(caseId, idempotencyKey),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['claims'] })
      void queryClient.invalidateQueries({ queryKey: ['cases'] })
    },
  })
}

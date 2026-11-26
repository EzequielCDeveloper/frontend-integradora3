import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { getAdminRepository } from '@/shared/mocks/mock-admin.repository'
import type {
  ReplyTicketInput,
  TicketFilterParams,
} from '@/shared/services/admin-repository.contract'

export function useSupportTicketsList(filters: TicketFilterParams) {
  return useQuery({
    queryKey: ['tickets', 'list', filters],
    queryFn: () => getAdminRepository().listSupportTickets(filters),
  })
}

export function useSupportTicketDetail(caseId: string | undefined) {
  return useQuery({
    queryKey: ['tickets', 'detail', caseId],
    queryFn: () => getAdminRepository().getSupportTicketDetail(caseId!),
    enabled: Boolean(caseId),
  })
}

export function useReplySupportTicket() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: ReplyTicketInput) =>
      getAdminRepository().replyToSupportTicket(input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['tickets'] })
      void queryClient.invalidateQueries({ queryKey: ['cases'] })
    },
  })
}

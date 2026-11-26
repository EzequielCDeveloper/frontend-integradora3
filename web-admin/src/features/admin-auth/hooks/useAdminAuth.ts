import { useQueryClient } from '@tanstack/react-query'
import { useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { getAdminRepository } from '@/shared/mocks/mock-admin.repository'
import { useMockBackendStore } from '@/shared/mocks/mock-backend.store'
import { useToastStore } from '@/shared/hooks/useToast'

export function useAdminSession() {
  return useMockBackendStore((state) => state.session)
}

export function useAdminLogout() {
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const pushToast = useToastStore((s) => s.push)

  return useCallback(async () => {
    try {
      await getAdminRepository().logout()
    } finally {
      queryClient.clear()
      pushToast('Sesión administrativa cerrada de forma segura.', 'info')
      navigate('/login', { replace: true })
    }
  }, [navigate, pushToast, queryClient])
}

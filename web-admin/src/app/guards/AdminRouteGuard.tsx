import type { ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useAdminSession } from '@/features/admin-auth'

export function AdminRouteGuard({ children }: { children: ReactNode }) {
  const session = useAdminSession()
  const location = useLocation()

  const isAuthorized =
    session !== null &&
    session.admin.role === 'admin' &&
    session.admin.account_status === 'active'

  if (!isAuthorized) {
    return (
      <Navigate
        to="/login"
        replace
        state={{ from: `${location.pathname}${location.search}` }}
      />
    )
  }

  return <>{children}</>
}

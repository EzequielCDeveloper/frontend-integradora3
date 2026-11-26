import { createBrowserRouter, Navigate } from 'react-router-dom'
import { AccountSanctionsView } from '@/features/account-sanctions'
import { AdminLoginView } from '@/features/admin-auth'
import { CasesInboxView } from '@/features/cases-inbox'
import { ClaimArbitrationView } from '@/features/claim-arbitration'
import { ContentModerationView } from '@/features/content-moderation'
import { StripeMonitorView } from '@/features/stripe-financial-monitor'
import { SupportTicketsView } from '@/features/support-tickets'
import { AdminRouteGuard } from './guards/AdminRouteGuard'
import { AdminShellLayout } from './layouts/AdminShellLayout'

export const adminRouter = createBrowserRouter([
  {
    path: '/login',
    element: <AdminLoginView />,
  },
  {
    path: '/',
    element: (
      <AdminRouteGuard>
        <AdminShellLayout />
      </AdminRouteGuard>
    ),
    children: [
      { index: true, element: <Navigate to="/casos" replace /> },
      { path: 'casos', element: <CasesInboxView /> },
      { path: 'arbitraje', element: <ClaimArbitrationView /> },
      { path: 'arbitraje/:caseId', element: <ClaimArbitrationView /> },
      { path: 'tickets', element: <SupportTicketsView /> },
      { path: 'tickets/:caseId', element: <SupportTicketsView /> },
      { path: 'moderacion', element: <ContentModerationView /> },
      { path: 'moderacion/:caseId', element: <ContentModerationView /> },
      { path: 'cuentas', element: <AccountSanctionsView /> },
      { path: 'cuentas/:userId', element: <AccountSanctionsView /> },
      { path: 'monitoreo-stripe', element: <StripeMonitorView /> },
    ],
  },
  {
    path: '*',
    element: <Navigate to="/casos" replace />,
  },
])

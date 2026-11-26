import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AdminLoginView } from '@/features/admin-auth'
import { CasesInboxView } from '@/features/cases-inbox'
import { ClaimArbitrationView } from '@/features/claim-arbitration'
import { SupportTicketsView } from '@/features/support-tickets'
import { mockAdminRepository } from '@/shared/mocks/mock-admin.repository'
import { useMockBackendStore } from '@/shared/mocks/mock-backend.store'

function renderWithProviders(ui: React.ReactElement, initialRoute = '/') {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  })
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[initialRoute]}>{ui}</MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('Adversarial UI Integration Suite (Rage-Click, Network Chaos, XSS, RLS)', () => {
  beforeEach(() => {
    useMockBackendStore.getState().resetMockDb({
      authenticated: true,
      latencyMs: 0,
    })
  })

  it('prevents duplicate login submissions on rapid rage-clicking', async () => {
    useMockBackendStore.getState().resetMockDb({
      authenticated: false,
      latencyMs: 60,
    })
    const loginSpy = vi.spyOn(mockAdminRepository, 'login')

    const user = userEvent.setup()
    renderWithProviders(
      <Routes>
        <Route path="/login" element={<AdminLoginView />} />
        <Route path="/casos" element={<div>Panel Cargado</div>} />
      </Routes>,
      '/login',
    )

    await user.type(
      screen.getByLabelText(/Correo electrónico corporativo/i),
      'admin@solidez.mx',
    )
    await user.type(
      screen.getByLabelText(/Contraseña de seguridad/i),
      'Admin2025!',
    )

    const submitBtn = screen.getByRole('button', {
      name: /Iniciar Sesión en Panel/i,
    })

    // Fire 8 rapid clicks
    await Promise.all(Array.from({ length: 8 }, () => user.click(submitBtn)))

    await waitFor(() => {
      expect(screen.getByText('Panel Cargado')).toBeInTheDocument()
    })
    expect(loginSpy).toHaveBeenCalledTimes(1)
  })

  it('recovers gracefully from simulated network failure in Cases Inbox', async () => {
    useMockBackendStore.getState().setNextSimulatedError('ERR_NETWORK')
    const user = userEvent.setup()

    renderWithProviders(
      <Routes>
        <Route path="/casos" element={<CasesInboxView />} />
      </Routes>,
      '/casos',
    )

    expect(
      await screen.findByText(/No fue posible conectar con el servicio/i),
    ).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /Reintentar/i }))

    expect(
      await screen.findByText(/Listado de Casos/i),
    ).toBeInTheDocument()
  })

  it('enforces RLS chat lock in ClaimArbitrationView and unlocks upon self-assignment', async () => {
    const user = userEvent.setup()

    renderWithProviders(
      <Routes>
        <Route path="/arbitraje/:caseId" element={<ClaimArbitrationView />} />
      </Routes>,
      '/arbitraje/cas-004',
    )

    expect(
      await screen.findByText(/Conversación bloqueada por privacidad/i),
    ).toBeInTheDocument()

    await user.click(
      screen.getByRole('button', {
        name: /Asignarme reclamación y desbloquear chat/i,
      }),
    )

    expect(
      await screen.findByText(/Quedaron manchas de pintura/i),
    ).toBeInTheDocument()
  })

  it('renders XSS payloads in SupportTicketsView strictly as plain text', async () => {
    const xssPayload = '<img src=x onerror=alert("XSS") />'
    await useMockBackendStore.getState().replyToSupportTicket({
      case_id: 'cas-002',
      body: xssPayload,
      is_internal: false,
      idempotency_key: 'xss-test-msg',
    })

    renderWithProviders(
      <Routes>
        <Route path="/tickets/:caseId" element={<SupportTicketsView />} />
      </Routes>,
      '/tickets/cas-002',
    )

    expect(await screen.findByText(xssPayload)).toBeInTheDocument()
    expect(document.querySelector('img[src="x"]')).toBeNull()
  })
})

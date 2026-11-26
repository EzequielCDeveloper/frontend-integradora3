import { useState, type FormEvent } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useAdminLogout, useAdminSession } from '@/features/admin-auth'
import { Avatar } from '@/shared/components/atoms/Avatar'
import { Button } from '@/shared/components/atoms/Button'
import { Icon } from '@/shared/components/atoms/Icon'
import { ConfirmActionModal } from '@/shared/components/molecules/ConfirmActionModal'
import { ToastViewport } from '@/shared/components/organisms/ToastViewport'

interface NavItem {
  to: string
  label: string
  icon: string
}

const ADMIN_NAV_ITEMS: readonly NavItem[] = [
  { to: '/casos', label: 'Bandeja de Casos', icon: 'inbox' },
  { to: '/tickets', label: 'Tickets y Soporte', icon: 'confirmation_number' },
  { to: '/arbitraje', label: 'Arbitraje de Pagos', icon: 'gavel' },
  { to: '/moderacion', label: 'Moderación de Contenido', icon: 'shield' },
  { to: '/cuentas', label: 'Cuentas y Sanciones', icon: 'manage_accounts' },
  { to: '/monitoreo-stripe', label: 'Pagos y Transferencias', icon: 'payments' },
]

export function AdminShellLayout() {
  const session = useAdminSession()
  const logout = useAdminLogout()
  const navigate = useNavigate()

  const [mobileNavOpen, setMobileNavOpen] = useState(false)
  const [profileMenuOpen, setProfileMenuOpen] = useState(false)
  const [logoutModalOpen, setLogoutModalOpen] = useState(false)
  const [globalQuery, setGlobalQuery] = useState('')

  const handleGlobalSearch = (event: FormEvent) => {
    event.preventDefault()
    const trimmed = globalQuery.trim()
    if (!trimmed) {
      navigate('/casos')
      return
    }
    if (/^pi_/i.test(trimmed) || /^evt_/i.test(trimmed)) {
      navigate(`/monitoreo-stripe?q=${encodeURIComponent(trimmed)}`)
    } else if (/^usr-/i.test(trimmed)) {
      navigate(`/cuentas?q=${encodeURIComponent(trimmed)}`)
    } else if (/^#?tck-/i.test(trimmed)) {
      navigate(`/tickets?q=${encodeURIComponent(trimmed)}`)
    } else {
      navigate(`/casos?q=${encodeURIComponent(trimmed)}`)
    }
  }

  const sidebarContent = (
    <div className="flex h-full flex-col bg-surface-container-low pb-6 pt-6">
      <div className="mb-8 flex items-center justify-between px-5">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary font-headline text-xl font-bold text-on-primary shadow-sm">
            S
          </div>
          <div>
            <p className="font-headline text-xl font-bold leading-none text-on-surface">
              Solidez MX
            </p>
            <p className="mt-1 text-[10px] font-bold uppercase tracking-widest text-secondary">
              Panel de Control
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setMobileNavOpen(false)}
          aria-label="Cerrar menú lateral"
          className="rounded-lg p-1.5 text-on-surface-variant hover:bg-surface-container-high lg:hidden cursor-pointer"
        >
          <Icon name="close" />
        </button>
      </div>

      <p className="mb-2 px-5 text-[10px] font-bold uppercase tracking-widest text-secondary">
        Secciones principales
      </p>

      <nav aria-label="Módulos administrativos" className="flex-1 space-y-1 px-3">
        {ADMIN_NAV_ITEMS.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            onClick={() => setMobileNavOpen(false)}
            className={({ isActive }) =>
              `flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-[13px] leading-snug transition-colors ${
                isActive
                  ? 'bg-primary text-on-primary font-bold shadow-sm'
                  : 'font-medium text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface'
              }`
            }
          >
            <Icon name={item.icon} className="text-[19px] shrink-0" />
            <span>{item.label}</span>
          </NavLink>
        ))}
      </nav>

      {session && (
        <div className="mt-6 border-t border-outline-variant/60 px-4 pt-4">
          <div className="flex items-center gap-3 rounded-xl bg-surface-container p-3">
            <Avatar name={session.admin.full_name} tone="primary" size="sm" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-bold text-on-surface">
                {session.admin.full_name}
              </p>
              <p className="truncate text-[11px] text-on-surface-variant">
                Administrador activo
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setLogoutModalOpen(true)}
            className="mt-2.5 flex w-full items-center justify-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold text-tertiary hover:bg-tertiary-fixed/60 transition-colors cursor-pointer"
          >
            <Icon name="logout" className="text-[16px]" />
            Salir del panel
          </button>
        </div>
      )}
    </div>
  )

  return (
    <div className="min-h-screen bg-surface text-on-surface">
      {/* Desktop Fixed Sidebar */}
      <aside className="fixed left-0 top-0 z-40 hidden h-full w-64 border-r border-outline-variant/40 lg:block">
        {sidebarContent}
      </aside>

      {/* Mobile Drawer Sidebar */}
      {mobileNavOpen && (
        <div
          className="fixed inset-0 z-50 flex lg:hidden"
          role="dialog"
          aria-modal="true"
          aria-label="Menú de navegación"
        >
          <div
            className="fixed inset-0 bg-inverse-surface/35 backdrop-blur-sm"
            onClick={() => setMobileNavOpen(false)}
          />
          <aside className="relative z-10 h-full w-72 max-w-[85vw] shadow-2xl">
            {sidebarContent}
          </aside>
        </div>
      )}

      {/* Content Wrapper */}
      <div className="lg:pl-64">
        {/* Top Fixed Header */}
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between gap-3 bg-surface/90 px-4 shadow-[0_1px_8px_rgba(58,48,42,0.05)] backdrop-blur-xl sm:px-8">
          <div className="flex min-w-0 flex-1 items-center gap-3">
            <button
              type="button"
              onClick={() => setMobileNavOpen(true)}
              aria-label="Abrir menú de secciones"
              className="flex h-9 items-center gap-1.5 rounded-lg bg-surface-container-low px-2.5 text-xs font-semibold text-on-surface hover:bg-surface-container-high lg:hidden cursor-pointer"
            >
              <Icon name="menu" className="text-[19px]" />
              <span>Menú</span>
            </button>

            <form
              onSubmit={handleGlobalSearch}
              role="search"
              className="flex w-full max-w-lg items-center gap-2"
            >
              <div className="relative flex-1">
                <Icon
                  name="search"
                  className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[18px] text-secondary"
                />
                <input
                  type="search"
                  value={globalQuery}
                  onChange={(e) => setGlobalQuery(e.target.value)}
                  aria-label="Buscar casos, personas o pagos"
                  placeholder="Buscar por folio, nombre o referencia de pago..."
                  className="w-full rounded-lg border border-outline-variant/60 bg-surface-container-lowest py-2 pl-10 pr-3 text-sm text-on-surface placeholder:text-secondary/80 focus:border-primary focus:outline-none"
                />
              </div>
              <Button type="submit" variant="secondary" size="sm">
                Buscar
              </Button>
            </form>
          </div>

          <div className="relative flex shrink-0 items-center gap-2 sm:gap-3">
            <button
              type="button"
              onClick={() => navigate('/casos?status=open')}
              className="inline-flex items-center gap-1.5 rounded-full bg-surface-container-low px-3 py-1.5 text-xs font-semibold text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface cursor-pointer"
            >
              <span
                aria-hidden="true"
                className="h-2 w-2 rounded-full bg-primary"
              />
              <span className="hidden sm:inline">Ver pendientes</span>
              <Icon name="notifications" className="text-[18px] sm:hidden" />
            </button>

            <button
              type="button"
              onClick={() => setProfileMenuOpen((prev) => !prev)}
              aria-expanded={profileMenuOpen}
              aria-haspopup="menu"
              className="flex items-center gap-2 rounded-full py-1 pl-1 pr-2.5 hover:bg-surface-container-low cursor-pointer"
            >
              <Avatar
                name={session?.admin.full_name ?? 'Admin'}
                tone="primary"
                size="sm"
              />
              <span className="hidden text-xs font-semibold text-on-surface sm:inline">
                {session?.admin.full_name}
              </span>
              <Icon
                name="expand_more"
                className="hidden text-[16px] text-secondary sm:inline-flex"
              />
            </button>

            {profileMenuOpen && (
              <div
                role="menu"
                className="absolute right-0 top-12 w-64 rounded-xl border border-outline-variant/60 bg-surface-container-lowest p-2 shadow-lg"
              >
                <div className="border-b border-outline-variant/40 px-3 py-2">
                  <p className="text-xs font-bold text-on-surface">
                    {session?.admin.full_name}
                  </p>
                  <p className="text-[11px] text-on-surface-variant">
                    {session?.admin.email} · Administrador activo
                  </p>
                </div>
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setProfileMenuOpen(false)
                    setLogoutModalOpen(true)
                  }}
                  className="mt-1 flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-xs font-semibold text-tertiary hover:bg-tertiary-fixed/50 cursor-pointer"
                >
                  <Icon name="logout" className="text-[16px]" />
                  Salir del panel administrativo
                </button>
              </div>
            )}
          </div>
        </header>

        {/* Main Workspace */}
        <main className="mx-auto w-full max-w-[1440px] px-4 py-7 sm:px-8">
          <Outlet />
        </main>
      </div>

      <ConfirmActionModal
        open={logoutModalOpen}
        title="¿Deseas salir del panel?"
        description="Se cerrará tu sesión administrativa actual y tendrás que ingresar tu correo y contraseña nuevamente para volver a entrar."
        confirmLabel="Sí, salir del panel"
        cancelLabel="Seguir trabajando"
        confirmVariant="tertiary"
        onCancel={() => setLogoutModalOpen(false)}
        onConfirm={() => {
          setLogoutModalOpen(false)
          void logout()
        }}
      />

      <ToastViewport />
    </div>
  )
}

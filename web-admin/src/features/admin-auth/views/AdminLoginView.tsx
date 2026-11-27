import { zodResolver } from '@hookform/resolvers/zod'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { useLocation, useNavigate } from 'react-router-dom'
import { Button } from '@/shared/components/atoms/Button'
import { Input } from '@/shared/components/atoms/FormControls'
import { Icon } from '@/shared/components/atoms/Icon'
import { useIdempotentAction } from '@/shared/hooks/useIdempotentAction'
import { useToastStore } from '@/shared/hooks/useToast'
import { getAdminRepository } from '@/shared/mocks/mock-admin.repository'
import { mapDomainErrorToUI } from '@/shared/utils/error-mapper'
import {
  passwordResetSchema,
  type AdminLoginFormValues,
  type PasswordResetFormValues,
} from '../schemas/auth.schema'

export function AdminLoginView() {
  const navigate = useNavigate()
  const location = useLocation()
  const pushToast = useToastStore((s) => s.push)

  const [authError, setAuthError] = useState<string | null>(null)
  const [resetMode, setResetMode] = useState(false)
  const [resetFeedback, setResetFeedback] = useState<string | null>(null)

  const fromPath =
    (location.state as { from?: string } | null)?.from &&
    (location.state as { from?: string }).from !== '/login'
      ? (location.state as { from?: string }).from!
      : '/casos'

  const loginForm = useForm<AdminLoginFormValues>({
    mode: 'onSubmit',
    defaultValues: { email: 'admin@solidez.mx', password: '••••••••••••' },
  })

  const resetForm = useForm<PasswordResetFormValues>({
    resolver: zodResolver(passwordResetSchema),
    mode: 'onBlur',
    defaultValues: { email: '' },
  })

  const loginAction = useIdempotentAction('admin-login', async () => {
    setAuthError(null)
    const session = await getAdminRepository().login(
      'admin@solidez.mx',
      'Admin2025!',
    )
    pushToast(`Bienvenido, ${session.admin.full_name}.`, 'success')
    navigate(fromPath, { replace: true })
  })

  const resetAction = useIdempotentAction(
    'admin-reset',
    async (_key, values: PasswordResetFormValues) => {
      setAuthError(null)
      setResetFeedback(null)
      const result = await getAdminRepository().requestPasswordReset(
        values.email.trim(),
      )
      setResetFeedback(result.message)
      resetForm.reset()
    },
  )

  const onSubmitLogin = loginForm.handleSubmit(async () => {
    try {
      await loginAction.execute()
    } catch (err) {
      setAuthError(mapDomainErrorToUI(err).message)
    }
  })

  const onSubmitReset = resetForm.handleSubmit(async (values) => {
    try {
      await resetAction.execute(values)
    } catch (err) {
      setAuthError(mapDomainErrorToUI(err).message)
    }
  })

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-background p-4 sm:p-8 lg:p-12">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -left-24 -top-24 h-80 w-80 rounded-full bg-primary-fixed-dim/20 blur-3xl"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -bottom-24 -right-24 h-96 w-96 rounded-full bg-tertiary-fixed/25 blur-3xl"
      />

      <div className="relative z-10 mx-auto grid w-full max-w-5xl grid-cols-1 items-center gap-8 lg:grid-cols-12 lg:gap-12">
        {/* Left Institutional Column */}
        <section className="hidden flex-col justify-between py-6 lg:col-span-5 lg:flex">
          <div className="space-y-6">
            <div className="flex items-center gap-3.5">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary font-headline text-2xl font-bold text-on-primary shadow-sm">
                S
              </div>
              <div>
                <p className="font-headline text-2xl font-bold leading-none text-on-surface">
                  Solidez MX
                </p>
                <p className="mt-1 text-[10px] font-bold uppercase tracking-[0.18em] text-on-surface-variant">
                  Panel de Administración Web
                </p>
              </div>
            </div>

            <div className="inline-flex items-center gap-2 rounded-full bg-surface-container px-3.5 py-1.5 text-xs font-semibold text-on-surface-variant">
              <span className="h-2 w-2 rounded-full bg-primary animate-pulse" />
              <span>Uso exclusivo para el equipo administrador</span>
            </div>

            <h1 className="font-headline text-4xl font-bold leading-[1.12] text-on-surface xl:text-5xl">
              Atiende casos, pagos y seguridad desde un solo lugar.
            </h1>

            <p className="text-sm leading-relaxed text-on-surface-variant">
              Resuelve reclamaciones de pagos retenidos, responde tickets de
              ayuda, revisa contenido reportado y gestiona sanciones de cuentas
              con historial completo.
            </p>
          </div>

          <div className="mt-8 space-y-4 rounded-2xl bg-surface-container-low/80 p-6">
            <div className="flex items-start gap-3">
              <Icon
                name="verified_user"
                filled
                className="mt-0.5 text-primary"
              />
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-on-surface">
                  Acceso solo por invitación
                </p>
                <p className="mt-0.5 text-xs text-on-surface-variant">
                  Solo el personal dado de alta como administrador activo puede
                  entrar. Si necesitas acceso, solicítalo al responsable.
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <Icon name="gavel" filled className="mt-0.5 text-primary" />
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-on-surface">
                  Decisiones protegidas
                </p>
                <p className="mt-0.5 text-xs text-on-surface-variant">
                  Antes de aplicar cualquier sanción, retiro de contenido o
                  movimiento de dinero, el sistema te pedirá confirmar.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Right Auth Card */}
        <section className="lg:col-span-7">
          <div className="relative overflow-hidden rounded-2xl bg-surface-container-lowest p-6 shadow-[0_8px_30px_rgba(58,48,42,0.06)] sm:p-10">
            <div
              aria-hidden="true"
              className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-primary via-primary-container to-surface-variant"
            />

            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary font-headline text-xl font-bold text-on-primary lg:hidden">
                  S
                </div>
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-secondary">
                    Inicio de sesión
                  </p>
                  <p className="font-headline text-xl font-bold text-on-surface">
                    Solidez MX
                  </p>
                </div>
              </div>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-primary-fixed px-3 py-1.5 text-xs font-semibold text-on-primary-fixed">
                <Icon
                  name="shield_person"
                  filled
                  className="text-[16px] text-primary"
                />
                Panel Administrativo
              </span>
            </div>

            {!resetMode ? (
              <>
                <div className="mt-7">
                  <h2 className="font-headline text-3xl font-bold text-on-surface">
                    Entrar al Panel Administrativo
                  </h2>
                  <p className="mt-1.5 text-sm text-on-surface-variant">
                    Escribe tu correo corporativo y tu contraseña para comenzar
                    a atender casos. Los campos con{' '}
                    <span className="font-bold text-error">*</span> son
                    obligatorios.
                  </p>
                </div>

                {authError && (
                  <div
                    role="alert"
                    className="mt-5 flex items-start gap-2.5 rounded-xl border border-error/25 bg-error-container/70 px-4 py-3 text-sm text-on-error-container"
                  >
                    <Icon
                      name="error_outline"
                      className="mt-0.5 shrink-0 text-[18px] text-error"
                    />
                    <span>{authError}</span>
                  </div>
                )}

                <form
                  onSubmit={onSubmitLogin}
                  noValidate
                  className="mt-6 space-y-5"
                >
                  <div>
                    <Input
                      label="Correo electrónico corporativo"
                      htmlFor="admin-email"
                      type="email"
                      leftIcon="alternate_email"
                      readOnly
                      className="bg-surface-container-low cursor-not-allowed"
                      {...loginForm.register('email')}
                    />
                    <p className="mt-1 text-xs text-secondary">
                      Modo demostración: cuenta administrativa verificada.
                    </p>
                  </div>

                  <div className="space-y-1.5">
                    <label
                      htmlFor="admin-password"
                      className="block text-[11px] font-bold uppercase tracking-wider text-on-surface-variant"
                    >
                      Contraseña de seguridad
                    </label>
                    <div className="relative">
                      <Icon
                        name="lock"
                        className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[18px] text-secondary"
                      />
                      <input
                        id="admin-password"
                        type="password"
                        readOnly
                        className="w-full rounded-lg border border-outline-variant/80 bg-surface-container-low py-2.5 pl-10 pr-4 text-sm text-on-surface cursor-not-allowed focus:outline-none"
                        {...loginForm.register('password')}
                      />
                    </div>
                    <p className="text-xs text-secondary">
                      Acceso administrativo de demostración preconfigurado.
                    </p>
                  </div>

                  <Button
                    type="submit"
                    size="lg"
                    leftIcon="login"
                    loading={loginAction.isPending}
                    loadingText="Accediendo al panel..."
                    className="w-full"
                  >
                    Iniciar Sesión en Panel
                  </Button>
                </form>
              </>
            ) : (
              <>
                <div className="mt-7">
                  <h2 className="font-headline text-3xl font-bold text-on-surface">
                    Recuperar tu Contraseña
                  </h2>
                  <p className="mt-1.5 text-sm text-on-surface-variant">
                    Escribe tu correo corporativo y te enviaremos un enlace para
                    crear una nueva contraseña.
                  </p>
                </div>

                {authError && (
                  <div
                    role="alert"
                    className="mt-5 rounded-xl border border-error/25 bg-error-container/70 px-4 py-3 text-sm text-on-error-container"
                  >
                    {authError}
                  </div>
                )}

                {resetFeedback && (
                  <div
                    role="status"
                    className="mt-5 rounded-xl bg-primary-fixed px-4 py-3 text-sm text-on-primary-fixed"
                  >
                    {resetFeedback}
                  </div>
                )}

                <form
                  onSubmit={onSubmitReset}
                  noValidate
                  className="mt-6 space-y-5"
                >
                  <Input
                    label="Correo electrónico corporativo"
                    htmlFor="reset-email"
                    type="email"
                    leftIcon="alternate_email"
                    placeholder="Ejemplo: admin@solidez.mx"
                    required
                    error={resetForm.formState.errors.email?.message}
                    {...resetForm.register('email')}
                  />

                  <div className="flex flex-wrap gap-3">
                    <Button
                      variant="secondary"
                      leftIcon="arrow_back"
                      onClick={() => {
                        setResetMode(false)
                        setAuthError(null)
                        setResetFeedback(null)
                      }}
                    >
                      Volver al inicio de sesión
                    </Button>
                    <Button
                      type="submit"
                      leftIcon="mail"
                      loading={resetAction.isPending}
                      loadingText="Enviando correo..."
                      className="flex-1"
                    >
                      Enviar instrucciones
                    </Button>
                  </div>
                </form>
              </>
            )}
          </div>
        </section>
      </div>
    </div>
  )
}

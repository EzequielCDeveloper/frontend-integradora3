import { zodResolver } from '@hookform/resolvers/zod'
import { useEffect, useMemo, useState } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { Avatar } from '@/shared/components/atoms/Avatar'
import { Badge } from '@/shared/components/atoms/Badge'
import { Button } from '@/shared/components/atoms/Button'
import {
  Input,
  Select,
  Textarea,
} from '@/shared/components/atoms/FormControls'
import { ConfirmActionModal } from '@/shared/components/molecules/ConfirmActionModal'
import {
  EmptyState,
  ErrorState,
  PageLoadingSkeleton,
} from '@/shared/components/molecules/FeedbackStates'
import { AccountStatusBadge } from '@/shared/components/molecules/StatusBadge'
import { SlideOverDrawer } from '@/shared/components/organisms/SlideOverDrawer'
import { PageHeader } from '@/shared/components/templates/PageHeader'
import { useDebounce } from '@/shared/hooks/useDebounce'
import { useIdempotentAction } from '@/shared/hooks/useIdempotentAction'
import { useToastStore } from '@/shared/hooks/useToast'
import type { AccountsFilterParams } from '@/shared/services/admin-repository.contract'
import type {
  AccountDetail,
  AccountStatus,
  SanctionType,
  UserSanctionRecord,
} from '@/shared/types/domain.types'
import { mapDomainErrorToUI } from '@/shared/utils/error-mapper'
import { formatDateTimeMX, formatRelativeTimeES } from '@/shared/utils/format'
import {
  useAccountsList,
  useAllAccountsSummary,
  useApplySanction,
  useRevokeSanction,
} from '../hooks/useAccountSanctions'
import {
  applySanctionSchema,
  type ApplySanctionFormValues,
} from '../schemas/sanction.schema'

const ROLE_OPTIONS = [
  { value: 'all', label: 'Todos los roles' },
  { value: 'employer', label: 'Empleador' },
  { value: 'worker', label: 'Trabajador' },
] as const

const STATUS_OPTIONS = [
  { value: 'all', label: 'Todos los estados' },
  { value: 'active', label: 'Activa' },
  { value: 'warned', label: 'Advertida' },
  { value: 'suspended', label: 'Suspendida' },
  { value: 'blocked', label: 'Bloqueada' },
  { value: 'soft_deleted', label: 'Dada de baja' },
] as const

const SANCTION_LABELS: Record<SanctionType, string> = {
  warning: 'Advertencia formal',
  suspension_1d: 'Suspensión temporal (1 día)',
  suspension_7d: 'Suspensión temporal (7 días)',
  suspension_30d: 'Suspensión temporal (30 días)',
  permanent_block: 'Bloqueo permanente',
  soft_delete: 'Dar de baja la cuenta',
}

type SanctionGroup = 'warning' | 'suspension' | 'permanent_block' | 'soft_delete'

export function AccountSanctionsView() {
  const { userId } = useParams<{ userId: string }>()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const pushToast = useToastStore((s) => s.push)

  const search = searchParams.get('q') ?? ''
  const setSearch = (value: string) => {
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev)
        if (value) next.set('q', value)
        else next.delete('q')
        return next
      },
      { replace: true },
    )
  }
  const debouncedSearch = useDebounce(search, 200)
  const [role, setRole] = useState<'all' | 'employer' | 'worker'>('all')
  const [status, setStatus] = useState<AccountStatus | 'all'>('all')

  const [drawerUserId, setDrawerUserId] = useState<string | null>(null)
  const selectedUserId = userId ?? drawerUserId
  const [sanctionGroup, setSanctionGroup] = useState<SanctionGroup>('warning')
  const [suspensionChoice, setSuspensionChoice] = useState<
    'suspension_1d' | 'suspension_7d' | 'suspension_30d'
  >('suspension_7d')

  const [pendingSanction, setPendingSanction] =
    useState<ApplySanctionFormValues | null>(null)
  const [revokingTarget, setRevokingTarget] =
    useState<UserSanctionRecord | null>(null)
  const [revokeReason, setRevokeReason] = useState('')
  const [revokeTouched, setRevokeTouched] = useState(false)

  const filters: AccountsFilterParams = useMemo(
    () => ({ search: debouncedSearch, role, status }),
    [debouncedSearch, role, status],
  )

  const listQuery = useAccountsList(filters)
  const summaryQuery = useAllAccountsSummary()
  const applyMutation = useApplySanction()
  const revokeMutation = useRevokeSanction()

  const selectedAccount: AccountDetail | null = useMemo(() => {
    if (!selectedUserId) return null
    const all = summaryQuery.data ?? listQuery.data ?? []
    return all.find((acc) => acc.profile.id === selectedUserId) ?? null
  }, [listQuery.data, selectedUserId, summaryQuery.data])

  const form = useForm<ApplySanctionFormValues>({
    resolver: zodResolver(applySanctionSchema),
    mode: 'onBlur',
    defaultValues: {
      sanction: 'warning',
      reason: '',
    },
  })

  const reasonValue = useWatch({ control: form.control, name: 'reason' })

  useEffect(() => {
    const nextSanction: SanctionType =
      sanctionGroup === 'suspension' ? suspensionChoice : sanctionGroup
    form.setValue('sanction', nextSanction)
  }, [form, sanctionGroup, suspensionChoice])

  const openUserDrawer = (targetId: string) => {
    setDrawerUserId(targetId)
    setSanctionGroup('warning')
    setSuspensionChoice('suspension_7d')
    form.reset({ sanction: 'warning', reason: '' })
  }

  const applySanctionAction = useIdempotentAction(
    'apply-sanction',
    async (
      idempotencyKey,
      targetUserId: string,
      values: ApplySanctionFormValues,
    ) => {
      await applyMutation.mutateAsync({
        user_id: targetUserId,
        sanction: values.sanction,
        reason: values.reason,
        idempotency_key: idempotencyKey,
      })
      setPendingSanction(null)
      form.reset({ sanction: 'warning', reason: '' })
      pushToast(
        `Medida "${SANCTION_LABELS[values.sanction]}" aplicada y guardada en el historial.`,
        'success',
      )
    },
  )

  const revokeSanctionAction = useIdempotentAction(
    'revoke-sanction',
    async (idempotencyKey, sanctionId: string, reason: string) => {
      await revokeMutation.mutateAsync({
        sanction_id: sanctionId,
        reason,
        idempotency_key: idempotencyKey,
      })
      setRevokingTarget(null)
      setRevokeReason('')
      setRevokeTouched(false)
      pushToast('Sanción retirada por apelación aprobada.', 'success')
    },
  )

  const kpis = useMemo(() => {
    const all = summaryQuery.data ?? []
    return {
      active: all.filter((a) => a.profile.account_status === 'active').length,
      warned: all.filter((a) => a.profile.account_status === 'warned').length,
      suspended: all.filter((a) => a.profile.account_status === 'suspended')
        .length,
      restricted: all.filter(
        (a) =>
          a.profile.account_status === 'blocked' ||
          a.profile.account_status === 'soft_deleted',
      ).length,
    }
  }, [summaryQuery.data])

  const closeDrawer = () => {
    setDrawerUserId(null)
    if (userId) navigate('/cuentas', { replace: true })
  }

  const trimmedSanctionReasonLen = (reasonValue ?? '').trim().length
  const trimmedRevokeReasonLen = revokeReason.trim().length

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="USUARIOS Y DISCIPLINA"
        title="Cuentas y Sanciones"
        subtitle="Busca a cualquier empleador o trabajador y pulsa Gestionar para revisar su historial, aplicar una sanción o retirar una por apelación."
        actions={
          <Button
            variant="ghost"
            size="sm"
            leftIcon="arrow_back"
            onClick={() => navigate('/casos')}
          >
            Volver a Bandeja de Casos
          </Button>
        }
      />

      {/* Integrity KPIs */}
      <section className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <div className="rounded-xl bg-surface-container-low p-5">
          <p className="text-[11px] font-bold uppercase tracking-wider text-secondary">
            Cuentas Activas
          </p>
          <p className="mt-2 font-headline text-3xl font-bold text-on-surface">
            {kpis.active}
          </p>
          <p className="mt-1 text-xs font-semibold text-primary">
            Funcionando con normalidad
          </p>
        </div>
        <div className="rounded-xl bg-surface-container-low p-5">
          <p className="text-[11px] font-bold uppercase tracking-wider text-secondary">
            Advertidas
          </p>
          <p className="mt-2 font-headline text-3xl font-bold text-on-primary-fixed-variant">
            {kpis.warned}
          </p>
          <p className="mt-1 text-xs text-on-surface-variant">
            Tienen un aviso formal
          </p>
        </div>
        <div className="rounded-xl bg-surface-container-low p-5">
          <p className="text-[11px] font-bold uppercase tracking-wider text-secondary">
            Suspendidas
          </p>
          <p className="mt-2 font-headline text-3xl font-bold text-tertiary">
            {kpis.suspended}
          </p>
          <p className="mt-1 text-xs text-on-surface-variant">
            Acceso pausado temporalmente
          </p>
        </div>
        <div className="rounded-xl bg-surface-container-low p-5">
          <p className="text-[11px] font-bold uppercase tracking-wider text-secondary">
            Bloqueadas o de Baja
          </p>
          <p className="mt-2 font-headline text-3xl font-bold text-error">
            {kpis.restricted}
          </p>
          <p className="mt-1 text-xs text-on-surface-variant">
            Acceso inhabilitado
          </p>
        </div>
      </section>

      {/* Search & Filter Bar */}
      <section className="rounded-xl bg-surface-container-lowest p-4 sm:p-5 shadow-xs">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-12 items-end">
          <div className="sm:col-span-2 lg:col-span-6">
            <Input
              label="Buscar persona"
              htmlFor="accounts-search"
              leftIcon="person_search"
              placeholder="Ejemplo: Carlos Mendoza, correo o código USR-8492..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="lg:col-span-3">
            <Select
              label="Tipo de usuario"
              htmlFor="accounts-role"
              options={ROLE_OPTIONS}
              value={role}
              onChange={(e) =>
                setRole(e.target.value as 'all' | 'employer' | 'worker')
              }
            />
          </div>
          <div className="lg:col-span-3">
            <Select
              label="Estado de la cuenta"
              htmlFor="accounts-status"
              options={STATUS_OPTIONS}
              value={status}
              onChange={(e) =>
                setStatus(e.target.value as AccountStatus | 'all')
              }
            />
          </div>
        </div>
      </section>

      {/* Accounts Table */}
      {listQuery.isLoading ? (
        <PageLoadingSkeleton />
      ) : listQuery.isError ? (
        <ErrorState
          message={mapDomainErrorToUI(listQuery.error).message}
          onRetry={() => void listQuery.refetch()}
        />
      ) : !listQuery.data || listQuery.data.length === 0 ? (
        <EmptyState
          icon="manage_accounts"
          title="No encontramos cuentas con esa búsqueda"
          description="Limpia los filtros o busca con otro nombre, correo o código de usuario."
          actionLabel="Mostrar todas las cuentas"
          onAction={() => {
            setSearch('')
            setRole('all')
            setStatus('all')
          }}
        />
      ) : (
        <section className="overflow-hidden rounded-xl bg-surface-container-lowest shadow-xs">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-outline-variant/40 px-6 py-4">
            <div className="flex items-center gap-3">
              <h2 className="font-headline text-2xl font-bold text-on-surface">
                Directorio de Usuarios
              </h2>
              <Badge tone="secondary">
                {listQuery.data.length} cuentas
              </Badge>
            </div>
            <span className="text-xs text-secondary">
              Pulsa Gestionar para revisar historial o aplicar una medida
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[780px] text-left text-sm">
              <thead>
                <tr className="border-b border-outline-variant/40 bg-surface-container-low/60 text-[11px] font-bold uppercase tracking-wider text-on-surface-variant">
                  <th scope="col" className="px-5 py-3.5">
                    Persona y Código
                  </th>
                  <th scope="col" className="px-4 py-3.5">
                    Tipo
                  </th>
                  <th scope="col" className="px-4 py-3.5">
                    Estado
                  </th>
                  <th scope="col" className="px-4 py-3.5">
                    Incidencias
                  </th>
                  <th scope="col" className="px-4 py-3.5">
                    Última Actividad
                  </th>
                  <th scope="col" className="px-5 py-3.5 text-right">
                    Acción
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant/30">
                {listQuery.data.map((item) => {
                  const activeSanctions = item.sanctions.filter(
                    (s) => !s.revoked_at,
                  ).length
                  return (
                    <tr
                      key={item.profile.id}
                      className="hover:bg-surface-container-low/55 transition-colors"
                    >
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          <Avatar
                            name={item.profile.full_name}
                            tone={
                              item.profile.account_status === 'blocked'
                                ? 'tertiary'
                                : 'secondary'
                            }
                            size="sm"
                          />
                          <div className="min-w-0">
                            <p className="font-semibold text-on-surface">
                              {item.profile.full_name}
                            </p>
                            <p className="text-xs text-on-surface-variant">
                              {item.profile.email} ·{' '}
                              <span className="font-mono">
                                {item.profile.code}
                              </span>
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        <Badge
                          tone="secondary"
                          icon={
                            item.profile.role === 'employer'
                              ? 'business_center'
                              : 'engineering'
                          }
                        >
                          {item.profile.role === 'employer'
                            ? 'Empleador'
                            : 'Trabajador'}
                        </Badge>
                      </td>
                      <td className="px-4 py-4">
                        <AccountStatusBadge
                          status={item.profile.account_status}
                        />
                      </td>
                      <td className="px-4 py-4 text-xs text-on-surface-variant">
                        <p className="font-semibold text-on-surface">
                          {item.reportsAgainst.length} reportes
                        </p>
                        <p>{activeSanctions} sanciones activas</p>
                      </td>
                      <td className="px-4 py-4 font-mono text-xs text-on-surface-variant whitespace-nowrap">
                        {formatRelativeTimeES(item.profile.last_activity_at)}
                      </td>
                      <td className="px-5 py-4 text-right">
                        <Button
                          variant="primary"
                          size="sm"
                          leftIcon="gavel"
                          onClick={() => openUserDrawer(item.profile.id)}
                        >
                          Gestionar
                        </Button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* Slide-Over Disciplinary Drawer */}
      <SlideOverDrawer
        open={selectedAccount !== null}
        eyebrow="GESTIÓN DISCIPLINARIA"
        title={selectedAccount?.profile.full_name ?? ''}
        subtitle={
          selectedAccount
            ? `${selectedAccount.profile.code} · ${
                selectedAccount.profile.role === 'employer'
                  ? 'Empleador'
                  : 'Trabajador'
              } · ${selectedAccount.profile.email}`
            : undefined
        }
        onClose={closeDrawer}
      >
        {selectedAccount && (
          <div className="space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-surface-container-low p-4">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wider text-secondary">
                  Estado actual de la cuenta
                </p>
                <div className="mt-1.5">
                  <AccountStatusBadge
                    status={selectedAccount.profile.account_status}
                  />
                </div>
              </div>
              {selectedAccount.profile.suspended_until && (
                <div className="text-right text-xs">
                  <p className="font-bold text-tertiary">Suspendida hasta:</p>
                  <p className="font-mono text-on-surface">
                    {formatDateTimeMX(selectedAccount.profile.suspended_until)}
                  </p>
                </div>
              )}
            </div>

            {/* Sanctions History & Appeal Revocation */}
            <div className="space-y-2.5 rounded-xl bg-surface-container-low p-4">
              <p className="text-[11px] font-bold uppercase tracking-wider text-secondary">
                Historial de Sanciones ({selectedAccount.sanctions.length}) ·
                Reportes ({selectedAccount.reportsAgainst.length})
              </p>
              {selectedAccount.sanctions.length === 0 ? (
                <p className="text-xs text-on-surface-variant">
                  Esta persona no tiene sanciones previas.
                </p>
              ) : (
                <ul className="space-y-2.5">
                  {selectedAccount.sanctions.map((snc) => (
                    <li
                      key={snc.id}
                      className="rounded-lg bg-surface-container-lowest p-3 text-xs space-y-1"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <strong className="text-on-surface">
                          {SANCTION_LABELS[snc.sanction]}
                        </strong>
                        {snc.revoked_at ? (
                          <Badge tone="neutral">Retirada por apelación</Badge>
                        ) : (
                          <button
                            type="button"
                            onClick={() => {
                              setRevokingTarget(snc)
                              setRevokeReason('')
                              setRevokeTouched(false)
                            }}
                            className="font-semibold text-primary hover:underline cursor-pointer"
                          >
                            Retirar por apelación
                          </button>
                        )}
                      </div>
                      <p className="text-on-surface-variant">{snc.reason}</p>
                      <p className="font-mono text-[10px] text-secondary">
                        Aplicada por {snc.admin_name} ·{' '}
                        {formatDateTimeMX(snc.created_at)}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* Guided Sanction Application Form */}
            <form
              onSubmit={form.handleSubmit((values) => {
                setPendingSanction(values)
              })}
              noValidate
              className="space-y-4"
            >
              <fieldset className="space-y-2.5">
                <legend className="text-[11px] font-bold uppercase tracking-wider text-on-surface-variant">
                  Paso 1 · Elige la medida a aplicar
                </legend>

                {(
                  [
                    {
                      group: 'warning' as const,
                      title: 'Advertencia formal',
                      desc: 'Envía un aviso oficial sin suspender el acceso a la cuenta.',
                      danger: false,
                    },
                    {
                      group: 'suspension' as const,
                      title: 'Suspensión temporal',
                      desc: 'Pausa el acceso y las operaciones durante 1, 7 o 30 días.',
                      danger: false,
                    },
                    {
                      group: 'permanent_block' as const,
                      title: 'Bloqueo permanente',
                      desc: 'Impide definitivamente que esta cuenta vuelva a usar la plataforma.',
                      danger: true,
                    },
                    {
                      group: 'soft_delete' as const,
                      title: 'Dar de baja la cuenta',
                      desc: 'Desactiva el perfil e impide iniciar sesión, conservando el historial de pagos y registros legales.',
                      danger: false,
                    },
                  ] as const
                ).map((option) => {
                  const selected = sanctionGroup === option.group
                  return (
                    <label
                      key={option.group}
                      className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3.5 transition-colors ${
                        selected
                          ? 'border-primary bg-primary-fixed/30'
                          : 'border-outline-variant/60 bg-surface-container-lowest'
                      }`}
                    >
                      <input
                        type="radio"
                        name="sanction-group"
                        checked={selected}
                        onChange={() => setSanctionGroup(option.group)}
                        className="mt-1 accent-[#c2652a]"
                      />
                      <div>
                        <p
                          className={`text-sm font-bold ${
                            option.danger ? 'text-error' : 'text-on-surface'
                          }`}
                        >
                          {option.title}
                        </p>
                        <p className="mt-0.5 text-xs text-on-surface-variant">
                          {option.desc}
                        </p>
                      </div>
                    </label>
                  )
                })}

                {sanctionGroup === 'suspension' && (
                  <div className="space-y-2 rounded-xl bg-surface-container-low p-3">
                    <p className="text-[11px] font-bold uppercase tracking-wider text-secondary">
                      Duración de la suspensión:
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {(
                        [
                          { value: 'suspension_1d', label: '1 día' },
                          { value: 'suspension_7d', label: '7 días' },
                          { value: 'suspension_30d', label: '30 días' },
                        ] as const
                      ).map((dur) => (
                        <button
                          key={dur.value}
                          type="button"
                          onClick={() => setSuspensionChoice(dur.value)}
                          className={`rounded-full px-3.5 py-1.5 text-xs font-semibold cursor-pointer ${
                            suspensionChoice === dur.value
                              ? 'bg-primary text-on-primary'
                              : 'bg-surface-container-lowest text-on-surface-variant hover:bg-surface-container-high'
                          }`}
                        >
                          {dur.label}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </fieldset>

              <div>
                <Textarea
                  label="Paso 2 · Explica el motivo"
                  htmlFor="sanction-reason"
                  rows={4}
                  required
                  placeholder="Ejemplo: Se comprobaron dos reportes por solicitar pagos fuera de la plataforma en el caso #REP-8490..."
                  error={form.formState.errors.reason?.message}
                  {...form.register('reason')}
                />
                <p className="mt-1 text-right text-[11px] text-secondary">
                  {trimmedSanctionReasonLen} / 10 caracteres mínimos
                </p>
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <Button variant="secondary" onClick={closeDrawer}>
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  variant={
                    sanctionGroup === 'permanent_block' ? 'danger' : 'primary'
                  }
                  leftIcon="gavel"
                >
                  Continuar y Confirmar
                </Button>
              </div>
            </form>
          </div>
        )}
      </SlideOverDrawer>

      {/* Two-Step Confirmation: Apply Sanction */}
      <ConfirmActionModal
        open={pendingSanction !== null && selectedAccount !== null}
        title="¿Confirmas aplicar esta medida?"
        description="El estado de la cuenta cambiará de inmediato y la acción quedará registrada en el historial."
        confirmLabel="Sí, aplicar medida"
        cancelLabel="Volver a revisar"
        confirmVariant={
          pendingSanction?.sanction === 'permanent_block' ? 'danger' : 'primary'
        }
        loading={applySanctionAction.isPending}
        onCancel={() => setPendingSanction(null)}
        onConfirm={() => {
          if (!pendingSanction || !selectedAccount) return
          void applySanctionAction
            .execute(selectedAccount.profile.id, pendingSanction)
            .catch((err) => {
              setPendingSanction(null)
              pushToast(mapDomainErrorToUI(err).message, 'error')
            })
        }}
        details={
          pendingSanction &&
          selectedAccount && (
            <div className="space-y-1.5 text-xs">
              <p>
                <strong>Persona:</strong> {selectedAccount.profile.full_name} (
                {selectedAccount.profile.code})
              </p>
              <p>
                <strong>Medida:</strong>{' '}
                {SANCTION_LABELS[pendingSanction.sanction]}
              </p>
              <p>
                <strong>Motivo:</strong> {pendingSanction.reason}
              </p>
            </div>
          )
        }
      />

      {/* Two-Step Confirmation: Revoke Sanction on Appeal */}
      <ConfirmActionModal
        open={revokingTarget !== null}
        title="¿Retirar esta sanción por apelación?"
        description="Si el usuario no tiene otras sanciones activas, su cuenta volverá automáticamente a estado Activa."
        confirmLabel="Sí, retirar sanción"
        cancelLabel="Cancelar"
        loading={revokeSanctionAction.isPending}
        onCancel={() => setRevokingTarget(null)}
        onConfirm={() => {
          setRevokeTouched(true)
          if (!revokingTarget || trimmedRevokeReasonLen < 8) {
            return
          }
          void revokeSanctionAction
            .execute(revokingTarget.id, revokeReason.trim())
            .catch((err) => {
              setRevokingTarget(null)
              pushToast(mapDomainErrorToUI(err).message, 'error')
            })
        }}
        details={
          <div className="space-y-2">
            <label
              htmlFor="revoke-reason-input"
              className="block text-[11px] font-bold uppercase tracking-wider text-on-surface-variant"
            >
              Motivo de la apelación aprobada <span className="text-error">*</span>
            </label>
            <textarea
              id="revoke-reason-input"
              rows={3}
              value={revokeReason}
              onBlur={() => setRevokeTouched(true)}
              onChange={(e) => setRevokeReason(e.target.value)}
              placeholder="Ejemplo: El usuario envió evidencia válida en el ticket #TCK-2041..."
              className={`w-full rounded-lg border bg-surface-container-lowest p-2.5 text-xs text-on-surface focus:border-primary focus:outline-none ${
                revokeTouched && trimmedRevokeReasonLen < 8
                  ? 'border-error'
                  : 'border-outline-variant'
              }`}
            />
            <div className="flex items-center justify-between text-[11px]">
              {revokeTouched && trimmedRevokeReasonLen < 8 ? (
                <span role="alert" className="font-semibold text-error">
                  Escribe al menos 8 caracteres para poder continuar.
                </span>
              ) : (
                <span className="text-secondary">
                  Campo obligatorio para guardar en el historial.
                </span>
              )}
              <span className="text-secondary">
                {trimmedRevokeReasonLen} / 8 mín.
              </span>
            </div>
          </div>
        }
      />
    </div>
  )
}

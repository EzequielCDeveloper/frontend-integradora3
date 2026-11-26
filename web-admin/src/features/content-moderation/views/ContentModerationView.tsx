import { zodResolver } from '@hookform/resolvers/zod'
import { useEffect, useMemo, useState } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Avatar } from '@/shared/components/atoms/Avatar'
import { Badge } from '@/shared/components/atoms/Badge'
import { Button } from '@/shared/components/atoms/Button'
import { Textarea } from '@/shared/components/atoms/FormControls'
import { Icon } from '@/shared/components/atoms/Icon'
import { ConfirmActionModal } from '@/shared/components/molecules/ConfirmActionModal'
import {
  EmptyState,
  ErrorState,
  PageLoadingSkeleton,
} from '@/shared/components/molecules/FeedbackStates'
import {
  CaseStatusBadge,
  ModerationStatusBadge,
} from '@/shared/components/molecules/StatusBadge'
import { PageHeader } from '@/shared/components/templates/PageHeader'
import { useIdempotentAction } from '@/shared/hooks/useIdempotentAction'
import { useToastStore } from '@/shared/hooks/useToast'
import type {
  ModerationActionType,
  ReportStatus,
  ReportTarget,
} from '@/shared/types/domain.types'
import { mapDomainErrorToUI } from '@/shared/utils/error-mapper'
import { formatDateTimeMX, formatRelativeTimeES } from '@/shared/utils/format'
import {
  useApplyModerationAction,
  useModerationAuditLog,
  useModerationReports,
} from '../hooks/useContentModeration'
import {
  moderationDecisionSchema,
  type ModerationDecisionFormValues,
} from '../schemas/moderation.schema'

const STATUS_TABS: ReadonlyArray<{ value: ReportStatus | 'all'; label: string }> =
  [
    { value: 'all', label: 'Todos' },
    { value: 'pending', label: 'Pendientes' },
    { value: 'in_review', label: 'En revisión' },
    { value: 'attended', label: 'Atendidos' },
    { value: 'dismissed', label: 'Desestimados' },
  ]

const TARGET_LABELS: Record<ReportTarget, string> = {
  job: 'Publicación de trabajo',
  review: 'Reseña',
  chat_message: 'Mensaje de chat',
  user: 'Perfil de usuario',
  application: 'Postulación',
}

const ACTION_META: Record<
  ModerationActionType,
  {
    label: string
    confirmTitle: string
    confirmDesc: string
    variant: 'primary' | 'secondary' | 'tertiary'
  }
> = {
  hide: {
    label: 'Ocultar temporalmente',
    confirmTitle: '¿Ocultar este contenido temporalmente?',
    confirmDesc:
      'Los usuarios dejarán de ver este contenido en la plataforma mientras se revisa. Podrás volver a mostrarlo después.',
    variant: 'secondary',
  },
  remove: {
    label: 'Retirar definitivamente',
    confirmTitle: '¿Retirar este contenido definitivamente?',
    confirmDesc:
      'El contenido se retirará de la plataforma por incumplir las normas y la decisión quedará guardada en el historial.',
    variant: 'tertiary',
  },
  restore: {
    label: 'Volver a mostrar',
    confirmTitle: '¿Volver a mostrar este contenido?',
    confirmDesc:
      'El contenido volverá a ser visible para todos los usuarios en la plataforma.',
    variant: 'primary',
  },
  dismiss: {
    label: 'Desestimar reporte',
    confirmTitle: '¿Desestimar este reporte?',
    confirmDesc:
      'El reporte se marcará como sin infracción y el contenido permanecerá exactamente como está.',
    variant: 'secondary',
  },
}

export function ContentModerationView() {
  const { caseId } = useParams<{ caseId: string }>()
  const navigate = useNavigate()
  const pushToast = useToastStore((s) => s.push)

  const [statusFilter, setStatusFilter] = useState<ReportStatus | 'all'>('all')
  const [pendingAction, setPendingAction] = useState<{
    action: ModerationActionType
    reason: string
  } | null>(null)

  const reportsQuery = useModerationReports(statusFilter)
  const allReportsQuery = useModerationReports('all')
  const auditQuery = useModerationAuditLog()
  const moderateMutation = useApplyModerationAction()

  const selectedDetail = useMemo(() => {
    const list = reportsQuery.data ?? []
    if (list.length === 0) return null
    if (caseId) {
      return list.find((item) => item.report.id === caseId) ?? list[0]
    }
    return list[0]
  }, [caseId, reportsQuery.data])

  const form = useForm<ModerationDecisionFormValues>({
    resolver: zodResolver(moderationDecisionSchema),
    mode: 'onBlur',
    defaultValues: { reason: '' },
  })

  const reasonValue = useWatch({ control: form.control, name: 'reason' })

  useEffect(() => {
    form.reset({ reason: '' })
  }, [selectedDetail?.report.id, form])

  const executeModeration = useIdempotentAction(
    'moderate-content',
    async (
      idempotencyKey,
      targetCaseId: string,
      action: ModerationActionType,
      reason: string,
    ) => {
      await moderateMutation.mutateAsync({
        case_id: targetCaseId,
        action,
        reason,
        idempotency_key: idempotencyKey,
      })
      setPendingAction(null)
      form.reset({ reason: '' })
      pushToast(
        `Decisión "${ACTION_META[action].label}" guardada en el historial.`,
        'success',
      )
    },
  )

  const kpis = useMemo(() => {
    const all = allReportsQuery.data ?? []
    return {
      pending: all.filter(
        (r) => r.report.status === 'pending' || r.report.status === 'in_review',
      ).length,
      attended: all.filter((r) => r.report.status === 'attended').length,
      auditTotal: auditQuery.data?.length ?? 0,
    }
  }, [allReportsQuery.data, auditQuery.data])

  const triggerActionWithValidation = (action: ModerationActionType) => {
    void form.handleSubmit(
      (values) => {
        setPendingAction({ action, reason: values.reason })
      },
      () => {
        form.setFocus('reason')
      },
    )()
  }

  const trimmedReasonLen = (reasonValue ?? '').trim().length

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="SEGURIDAD Y CONFIANZA"
        title="Moderación de Contenido"
        subtitle="Elige un reporte de la izquierda, lee el contenido señalado, escribe tu motivo y decide si se oculta, se retira o se desestima."
        actions={
          <div className="flex flex-wrap items-center gap-3">
            <Button
              variant="ghost"
              size="sm"
              leftIcon="arrow_back"
              onClick={() => navigate('/casos')}
            >
              Volver a Casos
            </Button>
            <div className="grid grid-cols-3 gap-2.5">
              <div className="rounded-xl bg-surface-container-lowest px-3.5 py-2.5 shadow-xs">
                <p className="text-[10px] font-bold uppercase tracking-wider text-secondary">
                  Pendientes
                </p>
                <p className="mt-0.5 font-headline text-2xl font-bold text-primary">
                  {kpis.pending}
                </p>
              </div>
              <div className="rounded-xl bg-surface-container-lowest px-3.5 py-2.5 shadow-xs">
                <p className="text-[10px] font-bold uppercase tracking-wider text-secondary">
                  Atendidos
                </p>
                <p className="mt-0.5 font-headline text-2xl font-bold text-on-surface">
                  {kpis.attended}
                </p>
              </div>
              <div className="rounded-xl bg-surface-container-low px-3.5 py-2.5">
                <p className="text-[10px] font-bold uppercase tracking-wider text-secondary">
                  Historial
                </p>
                <p className="mt-0.5 font-headline text-2xl font-bold text-on-surface">
                  {kpis.auditTotal}
                </p>
              </div>
            </div>
          </div>
        }
      />

      {reportsQuery.isLoading ? (
        <PageLoadingSkeleton />
      ) : reportsQuery.isError ? (
        <ErrorState
          message={mapDomainErrorToUI(reportsQuery.error).message}
          onRetry={() => void reportsQuery.refetch()}
        />
      ) : (
        <div className="grid grid-cols-1 items-start gap-8 lg:grid-cols-12">
          {/* Left Column: Report Queue */}
          <section className="min-w-0 rounded-2xl bg-surface-container-low p-5 sm:p-6 lg:col-span-5">
            <div className="mb-4 flex items-center justify-between gap-2">
              <h2 className="font-headline text-2xl font-bold text-on-surface">
                Reportes Recibidos
              </h2>
              <Badge tone="secondary">
                {reportsQuery.data?.length ?? 0} reportes
              </Badge>
            </div>

            <div
              role="tablist"
              aria-label="Filtrar reportes por estado"
              className="mb-5 flex flex-wrap gap-1.5"
            >
              {STATUS_TABS.map((tab) => {
                const active = statusFilter === tab.value
                return (
                  <button
                    key={tab.value}
                    type="button"
                    role="tab"
                    aria-selected={active}
                    onClick={() => setStatusFilter(tab.value)}
                    className={`rounded-full px-3 py-1.5 text-xs font-semibold transition-colors cursor-pointer ${
                      active
                        ? 'bg-primary text-on-primary shadow-xs'
                        : 'bg-surface-container-lowest text-on-surface-variant hover:bg-surface-container-high'
                    }`}
                  >
                    {tab.label}
                  </button>
                )
              })}
            </div>

            {!reportsQuery.data || reportsQuery.data.length === 0 ? (
              <EmptyState
                icon="shield"
                title="No hay reportes en esta pestaña"
                description="Selecciona otra pestaña o pulsa el botón para ver todos los reportes."
                actionLabel="Ver todos los reportes"
                onAction={() => setStatusFilter('all')}
              />
            ) : (
              <div className="space-y-3">
                {reportsQuery.data.map((item) => {
                  const isSelected = selectedDetail?.report.id === item.report.id
                  const targetLabel = item.report.target_type
                    ? TARGET_LABELS[item.report.target_type]
                    : 'Contenido'

                  return (
                    <button
                      key={item.report.id}
                      type="button"
                      onClick={() => navigate(`/moderacion/${item.report.id}`)}
                      className={`relative w-full overflow-hidden rounded-xl p-4 text-left transition-all cursor-pointer ${
                        isSelected
                          ? 'bg-surface-container-lowest shadow-[0_4px_20px_rgba(194,101,42,0.12)] ring-2 ring-primary'
                          : 'bg-surface-container-lowest/70 hover:bg-surface-container-lowest'
                      }`}
                    >
                      {isSelected && (
                        <span
                          aria-hidden="true"
                          className="absolute inset-y-2 left-0 w-1 rounded-r-full bg-primary"
                        />
                      )}
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="font-mono text-xs font-bold text-primary">
                          {item.report.folio} · {targetLabel}
                        </span>
                        <CaseStatusBadge status={item.report.status} />
                      </div>
                      <p className="mt-1.5 text-sm font-bold text-on-surface">
                        {item.offender?.full_name ?? 'Usuario reportado'}
                      </p>
                      <p className="mt-1 line-clamp-2 text-xs text-on-surface-variant">
                        {item.report.subject}
                      </p>
                      <div className="mt-2.5 flex items-center justify-between text-[11px] text-secondary">
                        <span>
                          {item.offenderSanctionsCount} sanciones previas
                        </span>
                        <span>
                          {formatRelativeTimeES(item.report.created_at)}
                        </span>
                      </div>
                    </button>
                  )
                })}
              </div>
            )}
          </section>

          {/* Right Column: Inspection Panel + Audit Log */}
          <div className="min-w-0 space-y-8 lg:col-span-7">
            {selectedDetail ? (
              <section className="rounded-2xl bg-surface-container-lowest p-6 shadow-xs sm:p-7 space-y-6">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-mono text-xs font-bold uppercase tracking-wider text-primary">
                      {selectedDetail.report.folio} ·{' '}
                      {selectedDetail.report.target_type
                        ? TARGET_LABELS[selectedDetail.report.target_type]
                        : 'Contenido'}
                    </p>
                    <h2 className="mt-1 font-headline text-3xl font-bold text-on-surface">
                      Revisión del Contenido Reportado
                    </h2>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <ModerationStatusBadge
                      status={selectedDetail.targetModerationStatus}
                    />
                    <CaseStatusBadge status={selectedDetail.report.status} />
                  </div>
                </div>

                {/* Report Reason Banner */}
                <div className="flex items-start gap-3 rounded-xl bg-tertiary-fixed/55 p-4">
                  <Icon
                    name="flag"
                    filled
                    className="mt-0.5 shrink-0 text-tertiary"
                  />
                  <div>
                    <p className="text-[11px] font-bold uppercase tracking-wider text-on-tertiary-fixed">
                      ¿Por qué fue reportado?
                    </p>
                    <p className="mt-1 text-sm font-semibold text-on-tertiary-fixed">
                      {selectedDetail.report.subject}
                    </p>
                    <p className="mt-0.5 text-xs text-on-tertiary-fixed-variant">
                      {selectedDetail.report.description}
                    </p>
                  </div>
                </div>

                {/* Reported Content Box */}
                <div className="space-y-4 rounded-xl bg-surface-container-low p-5">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-secondary">
                    Texto e imagen publicados por el usuario
                  </p>
                  <blockquote className="rounded-lg bg-surface-container-lowest p-4 text-sm leading-relaxed text-on-surface whitespace-pre-wrap break-words">
                    {selectedDetail.targetContentText}
                  </blockquote>
                  {selectedDetail.targetContentImageUrl && (
                    <div className="h-52 overflow-hidden rounded-xl bg-surface-container">
                      <img
                        src={selectedDetail.targetContentImageUrl}
                        alt={`Evidencia de ${selectedDetail.report.folio}`}
                        loading="lazy"
                        className="h-full w-full object-cover"
                      />
                    </div>
                  )}
                </div>

                {/* Offender Summary */}
                {selectedDetail.offender && (
                  <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl bg-surface-container-low/70 p-4">
                    <div className="flex items-center gap-3 min-w-0">
                      <Avatar
                        name={selectedDetail.offender.full_name}
                        tone="tertiary"
                        size="md"
                      />
                      <div className="min-w-0">
                        <p className="truncate text-sm font-bold text-on-surface">
                          {selectedDetail.offender.full_name}
                        </p>
                        <p className="truncate text-xs text-on-surface-variant">
                          {selectedDetail.offender.email} ·{' '}
                          {selectedDetail.offender.code}
                        </p>
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-3">
                      <Badge tone="tertiary">
                        {selectedDetail.offenderReportsCount} reportes ·{' '}
                        {selectedDetail.offenderSanctionsCount} sanciones
                      </Badge>
                      <Link
                        to={`/cuentas/${selectedDetail.offender.id}`}
                        className="inline-flex items-center gap-1 text-xs font-bold text-primary hover:underline"
                      >
                        <span>Ir a sancionar cuenta</span>
                        <Icon name="arrow_forward" className="text-[14px]" />
                      </Link>
                    </div>
                  </div>
                )}

                {/* Poka-Yoke Guided Step 1 -> Step 2 */}
                <div className="space-y-4 border-t border-outline-variant/40 pt-5">
                  <div>
                    <Textarea
                      label="Paso 1 · Escribe el motivo de tu decisión"
                      htmlFor="moderation-reason"
                      rows={3}
                      required
                      placeholder="Ejemplo: La publicación invita a realizar pagos fuera de la aplicación, lo cual incumple las normas de seguridad..."
                      error={form.formState.errors.reason?.message}
                      {...form.register('reason')}
                    />
                    <p className="mt-1 text-right text-[11px] text-secondary">
                      {trimmedReasonLen} / 8 caracteres mínimos
                    </p>
                  </div>

                  <div className="space-y-2">
                    <p className="text-[11px] font-bold uppercase tracking-wider text-on-surface-variant">
                      Paso 2 · Elige qué hacer con este contenido
                    </p>
                    <div className="flex flex-wrap gap-3">
                      <Button
                        variant="secondary"
                        leftIcon="visibility_off"
                        onClick={() => triggerActionWithValidation('hide')}
                      >
                        Ocultar temporalmente
                      </Button>
                      <Button
                        variant="tertiary"
                        leftIcon="delete_forever"
                        onClick={() => triggerActionWithValidation('remove')}
                      >
                        Retirar definitivamente
                      </Button>
                      {selectedDetail.targetModerationStatus !== 'visible' && (
                        <Button
                          variant="primary"
                          leftIcon="restore"
                          onClick={() => triggerActionWithValidation('restore')}
                        >
                          Volver a mostrar
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        leftIcon="check_circle"
                        onClick={() => triggerActionWithValidation('dismiss')}
                      >
                        Desestimar reporte
                      </Button>
                    </div>
                  </div>
                </div>
              </section>
            ) : (
              <EmptyState
                icon="shield"
                title="Selecciona un reporte"
                description="Haz clic en un reporte de la lista izquierda para revisar su contenido."
              />
            )}

            {/* Audit Log */}
            <section className="rounded-2xl bg-surface-container-low p-6">
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-widest text-secondary">
                    Registro Permanente
                  </p>
                  <h3 className="mt-0.5 font-headline text-2xl font-bold text-on-surface">
                    Historial de Decisiones de Moderación
                  </h3>
                </div>
                <Icon name="history" className="text-secondary" />
              </div>

              {!auditQuery.data || auditQuery.data.length === 0 ? (
                <p className="text-sm text-on-surface-variant">
                  Aún no se han registrado decisiones de moderación.
                </p>
              ) : (
                <ul className="space-y-3">
                  {auditQuery.data.map((entry) => (
                    <li
                      key={entry.id}
                      className="rounded-xl bg-surface-container-lowest p-4 shadow-xs"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <span
                            className={`h-2 w-2 rounded-full ${
                              entry.action === 'remove'
                                ? 'bg-tertiary'
                                : entry.action === 'hide'
                                  ? 'bg-primary'
                                  : 'bg-secondary'
                            }`}
                          />
                          <span className="text-sm font-bold text-on-surface">
                            {ACTION_META[entry.action].label} —{' '}
                            <span className="font-mono text-primary">
                              {entry.case_folio}
                            </span>
                          </span>
                          <Badge tone="neutral">
                            {TARGET_LABELS[entry.target_type]}
                          </Badge>
                        </div>
                        <span className="font-mono text-[11px] text-secondary">
                          {formatDateTimeMX(entry.created_at)}
                        </span>
                      </div>
                      <p className="mt-1.5 text-xs text-on-surface-variant">
                        <strong className="text-on-surface">
                          Atendido por {entry.admin_name}
                        </strong>{' '}
                        · {entry.reason}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>
        </div>
      )}

      {/* Two-Step Confirmation Modal */}
      <ConfirmActionModal
        open={pendingAction !== null && selectedDetail !== null}
        title={
          pendingAction ? ACTION_META[pendingAction.action].confirmTitle : ''
        }
        description={
          pendingAction ? ACTION_META[pendingAction.action].confirmDesc : ''
        }
        confirmLabel={
          pendingAction ? ACTION_META[pendingAction.action].label : 'Confirmar'
        }
        cancelLabel="Cancelar"
        confirmVariant={
          pendingAction ? ACTION_META[pendingAction.action].variant : 'primary'
        }
        loading={executeModeration.isPending}
        onCancel={() => setPendingAction(null)}
        onConfirm={() => {
          if (!pendingAction || !selectedDetail) return
          void executeModeration
            .execute(
              selectedDetail.report.id,
              pendingAction.action,
              pendingAction.reason,
            )
            .catch((err) => {
              setPendingAction(null)
              pushToast(mapDomainErrorToUI(err).message, 'error')
            })
        }}
        details={
          pendingAction &&
          selectedDetail && (
            <div className="space-y-1.5 text-xs">
              <p>
                <strong>Reporte:</strong> {selectedDetail.report.folio}
              </p>
              <p>
                <strong>Motivo escrito:</strong> {pendingAction.reason}
              </p>
            </div>
          )
        }
      />
    </div>
  )
}

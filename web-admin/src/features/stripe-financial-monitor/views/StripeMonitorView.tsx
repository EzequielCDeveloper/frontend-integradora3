import { useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Badge } from '@/shared/components/atoms/Badge'
import { Button } from '@/shared/components/atoms/Button'
import { Input } from '@/shared/components/atoms/FormControls'
import { Icon } from '@/shared/components/atoms/Icon'
import { ConfirmActionModal } from '@/shared/components/molecules/ConfirmActionModal'
import {
  EmptyState,
  ErrorState,
  PageLoadingSkeleton,
} from '@/shared/components/molecules/FeedbackStates'
import { PaymentStatusBadge } from '@/shared/components/molecules/StatusBadge'
import { PageHeader } from '@/shared/components/templates/PageHeader'
import { useIdempotentAction } from '@/shared/hooks/useIdempotentAction'
import { useToastStore } from '@/shared/hooks/useToast'
import { RETRYABLE_PAYMENT_STATUSES } from '@/shared/mocks/mock-backend.store'
import type { Payment, PaymentStatus } from '@/shared/types/domain.types'
import { mapDomainErrorToUI } from '@/shared/utils/error-mapper'
import { formatCurrencyMXN, formatDateTimeMX } from '@/shared/utils/format'
import {
  useRetryStripeOperation,
  useStripeMonitorSnapshot,
  useSyncStripeEvents,
} from '../hooks/useStripeMonitor'

const STATUS_PILLS: ReadonlyArray<{
  value: PaymentStatus | 'all'
  label: string
}> = [
  { value: 'all', label: 'Todos' },
  { value: 'transfer_failed', label: 'Transferencia fallida' },
  { value: 'transfer_pending', label: 'Envío en proceso' },
  { value: 'confirmed', label: 'En resguardo' },
  { value: 'in_claim', label: 'En reclamación' },
  { value: 'transferred', label: 'Transferido' },
  { value: 'refunded', label: 'Reembolsado' },
]

const EVENT_TYPE_LABELS: Record<string, string> = {
  'transfer.failed': 'Fallo al depositar al trabajador',
  'payment_intent.succeeded': 'Pago asegurado en resguardo',
  'transfer.created': 'Depósito enviado al trabajador',
  'charge.refunded': 'Reembolso devuelto al empleador',
  'charge.refund.updated': 'Actualización de reembolso',
}

export function StripeMonitorView() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const pushToast = useToastStore((s) => s.push)

  const [statusFilter, setStatusFilter] = useState<PaymentStatus | 'all'>('all')
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
  const [retryTarget, setRetryTarget] = useState<Payment | null>(null)
  const [expandedEventId, setExpandedEventId] = useState<string | null>(null)

  const snapshotQuery = useStripeMonitorSnapshot(statusFilter)
  const retryMutation = useRetryStripeOperation()
  const syncMutation = useSyncStripeEvents()

  const retryAction = useIdempotentAction(
    'retry-stripe-payment',
    async (idempotencyKey, payment: Payment) => {
      await retryMutation.mutateAsync({
        payment_id: payment.id,
        idempotency_key: idempotencyKey,
      })
      setRetryTarget(null)
      pushToast(
        `Se inició un nuevo intento de depósito para ${payment.beneficiary_name}.`,
        'success',
      )
    },
  )

  const syncAction = useIdempotentAction('sync-stripe', async () => {
    await syncMutation.mutateAsync()
    pushToast('Lista de pagos y avisos actualizada.', 'info')
  })

  const filteredPayments = useMemo(() => {
    const list = snapshotQuery.data?.payments ?? []
    const q = search.trim().toLowerCase()
    if (!q) return list
    return list.filter((p) =>
      [
        p.stripe_payment_intent_id,
        p.beneficiary_name,
        p.case_folio ?? '',
        p.status,
      ]
        .join(' ')
        .toLowerCase()
        .includes(q),
    )
  }, [search, snapshotQuery.data?.payments])

  const filteredWebhooks = useMemo(() => {
    const list = snapshotQuery.data?.webhooks ?? []
    const q = search.trim().toLowerCase()
    if (!q) return list
    return list.filter((evt) =>
      [evt.id, evt.event_type, evt.payment_intent_id ?? '', evt.summary]
        .join(' ')
        .toLowerCase()
        .includes(q),
    )
  }, [search, snapshotQuery.data?.webhooks])

  if (snapshotQuery.isLoading) {
    return <PageLoadingSkeleton />
  }

  if (snapshotQuery.isError) {
    return (
      <ErrorState
        message={mapDomainErrorToUI(snapshotQuery.error).message}
        onRetry={() => void snapshotQuery.refetch()}
      />
    )
  }

  const snapshot = snapshotQuery.data!

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="FINANZAS / PAGOS Y TRANSFERENCIAS"
        liveTag="PASARELA ACTIVA"
        title="Pagos y Transferencias"
        subtitle="Supervisa el dinero retenido en resguardo, los pagos ya depositados y reintenta manualmente cualquier transferencia fallida."
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
            <div className="flex items-center gap-2 rounded-lg bg-surface-container-low px-3.5 py-2 text-xs">
              <Icon name="verified_user" className="text-primary text-[18px]" />
              <span className="font-semibold text-on-surface">
                Conexión segura verificada
              </span>
            </div>
            <Button
              leftIcon="sync"
              loading={syncAction.isPending}
              loadingText="Actualizando..."
              onClick={() => {
                void syncAction
                  .execute()
                  .catch((err) =>
                    pushToast(mapDomainErrorToUI(err).message, 'error'),
                  )
              }}
            >
              Actualizar datos
            </Button>
          </div>
        }
      />

      {/* Asymmetric Bento Financial KPIs */}
      <section className="grid grid-cols-1 items-stretch gap-6 lg:grid-cols-12">
        <article className="flex flex-col justify-between rounded-xl bg-surface-container-lowest p-6 shadow-xs sm:p-7 lg:col-span-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-widest text-secondary">
                Dinero en Resguardo
              </p>
              <p className="mt-2 font-headline text-3xl sm:text-4xl font-bold text-on-surface">
                {formatCurrencyMXN(snapshot.escrowTotalMxn)}
              </p>
            </div>
            <Badge tone="primary">Protegido</Badge>
          </div>
          <p className="mt-4 text-xs text-on-surface-variant">
            {snapshot.escrowCount} pagos cobrados que esperan confirmación de
            entrega o resolución de disputa.
          </p>
        </article>

        <article className="flex flex-col justify-between rounded-xl bg-surface-container-low p-6 sm:p-7 lg:col-span-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-widest text-secondary">
                Pagos Completados
              </p>
              <p className="mt-2 font-headline text-3xl sm:text-4xl font-bold text-on-surface">
                {formatCurrencyMXN(snapshot.completedTotalMxn)}
              </p>
            </div>
            <Icon
              name="check_circle"
              filled
              className="text-primary text-[24px]"
            />
          </div>
          <div className="mt-4 space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="text-on-surface-variant">
                {snapshot.completedCount} depósitos entregados
              </span>
              <strong className="font-mono text-on-surface">
                {snapshot.successRatePct}% éxito
              </strong>
            </div>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-container-highest">
              <div
                className="h-full rounded-full bg-primary"
                style={{ width: `${snapshot.successRatePct}%` }}
              />
            </div>
          </div>
        </article>

        <article className="flex flex-col justify-between rounded-xl bg-error-container p-6 sm:p-7 lg:col-span-3">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-widest text-on-error-container">
                Pagos Fallidos
              </p>
              <p className="mt-2 font-headline text-3xl font-bold text-on-error-container">
                {snapshot.failedCount} pagos
              </p>
            </div>
            <Icon name="warning" className="text-error text-[24px]" />
          </div>
          <div className="mt-4 space-y-1">
            <p className="text-xs font-semibold text-on-error-container">
              {formatCurrencyMXN(snapshot.failedRetainedMxn)} pendientes de
              reintento
            </p>
            <a
              href="#tabla-transacciones"
              className="inline-block text-xs font-bold text-error hover:underline"
            >
              Ir a revisar y reintentar ↓
            </a>
          </div>
        </article>
      </section>

      {/* Transactions Table */}
      <section
        id="tabla-transacciones"
        className="space-y-4 rounded-xl bg-surface-container-lowest p-5 shadow-xs sm:p-6"
      >
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-widest text-secondary">
              Control de Movimientos
            </p>
            <h2 className="mt-1 font-headline text-2xl font-bold text-on-surface">
              Listado de Pagos y Reintentos
            </h2>
          </div>
          <div className="w-full max-w-sm">
            <Input
              htmlFor="stripe-search"
              leftIcon="search"
              placeholder="Buscar por beneficiario, folio o referencia..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>

        {/* Human Spanish Status Filter Pills */}
        <div className="flex flex-wrap gap-2">
          {STATUS_PILLS.map((pill) => {
            const active = statusFilter === pill.value
            return (
              <button
                key={pill.value}
                type="button"
                onClick={() => setStatusFilter(pill.value)}
                className={`rounded-full px-3.5 py-1.5 text-xs font-semibold transition-colors cursor-pointer ${
                  active
                    ? 'bg-on-surface text-surface'
                    : 'bg-surface-container-low text-on-surface-variant hover:bg-surface-container-high'
                }`}
              >
                {pill.label}
              </button>
            )
          })}
        </div>

        {filteredPayments.length === 0 ? (
          <EmptyState
            icon="payments"
            title="No encontramos pagos con ese filtro"
            description="Cambia el estado seleccionado o limpia la búsqueda para ver todos los movimientos."
            actionLabel="Mostrar todos los pagos"
            onAction={() => {
              setStatusFilter('all')
              setSearch('')
            }}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-outline-variant/40 bg-surface-container-low/60 text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">
                  <th scope="col" className="px-3 py-3">
                    Referencia de Pago
                  </th>
                  <th scope="col" className="px-3 py-3">
                    Beneficiario y Caso
                  </th>
                  <th scope="col" className="px-3 py-3">
                    Monto Total
                  </th>
                  <th scope="col" className="px-3 py-3">
                    Estado
                  </th>
                  <th scope="col" className="px-2 py-3 text-center">
                    Intentos
                  </th>
                  <th scope="col" className="px-3 py-3 text-right">
                    Acción
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant/30">
                {filteredPayments.map((pay) => {
                  const canRetry = RETRYABLE_PAYMENT_STATUSES.includes(
                    pay.status,
                  )
                  const isRefunded = pay.status === 'refunded'

                  return (
                    <tr
                      key={pay.id}
                      className="hover:bg-surface-container-low/50 transition-colors"
                    >
                      <td className="px-3 py-3.5 font-mono text-[11px] font-semibold text-on-surface whitespace-nowrap">
                        {pay.stripe_payment_intent_id}
                      </td>
                      <td className="px-3 py-3.5 max-w-[200px]">
                        <p className="truncate font-semibold text-on-surface">
                          {pay.beneficiary_name}
                        </p>
                        <p
                          className="truncate text-[11px] text-on-surface-variant"
                          title={pay.failure_reason ?? undefined}
                        >
                          {pay.case_folio ?? 'Sin caso asociado'}
                          {pay.failure_reason ? ` · ${pay.failure_reason}` : ''}
                        </p>
                      </td>
                      <td className="px-3 py-3.5 font-mono text-xs whitespace-nowrap">
                        <p
                          className={`font-bold ${
                            isRefunded
                              ? 'line-through text-secondary'
                              : 'text-on-surface'
                          }`}
                        >
                          {formatCurrencyMXN(pay.total_charged_mxn)}
                        </p>
                        <p className="text-[10px] text-secondary">
                          Trabajo: {formatCurrencyMXN(pay.job_amount_mxn)}
                        </p>
                      </td>
                      <td className="px-3 py-3.5">
                        <PaymentStatusBadge status={pay.status} />
                      </td>
                      <td className="px-2 py-3.5 text-center font-mono text-[11px] text-on-surface-variant whitespace-nowrap">
                        {pay.payment_attempts} de 5
                      </td>
                      <td className="px-3 py-3.5 text-right whitespace-nowrap">
                        {canRetry ? (
                          <Button
                            size="sm"
                            leftIcon="refresh"
                            onClick={() => setRetryTarget(pay)}
                          >
                            Reintentar pago
                          </Button>
                        ) : pay.status === 'transfer_pending' ||
                          pay.status === 'partial_settlement_pending' ? (
                          <span className="text-xs font-semibold italic text-primary">
                            En proceso
                          </span>
                        ) : pay.status === 'transferred' ||
                          pay.status === 'partial_settlement_completed' ? (
                          <span className="text-xs text-secondary">
                            Completado
                          </span>
                        ) : isRefunded ? (
                          <span className="text-xs text-tertiary">
                            Reembolsado
                          </span>
                        ) : (
                          <span className="text-xs text-secondary">
                            En resguardo
                          </span>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Verified Payment Notifications Log */}
      <section className="rounded-xl bg-surface-container-low p-6 space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-widest text-secondary">
              Historial de Notificaciones Bancarias
            </p>
            <h2 className="mt-1 font-headline text-2xl font-bold text-on-surface">
              Avisos de Pago Recibidos y Verificados
            </h2>
          </div>
          <span className="text-xs text-secondary">
            El sistema reintenta automáticamente hasta 3 veces en 24h antes de
            crear un ticket técnico.
          </span>
        </div>

        {filteredWebhooks.length === 0 ? (
          <p className="text-sm text-on-surface-variant">
            No hay avisos de pago que coincidan con tu búsqueda.
          </p>
        ) : (
          <ul className="space-y-3">
            {filteredWebhooks.map((evt) => {
              const isExpanded = expandedEventId === evt.id
              const isAlert = Boolean(evt.error_message)
              const friendlyEventTitle =
                EVENT_TYPE_LABELS[evt.event_type] ?? evt.event_type

              return (
                <li
                  key={evt.id}
                  className="rounded-xl bg-surface-container-lowest p-4 shadow-xs"
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-start gap-3 min-w-0">
                      <div
                        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${
                          isAlert
                            ? 'bg-error-container text-error'
                            : 'bg-primary-fixed text-primary'
                        }`}
                      >
                        <Icon
                          name={isAlert ? 'error_outline' : 'verified'}
                          className="text-[18px]"
                        />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-bold text-on-surface">
                          {friendlyEventTitle}
                        </p>
                        <p className="mt-0.5 text-xs text-on-surface-variant">
                          {evt.summary} ·{' '}
                          <span className="font-mono text-[11px] text-secondary">
                            {evt.id}
                          </span>
                        </p>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-3">
                      <span className="font-mono text-[11px] text-secondary">
                        {formatDateTimeMX(evt.received_at)}
                      </span>
                      <Badge tone={isAlert ? 'error' : 'secondary'}>
                        {isAlert ? 'Requiere atención' : 'Recibido correctamente'}
                      </Badge>
                      <button
                        type="button"
                        onClick={() =>
                          setExpandedEventId(isExpanded ? null : evt.id)
                        }
                        className="text-xs font-semibold text-primary hover:underline cursor-pointer"
                      >
                        {isExpanded ? 'Ocultar detalle' : 'Ver detalle técnico'}
                      </button>
                    </div>
                  </div>

                  {isExpanded && (
                    <pre className="mt-3 overflow-x-auto rounded-lg bg-surface-container-low p-3 font-mono text-[11px] text-on-surface">
                      {JSON.stringify(evt.payload, null, 2)}
                    </pre>
                  )}
                </li>
              )
            })}
          </ul>
        )}
      </section>

      {/* Two-Step Confirmation: Manual Retry */}
      <ConfirmActionModal
        open={retryTarget !== null}
        title="¿Confirmas reintentar este depósito ahora?"
        description="Se enviará un nuevo intento seguro de pago sin riesgo de cobrar o depositar dos veces."
        confirmLabel="Sí, reintentar pago"
        cancelLabel="Cancelar"
        loading={retryAction.isPending}
        onCancel={() => setRetryTarget(null)}
        onConfirm={() => {
          if (!retryTarget) return
          void retryAction.execute(retryTarget).catch((err) => {
            setRetryTarget(null)
            pushToast(mapDomainErrorToUI(err).message, 'error')
          })
        }}
        details={
          retryTarget && (
            <div className="space-y-1.5 text-xs">
              <p>
                <strong>Beneficiario:</strong> {retryTarget.beneficiary_name}
              </p>
              <p>
                <strong>Referencia de pago:</strong>{' '}
                <span className="font-mono">
                  {retryTarget.stripe_payment_intent_id}
                </span>
              </p>
              <p>
                <strong>Monto a depositar:</strong>{' '}
                <span className="font-mono">
                  {formatCurrencyMXN(retryTarget.job_amount_mxn)}
                </span>
              </p>
              <p>
                <strong>Intentos previos:</strong>{' '}
                {retryTarget.payment_attempts} de 5
              </p>
            </div>
          )
        }
      />
    </div>
  )
}

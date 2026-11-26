import { zodResolver } from '@hookform/resolvers/zod'
import { useEffect, useState } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useAdminSession } from '@/features/admin-auth'
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
  PaymentStatusBadge,
} from '@/shared/components/molecules/StatusBadge'
import { PageHeader } from '@/shared/components/templates/PageHeader'
import { useCountdown } from '@/shared/hooks/useCountdown'
import { useIdempotentAction } from '@/shared/hooks/useIdempotentAction'
import { useToastStore } from '@/shared/hooks/useToast'
import type { CaseDecision } from '@/shared/types/domain.types'
import { mapDomainErrorToUI } from '@/shared/utils/error-mapper'
import {
  formatCurrencyMXN,
  formatDateTimeMX,
  formatFileSize,
  roundToCents,
} from '@/shared/utils/format'
import { openSafeExternalUrl } from '@/shared/utils/safe-url'
import {
  useAssignClaimToAdmin,
  useClaimDossier,
  useClaimsList,
  useCloseClaimAndExecutePayout,
  useResolveClaim,
  useSimulateClaimObjection,
} from '../hooks/useClaimArbitration'
import {
  resolveClaimSchema,
  type ResolveClaimFormValues,
} from '../schemas/arbitration.schema'

const DECISION_LABELS: Record<CaseDecision, string> = {
  transfer_full: 'Pagar el 100% del trabajo al trabajador',
  refund_full: 'Devolver el 100% cobrado al empleador',
  partial: 'Dividir el total entre trabajador y empleador',
}

const TIMELINE_STATE_LABELS: Record<string, string> = {
  published: 'Trabajo publicado',
  confirmed: 'Pago resguardado',
  completion_requested: 'Entrega solicitada',
  in_claim: 'Reclamación abierta',
  in_review: 'En revisión',
  resolved: 'Decisión emitida',
  closed: 'Caso cerrado',
  completed: 'Trabajo completado',
  cancelled: 'Trabajo cancelado',
}

export function ClaimArbitrationView() {
  const { caseId } = useParams<{ caseId: string }>()
  const navigate = useNavigate()
  const session = useAdminSession()
  const pushToast = useToastStore((s) => s.push)

  const claimsQuery = useClaimsList()
  const activeCaseId = caseId ?? claimsQuery.data?.[0]?.id
  const dossierQuery = useClaimDossier(activeCaseId)

  const assignMutation = useAssignClaimToAdmin()
  const resolveMutation = useResolveClaim()
  const closeMutation = useCloseClaimAndExecutePayout()
  const objectionMutation = useSimulateClaimObjection()

  const [pendingConfirm, setPendingConfirm] =
    useState<ResolveClaimFormValues | null>(null)
  const [closeModalOpen, setCloseModalOpen] = useState(false)
  const [objectionModalOpen, setObjectionModalOpen] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  const dossier = dossierQuery.data
  const countdown = useCountdown(dossier?.caseRecord.auto_close_deadline)

  const form = useForm<ResolveClaimFormValues>({
    resolver: zodResolver(resolveClaimSchema),
    mode: 'onBlur',
    defaultValues: {
      decision: 'transfer_full',
      approved_transfer_amount: 0,
      approved_refund_amount: 0,
      resolution_notes: '',
    },
  })

  const selectedDecision = useWatch({
    control: form.control,
    name: 'decision',
  })
  const transferAmount = useWatch({
    control: form.control,
    name: 'approved_transfer_amount',
  })
  const refundAmount = useWatch({
    control: form.control,
    name: 'approved_refund_amount',
  })
  const notesValue = useWatch({
    control: form.control,
    name: 'resolution_notes',
  })

  useEffect(() => {
    if (!dossier) return
    const { payment } = dossier
    if (selectedDecision === 'transfer_full') {
      form.setValue('approved_transfer_amount', payment.job_amount_mxn)
      form.setValue('approved_refund_amount', 0)
    } else if (selectedDecision === 'refund_full') {
      form.setValue('approved_transfer_amount', 0)
      form.setValue('approved_refund_amount', payment.total_charged_mxn)
    } else {
      const currentSum = roundToCents(
        (Number(transferAmount) || 0) + (Number(refundAmount) || 0),
      )
      if (
        currentSum !== payment.total_charged_mxn ||
        transferAmount <= 0 ||
        refundAmount <= 0
      ) {
        const half = roundToCents(payment.total_charged_mxn / 2)
        const remainder = roundToCents(payment.total_charged_mxn - half)
        form.setValue('approved_transfer_amount', half)
        form.setValue('approved_refund_amount', remainder)
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dossier?.caseRecord.id, selectedDecision])

  const takeCaseAction = useIdempotentAction(
    'assign-claim-self',
    async (idempotencyKey, targetCaseId: string) => {
      if (!session) return
      await assignMutation.mutateAsync({
        caseId: targetCaseId,
        adminId: session.admin.id,
        idempotencyKey,
      })
      pushToast(
        'Reclamación asignada a tu nombre. Ya puedes leer la conversación y emitir tu decisión.',
        'success',
      )
    },
  )

  const confirmResolveAction = useIdempotentAction(
    'resolve-claim',
    async (idempotencyKey, values: ResolveClaimFormValues) => {
      if (!dossier) return
      setFormError(null)
      await resolveMutation.mutateAsync({
        case_id: dossier.caseRecord.id,
        decision: values.decision,
        approved_transfer_amount: roundToCents(values.approved_transfer_amount),
        approved_refund_amount: roundToCents(values.approved_refund_amount),
        resolution_notes: values.resolution_notes,
        idempotency_key: idempotencyKey,
      })
      setPendingConfirm(null)
      form.reset({
        decision: 'transfer_full',
        approved_transfer_amount: dossier.payment.job_amount_mxn,
        approved_refund_amount: 0,
        resolution_notes: '',
      })
      pushToast(
        'Decisión guardada y notificada. Comenzó el plazo de 7 días para aclaraciones.',
        'success',
      )
    },
  )

  const confirmCloseAction = useIdempotentAction(
    'close-claim-payout',
    async (idempotencyKey) => {
      if (!dossier) return
      await closeMutation.mutateAsync({
        case_id: dossier.caseRecord.id,
        idempotency_key: idempotencyKey,
      })
      setCloseModalOpen(false)
      pushToast(
        'Reclamación cerrada. El envío o reembolso del dinero ya fue programado.',
        'success',
      )
    },
  )

  const objectionAction = useIdempotentAction(
    'object-claim',
    async (idempotencyKey) => {
      if (!dossier) return
      await objectionMutation.mutateAsync({
        caseId: dossier.caseRecord.id,
        idempotencyKey,
      })
      setObjectionModalOpen(false)
      pushToast(
        'La reclamación volvió a En revisión. El dinero seguirá retenido hasta la nueva decisión.',
        'info',
      )
    },
  )

  const handlePartialTransferChange = (raw: string) => {
    if (!dossier) return
    const parsed = Number(raw)
    if (!Number.isFinite(parsed)) {
      form.setValue('approved_transfer_amount', 0)
      return
    }
    const clamped = Math.max(
      0,
      Math.min(dossier.payment.total_charged_mxn, roundToCents(parsed)),
    )
    const remaining = roundToCents(dossier.payment.total_charged_mxn - clamped)
    form.setValue('approved_transfer_amount', clamped)
    form.setValue('approved_refund_amount', remaining)
  }

  const handlePartialRefundChange = (raw: string) => {
    if (!dossier) return
    const parsed = Number(raw)
    if (!Number.isFinite(parsed)) {
      form.setValue('approved_refund_amount', 0)
      return
    }
    const clamped = Math.max(
      0,
      Math.min(dossier.payment.total_charged_mxn, roundToCents(parsed)),
    )
    const remaining = roundToCents(dossier.payment.total_charged_mxn - clamped)
    form.setValue('approved_refund_amount', clamped)
    form.setValue('approved_transfer_amount', remaining)
  }

  const handlePreSubmit = form.handleSubmit((values) => {
    if (!dossier) return
    const total = dossier.payment.total_charged_mxn
    if (values.decision === 'partial') {
      const sum = roundToCents(
        values.approved_transfer_amount + values.approved_refund_amount,
      )
      if (
        values.approved_transfer_amount <= 0 ||
        values.approved_refund_amount <= 0 ||
        sum !== total
      ) {
        setFormError(
          `Ambos montos deben ser mayores a $0.00 y juntos deben sumar exactamente ${formatCurrencyMXN(total)}.`,
        )
        return
      }
    }
    setFormError(null)
    setPendingConfirm(values)
  })

  if (claimsQuery.isLoading || (activeCaseId && dossierQuery.isLoading)) {
    return <PageLoadingSkeleton />
  }

  if (claimsQuery.isError || dossierQuery.isError) {
    const err = claimsQuery.error ?? dossierQuery.error
    return (
      <ErrorState
        message={mapDomainErrorToUI(err).message}
        onRetry={() => {
          void claimsQuery.refetch()
          void dossierQuery.refetch()
        }}
      />
    )
  }

  if (!claimsQuery.data || claimsQuery.data.length === 0 || !dossier) {
    return (
      <EmptyState
        icon="gavel"
        title="No hay reclamaciones pendientes"
        description="En este momento no existen disputas de pago por revisar. Puedes volver a la bandeja general para atender otros casos."
        actionLabel="Volver a Bandeja de Casos"
        onAction={() => navigate('/casos')}
      />
    )
  }

  const partialSum = roundToCents(
    (Number(transferAmount) || 0) + (Number(refundAmount) || 0),
  )
  const partialValid =
    transferAmount > 0 &&
    refundAmount > 0 &&
    partialSum === dossier.payment.total_charged_mxn
  const trimmedNotesLen = (notesValue ?? '').trim().length

  return (
    <div className="space-y-6">
      {/* Claim Selector Strip */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-surface-container-low p-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="px-2 text-[11px] font-bold uppercase tracking-wider text-on-surface-variant">
            Elegir reclamación:
          </span>
          {claimsQuery.data.map((claim) => {
            const isCurrent = claim.id === dossier.caseRecord.id
            return (
              <button
                key={claim.id}
                type="button"
                onClick={() => navigate(`/arbitraje/${claim.id}`)}
                className={`inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors cursor-pointer ${
                  isCurrent
                    ? 'bg-primary text-on-primary shadow-sm'
                    : 'bg-surface-container-lowest text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface'
                }`}
              >
                <span className="font-mono">{claim.folio}</span>
                <span className="max-w-[180px] truncate">{claim.subject}</span>
              </button>
            )
          })}
        </div>
        <Button
          variant="ghost"
          size="sm"
          leftIcon="arrow_back"
          onClick={() => navigate('/casos')}
        >
          Volver a Bandeja de Casos
        </Button>
      </div>

      <PageHeader
        eyebrow={`ARBITRAJE DE PAGOS • RECLAMACIÓN ${dossier.caseRecord.folio}`}
        title={dossier.job.title}
        subtitle={`Revisa las pruebas de ${dossier.employer.full_name} (empleador) y ${dossier.worker.full_name} (trabajador) para decidir cómo se entregará el dinero retenido.`}
        actions={
          <div className="flex flex-wrap items-center gap-2.5">
            <CaseStatusBadge status={dossier.caseRecord.status} />
            <PaymentStatusBadge status={dossier.payment.status} />
          </div>
        }
      />

      {/* Main 2-Column Workspace */}
      <div className="grid grid-cols-1 items-start gap-8 pb-12 lg:grid-cols-12">
        {/* Left Column: Traceability, Privacy-Guarded Chat, Evidence Gallery */}
        <div className="min-w-0 space-y-8 lg:col-span-7 xl:col-span-8">
          {/* 01 / Traceability Timeline */}
          <section className="rounded-xl bg-surface-container-low p-6 sm:p-7">
            <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-widest text-secondary">
                  Paso 1 · Revisar qué ocurrió
                </p>
                <h2 className="mt-1 font-headline text-2xl font-bold text-on-surface">
                  Historial del Trabajo y Disputa
                </h2>
              </div>
              <Badge tone="secondary" icon="verified_user">
                Trabajo {dossier.job.folio}
              </Badge>
            </div>

            <ol className="relative space-y-6 border-l-2 border-surface-container-highest pl-6">
              {dossier.statusHistory.map((item) => {
                const isClaim = item.to_state === 'in_claim'
                const isPayment = item.entity === 'payment'
                const friendlyState =
                  TIMELINE_STATE_LABELS[item.to_state] ?? item.to_state
                return (
                  <li key={item.id} className="relative">
                    <span
                      aria-hidden="true"
                      className={`absolute -left-[31px] top-1 h-3 w-3 rounded-full ring-4 ring-surface-container-low ${
                        isClaim
                          ? 'bg-tertiary'
                          : isPayment
                            ? 'bg-primary'
                            : 'bg-secondary'
                      }`}
                    />
                    <div className="flex flex-wrap items-center gap-2 text-xs text-on-surface-variant">
                      <span className="font-mono">
                        {formatDateTimeMX(item.created_at)}
                      </span>
                      <span>·</span>
                      <span className="font-semibold text-on-surface">
                        {item.actor_label}
                      </span>
                      <span className="rounded bg-surface-container-high px-2 py-0.5 text-[11px] font-medium">
                        {friendlyState}
                      </span>
                    </div>
                    <p
                      className={`mt-1 text-sm font-medium ${
                        isClaim ? 'text-tertiary' : 'text-on-surface'
                      }`}
                    >
                      {item.notes ?? friendlyState}
                    </p>
                  </li>
                )
              })}
            </ol>
          </section>

          {/* 02 / Read-Only Chat with Privacy Guard */}
          <section className="rounded-xl bg-surface-container-low p-6 sm:p-7">
            <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-widest text-secondary">
                  Paso 2 · Leer la conversación
                </p>
                <h2 className="mt-1 font-headline text-2xl font-bold text-on-surface">
                  Mensajes entre Empleador y Trabajador
                </h2>
              </div>
              <Badge tone="secondary" icon="lock">
                Solo lectura
              </Badge>
            </div>

            {dossier.chatLockedByRls ? (
              <div className="rounded-xl border border-outline-variant/60 bg-surface-container-lowest p-6 text-center">
                <div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-primary-fixed text-primary">
                  <Icon name="shield_lock" />
                </div>
                <h3 className="font-headline text-xl font-bold text-on-surface">
                  Conversación bloqueada por privacidad
                </h3>
                <p className="mx-auto mt-1.5 max-w-md text-sm text-on-surface-variant">
                  Para proteger la privacidad de los usuarios, primero debes
                  asignarte esta reclamación para poder leer sus mensajes.
                </p>
                <Button
                  className="mt-4"
                  leftIcon="assignment_ind"
                  loading={takeCaseAction.isPending}
                  loadingText="Asignando reclamación..."
                  onClick={() => {
                    void takeCaseAction
                      .execute(dossier.caseRecord.id)
                      .catch((err) =>
                        pushToast(mapDomainErrorToUI(err).message, 'error'),
                      )
                  }}
                >
                  Asignarme reclamación y desbloquear chat
                </Button>
              </div>
            ) : !dossier.chatMessages || dossier.chatMessages.length === 0 ? (
              <EmptyState
                icon="chat_bubble_outline"
                title="No hay mensajes registrados"
                description="El empleador y el trabajador no intercambiaron mensajes en este trabajo."
              />
            ) : (
              <div className="max-h-96 space-y-4 overflow-y-auto pr-1">
                {dossier.chatMessages.map((msg) => {
                  const isWorker = msg.sender_role === 'worker'
                  return (
                    <div
                      key={msg.id}
                      className={`flex flex-col ${
                        isWorker ? 'items-end' : 'items-start'
                      }`}
                    >
                      <div
                        className={`max-w-[88%] rounded-xl p-4 shadow-xs ${
                          isWorker
                            ? 'rounded-tr-none bg-surface-container'
                            : 'rounded-tl-none bg-surface-container-lowest'
                        }`}
                      >
                        <div className="mb-1.5 flex flex-wrap items-center gap-2">
                          <span className="text-xs font-bold text-on-surface">
                            {msg.sender_name}
                          </span>
                          <Badge
                            tone={isWorker ? 'primary' : 'secondary'}
                            className="text-[10px] uppercase"
                          >
                            {isWorker ? 'Trabajador' : 'Empleador'}
                          </Badge>
                          <span className="font-mono text-[11px] text-secondary">
                            {formatDateTimeMX(msg.created_at)}
                          </span>
                        </div>
                        <p className="text-sm leading-relaxed text-on-surface whitespace-pre-wrap break-words">
                          {msg.body}
                        </p>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </section>

          {/* 03 / Evidence Gallery */}
          <section className="rounded-xl bg-surface-container-low p-6 sm:p-7">
            <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-widest text-secondary">
                  Paso 3 · Revisar pruebas
                </p>
                <h2 className="mt-1 font-headline text-2xl font-bold text-on-surface">
                  Fotos y Documentos Adjuntos
                </h2>
              </div>
              <span className="text-xs text-secondary">
                Archivos JPG, PNG o PDF (máx. 5 archivos de 10 MB)
              </span>
            </div>

            {dossier.attachments.length === 0 ? (
              <EmptyState
                icon="attach_file"
                title="Sin pruebas adjuntas"
                description="Ninguna de las partes subió fotografías ni documentos en esta reclamación."
              />
            ) : (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                {dossier.attachments.map((att) => {
                  const isPdf = att.mime_type === 'application/pdf'
                  const roleLabel =
                    att.uploaded_by_role === 'employer'
                      ? 'Empleador'
                      : att.uploaded_by_role === 'worker'
                        ? 'Trabajador'
                        : 'Administrador'

                  return (
                    <article
                      key={att.id}
                      className="overflow-hidden rounded-xl bg-surface-container-lowest shadow-xs flex flex-col"
                    >
                      {isPdf ? (
                        <div className="flex h-36 flex-col items-center justify-center bg-tertiary-fixed/50 p-4 text-tertiary">
                          <Icon name="picture_as_pdf" className="text-[36px]" />
                          <span className="mt-1 font-mono text-[11px] font-semibold">
                            PDF · {formatFileSize(att.size_bytes)}
                          </span>
                        </div>
                      ) : (
                        <div className="relative h-36 bg-surface-container">
                          <img
                            src={att.preview_url}
                            alt={att.file_name}
                            loading="lazy"
                            className="h-full w-full object-cover"
                          />
                          <span className="absolute right-2 top-2 rounded-md bg-inverse-surface/80 px-2 py-0.5 font-mono text-[10px] font-semibold text-inverse-on-surface">
                            {att.mime_type === 'image/png' ? 'PNG' : 'JPG'} ·{' '}
                            {formatFileSize(att.size_bytes)}
                          </span>
                        </div>
                      )}
                      <div className="flex flex-1 flex-col justify-between p-3.5">
                        <div>
                          <p className="truncate text-xs font-bold text-on-surface">
                            {att.file_name}
                          </p>
                          <p className="mt-0.5 text-[11px] text-on-surface-variant">
                            Subido por {roleLabel}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            const opened = openSafeExternalUrl(att.preview_url)
                            if (!opened) {
                              pushToast(
                                'No se pudo abrir este enlace por seguridad.',
                                'error',
                              )
                            }
                          }}
                          className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline cursor-pointer"
                        >
                          <span>Abrir archivo</span>
                          <Icon name="open_in_new" className="text-[14px]" />
                        </button>
                      </div>
                    </article>
                  )
                })}
              </div>
            )}
          </section>
        </div>

        {/* Right Column: Sticky Payment Resolution Panel */}
        <aside className="min-w-0 lg:col-span-5 xl:col-span-4 lg:sticky lg:top-24">
          <div className="rounded-xl bg-surface-container-lowest p-6 shadow-md sm:p-7 space-y-6">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-widest text-primary">
                  Dinero en resguardo
                </p>
                <h2 className="mt-1 font-headline text-2xl font-bold text-on-surface">
                  Decisión del Pago
                </h2>
              </div>
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary-fixed text-primary">
                <Icon name="account_balance_wallet" />
              </div>
            </div>

            {/* Financial Breakdown */}
            <div className="space-y-2.5 rounded-xl bg-surface-container-low p-4 text-sm">
              <div className="flex items-center justify-between gap-2">
                <span className="text-on-surface-variant">
                  Pago del trabajo
                </span>
                <span className="shrink-0 font-mono font-semibold text-on-surface">
                  {formatCurrencyMXN(dossier.payment.job_amount_mxn)}
                </span>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-on-surface-variant">
                  Comisión de plataforma (10%)
                </span>
                <span className="shrink-0 font-mono font-semibold text-on-surface">
                  {formatCurrencyMXN(dossier.payment.platform_fee_mxn)}
                </span>
              </div>
              <div className="flex items-center justify-between gap-2 border-t border-outline-variant/60 pt-2.5">
                <span className="font-semibold text-on-surface">
                  Total cobrado y retenido
                </span>
                <span className="shrink-0 font-headline text-2xl font-bold text-primary">
                  {formatCurrencyMXN(dossier.payment.total_charged_mxn)}
                </span>
              </div>
              <p className="truncate font-mono text-[11px] text-secondary">
                Referencia: {dossier.payment.stripe_payment_intent_id}
              </p>
            </div>

            {/* State-Dependent Panel Controls */}
            {dossier.caseRecord.status === 'open' ? (
              <div className="space-y-4 rounded-xl bg-surface-container-low p-4">
                <p className="text-sm text-on-surface">
                  Esta reclamación todavía está <strong>Abierta</strong> y nadie
                  la está atendiendo. Asígnatela primero para revisar el chat y
                  decidir el pago.
                </p>
                <Button
                  className="w-full"
                  leftIcon="assignment_ind"
                  loading={takeCaseAction.isPending}
                  loadingText="Asignando a tu nombre..."
                  onClick={() => {
                    void takeCaseAction
                      .execute(dossier.caseRecord.id)
                      .catch((err) =>
                        pushToast(mapDomainErrorToUI(err).message, 'error'),
                      )
                  }}
                >
                  Tomar Reclamación para Revisar
                </Button>
              </div>
            ) : dossier.caseRecord.status === 'in_review' ? (
              <form
                onSubmit={handlePreSubmit}
                noValidate
                className="space-y-5"
              >
                <fieldset className="space-y-2.5">
                  <legend className="text-[11px] font-bold uppercase tracking-wider text-on-surface-variant">
                    1. Elige cómo distribuir el dinero
                  </legend>

                  {(
                    [
                      {
                        value: 'transfer_full',
                        title: 'Pagar completo al trabajador',
                        desc: `Se depositan ${formatCurrencyMXN(dossier.payment.job_amount_mxn)} al trabajador. La plataforma conserva la comisión de ${formatCurrencyMXN(dossier.payment.platform_fee_mxn)}.`,
                      },
                      {
                        value: 'refund_full',
                        title: 'Devolver todo al empleador',
                        desc: `Se devuelven los ${formatCurrencyMXN(dossier.payment.total_charged_mxn)} completos a la tarjeta del empleador.`,
                      },
                      {
                        value: 'partial',
                        title: 'Dividir el pago entre ambos',
                        desc: `Reparte los ${formatCurrencyMXN(dossier.payment.total_charged_mxn)} totales sin retener comisión. Ambos montos deben ser mayores a $0.`,
                      },
                    ] as const
                  ).map((opt) => {
                    const checked = selectedDecision === opt.value
                    return (
                      <label
                        key={opt.value}
                        className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3.5 transition-colors ${
                          checked
                            ? 'border-primary bg-primary-fixed/35'
                            : 'border-outline-variant/60 bg-surface-container-low/50 hover:bg-surface-container-low'
                        }`}
                      >
                        <input
                          type="radio"
                          value={opt.value}
                          checked={checked}
                          onChange={() => {
                            setFormError(null)
                            form.setValue('decision', opt.value)
                          }}
                          className="mt-1 accent-[#c2652a]"
                        />
                        <div className="min-w-0">
                          <p className="text-sm font-bold text-on-surface">
                            {opt.title}
                          </p>
                          <p className="mt-0.5 text-xs text-on-surface-variant">
                            {opt.desc}
                          </p>
                        </div>
                      </label>
                    )
                  })}
                </fieldset>

                {selectedDecision === 'partial' && (
                  <div className="space-y-3 rounded-xl border border-primary/30 bg-primary-fixed/25 p-4">
                    <p className="text-xs font-semibold text-on-surface">
                      Al escribir un monto, el otro se ajusta automáticamente
                      para cuadrar el total:
                    </p>
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <div>
                        <label
                          htmlFor="partial-transfer"
                          className="block text-[11px] font-bold uppercase tracking-wider text-on-surface-variant"
                        >
                          Para el trabajador (MXN)
                        </label>
                        <input
                          id="partial-transfer"
                          type="number"
                          step="0.01"
                          min="0.01"
                          max={dossier.payment.total_charged_mxn}
                          value={transferAmount}
                          onChange={(e) =>
                            handlePartialTransferChange(e.target.value)
                          }
                          className="mt-1 w-full rounded-lg border border-outline-variant bg-surface-container-lowest px-3 py-2 font-mono text-sm text-on-surface focus:border-primary focus:outline-none"
                        />
                      </div>
                      <div>
                        <label
                          htmlFor="partial-refund"
                          className="block text-[11px] font-bold uppercase tracking-wider text-on-surface-variant"
                        >
                          Para el empleador (MXN)
                        </label>
                        <input
                          id="partial-refund"
                          type="number"
                          step="0.01"
                          min="0.01"
                          max={dossier.payment.total_charged_mxn}
                          value={refundAmount}
                          onChange={(e) =>
                            handlePartialRefundChange(e.target.value)
                          }
                          className="mt-1 w-full rounded-lg border border-outline-variant bg-surface-container-lowest px-3 py-2 font-mono text-sm text-on-surface focus:border-primary focus:outline-none"
                        />
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                      <span className="text-on-surface-variant">
                        {partialValid
                          ? 'La suma cuadra exactamente:'
                          : 'Ajusta ambos montos (mayores a $0):'}
                      </span>
                      <span
                        className={`font-mono font-bold ${
                          partialValid ? 'text-primary' : 'text-error'
                        }`}
                      >
                        {formatCurrencyMXN(partialSum)} /{' '}
                        {formatCurrencyMXN(dossier.payment.total_charged_mxn)}
                      </span>
                    </div>
                  </div>
                )}

                <div>
                  <Textarea
                    label="2. Explica el motivo de tu decisión"
                    htmlFor="arbitration-notes"
                    rows={4}
                    required
                    placeholder="Ejemplo: Según las fotografías entregadas y el acuerdo inicial, se completó el trabajo con un detalle menor en el pasillo..."
                    error={form.formState.errors.resolution_notes?.message}
                    {...form.register('resolution_notes')}
                  />
                  <p className="mt-1 text-right text-[11px] text-secondary">
                    {trimmedNotesLen} / 10 caracteres mínimos
                  </p>
                </div>

                {formError && (
                  <p
                    role="alert"
                    className="rounded-lg bg-error-container px-3.5 py-2.5 text-xs font-semibold text-on-error-container"
                  >
                    {formError}
                  </p>
                )}

                <div className="flex items-start gap-3 rounded-xl bg-tertiary-fixed p-4">
                  <Icon
                    name="schedule"
                    className="mt-0.5 shrink-0 text-tertiary"
                  />
                  <div>
                    <p className="text-xs font-bold text-on-tertiary-fixed">
                      Plazo de 7 días para aclaraciones
                    </p>
                    <p className="mt-0.5 text-xs text-on-tertiary-fixed-variant">
                      El dinero no se moverá todavía: ambas partes tendrán 7
                      días naturales para aceptar o pedir una nueva revisión.
                    </p>
                  </div>
                </div>

                <Button
                  type="submit"
                  size="lg"
                  leftIcon="gavel"
                  className="w-full"
                >
                  Emitir Decisión y Notificar
                </Button>
              </form>
            ) : dossier.caseRecord.status === 'resolved' ? (
              <div className="space-y-4">
                <div className="rounded-xl bg-primary-fixed/40 p-4 space-y-2 text-sm">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-on-primary-fixed">
                    Decisión registrada (en plazo de 7 días)
                  </p>
                  <p className="font-bold text-on-surface">
                    {dossier.caseRecord.decision
                      ? DECISION_LABELS[dossier.caseRecord.decision]
                      : 'Resuelto'}
                  </p>
                  <div className="flex justify-between text-xs">
                    <span>Monto para el trabajador:</span>
                    <strong className="font-mono">
                      {formatCurrencyMXN(
                        dossier.caseRecord.approved_transfer_amount ?? 0,
                      )}
                    </strong>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span>Monto para el empleador:</span>
                    <strong className="font-mono">
                      {formatCurrencyMXN(
                        dossier.caseRecord.approved_refund_amount ?? 0,
                      )}
                    </strong>
                  </div>
                  <p className="pt-1 text-xs text-on-surface-variant">
                    {dossier.caseRecord.resolution_notes}
                  </p>
                </div>

                <div className="rounded-xl bg-tertiary-fixed/70 p-4 text-xs text-on-tertiary-fixed">
                  <p className="font-bold">Tiempo restante para cierre:</p>
                  <p className="mt-1 font-mono">{countdown.formatted}</p>
                </div>

                <Button
                  size="lg"
                  leftIcon="payments"
                  className="w-full"
                  onClick={() => setCloseModalOpen(true)}
                >
                  Cerrar Caso y Liberar Dinero
                </Button>

                <Button
                  variant="secondary"
                  size="sm"
                  leftIcon="replay"
                  className="w-full"
                  onClick={() => setObjectionModalOpen(true)}
                >
                  Reabrir por Inconformidad de una Parte
                </Button>
              </div>
            ) : (
              <div className="space-y-4 rounded-xl bg-surface-container-low p-4 text-sm">
                <div className="flex items-center gap-2 font-bold text-on-surface">
                  <Icon name="check_circle" filled className="text-primary" />
                  <span>Caso cerrado y pago programado</span>
                </div>
                <p className="text-xs text-on-surface-variant">
                  {dossier.caseRecord.resolution_notes}
                </p>
                <div className="space-y-1 border-t border-outline-variant/50 pt-3 text-xs">
                  <div className="flex justify-between">
                    <span>Monto al trabajador:</span>
                    <strong className="font-mono">
                      {formatCurrencyMXN(
                        dossier.caseRecord.approved_transfer_amount ?? 0,
                      )}
                    </strong>
                  </div>
                  <div className="flex justify-between">
                    <span>Reembolso al empleador:</span>
                    <strong className="font-mono">
                      {formatCurrencyMXN(
                        dossier.caseRecord.approved_refund_amount ?? 0,
                      )}
                    </strong>
                  </div>
                </div>
                <Link
                  to={`/monitoreo-stripe?q=${encodeURIComponent(dossier.payment.stripe_payment_intent_id)}`}
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary hover:underline"
                >
                  <span>Seguir este pago en Pagos y Transferencias</span>
                  <Icon name="arrow_forward" className="text-[14px]" />
                </Link>
              </div>
            )}
          </div>
        </aside>
      </div>

      {/* Two-Step Confirmation: Resolve Claim */}
      <ConfirmActionModal
        open={pendingConfirm !== null}
        title="¿Confirmas esta decisión de arbitraje?"
        description="Se avisará al empleador y al trabajador y comenzará el plazo de 7 días para aclaraciones antes de mover el dinero."
        confirmLabel="Sí, emitir decisión"
        cancelLabel="Revisar de nuevo"
        loading={confirmResolveAction.isPending}
        onCancel={() => setPendingConfirm(null)}
        onConfirm={() => {
          if (!pendingConfirm) return
          void confirmResolveAction.execute(pendingConfirm).catch((err) => {
            setPendingConfirm(null)
            setFormError(mapDomainErrorToUI(err).message)
          })
        }}
        details={
          pendingConfirm && (
            <div className="space-y-2 text-xs">
              <div className="flex justify-between gap-2">
                <span>Decisión elegida:</span>
                <strong>{DECISION_LABELS[pendingConfirm.decision]}</strong>
              </div>
              <div className="flex justify-between gap-2">
                <span>Pago al trabajador:</span>
                <strong className="font-mono">
                  {formatCurrencyMXN(pendingConfirm.approved_transfer_amount)}
                </strong>
              </div>
              <div className="flex justify-between gap-2">
                <span>Devolución al empleador:</span>
                <strong className="font-mono">
                  {formatCurrencyMXN(pendingConfirm.approved_refund_amount)}
                </strong>
              </div>
              <p className="border-t border-outline-variant/50 pt-2 text-on-surface-variant">
                {pendingConfirm.resolution_notes}
              </p>
            </div>
          )
        }
      />

      {/* Two-Step Confirmation: Close Claim & Execute Payout */}
      <ConfirmActionModal
        open={closeModalOpen}
        title="¿Cerrar definitivamente y liberar el dinero?"
        description="Esta acción no se puede deshacer. El caso quedará cerrado y se enviarán las instrucciones de pago o reembolso."
        confirmLabel="Sí, cerrar y liberar dinero"
        cancelLabel="Cancelar"
        confirmVariant="tertiary"
        loading={confirmCloseAction.isPending}
        onCancel={() => setCloseModalOpen(false)}
        onConfirm={() => {
          void confirmCloseAction.execute().catch((err) => {
            setCloseModalOpen(false)
            pushToast(mapDomainErrorToUI(err).message, 'error')
          })
        }}
      />

      {/* Two-Step Confirmation: Reopen on Objection */}
      <ConfirmActionModal
        open={objectionModalOpen}
        title="¿Reabrir la reclamación para nueva revisión?"
        description="El caso volverá al estado En revisión y el dinero seguirá retenido hasta que emitas una nueva decisión."
        confirmLabel="Sí, reabrir caso"
        cancelLabel="Cancelar"
        loading={objectionAction.isPending}
        onCancel={() => setObjectionModalOpen(false)}
        onConfirm={() => {
          void objectionAction.execute().catch((err) => {
            setObjectionModalOpen(false)
            pushToast(mapDomainErrorToUI(err).message, 'error')
          })
        }}
      />
    </div>
  )
}

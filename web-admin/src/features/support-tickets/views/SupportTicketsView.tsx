import { zodResolver } from '@hookform/resolvers/zod'
import { useMemo, useRef, useState } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { Avatar } from '@/shared/components/atoms/Avatar'
import { Badge } from '@/shared/components/atoms/Badge'
import { Button } from '@/shared/components/atoms/Button'
import {
  Input,
  Select,
  Textarea,
} from '@/shared/components/atoms/FormControls'
import { Icon } from '@/shared/components/atoms/Icon'
import { ConfirmActionModal } from '@/shared/components/molecules/ConfirmActionModal'
import {
  EmptyState,
  ErrorState,
  PageLoadingSkeleton,
} from '@/shared/components/molecules/FeedbackStates'
import { KpiCard } from '@/shared/components/molecules/KpiCard'
import {
  CaseStatusBadge,
  TicketCategoryBadge,
} from '@/shared/components/molecules/StatusBadge'
import { PageHeader } from '@/shared/components/templates/PageHeader'
import { useDebounce } from '@/shared/hooks/useDebounce'
import { useIdempotentAction } from '@/shared/hooks/useIdempotentAction'
import { useToastStore } from '@/shared/hooks/useToast'
import { TICKET_CLAIM_TRANSITIONS } from '@/shared/mocks/mock-backend.store'
import type {
  DateRangeFilter,
  TicketFilterParams,
} from '@/shared/services/admin-repository.contract'
import type {
  Attachment,
  TicketCategory,
  TicketOrClaimStatus,
} from '@/shared/types/domain.types'
import { mapDomainErrorToUI } from '@/shared/utils/error-mapper'
import { validateAttachmentFile } from '@/shared/utils/file-validator'
import {
  formatCurrencyMXN,
  formatDateTimeMX,
  formatFileSize,
  formatRelativeTimeES,
} from '@/shared/utils/format'
import {
  useReplySupportTicket,
  useSupportTicketDetail,
  useSupportTicketsList,
} from '../hooks/useSupportTickets'
import {
  ticketReplySchema,
  type TicketReplyFormValues,
} from '../schemas/ticket.schema'

const CATEGORY_OPTIONS = [
  { value: 'all', label: 'Todas las categorías' },
  { value: 'account', label: 'Cuenta y acceso' },
  { value: 'publication', label: 'Publicaciones' },
  { value: 'application', label: 'Postulaciones' },
  { value: 'job', label: 'Trabajos en curso' },
  { value: 'payment', label: 'Pagos y cobros' },
  { value: 'technical', label: 'Problemas técnicos' },
] as const

const STATUS_OPTIONS = [
  { value: 'all', label: 'Todos' },
  { value: 'open', label: 'Abierto' },
  { value: 'in_review', label: 'En revisión' },
  { value: 'resolved', label: 'Resuelto' },
  { value: 'closed', label: 'Cerrado' },
] as const

const DATE_OPTIONS = [
  { value: 'all', label: 'Todos' },
  { value: 'today', label: 'Hoy (24h)' },
  { value: '7d', label: 'Últimos 7 días' },
  { value: '30d', label: 'Últimos 30 días' },
] as const

const CANNED_TEMPLATES = [
  {
    id: '',
    label: 'Usar respuesta preescrita...',
    text: '',
  },
  {
    id: '3ds',
    label: 'Confirmación bancaria vencida (sin cobro doble)',
    text: 'Confirmamos que no se realizó ningún cobro doble en tu tarjeta. La pantalla de verificación de tu banco venció por tiempo y ya puedes volver a intentar el pago desde el detalle del trabajo.',
  },
  {
    id: 'escrow',
    label: 'Cómo funciona el pago en resguardo',
    text: 'El dinero del trabajo permanece protegido en resguardo hasta que el servicio termine correctamente o un administrador resuelva cualquier aclaración.',
  },
  {
    id: 'resolved',
    label: 'Cierre con plazo de 7 días para dudas',
    text: 'Tu consulta quedó atendida y marcada como resuelta. Si necesitas ayuda adicional, puedes responder en este mismo mensaje durante los próximos 7 días.',
  },
] as const

const STATUS_LABELS: Record<TicketOrClaimStatus, string> = {
  open: 'Abierto',
  in_review: 'En revisión',
  resolved: 'Resuelto',
  closed: 'Cerrado',
}

export function SupportTicketsView() {
  const { caseId } = useParams<{ caseId: string }>()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const pushToast = useToastStore((s) => s.push)
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  const [category, setCategory] = useState<TicketCategory | 'all'>('all')
  const [status, setStatus] = useState<TicketOrClaimStatus | 'all'>('all')
  const [dateRange, setDateRange] = useState<DateRangeFilter>('all')
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

  const [stagedAttachment, setStagedAttachment] = useState<Pick<
    Attachment,
    'file_name' | 'mime_type' | 'size_bytes' | 'preview_url'
  > | null>(null)
  const [attachmentError, setAttachmentError] = useState<string | null>(null)
  const [pendingCloseSubmit, setPendingCloseSubmit] =
    useState<TicketReplyFormValues | null>(null)

  const filters: TicketFilterParams = useMemo(
    () => ({ category, status, dateRange, search: debouncedSearch }),
    [category, dateRange, debouncedSearch, status],
  )

  const listQuery = useSupportTicketsList(filters)
  const selectedId = caseId ?? listQuery.data?.[0]?.id
  const detailQuery = useSupportTicketDetail(selectedId)
  const replyMutation = useReplySupportTicket()

  const replyForm = useForm<TicketReplyFormValues>({
    resolver: zodResolver(ticketReplySchema),
    mode: 'onBlur',
    defaultValues: {
      body: '',
      is_internal: false,
      next_status: '',
    },
  })

  const isInternalChecked = useWatch({
    control: replyForm.control,
    name: 'is_internal',
  })
  const replyBodyValue = useWatch({
    control: replyForm.control,
    name: 'body',
  })

  const handleSelectTicket = (ticketId: string) => {
    replyForm.reset({ body: '', is_internal: false, next_status: '' })
    setStagedAttachment(null)
    setAttachmentError(null)
    navigate(`/tickets/${ticketId}`)
  }

  const sendReplyAction = useIdempotentAction(
    'reply-support-ticket',
    async (idempotencyKey, values: TicketReplyFormValues) => {
      if (!selectedId) return
      await replyMutation.mutateAsync({
        case_id: selectedId,
        body: values.body,
        is_internal: values.is_internal,
        next_status: values.next_status || undefined,
        attachment: stagedAttachment,
        idempotency_key: idempotencyKey,
      })
      replyForm.reset({ body: '', is_internal: false, next_status: '' })
      setStagedAttachment(null)
      setAttachmentError(null)
      setPendingCloseSubmit(null)
      pushToast(
        values.is_internal
          ? 'Nota interna guardada (solo visible para administradores).'
          : 'Respuesta enviada al usuario y ticket actualizado.',
        'success',
      )
    },
  )

  const handleReplySubmit = replyForm.handleSubmit(async (values) => {
    // Poka-Yoke: Closing a ticket is irreversible -> require explicit confirmation
    if (values.next_status === 'closed') {
      setPendingCloseSubmit(values)
      return
    }
    try {
      await sendReplyAction.execute(values)
    } catch (err) {
      pushToast(mapDomainErrorToUI(err).message, 'error')
    }
  })

  const kpis = useMemo(() => {
    const tickets = listQuery.data ?? []
    return {
      open: tickets.filter((t) => t.status === 'open').length,
      inReview: tickets.filter((t) => t.status === 'in_review').length,
      system: tickets.filter((t) => t.source === 'system').length,
      resolved: tickets.filter(
        (t) => t.status === 'resolved' || t.status === 'closed',
      ).length,
    }
  }, [listQuery.data])

  const currentTicketStatus = (detailQuery.data?.ticket.status ??
    'open') as TicketOrClaimStatus
  const allowedNextStatuses = TICKET_CLAIM_TRANSITIONS[currentTicketStatus]

  const transitionOptions = useMemo(() => {
    const base = [
      {
        value: '',
        label: `Dejar en ${STATUS_LABELS[currentTicketStatus]}`,
      },
    ]
    const nextOpts = allowedNextStatuses.map((s) => ({
      value: s,
      label:
        currentTicketStatus === 'resolved' && s === 'in_review'
          ? 'Reabrir a En revisión'
          : `Cambiar a ${STATUS_LABELS[s]}`,
    }))
    return [...base, ...nextOpts]
  }, [allowedNextStatuses, currentTicketStatus])

  const handleFileChange = (file: File | undefined) => {
    setAttachmentError(null)
    if (!file) return
    const existingAttachments =
      detailQuery.data?.messages.reduce(
        (acc, msg) => acc + msg.attachments.length,
        0,
      ) ?? 0
    const check = validateAttachmentFile(file, existingAttachments)
    if (!check.valid) {
      setAttachmentError(check.message ?? 'Archivo no válido.')
      return
    }
    setStagedAttachment({
      file_name: file.name,
      mime_type: file.type as 'image/jpeg' | 'image/png' | 'application/pdf',
      size_bytes: file.size,
      preview_url: 'https://solidez.mx/evidencia-adjunta',
    })
  }

  const handleCopyPaymentRef = async (reference: string) => {
    try {
      await navigator.clipboard.writeText(reference)
      pushToast('Referencia de pago copiada al portapapeles.', 'info')
    } catch {
      pushToast('No se pudo copiar automáticamente. Selecciónala manualmente.', 'info')
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="SOPORTE Y ATENCIÓN A USUARIOS"
        liveTag="MESA ACTIVA"
        title="Tickets y Soporte"
        subtitle="Elige un ticket de la lista izquierda para leer el mensaje, responder al usuario o guardar notas privadas para el equipo."
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

      {/* KPIs */}
      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          label="Tickets Abiertos"
          value={kpis.open}
          icon="inbox"
          badgeText="Sin atender"
          badgeTone="primary"
          footerText="Esperando primera respuesta"
        />
        <KpiCard
          label="En Revisión"
          value={kpis.inReview}
          icon="support_agent"
          iconBgClass="bg-secondary-container"
          iconTextClass="text-on-secondary-container"
          badgeText="En curso"
          badgeTone="secondary"
          footerText="Conversación activa"
        />
        <KpiCard
          label="Alertas Automáticas"
          value={kpis.system}
          icon="notifications_active"
          iconBgClass="bg-tertiary-fixed"
          iconTextClass="text-tertiary"
          badgeText="Sistema"
          badgeTone="tertiary"
          footerText="Avisos de pagos o fallas"
        />
        <KpiCard
          label="Resueltos y Cerrados"
          value={kpis.resolved}
          icon="verified"
          cardTone="warm"
          iconBgClass="bg-primary"
          iconTextClass="text-on-primary"
          footerText="Atención completada"
        />
      </section>

      {/* Filter Bar */}
      <section className="rounded-2xl bg-surface-container-lowest p-4 shadow-xs">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-12 items-end">
          <div className="sm:col-span-2 lg:col-span-5">
            <Input
              label="Buscar ticket"
              htmlFor="tickets-search"
              leftIcon="search"
              placeholder="Ejemplo: #TCK-2041, Carlos Mendoza o pago..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="lg:col-span-3">
            <Select
              label="Categoría"
              htmlFor="tickets-category"
              options={CATEGORY_OPTIONS}
              value={category}
              onChange={(e) =>
                setCategory(e.target.value as TicketCategory | 'all')
              }
            />
          </div>
          <div className="lg:col-span-2">
            <Select
              label="Estado"
              htmlFor="tickets-status"
              options={STATUS_OPTIONS}
              value={status}
              onChange={(e) =>
                setStatus(e.target.value as TicketOrClaimStatus | 'all')
              }
            />
          </div>
          <div className="lg:col-span-2">
            <Select
              label="Fecha"
              htmlFor="tickets-date"
              options={DATE_OPTIONS}
              value={dateRange}
              onChange={(e) => setDateRange(e.target.value as DateRangeFilter)}
            />
          </div>
        </div>
      </section>

      {/* Split Workspace */}
      {listQuery.isLoading ? (
        <PageLoadingSkeleton />
      ) : listQuery.isError ? (
        <ErrorState
          message={mapDomainErrorToUI(listQuery.error).message}
          onRetry={() => void listQuery.refetch()}
        />
      ) : !listQuery.data || listQuery.data.length === 0 ? (
        <EmptyState
          icon="confirmation_number"
          title="No encontramos tickets con esos filtros"
          description="Limpia los filtros o cambia el texto de búsqueda para ver todos los tickets disponibles."
          actionLabel="Mostrar todos los tickets"
          onAction={() => {
            setCategory('all')
            setStatus('all')
            setDateRange('all')
            setSearch('')
          }}
        />
      ) : (
        <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-12">
          {/* Left Ticket Stream */}
          <aside className="min-w-0 space-y-3 lg:col-span-5 xl:col-span-4">
            <div className="flex items-center justify-between px-1">
              <p className="text-[11px] font-bold uppercase tracking-wider text-on-surface-variant">
                Lista de tickets ({listQuery.data.length})
              </p>
              <span className="text-xs text-secondary">Más recientes primero</span>
            </div>

            <div className="max-h-[780px] space-y-3 overflow-y-auto pr-1">
              {listQuery.data.map((ticket) => {
                const isSelected = ticket.id === selectedId
                return (
                  <button
                    key={ticket.id}
                    type="button"
                    onClick={() => handleSelectTicket(ticket.id)}
                    className={`relative w-full overflow-hidden rounded-2xl p-4 text-left transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-surface-container-lowest ring-2 ring-primary shadow-sm'
                        : 'bg-surface-container-low/80 hover:bg-surface-container-lowest'
                    }`}
                  >
                    {isSelected && (
                      <span
                        aria-hidden="true"
                        className="absolute inset-y-0 left-0 w-1.5 bg-primary"
                      />
                    )}
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="font-mono text-xs font-bold text-primary">
                          {ticket.folio}
                        </span>
                        <TicketCategoryBadge category={ticket.ticket_category} />
                        {ticket.source === 'system' && (
                          <Badge tone="tertiary">Automático</Badge>
                        )}
                      </div>
                      <span className="font-mono text-[11px] text-secondary">
                        {formatRelativeTimeES(ticket.updated_at)}
                      </span>
                    </div>

                    <p className="mt-2 line-clamp-2 text-sm font-bold text-on-surface">
                      {ticket.subject}
                    </p>
                    <p className="mt-1 line-clamp-2 text-xs text-on-surface-variant">
                      {ticket.description}
                    </p>

                    <div className="mt-3 flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-outline-variant/30">
                      <div className="flex items-center gap-2 min-w-0">
                        <Avatar
                          name={ticket.reporter?.full_name ?? 'Sistema'}
                          tone={
                            ticket.source === 'system' ? 'tertiary' : 'secondary'
                          }
                          size="sm"
                        />
                        <span className="truncate text-xs font-medium text-on-surface">
                          {ticket.reporter?.full_name ?? 'Alerta del sistema'}
                        </span>
                      </div>
                      <CaseStatusBadge status={ticket.status} />
                    </div>
                  </button>
                )
              })}
            </div>
          </aside>

          {/* Right Ticket Workspace */}
          <div className="min-w-0 space-y-6 lg:col-span-7 xl:col-span-8">
            {detailQuery.isLoading ? (
              <PageLoadingSkeleton />
            ) : detailQuery.isError ? (
              <ErrorState
                message={mapDomainErrorToUI(detailQuery.error).message}
                onRetry={() => void detailQuery.refetch()}
              />
            ) : detailQuery.data ? (
              <>
                <section className="rounded-3xl bg-surface-container-lowest p-6 shadow-xs sm:p-7 space-y-6">
                  {/* Ticket Header */}
                  <div className="space-y-3 border-b border-outline-variant/40 pb-5">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-sm font-bold text-primary">
                        {detailQuery.data.ticket.folio}
                      </span>
                      <TicketCategoryBadge
                        category={detailQuery.data.ticket.ticket_category}
                      />
                      <CaseStatusBadge status={detailQuery.data.ticket.status} />
                      {detailQuery.data.ticket.source === 'system' && (
                        <Badge tone="tertiary" icon="notifications_active">
                          Creado automáticamente por el sistema
                        </Badge>
                      )}
                    </div>
                    <h2 className="font-headline text-2xl sm:text-3xl font-bold text-on-surface">
                      {detailQuery.data.ticket.subject}
                    </h2>
                    <p className="text-xs text-on-surface-variant">
                      Recibido el{' '}
                      {formatDateTimeMX(detailQuery.data.ticket.created_at)} ·
                      Atendido por:{' '}
                      <strong className="text-on-surface">
                        {detailQuery.data.ticket.assigned_admin?.full_name ??
                          'Sin asignar aún'}
                      </strong>
                    </p>
                  </div>

                  {/* Linked Payment Context */}
                  {detailQuery.data.linkedPayment && (
                    <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl bg-surface-container-low p-4">
                      <div className="flex items-start gap-3 min-w-0">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary-fixed text-primary">
                          <Icon name="account_balance_wallet" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-[10px] font-bold uppercase tracking-widest text-secondary">
                            Pago Relacionado
                          </p>
                          <p className="text-sm font-bold text-on-surface">
                            Trabajo {detailQuery.data.linkedJob?.folio ?? ''} ·{' '}
                            {formatCurrencyMXN(
                              detailQuery.data.linkedPayment.total_charged_mxn,
                            )}
                          </p>
                          <p className="truncate font-mono text-xs text-on-surface-variant">
                            Referencia:{' '}
                            {
                              detailQuery.data.linkedPayment
                                .stripe_payment_intent_id
                            }
                          </p>
                        </div>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          leftIcon="content_copy"
                          onClick={() =>
                            void handleCopyPaymentRef(
                              detailQuery.data.linkedPayment!
                                .stripe_payment_intent_id,
                            )
                          }
                        >
                          Copiar referencia
                        </Button>
                        <Link
                          to={`/monitoreo-stripe?q=${encodeURIComponent(
                            detailQuery.data.linkedPayment
                              .stripe_payment_intent_id,
                          )}`}
                          className="inline-flex items-center gap-1 rounded-lg bg-surface-container-lowest px-3 py-1.5 text-xs font-semibold text-primary hover:bg-primary-fixed/40"
                        >
                          <span>Ver en Pagos</span>
                          <Icon name="open_in_new" className="text-[14px]" />
                        </Link>
                      </div>
                    </div>
                  )}

                  {/* Thread Timeline */}
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <h3 className="font-headline text-xl font-bold text-on-surface">
                        Conversación del Ticket
                      </h3>
                      <span className="text-xs text-secondary">
                        {detailQuery.data.messages.length} mensajes
                      </span>
                    </div>

                    <div className="space-y-3">
                      <div className="rounded-2xl bg-surface-container-low/80 p-4">
                        <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                          <span className="font-bold text-on-surface">
                            {detailQuery.data.ticket.reporter?.full_name ??
                              'Alerta automática del sistema'}
                          </span>
                          <span className="font-mono text-secondary">
                            {formatDateTimeMX(
                              detailQuery.data.ticket.created_at,
                            )}
                          </span>
                        </div>
                        <p className="mt-2 text-sm text-on-surface whitespace-pre-wrap break-words">
                          {detailQuery.data.ticket.description}
                        </p>
                      </div>

                      {detailQuery.data.messages.map((msg) => {
                        const isAdmin = msg.author_role === 'admin'
                        return (
                          <div
                            key={msg.id}
                            className={`rounded-2xl p-4 ${
                              msg.is_internal
                                ? 'border border-tertiary/30 bg-tertiary-fixed/40'
                                : isAdmin
                                  ? 'bg-primary-fixed/35'
                                  : 'bg-surface-container-low'
                            }`}
                          >
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="text-xs font-bold text-on-surface">
                                  {msg.author_name}
                                </span>
                                {msg.is_internal ? (
                                  <Badge tone="tertiary" icon="visibility_off">
                                    Nota interna (el usuario no la ve)
                                  </Badge>
                                ) : isAdmin ? (
                                  <Badge tone="primary">Respuesta del equipo</Badge>
                                ) : null}
                              </div>
                              <span className="font-mono text-[11px] text-secondary">
                                {formatDateTimeMX(msg.created_at)}
                              </span>
                            </div>
                            <p className="mt-2 text-sm leading-relaxed text-on-surface whitespace-pre-wrap break-words">
                              {msg.body}
                            </p>
                            {msg.attachments.length > 0 && (
                              <div className="mt-3 flex flex-wrap gap-2">
                                {msg.attachments.map((att) => (
                                  <span
                                    key={att.id}
                                    className="inline-flex items-center gap-1.5 rounded-lg bg-surface-container-lowest px-2.5 py-1 text-xs font-medium text-on-surface"
                                  >
                                    <Icon
                                      name={
                                        att.mime_type === 'application/pdf'
                                          ? 'picture_as_pdf'
                                          : 'image'
                                      }
                                      className="text-[15px] text-primary"
                                    />
                                    <span>
                                      {att.file_name} (
                                      {formatFileSize(att.size_bytes)})
                                    </span>
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  </div>

                  {/* Admin Reply Form */}
                  {currentTicketStatus !== 'closed' ? (
                    <form
                      onSubmit={handleReplySubmit}
                      noValidate
                      className="space-y-4 rounded-2xl bg-surface-container-low/75 p-5"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div className="flex items-center gap-2">
                          <Icon name="edit_note" className="text-primary" />
                          <span className="text-xs font-bold uppercase tracking-wider text-on-surface">
                            {isInternalChecked
                              ? 'Escribir Nota Privada para Administradores'
                              : 'Responder al Usuario'}
                          </span>
                        </div>
                        <select
                          aria-label="Usar respuesta preescrita"
                          defaultValue=""
                          onChange={(e) => {
                            const tpl = CANNED_TEMPLATES.find(
                              (t) => t.id === e.target.value,
                            )
                            if (tpl?.text) {
                              replyForm.setValue('body', tpl.text, {
                                shouldValidate: true,
                              })
                            }
                          }}
                          className="rounded-lg border border-outline-variant/70 bg-surface-container-lowest px-3 py-1.5 text-xs text-on-surface focus:border-primary focus:outline-none"
                        >
                          {CANNED_TEMPLATES.map((tpl) => (
                            <option key={tpl.id} value={tpl.id}>
                              {tpl.label}
                            </option>
                          ))}
                        </select>
                      </div>

                      {isInternalChecked && (
                        <div className="flex items-center gap-2 rounded-xl bg-tertiary-fixed/70 px-3.5 py-2.5 text-xs font-semibold text-on-tertiary-fixed">
                          <Icon
                            name="visibility_off"
                            className="shrink-0 text-[16px] text-tertiary"
                          />
                          <span>
                            Modo nota interna activo: este texto quedará solo
                            para el equipo y el usuario NO lo verá.
                          </span>
                        </div>
                      )}

                      <div>
                        <Textarea
                          htmlFor="ticket-reply-body"
                          rows={4}
                          placeholder={
                            isInternalChecked
                              ? 'Ejemplo: Revisé el pago en la sección de transferencias y ya aparece confirmado...'
                              : 'Ejemplo: Hola, revisamos tu pago y ya puedes volver a intentarlo desde la aplicación...'
                          }
                          error={replyForm.formState.errors.body?.message}
                          {...replyForm.register('body')}
                        />
                        <p className="mt-1 text-right text-[11px] text-secondary">
                          {(replyBodyValue ?? '').length} / 4000 caracteres
                        </p>
                      </div>

                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div className="flex flex-wrap items-center gap-4">
                          <label className="inline-flex items-center gap-2 text-xs font-semibold text-on-surface cursor-pointer">
                            <input
                              type="checkbox"
                              className="accent-[#c2652a]"
                              {...replyForm.register('is_internal')}
                            />
                            <span>Guardar como nota interna (privada)</span>
                          </label>

                          <div className="flex items-center gap-2">
                            <input
                              ref={fileInputRef}
                              type="file"
                              accept=".jpg,.jpeg,.png,.pdf,image/jpeg,image/png,application/pdf"
                              className="hidden"
                              onChange={(e) =>
                                handleFileChange(e.target.files?.[0])
                              }
                            />
                            <Button
                              variant="ghost"
                              size="sm"
                              leftIcon="attach_file"
                              onClick={() => fileInputRef.current?.click()}
                            >
                              {stagedAttachment
                                ? stagedAttachment.file_name
                                : 'Adjuntar imagen o PDF'}
                            </Button>
                            {stagedAttachment && (
                              <button
                                type="button"
                                onClick={() => setStagedAttachment(null)}
                                className="text-xs font-semibold text-tertiary hover:underline cursor-pointer"
                              >
                                Quitar
                              </button>
                            )}
                          </div>
                        </div>

                        <div className="flex flex-wrap items-center gap-3">
                          <select
                            aria-label="Cambiar estado del ticket"
                            className="rounded-lg border border-outline-variant/70 bg-surface-container-lowest px-3 py-2 text-xs font-semibold text-on-surface focus:border-primary focus:outline-none"
                            {...replyForm.register('next_status')}
                          >
                            {transitionOptions.map((opt) => (
                              <option key={opt.value} value={opt.value}>
                                {opt.label}
                              </option>
                            ))}
                          </select>

                          <Button
                            type="submit"
                            variant={isInternalChecked ? 'secondary' : 'primary'}
                            rightIcon={isInternalChecked ? 'lock' : 'send'}
                            loading={sendReplyAction.isPending}
                            loadingText="Guardando..."
                          >
                            {isInternalChecked
                              ? 'Guardar Nota Privada'
                              : 'Enviar Respuesta al Usuario'}
                          </Button>
                        </div>
                      </div>

                      {attachmentError && (
                        <p
                          role="alert"
                          className="text-xs font-semibold text-error"
                        >
                          {attachmentError}
                        </p>
                      )}
                    </form>
                  ) : (
                    <div className="rounded-xl bg-surface-container-low p-4 text-xs text-on-surface-variant">
                      Este ticket está <strong>Cerrado</strong> y ya no admite
                      nuevos mensajes.
                    </div>
                  )}
                </section>

                {/* Auxiliary Requester Dossier Card */}
                {detailQuery.data.ticket.reporter && (
                  <section className="rounded-3xl bg-surface-container-low p-6 shadow-xs space-y-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-surface-container-lowest text-primary">
                          <Icon name="badge" />
                        </div>
                        <div>
                          <p className="text-[11px] font-bold uppercase tracking-wider text-secondary">
                            Datos del Solicitante
                          </p>
                          <h3 className="font-headline text-xl font-bold text-on-surface">
                            {detailQuery.data.ticket.reporter.full_name} (
                            {detailQuery.data.ticket.reporter.code})
                          </h3>
                        </div>
                      </div>
                      <Link
                        to={`/cuentas/${detailQuery.data.ticket.reporter.id}`}
                        className="inline-flex items-center gap-1 text-xs font-bold text-primary hover:underline"
                      >
                        <span>Ver perfil y sanciones</span>
                        <Icon name="arrow_forward" className="text-[15px]" />
                      </Link>
                    </div>

                    <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                      <div className="rounded-2xl bg-surface-container-lowest p-4">
                        <p className="text-[11px] font-bold uppercase tracking-wider text-secondary">
                          Calificación
                        </p>
                        <p className="mt-1 font-headline text-2xl font-bold text-on-surface">
                          {detailQuery.data.ticket.reporter.rating_avg.toFixed(1)}{' '}
                          ★
                        </p>
                        <p className="mt-1 text-xs text-on-surface-variant">
                          {detailQuery.data.ticket.reporter.completed_jobs_count}{' '}
                          trabajos terminados
                        </p>
                      </div>
                      <div className="rounded-2xl bg-surface-container-lowest p-4">
                        <p className="text-[11px] font-bold uppercase tracking-wider text-secondary">
                          Total en Pagos
                        </p>
                        <p className="mt-1 font-headline text-2xl font-bold text-on-surface">
                          {formatCurrencyMXN(
                            detailQuery.data.ticket.reporter
                              .transacted_volume_mxn,
                          )}
                        </p>
                        <p className="mt-1 truncate text-[11px] text-secondary">
                          {detailQuery.data.ticket.reporter.role === 'employer'
                            ? 'Cuenta de Empleador'
                            : 'Cuenta de Trabajador'}
                        </p>
                      </div>
                      <div className="rounded-2xl bg-surface-container-lowest p-4">
                        <p className="text-[11px] font-bold uppercase tracking-wider text-secondary">
                          Tickets Anteriores (
                          {detailQuery.data.requesterTickets.length})
                        </p>
                        {detailQuery.data.requesterTickets.length === 0 ? (
                          <p className="mt-1.5 text-xs text-on-surface-variant">
                            Sin tickets previos.
                          </p>
                        ) : (
                          <ul className="mt-1.5 space-y-1.5 text-xs">
                            {detailQuery.data.requesterTickets
                              .slice(0, 2)
                              .map((prev) => (
                                <li
                                  key={prev.id}
                                  className="flex items-center justify-between gap-2"
                                >
                                  <span className="truncate font-mono text-primary">
                                    {prev.folio}
                                  </span>
                                  <CaseStatusBadge status={prev.status} />
                                </li>
                              ))}
                          </ul>
                        )}
                      </div>
                    </div>
                  </section>
                )}
              </>
            ) : null}
          </div>
        </div>
      )}

      {/* Poka-Yoke: Explicit confirmation before irreversibly closing a ticket */}
      <ConfirmActionModal
        open={pendingCloseSubmit !== null}
        title="¿Cerrar definitivamente este ticket?"
        description="Una vez cerrado, ni tú ni el usuario podrán volver a escribir mensajes en este ticket."
        confirmLabel="Sí, enviar y cerrar ticket"
        cancelLabel="Cancelar"
        confirmVariant="tertiary"
        loading={sendReplyAction.isPending}
        onCancel={() => setPendingCloseSubmit(null)}
        onConfirm={() => {
          if (!pendingCloseSubmit) return
          void sendReplyAction.execute(pendingCloseSubmit).catch((err) => {
            setPendingCloseSubmit(null)
            pushToast(mapDomainErrorToUI(err).message, 'error')
          })
        }}
      />
    </div>
  )
}

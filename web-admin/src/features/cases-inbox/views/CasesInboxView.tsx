import { zodResolver } from '@hookform/resolvers/zod'
import { useMemo, useState } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { useNavigate, useSearchParams } from 'react-router-dom'
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
import { KpiCard } from '@/shared/components/molecules/KpiCard'
import {
  CaseStatusBadge,
  CaseTypeBadge,
} from '@/shared/components/molecules/StatusBadge'
import { SlideOverDrawer } from '@/shared/components/organisms/SlideOverDrawer'
import { PageHeader } from '@/shared/components/templates/PageHeader'
import { useDebounce } from '@/shared/hooks/useDebounce'
import {
  generateIdempotencyKey,
  useIdempotentAction,
} from '@/shared/hooks/useIdempotentAction'
import { useToastStore } from '@/shared/hooks/useToast'
import type {
  CasesFilterParams,
  DateRangeFilter,
} from '@/shared/services/admin-repository.contract'
import type {
  CaseListItem,
  CaseStatus,
  CaseType,
} from '@/shared/types/domain.types'
import { downloadCsvFile } from '@/shared/utils/csv-export'
import { mapDomainErrorToUI } from '@/shared/utils/error-mapper'
import { formatShortDateMX } from '@/shared/utils/format'
import {
  useActiveAdmins,
  useAllCasesSummary,
  useAssignCase,
  useCasesList,
  useCreateCase,
  useQuickResolveCase,
} from '../hooks/useCasesInbox'
import {
  createCaseSchema,
  quickResolveSchema,
  type CreateCaseFormValues,
  type QuickResolveFormValues,
} from '../schemas/case.schema'

const CASE_TYPE_OPTIONS = [
  { value: 'all', label: 'Todos los tipos' },
  { value: 'ticket', label: 'Ticket de soporte' },
  { value: 'claim', label: 'Reclamación de pago' },
  { value: 'report', label: 'Reporte de contenido' },
] as const

const CASE_STATUS_OPTIONS = [
  { value: 'all', label: 'Todos los estados' },
  { value: 'open', label: 'Abierto' },
  { value: 'pending', label: 'Pendiente' },
  { value: 'in_review', label: 'En revisión' },
  { value: 'resolved', label: 'Resuelto' },
  { value: 'closed', label: 'Cerrado' },
  { value: 'attended', label: 'Atendido' },
  { value: 'dismissed', label: 'Desestimado' },
] as const

const DATE_RANGE_OPTIONS = [
  { value: 'all', label: 'Cualquier fecha' },
  { value: 'today', label: 'Hoy (24h)' },
  { value: '7d', label: 'Últimos 7 días' },
  { value: '30d', label: 'Últimos 30 días' },
] as const

const TICKET_CATEGORY_OPTIONS = [
  { value: 'technical', label: 'Problema técnico' },
  { value: 'payment', label: 'Pagos y cobros' },
  { value: 'account', label: 'Cuenta y acceso' },
  { value: 'publication', label: 'Publicaciones' },
  { value: 'application', label: 'Postulaciones' },
  { value: 'job', label: 'Trabajos en curso' },
] as const

function getTargetRouteForCase(item: CaseListItem): string {
  if (item.case_type === 'claim') return `/arbitraje/${item.id}`
  if (item.case_type === 'ticket') return `/tickets/${item.id}`
  return `/moderacion/${item.id}`
}

export function CasesInboxView() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const pushToast = useToastStore((s) => s.push)

  const [caseType, setCaseType] = useState<CaseType | 'all'>('all')
  const [status, setStatus] = useState<CaseStatus | 'all'>(
    (searchParams.get('status') as CaseStatus | null) ?? 'all',
  )
  const [dateRange, setDateRange] = useState<DateRangeFilter>('all')
  const [assignedAdminId, setAssignedAdminId] = useState<string>('all')
  const searchText = searchParams.get('q') ?? ''
  const setSearchText = (value: string) => {
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
  const debouncedSearch = useDebounce(searchText, 200)

  const [selectedCase, setSelectedCase] = useState<CaseListItem | null>(null)
  const [pendingQuickResolve, setPendingQuickResolve] =
    useState<QuickResolveFormValues | null>(null)
  const [newCaseOpen, setNewCaseOpen] = useState(false)

  const filters: CasesFilterParams = useMemo(
    () => ({
      caseType,
      status,
      dateRange,
      assignedAdminId,
      search: debouncedSearch,
    }),
    [assignedAdminId, caseType, dateRange, debouncedSearch, status],
  )

  const casesQuery = useCasesList(filters)
  const summaryQuery = useAllCasesSummary()
  const adminsQuery = useActiveAdmins()
  const assignMutation = useAssignCase()
  const quickResolveMutation = useQuickResolveCase()
  const createCaseMutation = useCreateCase()

  const adminFilterOptions = useMemo(() => {
    const base = [
      { value: 'all', label: 'Todos' },
      { value: 'unassigned', label: 'Sin asignar' },
    ]
    const admins = (adminsQuery.data ?? []).map((adm) => ({
      value: adm.id,
      label: adm.full_name,
    }))
    return [...base, ...admins]
  }, [adminsQuery.data])

  const kpis = useMemo(() => {
    const all = summaryQuery.data ?? []
    const openOrPending = all.filter(
      (c) => c.status === 'open' || c.status === 'pending',
    ).length
    const inReview = all.filter((c) => c.status === 'in_review').length
    const activeClaims = all.filter(
      (c) => c.case_type === 'claim' && c.status !== 'closed',
    ).length
    const resolvedOrAttended = all.filter(
      (c) =>
        c.status === 'resolved' ||
        c.status === 'closed' ||
        c.status === 'attended',
    ).length
    const completionPct =
      all.length > 0 ? Math.round((resolvedOrAttended / all.length) * 100) : 0
    return {
      openOrPending,
      inReview,
      activeClaims,
      resolvedOrAttended,
      completionPct,
      total: all.length,
    }
  }, [summaryQuery.data])

  const quickForm = useForm<QuickResolveFormValues>({
    resolver: zodResolver(quickResolveSchema),
    mode: 'onBlur',
    defaultValues: { resolution_notes: '' },
  })

  const createForm = useForm<CreateCaseFormValues>({
    resolver: zodResolver(createCaseSchema),
    mode: 'onBlur',
    defaultValues: {
      case_type: 'ticket',
      ticket_category: 'technical',
      subject: '',
      description: '',
    },
  })

  const quickNotesValue = useWatch({
    control: quickForm.control,
    name: 'resolution_notes',
  })

  const quickResolveAction = useIdempotentAction(
    'quick-resolve-case',
    async (idempotencyKey, caseId: string, values: QuickResolveFormValues) => {
      await quickResolveMutation.mutateAsync({
        caseId,
        resolutionNotes: values.resolution_notes,
        idempotencyKey,
      })
      pushToast('Caso marcado como resuelto y nota guardada.', 'success')
      quickForm.reset()
      setPendingQuickResolve(null)
      setSelectedCase(null)
    },
  )

  const createCaseAction = useIdempotentAction(
    'create-admin-case',
    async (idempotencyKey, values: CreateCaseFormValues) => {
      const created = await createCaseMutation.mutateAsync({
        case_type: values.case_type,
        ticket_category:
          values.case_type === 'ticket' ? values.ticket_category : null,
        subject: values.subject,
        description: values.description,
        reporter_id: null,
        idempotency_key: idempotencyKey,
      })
      pushToast(`Caso ${created.folio} creado en la bandeja.`, 'success')
      createForm.reset()
      setNewCaseOpen(false)
    },
  )

  const handleAssignAdmin = async (caseId: string, nextAdminId: string) => {
    try {
      const updated = await assignMutation.mutateAsync({
        caseId,
        adminId: nextAdminId || null,
        idempotencyKey: generateIdempotencyKey(`assign-${caseId}`),
      })
      if (selectedCase?.id === caseId) {
        setSelectedCase(updated)
      }
      pushToast(
        nextAdminId
          ? `Caso ${updated.folio} asignado correctamente.`
          : `El caso ${updated.folio} quedó sin asignar.`,
        'success',
      )
    } catch (err) {
      pushToast(mapDomainErrorToUI(err).message, 'error')
    }
  }

  const handleResetFilters = () => {
    setCaseType('all')
    setStatus('all')
    setDateRange('all')
    setAssignedAdminId('all')
    setSearchText('')
    setSearchParams({})
  }

  const handleExportCsv = () => {
    const rows = (casesQuery.data ?? []).map((item) => [
      item.folio,
      item.case_type === 'claim'
        ? 'Reclamación'
        : item.case_type === 'ticket'
          ? 'Ticket'
          : 'Reporte',
      item.status,
      item.reporter?.full_name ?? 'Alerta del sistema',
      item.assigned_admin?.full_name ?? 'Sin asignar',
      item.subject,
      formatShortDateMX(item.created_at),
    ])
    downloadCsvFile(
      `solidez-casos-${new Date().toISOString().slice(0, 10)}.csv`,
      [
        'Folio',
        'Tipo',
        'Estado',
        'Solicitante',
        'Asignado a',
        'Asunto',
        'Fecha de creación',
      ],
      rows,
    )
    pushToast('Archivo Excel/CSV descargado correctamente.', 'info')
  }

  const watchNewCaseType = useWatch({
    control: createForm.control,
    name: 'case_type',
  })

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="INICIO / BANDEJA DE CASOS"
        liveTag="EN VIVO"
        title="Bandeja de Casos Unificada"
        subtitle="Aquí se concentran todos los tickets de ayuda, reclamaciones de pago y reportes. Pulsa Atender en cualquier fila para trabajarlo."
        actions={
          <>
            <Button
              variant="secondary"
              leftIcon="download"
              onClick={handleExportCsv}
              disabled={!casesQuery.data?.length}
            >
              Descargar listado (Excel/CSV)
            </Button>
            <Button
              variant="primary"
              leftIcon="add"
              onClick={() => setNewCaseOpen(true)}
            >
              Registrar Nuevo Caso
            </Button>
          </>
        }
      />

      {/* KPI Bento Row */}
      <section
        aria-label="Resumen de casos"
        className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-4"
      >
        <KpiCard
          label="Abiertos y Pendientes"
          value={kpis.openOrPending}
          icon="inbox"
          iconBgClass="bg-primary-fixed/70"
          iconTextClass="text-primary"
          badgeText="Por atender"
          badgeTone="primary"
          footerText="Esperando revisión inicial"
        />
        <KpiCard
          label="En Revisión"
          value={kpis.inReview}
          icon="pending_actions"
          iconBgClass="bg-secondary-container"
          iconTextClass="text-on-secondary-container"
          badgeText="En curso"
          badgeTone="secondary"
          footerText="Con administrador asignado"
        />
        <KpiCard
          label="Reclamaciones de Pago"
          value={kpis.activeClaims}
          icon="gavel"
          iconBgClass="bg-tertiary-fixed"
          iconTextClass="text-tertiary"
          valueClassName="text-tertiary"
          badgeText="Dinero retenido"
          badgeTone="tertiary"
          footerText="Pendientes de decisión"
        />
        <KpiCard
          label="Resueltos y Atendidos"
          value={kpis.resolvedOrAttended}
          icon="task_alt"
          iconBgClass="bg-primary"
          iconTextClass="text-on-primary"
          cardTone="warm"
          valueClassName="text-on-primary-fixed"
          badgeText={`${kpis.completionPct}%`}
          badgeTone="primary"
          footerText={`De ${kpis.total} casos registrados`}
          progressPct={kpis.completionPct}
        />
      </section>

      {/* Filters Bar */}
      <section
        aria-label="Filtros de casos"
        className="rounded-xl bg-surface-container-low p-5"
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 items-end">
          <div className="sm:col-span-2 lg:col-span-4">
            <Input
              label="Buscar en la bandeja"
              htmlFor="cases-search"
              leftIcon="search"
              placeholder="Ejemplo: #ARB-2025, #TCK-2041, Carlos Mendoza..."
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
            />
          </div>

          <Select
            label="Tipo de caso"
            htmlFor="filter-case-type"
            options={CASE_TYPE_OPTIONS}
            value={caseType}
            onChange={(e) => setCaseType(e.target.value as CaseType | 'all')}
          />

          <Select
            label="Estado"
            htmlFor="filter-case-status"
            options={CASE_STATUS_OPTIONS}
            value={status}
            onChange={(e) => setStatus(e.target.value as CaseStatus | 'all')}
          />

          <Select
            label="Fecha"
            htmlFor="filter-case-date"
            options={DATE_RANGE_OPTIONS}
            value={dateRange}
            onChange={(e) => setDateRange(e.target.value as DateRangeFilter)}
          />

          <Select
            label="Responsable"
            htmlFor="filter-case-admin"
            options={adminFilterOptions}
            value={assignedAdminId}
            onChange={(e) => setAssignedAdminId(e.target.value)}
          />
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-outline-variant/40 pt-3">
          <p className="text-xs text-on-surface-variant">
            Mostrando{' '}
            <strong className="text-on-surface">
              {casesQuery.data?.length ?? 0}
            </strong>{' '}
            casos con los filtros actuales.
          </p>
          <Button
            variant="ghost"
            size="sm"
            leftIcon="filter_alt_off"
            onClick={handleResetFilters}
          >
            Limpiar filtros
          </Button>
        </div>
      </section>

      {/* Main Content Area: 4 Required Visual States */}
      {casesQuery.isLoading ? (
        <PageLoadingSkeleton />
      ) : casesQuery.isError ? (
        <ErrorState
          message={mapDomainErrorToUI(casesQuery.error).message}
          onRetry={() => void casesQuery.refetch()}
        />
      ) : !casesQuery.data || casesQuery.data.length === 0 ? (
        <EmptyState
          title="No encontramos casos con esos filtros"
          description="Limpia los filtros para volver a ver todos los tickets, reclamaciones y reportes."
          actionLabel="Mostrar todos los casos"
          onAction={handleResetFilters}
        />
      ) : (
        <section className="overflow-hidden rounded-xl bg-surface-container-lowest shadow-[0_2px_16px_rgba(58,48,42,0.04)]">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-outline-variant/40 px-6 py-4">
            <div className="flex items-center gap-3">
              <h2 className="font-headline text-2xl font-bold text-on-surface">
                Listado de Casos
              </h2>
              <Badge tone="secondary">
                {casesQuery.data.length} casos
              </Badge>
            </div>
            <span className="text-xs text-secondary">
              Ordenados del más reciente al más antiguo
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-outline-variant/40 bg-surface-container-low/60 text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">
                  <th scope="col" className="px-3 py-3">
                    Folio y Asunto
                  </th>
                  <th scope="col" className="px-2.5 py-3">
                    Solicitante
                  </th>
                  <th scope="col" className="px-2.5 py-3">
                    Tipo y Estado
                  </th>
                  <th scope="col" className="px-2.5 py-3">
                    Responsable
                  </th>
                  <th scope="col" className="px-2.5 py-3">
                    Fecha
                  </th>
                  <th scope="col" className="px-3 py-3 text-right">
                    Acciones
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant/30">
                {casesQuery.data.map((item, idx) => {
                  const isClosed =
                    item.status === 'closed' ||
                    item.status === 'attended' ||
                    item.status === 'dismissed'
                  return (
                    <tr
                      key={item.id}
                      className={`${
                        idx % 2 === 1 ? 'bg-surface-container-low/25' : ''
                      } hover:bg-surface-container-low/60 transition-colors`}
                    >
                      <td className="px-3 py-3.5 align-top max-w-[175px]">
                        <span className="font-mono text-[11px] font-bold text-primary">
                          {item.folio}
                        </span>
                        <p
                          className="mt-0.5 truncate text-xs font-semibold text-on-surface"
                          title={item.subject}
                        >
                          {item.subject}
                        </p>
                      </td>
                      <td className="px-2.5 py-3.5 align-top max-w-[140px]">
                        <div className="flex items-center gap-2 min-w-0">
                          <Avatar
                            name={item.reporter?.full_name ?? 'Sistema'}
                            tone={
                              item.source === 'system' ? 'tertiary' : 'secondary'
                            }
                            size="sm"
                            className="hidden xl:inline-flex"
                          />
                          <div className="min-w-0">
                            <p className="truncate font-medium text-on-surface">
                              {item.reporter?.full_name ?? 'Sistema'}
                            </p>
                            <p className="truncate text-[11px] text-on-surface-variant">
                              {item.reporter?.email ?? 'Aviso automático'}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-2.5 py-3.5 align-top">
                        <div className="flex flex-col items-start gap-1">
                          <CaseTypeBadge type={item.case_type} />
                          <CaseStatusBadge status={item.status} />
                        </div>
                      </td>
                      <td className="px-2.5 py-3.5 align-top">
                        <select
                          aria-label={`Asignar responsable al caso ${item.folio}`}
                          value={item.assigned_admin_id ?? ''}
                          disabled={assignMutation.isPending}
                          onChange={(e) =>
                            void handleAssignAdmin(item.id, e.target.value)
                          }
                          className={`w-[122px] rounded-lg border border-outline-variant/70 bg-surface-container-lowest px-2 py-1.5 text-xs font-medium focus:border-primary focus:outline-none ${
                            !item.assigned_admin_id
                              ? 'text-tertiary font-semibold'
                              : 'text-on-surface'
                          }`}
                        >
                          <option value="">Sin asignar</option>
                          {(adminsQuery.data ?? []).map((adm) => (
                            <option key={adm.id} value={adm.id}>
                              {adm.full_name}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="px-2.5 py-3.5 align-top whitespace-nowrap font-mono text-[11px] text-on-surface-variant">
                        {formatShortDateMX(item.created_at)}
                      </td>
                      <td className="px-3 py-3.5 align-top text-right whitespace-nowrap">
                        <div className="inline-flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="px-2"
                            onClick={() => {
                              setSelectedCase(item)
                              quickForm.reset({ resolution_notes: '' })
                            }}
                          >
                            Resumen
                          </Button>
                          <Button
                            variant={isClosed ? 'secondary' : 'primary'}
                            size="sm"
                            className="px-2.5"
                            onClick={() => navigate(getTargetRouteForCase(item))}
                          >
                            {isClosed ? 'Abrir caso' : 'Atender'}
                          </Button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* Quick Action Slide-Over Drawer */}
      <SlideOverDrawer
        open={selectedCase !== null}
        eyebrow={`RESUMEN DEL CASO ${selectedCase?.folio ?? ''}`}
        title={selectedCase?.subject ?? ''}
        subtitle={
          selectedCase
            ? `Solicitante: ${selectedCase.reporter?.full_name ?? 'Alerta del sistema'} · Recibido el ${formatShortDateMX(selectedCase.created_at)}`
            : undefined
        }
        onClose={() => setSelectedCase(null)}
        footer={
          selectedCase && (
            <div className="flex flex-wrap justify-end gap-3">
              <Button variant="secondary" onClick={() => setSelectedCase(null)}>
                Cerrar resumen
              </Button>
              <Button
                variant="primary"
                rightIcon="open_in_new"
                onClick={() => {
                  const target = getTargetRouteForCase(selectedCase)
                  setSelectedCase(null)
                  navigate(target)
                }}
              >
                Abrir pantalla completa
              </Button>
            </div>
          )
        }
      >
        {selectedCase && (
          <div className="space-y-5">
            <div className="flex flex-wrap gap-2">
              <CaseTypeBadge type={selectedCase.case_type} />
              <CaseStatusBadge status={selectedCase.status} />
            </div>

            <div className="rounded-xl bg-surface-container-low p-4">
              <p className="text-[11px] font-bold uppercase tracking-wider text-on-surface-variant">
                Descripción del caso
              </p>
              <p className="mt-2 text-sm leading-relaxed text-on-surface">
                {selectedCase.description}
              </p>
            </div>

            {selectedCase.case_type === 'claim' ? (
              <div className="rounded-xl bg-tertiary-fixed/70 p-4 text-xs text-on-tertiary-fixed">
                Las reclamaciones involucran dinero retenido. Pulsa{' '}
                <strong>Abrir pantalla completa</strong> para revisar las
                pruebas y decidir cómo se entregará el pago.
              </div>
            ) : (
              selectedCase.status !== 'closed' &&
              selectedCase.status !== 'resolved' &&
              selectedCase.status !== 'attended' &&
              selectedCase.status !== 'dismissed' && (
                <form
                  onSubmit={quickForm.handleSubmit((values) => {
                    setPendingQuickResolve(values)
                  })}
                  className="space-y-4 rounded-xl border border-outline-variant/60 bg-surface-container-lowest p-4"
                >
                  <div>
                    <Textarea
                      label="Resolver rápidamente con una nota"
                      htmlFor="quick-resolution-notes"
                      rows={4}
                      required
                      placeholder="Ejemplo: Se confirmó el pago con el usuario y se actualizó el estado de su solicitud..."
                      error={quickForm.formState.errors.resolution_notes?.message}
                      {...quickForm.register('resolution_notes')}
                    />
                    <p className="mt-1 text-right text-[11px] text-secondary">
                      {(quickNotesValue ?? '').trim().length} / 8 caracteres
                      mínimos
                    </p>
                  </div>
                  <Button
                    type="submit"
                    leftIcon="check_circle"
                    className="w-full"
                  >
                    {selectedCase.case_type === 'report'
                      ? 'Marcar reporte como Atendido'
                      : 'Marcar ticket como Resuelto'}
                  </Button>
                </form>
              )
            )}
          </div>
        )}
      </SlideOverDrawer>

      {/* Poka-Yoke Confirmation for Quick Resolve */}
      <ConfirmActionModal
        open={pendingQuickResolve !== null && selectedCase !== null}
        title="¿Confirmas marcar este caso como atendido?"
        description="Se guardará tu nota de resolución y cambiará el estado del caso en la bandeja."
        confirmLabel="Sí, guardar y resolver"
        cancelLabel="Cancelar"
        loading={quickResolveAction.isPending}
        onCancel={() => setPendingQuickResolve(null)}
        onConfirm={() => {
          if (!pendingQuickResolve || !selectedCase) return
          void quickResolveAction
            .execute(selectedCase.id, pendingQuickResolve)
            .catch((err) => {
              setPendingQuickResolve(null)
              pushToast(mapDomainErrorToUI(err).message, 'error')
            })
        }}
        details={
          pendingQuickResolve &&
          selectedCase && (
            <div className="space-y-1 text-xs">
              <p>
                <strong>Caso:</strong> {selectedCase.folio} —{' '}
                {selectedCase.subject}
              </p>
              <p>
                <strong>Nota:</strong> {pendingQuickResolve.resolution_notes}
              </p>
            </div>
          )
        }
      />

      {/* Create New Case Drawer */}
      <SlideOverDrawer
        open={newCaseOpen}
        eyebrow="NUEVO REGISTRO"
        title="Registrar Nuevo Caso"
        subtitle="Usa este formulario para dar de alta un ticket de soporte o un reporte administrativo. Los campos con * son obligatorios."
        onClose={() => setNewCaseOpen(false)}
      >
        <form
          onSubmit={createForm.handleSubmit(async (values) => {
            try {
              await createCaseAction.execute(values)
            } catch (err) {
              pushToast(mapDomainErrorToUI(err).message, 'error')
            }
          })}
          noValidate
          className="space-y-5"
        >
          <Select
            label="1. Tipo de caso"
            htmlFor="new-case-type"
            required
            options={[
              { value: 'ticket', label: 'Ticket de soporte' },
              { value: 'report', label: 'Reporte de moderación' },
            ]}
            error={createForm.formState.errors.case_type?.message}
            {...createForm.register('case_type')}
          />

          {watchNewCaseType === 'ticket' && (
            <Select
              label="2. Categoría del ticket"
              htmlFor="new-ticket-category"
              required
              options={TICKET_CATEGORY_OPTIONS}
              error={createForm.formState.errors.ticket_category?.message}
              {...createForm.register('ticket_category')}
            />
          )}

          <Input
            label="Asunto breve"
            htmlFor="new-case-subject"
            required
            placeholder="Ejemplo: Aclaración de depósito pendiente del trabajo #TRAB-8492"
            error={createForm.formState.errors.subject?.message}
            {...createForm.register('subject')}
          />

          <Textarea
            label="Descripción completa"
            htmlFor="new-case-description"
            rows={5}
            required
            placeholder="Ejemplo: El trabajador reportó por correo que su transferencia sigue pendiente desde ayer..."
            error={createForm.formState.errors.description?.message}
            {...createForm.register('description')}
          />

          <div className="flex justify-end gap-3 pt-2">
            <Button variant="secondary" onClick={() => setNewCaseOpen(false)}>
              Cancelar
            </Button>
            <Button
              type="submit"
              leftIcon="add"
              loading={createCaseAction.isPending}
              loadingText="Guardando caso..."
            >
              Crear Caso
            </Button>
          </div>
        </form>
      </SlideOverDrawer>
    </div>
  )
}

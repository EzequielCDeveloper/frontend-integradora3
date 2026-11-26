import type {
  AccountStatus,
  CaseStatus,
  CaseType,
  ModerationStatus,
  PaymentStatus,
  TicketCategory,
} from '@/shared/types/domain.types'
import type { BadgeTone } from '@/shared/theme/sahara.tokens'
import { Badge } from '@/shared/components/atoms/Badge'

const CASE_STATUS_META: Record<CaseStatus, { label: string; tone: BadgeTone }> = {
  open: { label: 'Abierto', tone: 'primary' },
  pending: { label: 'Pendiente', tone: 'primary' },
  in_review: { label: 'En revisión', tone: 'secondary' },
  resolved: { label: 'Resuelto', tone: 'success' },
  closed: { label: 'Cerrado', tone: 'neutral' },
  attended: { label: 'Atendido', tone: 'success' },
  dismissed: { label: 'Desestimado', tone: 'neutral' },
}

export function CaseStatusBadge({ status }: { status: CaseStatus }) {
  const meta = CASE_STATUS_META[status]
  return (
    <Badge
      tone={meta.tone}
      dot
      pulseDot={status === 'open' || status === 'pending'}
    >
      {meta.label}
    </Badge>
  )
}

const CASE_TYPE_META: Record<
  CaseType,
  { label: string; icon: string; tone: BadgeTone }
> = {
  claim: { label: 'Reclamación', icon: 'gavel', tone: 'tertiary' },
  ticket: { label: 'Ticket', icon: 'confirmation_number', tone: 'secondary' },
  report: { label: 'Reporte', icon: 'flag', tone: 'primary' },
}

export function CaseTypeBadge({ type }: { type: CaseType }) {
  const meta = CASE_TYPE_META[type]
  return (
    <Badge tone={meta.tone} icon={meta.icon}>
      {meta.label}
    </Badge>
  )
}

const ACCOUNT_STATUS_META: Record<
  AccountStatus,
  { label: string; tone: BadgeTone }
> = {
  active: { label: 'Activa', tone: 'primary' },
  warned: { label: 'Advertida', tone: 'success' },
  suspended: { label: 'Suspendida', tone: 'tertiary' },
  blocked: { label: 'Bloqueada', tone: 'error' },
  soft_deleted: { label: 'Dada de baja', tone: 'neutral' },
}

export function AccountStatusBadge({
  status,
  suffix,
}: {
  status: AccountStatus
  suffix?: string
}) {
  const meta = ACCOUNT_STATUS_META[status]
  return (
    <Badge tone={meta.tone} dot>
      {suffix ? `${meta.label} (${suffix})` : meta.label}
    </Badge>
  )
}

const PAYMENT_STATUS_META: Record<
  PaymentStatus,
  { label: string; tone: BadgeTone; icon?: string }
> = {
  not_started: { label: 'Sin iniciar', tone: 'neutral' },
  payment_pending: { label: 'Cobro pendiente', tone: 'primary' },
  confirmed: { label: 'Retenido en resguardo', tone: 'secondary' },
  failed: { label: 'Cobro fallido', tone: 'error' },
  in_claim: { label: 'En reclamación', tone: 'tertiary' },
  transfer_pending: { label: 'Envío en proceso', tone: 'primary' },
  transfer_failed: { label: 'Transferencia fallida', tone: 'error' },
  transferred: { label: 'Transferido', tone: 'neutral', icon: 'check' },
  partial_settlement_pending: {
    label: 'Pago dividido en proceso',
    tone: 'primary',
  },
  partial_settlement_failed: {
    label: 'Pago dividido fallido',
    tone: 'error',
  },
  partial_settlement_completed: {
    label: 'Pago dividido completado',
    tone: 'success',
    icon: 'check',
  },
  refund_failed: { label: 'Reembolso fallido', tone: 'error' },
  refunded: { label: 'Reembolsado', tone: 'tertiary' },
  cancelled: { label: 'Cancelado', tone: 'neutral' },
}

export function PaymentStatusBadge({ status }: { status: PaymentStatus }) {
  const meta = PAYMENT_STATUS_META[status]
  return (
    <Badge tone={meta.tone} icon={meta.icon} dot={!meta.icon}>
      {meta.label}
    </Badge>
  )
}

const MODERATION_STATUS_META: Record<
  ModerationStatus,
  { label: string; tone: BadgeTone }
> = {
  visible: { label: 'Visible al público', tone: 'primary' },
  hidden: { label: 'Oculto temporalmente', tone: 'secondary' },
  removed: { label: 'Retirado definitivamente', tone: 'tertiary' },
}

export function ModerationStatusBadge({ status }: { status: ModerationStatus }) {
  const meta = MODERATION_STATUS_META[status]
  return <Badge tone={meta.tone}>{meta.label}</Badge>
}

const TICKET_CATEGORY_META: Record<
  TicketCategory,
  { label: string; tone: BadgeTone }
> = {
  account: { label: 'Cuenta', tone: 'secondary' },
  publication: { label: 'Publicación', tone: 'secondary' },
  application: { label: 'Postulación', tone: 'secondary' },
  job: { label: 'Trabajo', tone: 'primary' },
  payment: { label: 'Pagos', tone: 'error' },
  technical: { label: 'Problema técnico', tone: 'tertiary' },
}

export function TicketCategoryBadge({
  category,
}: {
  category: TicketCategory | null
}) {
  if (!category) return null
  const meta = TICKET_CATEGORY_META[category]
  return <Badge tone={meta.tone}>{meta.label}</Badge>
}

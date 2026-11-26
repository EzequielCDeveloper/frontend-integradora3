import { Badge } from '@/shared/components/atoms/Badge'
import { Icon } from '@/shared/components/atoms/Icon'
import type { BadgeTone } from '@/shared/theme/sahara.tokens'

export interface KpiCardProps {
  label: string
  value: string | number
  icon: string
  iconBgClass?: string
  iconTextClass?: string
  badgeText?: string
  badgeTone?: BadgeTone
  footerText?: string
  progressPct?: number
  cardTone?: 'default' | 'warm' | 'error'
  valueClassName?: string
}

export function KpiCard({
  label,
  value,
  icon,
  iconBgClass = 'bg-primary-fixed/70',
  iconTextClass = 'text-primary',
  badgeText,
  badgeTone = 'primary',
  footerText,
  progressPct,
  cardTone = 'default',
  valueClassName = 'text-on-surface',
}: KpiCardProps) {
  const containerBg =
    cardTone === 'warm'
      ? 'bg-primary-fixed/45'
      : cardTone === 'error'
        ? 'bg-error-container'
        : 'bg-surface-container-lowest'

  return (
    <article
      className={`min-w-0 rounded-xl p-5 sm:p-6 shadow-[0_2px_16px_rgba(58,48,42,0.04)] flex flex-col justify-between gap-4 ${containerBg}`}
    >
      <div className="flex items-start justify-between gap-2.5">
        <div className="min-w-0">
          <p className="text-[11px] font-bold uppercase leading-snug tracking-wider text-on-surface-variant">
            {label}
          </p>
          <p
            className={`mt-2 font-headline text-3xl sm:text-4xl font-bold leading-none tracking-tight ${valueClassName}`}
          >
            {value}
          </p>
        </div>
        <div
          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${iconBgClass} ${iconTextClass}`}
        >
          <Icon name={icon} className="text-[19px]" />
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          {footerText && (
            <span className="text-xs text-on-surface-variant">{footerText}</span>
          )}
          {badgeText && <Badge tone={badgeTone}>{badgeText}</Badge>}
        </div>
        {typeof progressPct === 'number' && (
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-container-highest">
            <div
              className="h-full rounded-full bg-primary transition-all"
              style={{ width: `${Math.min(100, Math.max(0, progressPct))}%` }}
            />
          </div>
        )}
      </div>
    </article>
  )
}

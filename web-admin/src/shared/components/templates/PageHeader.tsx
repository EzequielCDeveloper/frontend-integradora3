import type { ReactNode } from 'react'

export interface PageHeaderProps {
  eyebrow: string
  liveTag?: string
  title: string
  subtitle?: string
  actions?: ReactNode
}

export function PageHeader({
  eyebrow,
  liveTag,
  title,
  subtitle,
  actions,
}: PageHeaderProps) {
  return (
    <header className="mb-8 flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2 text-[11px] font-bold uppercase tracking-[0.14em] text-on-surface-variant">
          <span>{eyebrow}</span>
          {liveTag && (
            <>
              <span className="text-outline-variant" aria-hidden="true">
                /
              </span>
              <span className="inline-flex items-center gap-1.5 text-primary">
                <span
                  className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse"
                  aria-hidden="true"
                />
                {liveTag}
              </span>
            </>
          )}
        </div>
        <h1 className="mt-2 font-headline text-3xl sm:text-4xl lg:text-[42px] font-bold leading-tight text-on-surface">
          {title}
        </h1>
        {subtitle && (
          <p className="mt-2 max-w-2xl text-sm text-on-surface-variant">
            {subtitle}
          </p>
        )}
      </div>

      {actions && (
        <div className="flex flex-wrap items-center gap-3 shrink-0">
          {actions}
        </div>
      )}
    </header>
  )
}

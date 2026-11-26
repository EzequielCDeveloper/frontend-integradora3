import { Button } from '@/shared/components/atoms/Button'
import { Icon } from '@/shared/components/atoms/Icon'
import { Skeleton } from '@/shared/components/atoms/Skeleton'

export function EmptyState({
  icon = 'search_off',
  title,
  description,
  actionLabel,
  onAction,
}: {
  icon?: string
  title: string
  description: string
  actionLabel?: string
  onAction?: () => void
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl bg-surface-container-low/70 px-6 py-14 text-center">
      <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-surface-container-high text-secondary">
        <Icon name={icon} className="text-[24px]" />
      </div>
      <h3 className="font-headline text-2xl font-semibold text-on-surface">
        {title}
      </h3>
      <p className="mt-1.5 max-w-md text-sm text-on-surface-variant">
        {description}
      </p>
      {actionLabel && onAction && (
        <Button variant="secondary" className="mt-5" onClick={onAction}>
          {actionLabel}
        </Button>
      )}
    </div>
  )
}

export function ErrorState({
  title = 'No se pudo cargar la información',
  message,
  onRetry,
}: {
  title?: string
  message: string
  onRetry?: () => void
}) {
  return (
    <div
      role="alert"
      className="flex flex-col items-center justify-center rounded-xl border border-error/25 bg-error-container/50 px-6 py-12 text-center"
    >
      <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-error-container text-error">
        <Icon name="error_outline" className="text-[24px]" />
      </div>
      <h3 className="font-headline text-2xl font-semibold text-on-error-container">
        {title}
      </h3>
      <p className="mt-1.5 max-w-md text-sm text-on-error-container/90">
        {message}
      </p>
      {onRetry && (
        <Button
          variant="primary"
          leftIcon="refresh"
          className="mt-5"
          onClick={onRetry}
        >
          Reintentar
        </Button>
      )}
    </div>
  )
}

export function PageLoadingSkeleton() {
  return (
    <div className="space-y-6" aria-label="Cargando contenido" role="status">
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <div
            key={index}
            className="rounded-xl bg-surface-container-lowest p-6 shadow-[0_2px_16px_rgba(58,48,42,0.04)]"
          >
            <Skeleton className="h-4 w-28" />
            <Skeleton className="mt-4 h-9 w-24" />
            <Skeleton className="mt-4 h-3 w-40" />
          </div>
        ))}
      </div>
      <div className="rounded-xl bg-surface-container-lowest p-6 shadow-[0_2px_16px_rgba(58,48,42,0.04)] space-y-4">
        <Skeleton className="h-6 w-52" />
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-12 w-full" />
      </div>
    </div>
  )
}

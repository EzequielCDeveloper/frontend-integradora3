import { useEffect, type ReactNode } from 'react'
import { Icon } from '@/shared/components/atoms/Icon'

export interface SlideOverDrawerProps {
  open: boolean
  eyebrow?: string
  title: string
  subtitle?: string
  widthClass?: string
  onClose: () => void
  footer?: ReactNode
  children: ReactNode
}

export function SlideOverDrawer({
  open,
  eyebrow,
  title,
  subtitle,
  widthClass = 'max-w-lg',
  onClose,
  footer,
  children,
}: SlideOverDrawerProps) {
  useEffect(() => {
    if (!open) return
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose()
      }
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [open, onClose])

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end bg-inverse-surface/35 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="drawer-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div
        className={`flex h-full w-full ${widthClass} flex-col bg-surface shadow-2xl`}
      >
        <div className="flex items-start justify-between gap-4 border-b border-outline-variant/60 bg-surface-container-lowest px-6 py-5">
          <div className="min-w-0">
            {eyebrow && (
              <p className="text-[11px] font-bold uppercase tracking-widest text-primary">
                {eyebrow}
              </p>
            )}
            <h2
              id="drawer-title"
              className="mt-1 font-headline text-2xl sm:text-3xl font-bold text-on-surface"
            >
              {title}
            </h2>
            {subtitle && (
              <p className="mt-1 text-xs text-on-surface-variant">{subtitle}</p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar panel"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface cursor-pointer"
          >
            <Icon name="close" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5">{children}</div>

        {footer && (
          <div className="border-t border-outline-variant/60 bg-surface-container-low px-6 py-4">
            {footer}
          </div>
        )}
      </div>
    </div>
  )
}

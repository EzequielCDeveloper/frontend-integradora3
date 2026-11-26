import { useEffect, type ReactNode } from 'react'
import { Button, type ButtonVariant } from '@/shared/components/atoms/Button'
import { Icon } from '@/shared/components/atoms/Icon'

export interface ConfirmActionModalProps {
  open: boolean
  title: string
  description: string
  details?: ReactNode
  confirmLabel: string
  cancelLabel?: string
  confirmVariant?: ButtonVariant
  loading?: boolean
  onConfirm: () => void
  onCancel: () => void
}

export function ConfirmActionModal({
  open,
  title,
  description,
  details,
  confirmLabel,
  cancelLabel = 'Cancelar',
  confirmVariant = 'primary',
  loading = false,
  onConfirm,
  onCancel,
}: ConfirmActionModalProps) {
  useEffect(() => {
    if (!open) return
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !loading) {
        onCancel()
      }
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [open, loading, onCancel])

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-inverse-surface/40 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-modal-title"
    >
      <div className="w-full max-w-lg rounded-2xl bg-surface-container-lowest p-6 sm:p-7 shadow-xl">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-tertiary-fixed text-tertiary">
            <Icon name="gavel" />
          </div>
          <div className="min-w-0 flex-1">
            <h2
              id="confirm-modal-title"
              className="font-headline text-2xl font-bold text-on-surface"
            >
              {title}
            </h2>
            <p className="mt-1.5 text-sm text-on-surface-variant">
              {description}
            </p>
          </div>
        </div>

        {details && (
          <div className="mt-5 rounded-xl bg-surface-container-low p-4 text-sm text-on-surface">
            {details}
          </div>
        )}

        <div className="mt-6 flex flex-wrap justify-end gap-3">
          <Button
            variant="secondary"
            disabled={loading}
            onClick={onCancel}
          >
            {cancelLabel}
          </Button>
          <Button
            variant={confirmVariant}
            loading={loading}
            loadingText="Procesando..."
            onClick={onConfirm}
          >
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  )
}

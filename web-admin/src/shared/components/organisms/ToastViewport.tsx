import { Icon } from '@/shared/components/atoms/Icon'
import { useToastStore } from '@/shared/hooks/useToast'

export function ToastViewport() {
  const toasts = useToastStore((s) => s.toasts)
  const dismiss = useToastStore((s) => s.dismiss)

  if (toasts.length === 0) return null

  return (
    <div
      aria-live="polite"
      aria-atomic="true"
      className="fixed bottom-5 right-5 z-50 flex max-w-md flex-col gap-2.5"
    >
      {toasts.map((toast) => {
        const toneClasses =
          toast.tone === 'error'
            ? 'bg-error text-on-error'
            : toast.tone === 'success'
              ? 'bg-on-surface text-surface'
              : 'bg-inverse-surface text-inverse-on-surface'
        const iconName =
          toast.tone === 'error'
            ? 'error'
            : toast.tone === 'success'
              ? 'check_circle'
              : 'info'

        return (
          <div
            key={toast.id}
            role="status"
            className={`flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium shadow-lg ${toneClasses}`}
          >
            <Icon name={iconName} className="shrink-0 text-[18px]" />
            <span className="flex-1">{toast.message}</span>
            <button
              type="button"
              aria-label="Cerrar notificación"
              onClick={() => dismiss(toast.id)}
              className="opacity-80 hover:opacity-100 cursor-pointer"
            >
              <Icon name="close" className="text-[16px]" />
            </button>
          </div>
        )
      })}
    </div>
  )
}

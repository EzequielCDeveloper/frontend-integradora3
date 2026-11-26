import { create } from 'zustand'

export type ToastTone = 'info' | 'success' | 'error'

export interface ToastItem {
  id: string
  message: string
  tone: ToastTone
}

interface ToastStore {
  toasts: ToastItem[]
  push: (message: string, tone?: ToastTone) => void
  dismiss: (id: string) => void
  clear: () => void
}

export const useToastStore = create<ToastStore>((set) => ({
  toasts: [],
  push: (message, tone = 'info') => {
    const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
    set((state) => ({ toasts: [...state.toasts.slice(-3), { id, message, tone }] }))
    window.setTimeout(() => {
      set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) }))
    }, 4500)
  },
  dismiss: (id) =>
    set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) })),
  clear: () => set({ toasts: [] }),
}))

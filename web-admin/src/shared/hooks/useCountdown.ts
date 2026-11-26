import { useEffect, useState } from 'react'

export interface CountdownState {
  isExpired: boolean
  days: number
  hours: number
  minutes: number
  formatted: string
}

function computeCountdown(
  deadlineIso: string | null | undefined,
  nowMs: number,
): CountdownState {
  if (!deadlineIso) {
    return { isExpired: false, days: 0, hours: 0, minutes: 0, formatted: '—' }
  }
  const diffMs = new Date(deadlineIso).getTime() - nowMs
  if (Number.isNaN(diffMs) || diffMs <= 0) {
    return {
      isExpired: true,
      days: 0,
      hours: 0,
      minutes: 0,
      formatted: 'Ventana vencida (listo para cierre automático)',
    }
  }
  const totalMinutes = Math.floor(diffMs / 60_000)
  const days = Math.floor(totalMinutes / (60 * 24))
  const hours = Math.floor((totalMinutes % (60 * 24)) / 60)
  const minutes = totalMinutes % 60
  return {
    isExpired: false,
    days,
    hours,
    minutes,
    formatted: `${days}d ${hours}h ${minutes}m restantes`,
  }
}

export function useCountdown(deadlineIso: string | null | undefined): CountdownState {
  const [nowMs, setNowMs] = useState(() => Date.now())

  useEffect(() => {
    if (!deadlineIso) return
    const interval = window.setInterval(() => {
      setNowMs(Date.now())
    }, 30_000)
    return () => window.clearInterval(interval)
  }, [deadlineIso])

  return computeCountdown(deadlineIso, nowMs)
}

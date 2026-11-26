import type { ReactNode } from 'react'
import { BADGE_TONE_CLASSES, type BadgeTone } from '@/shared/theme/sahara.tokens'
import { Icon } from './Icon'

export interface BadgeProps {
  tone?: BadgeTone
  icon?: string
  dot?: boolean
  pulseDot?: boolean
  className?: string
  children: ReactNode
}

const DOT_COLOR: Record<BadgeTone, string> = {
  primary: 'bg-primary',
  secondary: 'bg-secondary',
  tertiary: 'bg-tertiary',
  error: 'bg-error',
  neutral: 'bg-outline',
  success: 'bg-on-primary-fixed-variant',
}

export function Badge({
  tone = 'secondary',
  icon,
  dot = false,
  pulseDot = false,
  className = '',
  children,
}: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold leading-none whitespace-nowrap ${BADGE_TONE_CLASSES[tone]} ${className}`}
    >
      {dot && (
        <span
          className={`h-1.5 w-1.5 rounded-full ${DOT_COLOR[tone]} ${pulseDot ? 'animate-pulse' : ''}`}
          aria-hidden="true"
        />
      )}
      {icon && <Icon name={icon} className="text-[14px]" />}
      {children}
    </span>
  )
}

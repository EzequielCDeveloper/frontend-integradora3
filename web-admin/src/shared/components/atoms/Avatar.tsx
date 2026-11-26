import { getInitials } from '@/shared/utils/format'

interface AvatarProps {
  name: string
  tone?: 'primary' | 'secondary' | 'tertiary'
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

const TONE_MAP = {
  primary: 'bg-primary text-on-primary',
  secondary: 'bg-secondary-container text-on-surface',
  tertiary: 'bg-tertiary-fixed text-on-tertiary-fixed',
}

const SIZE_MAP = {
  sm: 'h-8 w-8 text-xs',
  md: 'h-10 w-10 text-sm',
  lg: 'h-12 w-12 text-base',
}

export function Avatar({
  name,
  tone = 'secondary',
  size = 'md',
  className = '',
}: AvatarProps) {
  return (
    <span
      aria-hidden="true"
      className={`inline-flex shrink-0 items-center justify-center rounded-full font-headline font-bold ${TONE_MAP[tone]} ${SIZE_MAP[size]} ${className}`}
    >
      {getInitials(name)}
    </span>
  )
}

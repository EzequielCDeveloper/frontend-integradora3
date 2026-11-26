import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { Icon } from './Icon'

export type ButtonVariant =
  | 'primary'
  | 'secondary'
  | 'tertiary'
  | 'danger'
  | 'ghost'
export type ButtonSize = 'sm' | 'md' | 'lg'

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?: ButtonSize
  loading?: boolean
  loadingText?: string
  leftIcon?: string
  rightIcon?: string
  children: ReactNode
}

const VARIANT_CLASSES: Record<ButtonVariant, string> = {
  primary:
    'bg-primary text-on-primary hover:bg-on-primary-fixed-variant shadow-sm',
  secondary:
    'bg-surface-container-low text-on-surface border border-outline-variant/70 hover:bg-surface-container-high',
  tertiary:
    'bg-tertiary text-on-tertiary hover:bg-on-tertiary-fixed-variant shadow-sm',
  danger:
    'bg-error text-on-error hover:bg-on-error-container shadow-sm',
  ghost:
    'bg-transparent text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface',
}

const SIZE_CLASSES: Record<ButtonSize, string> = {
  sm: 'px-3 py-1.5 text-xs rounded-lg gap-1.5',
  md: 'px-4 py-2.5 text-sm rounded-lg gap-2',
  lg: 'px-5 py-3.5 text-sm rounded-lg gap-2',
}

export function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  loadingText,
  leftIcon,
  rightIcon,
  disabled,
  className = '',
  type = 'button',
  children,
  ...rest
}: ButtonProps) {
  const isDisabled = disabled || loading

  return (
    <button
      type={type}
      disabled={isDisabled}
      aria-busy={loading || undefined}
      className={`inline-flex items-center justify-center font-semibold transition-colors cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed ${VARIANT_CLASSES[variant]} ${SIZE_CLASSES[size]} ${className}`}
      {...rest}
    >
      {loading ? (
        <Icon name="progress_activity" className="animate-spin text-[18px]" />
      ) : (
        leftIcon && <Icon name={leftIcon} className="text-[18px]" />
      )}
      <span>{loading && loadingText ? loadingText : children}</span>
      {!loading && rightIcon && <Icon name={rightIcon} className="text-[18px]" />}
    </button>
  )
}

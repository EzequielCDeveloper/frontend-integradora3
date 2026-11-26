import {
  forwardRef,
  type InputHTMLAttributes,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from 'react'
import { Icon } from './Icon'

export interface FieldWrapperProps {
  label?: string
  htmlFor?: string
  error?: string
  hint?: string
  required?: boolean
}

export interface InputProps
  extends InputHTMLAttributes<HTMLInputElement>,
    FieldWrapperProps {
  leftIcon?: string
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { label, htmlFor, error, hint, required, leftIcon, className = '', id, ...rest },
  ref,
) {
  const inputId = id ?? htmlFor
  return (
    <div className="space-y-1.5">
      {label && (
        <label
          htmlFor={inputId}
          className="block text-[11px] font-bold uppercase tracking-wider text-on-surface-variant"
        >
          {label}
          {required && <span className="ml-0.5 text-error">*</span>}
        </label>
      )}
      <div className="relative">
        {leftIcon && (
          <Icon
            name={leftIcon}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[18px] text-secondary"
          />
        )}
        <input
          ref={ref}
          id={inputId}
          aria-invalid={error ? 'true' : undefined}
          className={`w-full rounded-lg border bg-surface-container-lowest py-2.5 text-sm text-on-surface placeholder:text-secondary/75 transition-colors focus:border-primary focus:outline-none ${
            leftIcon ? 'pl-10 pr-3.5' : 'px-3.5'
          } ${
            error ? 'border-error' : 'border-outline-variant/80'
          } ${className}`}
          {...rest}
        />
      </div>
      {error && (
        <p role="alert" className="text-xs font-medium text-error">
          {error}
        </p>
      )}
      {!error && hint && <p className="text-xs text-secondary">{hint}</p>}
    </div>
  )
})

export interface SelectOption {
  value: string
  label: string
}

export interface SelectProps
  extends SelectHTMLAttributes<HTMLSelectElement>,
    FieldWrapperProps {
  options: readonly SelectOption[]
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
  { label, htmlFor, error, hint, required, options, className = '', id, ...rest },
  ref,
) {
  const selectId = id ?? htmlFor
  return (
    <div className="space-y-1.5">
      {label && (
        <label
          htmlFor={selectId}
          className="block text-[11px] font-bold uppercase tracking-wider text-on-surface-variant"
        >
          {label}
          {required && <span className="ml-0.5 text-error">*</span>}
        </label>
      )}
      <select
        ref={ref}
        id={selectId}
        aria-invalid={error ? 'true' : undefined}
        className={`w-full rounded-lg border bg-surface-container-lowest px-3.5 py-2.5 text-sm text-on-surface transition-colors focus:border-primary focus:outline-none ${
          error ? 'border-error' : 'border-outline-variant/80'
        } ${className}`}
        {...rest}
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
      {error && (
        <p role="alert" className="text-xs font-medium text-error">
          {error}
        </p>
      )}
      {!error && hint && <p className="text-xs text-secondary">{hint}</p>}
    </div>
  )
})

export interface TextareaProps
  extends TextareaHTMLAttributes<HTMLTextAreaElement>,
    FieldWrapperProps {}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  function Textarea(
    { label, htmlFor, error, hint, required, className = '', id, ...rest },
    ref,
  ) {
    const textareaId = id ?? htmlFor
    return (
      <div className="space-y-1.5">
        {label && (
          <label
            htmlFor={textareaId}
            className="block text-[11px] font-bold uppercase tracking-wider text-on-surface-variant"
          >
            {label}
            {required && <span className="ml-0.5 text-error">*</span>}
          </label>
        )}
        <textarea
          ref={ref}
          id={textareaId}
          aria-invalid={error ? 'true' : undefined}
          className={`w-full rounded-lg border bg-surface-container-lowest px-3.5 py-2.5 text-sm text-on-surface placeholder:text-secondary/75 transition-colors focus:border-primary focus:outline-none ${
            error ? 'border-error' : 'border-outline-variant/80'
          } ${className}`}
          {...rest}
        />
        {error && (
          <p role="alert" className="text-xs font-medium text-error">
            {error}
          </p>
        )}
        {!error && hint && <p className="text-xs text-secondary">{hint}</p>}
      </div>
    )
  },
)

interface IconProps {
  name: string
  filled?: boolean
  className?: string
  'aria-hidden'?: boolean
}

export function Icon({
  name,
  filled = false,
  className = '',
  'aria-hidden': ariaHidden = true,
}: IconProps) {
  return (
    <span
      className={`material-symbols-outlined ${filled ? 'material-symbols-filled' : ''} ${className}`}
      aria-hidden={ariaHidden}
    >
      {name}
    </span>
  )
}

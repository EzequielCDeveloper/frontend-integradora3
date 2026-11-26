import { useCallback, useRef, useState } from 'react'

export function generateIdempotencyKey(prefix: string): string {
  const randomPart =
    typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
  return `${prefix}-${randomPart}`
}

/**
 * Synchronous mutation lock preventing double-submit / rage-click duplicates.
 * Attaches an idempotency key per logical attempt.
 */
export function useIdempotentAction<TArgs extends unknown[], TResult>(
  prefix: string,
  action: (idempotencyKey: string, ...args: TArgs) => Promise<TResult>,
) {
  const lockRef = useRef(false)
  const [isPending, setIsPending] = useState(false)

  const execute = useCallback(
    async (...args: TArgs): Promise<TResult | undefined> => {
      if (lockRef.current) {
        return undefined
      }
      lockRef.current = true
      setIsPending(true)
      const idempotencyKey = generateIdempotencyKey(prefix)
      try {
        return await action(idempotencyKey, ...args)
      } finally {
        lockRef.current = false
        setIsPending(false)
      }
    },
    [action, prefix],
  )

  return { execute, isPending }
}

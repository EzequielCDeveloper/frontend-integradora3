import { useCallback, useRef, useState } from 'react';

export function useIdempotentAction<TArgs extends unknown[], TResult>(
  asyncFn: (...args: TArgs) => Promise<TResult>,
): {
  execute: (...args: TArgs) => Promise<TResult | undefined>;
  isPending: boolean;
} {
  const lockRef = useRef(false);
  const [isPending, setIsPending] = useState(false);

  const execute = useCallback(
    async (...args: TArgs): Promise<TResult | undefined> => {
      if (lockRef.current) {
        return undefined;
      }
      lockRef.current = true;
      setIsPending(true);
      try {
        return await asyncFn(...args);
      } finally {
        lockRef.current = false;
        setIsPending(false);
      }
    },
    [asyncFn],
  );

  return { execute, isPending };
}

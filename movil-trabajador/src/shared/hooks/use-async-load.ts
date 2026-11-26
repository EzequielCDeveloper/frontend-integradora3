import { useEffect } from 'react';

export function useAsyncLoad(
  load: () => void | Promise<void>,
  reloadKey?: unknown,
): void {
  useEffect(() => {
    let cancelled = false;
    queueMicrotask(() => {
      if (!cancelled) {
        void load();
      }
    });
    return () => {
      cancelled = true;
    };
  }, [load, reloadKey]);
}

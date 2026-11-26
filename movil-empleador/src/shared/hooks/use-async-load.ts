/**
 * Runs an async loader after the effect commit so synchronous state updates in
 * the loader cannot trigger cascading renders during the commit phase.
 * The queued load is skipped when the component unmounts or the loader changes.
 */
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

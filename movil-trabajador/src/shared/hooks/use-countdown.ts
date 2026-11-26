import { useCallback, useEffect, useState } from 'react';

export interface CountdownState {
  totalSeconds: number;
  isExpired: boolean;
  formattedShort: string;
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
}

export function useCountdown(
  targetIso: string | null | undefined,
  mode: 'hms' | 'ms' | 'days' = 'hms',
): CountdownState {
  const compute = useCallback((): CountdownState => {
    if (!targetIso) {
      return {
        totalSeconds: 0,
        isExpired: true,
        formattedShort: mode === 'ms' ? '00:00' : '0h 00m 00s',
        days: 0,
        hours: 0,
        minutes: 0,
        seconds: 0,
      };
    }

    const diffMs = new Date(targetIso).getTime() - Date.now();
    const totalSeconds = Math.max(0, Math.floor(diffMs / 1000));
    const isExpired = totalSeconds <= 0;

    const days = Math.floor(totalSeconds / 86400);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    const pad = (n: number) => String(n).padStart(2, '0');
    let formattedShort = `${hours}h ${pad(minutes)}m ${pad(seconds)}s`;
    if (mode === 'ms') {
      const totalMins = Math.floor(totalSeconds / 60);
      formattedShort = `${pad(totalMins)}:${pad(seconds)}`;
    } else if (mode === 'days') {
      const remHours = Math.floor((totalSeconds % 86400) / 3600);
      formattedShort = `${days}d ${remHours}h restantes`;
    }

    return {
      totalSeconds,
      isExpired,
      formattedShort,
      days,
      hours,
      minutes,
      seconds,
    };
  }, [targetIso, mode]);

  const [state, setState] = useState<CountdownState>(compute);

  useEffect(() => {
    queueMicrotask(() => setState(compute()));
    const interval = setInterval(() => {
      setState(compute());
    }, 1000);
    return () => clearInterval(interval);
  }, [compute]);

  return state;
}

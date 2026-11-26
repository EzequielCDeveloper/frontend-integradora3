import React from 'react';
import { Redirect } from 'expo-router';
import { useWorkerStore } from '@/services/worker-store';

export default function IndexRoute() {
  const activeWorkerId = useWorkerStore((s) => s.activeWorkerId);

  if (!activeWorkerId) {
    return <Redirect href="/(auth)/login" />;
  }
  return <Redirect href="/(main)/home" />;
}

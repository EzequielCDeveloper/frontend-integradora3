import React from 'react';
import { Redirect } from 'expo-router';
import { useMockBackendStore } from '@/services/mocks/mock-employer-repository';

export default function IndexRoute() {
  const activeEmployerId = useMockBackendStore((s) => s.activeEmployerId);

  if (!activeEmployerId) {
    return <Redirect href="/(auth)/login" />;
  }
  return <Redirect href="/(main)/feed" />;
}

import React from 'react';
import { Redirect, Stack } from 'expo-router';
import { SaharaColors } from '@/constants/theme';
import { useMockBackendStore } from '@/services/mocks/mock-employer-repository';

export default function MainProtectedLayout() {
  const activeEmployerId = useMockBackendStore((s) => s.activeEmployerId);
  const profile = useMockBackendStore((s) =>
    s.db.profiles.find((p) => p.id === s.activeEmployerId),
  );

  // OWASP A01 / M1: Role & Auth Guard
  if (!activeEmployerId || !profile || profile.role !== 'employer') {
    return <Redirect href="/(auth)/login" />;
  }

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: SaharaColors.surface },
      }}
    />
  );
}

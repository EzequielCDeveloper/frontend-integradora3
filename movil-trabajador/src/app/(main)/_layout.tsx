import React from 'react';
import { Redirect, Stack } from 'expo-router';
import { SaharaColors } from '@/constants/theme';
import { useWorkerStore } from '@/services/worker-store';

export default function MainWorkerLayout() {
  const activeWorkerId = useWorkerStore((s) => s.activeWorkerId);
  const profile = useWorkerStore((s) =>
    s.db.profiles.find((p) => p.id === s.activeWorkerId),
  );

  if (!activeWorkerId || !profile || profile.role !== 'worker') {
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

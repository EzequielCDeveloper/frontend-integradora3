import React from 'react';
import { Stack } from 'expo-router';
import { SaharaColors } from '@/constants/theme';

export default function AuthLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: SaharaColors.surface },
      }}
    />
  );
}

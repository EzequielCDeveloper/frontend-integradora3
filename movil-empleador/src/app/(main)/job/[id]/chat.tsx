import React from 'react';
import { useLocalSearchParams } from 'expo-router';
import { RealtimeChatScreenView } from '@/features/realtime-chat';

export default function RealtimeChatRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <RealtimeChatScreenView jobId={id ?? ''} />;
}

import React from 'react';
import { useLocalSearchParams } from 'expo-router';
import { WorkerReviewScreenView } from '@/features/worker-review';

export default function WorkerReviewRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <WorkerReviewScreenView jobId={id ?? ''} />;
}

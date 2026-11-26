import React from 'react';
import { useLocalSearchParams } from 'expo-router';
import { AssignedJobConditionsScreenView } from '@/features/assigned-job-conditions';

export default function AssignedJobConditionsRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <AssignedJobConditionsScreenView jobId={id ?? ''} />;
}

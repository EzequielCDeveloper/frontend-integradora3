import React from 'react';
import { useLocalSearchParams } from 'expo-router';
import { JobCompletionVerifyScreenView } from '@/features/job-completion-verify';

export default function JobCompletionRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <JobCompletionVerifyScreenView jobId={id ?? ''} />;
}

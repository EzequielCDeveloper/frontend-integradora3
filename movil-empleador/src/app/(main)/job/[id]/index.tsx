import React from 'react';
import { useLocalSearchParams } from 'expo-router';
import { JobDetailApplicantsScreenView } from '@/features/applicants-selection';

export default function JobDetailRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <JobDetailApplicantsScreenView jobId={id ?? ''} />;
}

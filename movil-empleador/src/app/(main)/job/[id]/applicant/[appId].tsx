import React from 'react';
import { useLocalSearchParams } from 'expo-router';
import { ApplicantProfileScreenView } from '@/features/applicants-selection';

export default function ApplicantProfileRoute() {
  const { id, appId } = useLocalSearchParams<{ id: string; appId: string }>();
  return (
    <ApplicantProfileScreenView
      jobId={id ?? ''}
      applicationId={appId ?? ''}
    />
  );
}

import React from 'react';
import { useLocalSearchParams } from 'expo-router';
import { EscrowCheckoutScreenView } from '@/features/escrow-checkout';

export default function EscrowCheckoutRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <EscrowCheckoutScreenView jobId={id ?? ''} />;
}

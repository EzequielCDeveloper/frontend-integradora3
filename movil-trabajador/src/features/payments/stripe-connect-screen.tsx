/**
 * Alta y estado de cuenta conectada (Stripe Connect)
 * No solicita ni almacena datos bancarios; gestiona únicamente el estado de alta en el frontend.
 */
import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Fonts, Radius, SaharaColors, Spacing } from '@/constants/theme';
import {
  FeedbackBanner,
  SaharaButton,
  SaharaCard,
  SaharaHeader,
  SaharaIcon,
  SaharaScreenShell,
} from '@/components/ui';
import { useWorkerStore, workerStore } from '@/services/worker-store';

export function StripeConnectScreen() {
  const router = useRouter();
  const worker = useWorkerStore((s) =>
    s.db.profiles.find((p) => p.id === s.activeWorkerId),
  );
  const [feedback, setFeedback] = useState<string | null>(null);

  if (!worker) return null;

  const isReady = worker.stripe_onboarding_complete;

  const handleCompleteOnboarding = () => {
    workerStore.completeStripeOnboarding();
    setFeedback(
      'Tu cuenta conectada quedó marcada como verificada y habilitada para recibir transferencias.',
    );
  };

  return (
    <SaharaScreenShell
      header={
        <SaharaHeader
          title="Cuenta conectada"
          subtitle="Recepción de pagos"
          onBack={() => router.back()}
        />
      }>
      {feedback ? (
        <FeedbackBanner
          tone="success"
          message={feedback}
          onDismiss={() => setFeedback(null)}
        />
      ) : null}

      <SaharaCard
        variant="lowest"
        accentColor={isReady ? SaharaColors.success : SaharaColors.warning}
        style={{ gap: 12 }}>
        <View style={styles.statusRow}>
          <View
            style={[
              styles.iconCircle,
              {
                backgroundColor: isReady
                  ? SaharaColors.successContainer
                  : SaharaColors.warningContainer,
              },
            ]}>
            <SaharaIcon
              name={isReady ? 'verified_user' : 'account_balance'}
              size={20}
              color={isReady ? SaharaColors.success : SaharaColors.warning}
            />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.title}>
              {isReady ? 'Alta completa y activa' : 'Alta pendiente'}
            </Text>
            <Text style={styles.subtitle}>
              {isReady
                ? `Identificador de cuenta: ${worker.stripe_account_id}`
                : 'Completa el proceso de vinculación para habilitar el registro de llegada y recibir tus pagos.'}
            </Text>
          </View>
        </View>

        <View style={styles.infoBox}>
          <Text style={styles.infoTitle}>Seguridad de tus datos</Text>
          <Text style={styles.infoText}>
            Esta aplicación no solicita ni guarda números de cuenta, CLABE ni datos de tarjetas. El alta de cuenta conectada se gestiona mediante un flujo dedicado de verificación de identidad y cobros.
          </Text>
        </View>

        {!isReady ? (
          <SaharaButton
            label="Iniciar y completar alta de cuenta"
            icon="verified_user"
            onPress={handleCompleteOnboarding}
          />
        ) : (
          <SaharaButton
            label="Volver a Mis trabajos"
            variant="outline"
            onPress={() => router.replace('/(main)/my-jobs' as never)}
          />
        )}
      </SaharaCard>
    </SaharaScreenShell>
  );
}

const styles = StyleSheet.create({
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  iconCircle: {
    width: 48,
    height: 48,
    borderRadius: Radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontFamily: Fonts.headline,
    fontSize: 20,
    fontWeight: '600',
    color: SaharaColors.onSurface,
  },
  subtitle: {
    fontFamily: Fonts.body,
    fontSize: 12.5,
    color: SaharaColors.onSurfaceVariant,
    marginTop: 2,
  },
  infoBox: {
    backgroundColor: SaharaColors.surfaceContainerLow,
    padding: Spacing.md,
    borderRadius: Radius.lg,
    gap: 4,
  },
  infoTitle: {
    fontFamily: Fonts.label,
    fontSize: 13,
    fontWeight: '700',
    color: SaharaColors.onSurface,
  },
  infoText: {
    fontFamily: Fonts.body,
    fontSize: 12.5,
    color: SaharaColors.onSurfaceVariant,
    lineHeight: 19,
  },
});

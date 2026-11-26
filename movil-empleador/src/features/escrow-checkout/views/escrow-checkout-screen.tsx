/**
 * UI-EMP-07: Checkout y Confirmación de Pago Stripe Escrow (Audit Fixed & Zero Emojis)
 * Source of Truth: Especificacion_de_Arquitectura_de_Software_v2.md (Section 3.2 UI-EMP-07, RF-17, RF-18)
 * Audit Fixes Applied:
 * - UI-EMP-07-1: Modal close button elevated to 48x48dp with explicit accessibilityLabel="Cerrar hoja de pago"
 * - UI-EMP-07-2: Added accessibilityRole="radiogroup" to card selector container and explicit accessibilityLabel to each radio option
 * - SYS-07: Zero hardcoded rgba(...)
 */
import React, { useCallback, useState } from 'react';
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import {
  Fonts,
  Radius,
  SaharaColors,
  Spacing,
} from '@/constants/theme';
import {
  CountdownBanner,
  ErrorState,
  LoadingSkeleton,
  PaymentStatusBadge,
  SaharaButton,
  SaharaCard,
  SaharaHeader,
  SaharaIcon,
  SaharaScreenShell,
} from '@/components/ui/sahara-primitives';
import {
  employerRepository,
  useMockBackendStore,
} from '@/services/mocks/mock-employer-repository';
import { useAsyncLoad } from '@/shared/hooks/use-async-load';
import { useIdempotentAction } from '@/shared/hooks/use-idempotent-action';
import { mapDomainErrorToUI } from '@/shared/utils/error-mapper';
import {
  formatCurrencyMXN,
  formatFolio,
} from '@/shared/utils/formatters';
import type {
  EmployerJobDetailView,
  PaymentBreakdown,
} from '@/types/database';

type SimulatedStripeMethod = 'visa_4242_success' | 'mc_0002_decline';

export function EscrowCheckoutScreenView({ jobId }: { jobId: string }) {
  const router = useRouter();
  const storeVersion = useMockBackendStore((s) => s.version);

  const [job, setJob] = useState<EmployerJobDetailView | null>(null);
  const [breakdown, setBreakdown] = useState<PaymentBreakdown | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [selectedMethod, setSelectedMethod] =
    useState<SimulatedStripeMethod>('visa_4242_success');
  const [showPaymentSheet, setShowPaymentSheet] = useState(false);

  const loadCheckout = useCallback(async () => {
    if (!jobId) return;
    setIsLoading(true);
    setErrorMsg(null);
    try {
      const [jobDetail, payBreakdown] = await Promise.all([
        employerRepository.getEmployerJobDetail(jobId),
        employerRepository.getPaymentBreakdown(jobId),
      ]);
      setJob(jobDetail);
      setBreakdown(payBreakdown);
    } catch (err) {
      const mapped = mapDomainErrorToUI(err);
      setErrorMsg(mapped.message);
    } finally {
      setIsLoading(false);
    }
  }, [jobId]);

  useAsyncLoad(loadCheckout, storeVersion);

  const { execute: handleExecuteStripePayment, isPending: isPaying } =
    useIdempotentAction(async () => {
      if (!job || !breakdown) return;
      setErrorMsg(null);
      try {
        await employerRepository.createPaymentIntentMock(job.id, {
          simulateDecline: selectedMethod === 'mc_0002_decline',
          idempotencyKey: `idem-${job.id}-attempt-${breakdown.payment_attempts + 1}`,
        });
        setShowPaymentSheet(false);
        router.replace(`/(main)/job/${job.id}/completion` as never);
      } catch (err) {
        const mapped = mapDomainErrorToUI(err);
        setErrorMsg(mapped.message);
        setShowPaymentSheet(false);
      }
    });

  return (
    <SaharaScreenShell
      header={
        <SaharaHeader
          title="Pagar Trabajo"
          subtitle={job ? `Folio ${formatFolio(job.id)}` : 'Pago Protegido'}
          onBack={() => router.back()}
        />
      }>
      {isLoading ? (
        <LoadingSkeleton message="Preparando el resumen de tu pago..." />
      ) : !job || !breakdown ? (
        <ErrorState
          message={errorMsg ?? 'No se pudo cargar el resumen de pago.'}
          onRetry={() => void loadCheckout()}
        />
      ) : (
        <>
          {/* 30-Minute Countdown Banner after Worker Arrival */}
          {breakdown.expires_at ? (
            <CountdownBanner
              targetIso={breakdown.expires_at}
              title="El trabajador ya llegó a tu domicilio"
              subtitle={`Tienes 30 minutos para realizar el pago y que empiece a trabajar. Intentos realizados: ${breakdown.payment_attempts} de 3.`}
              mode="ms"
            />
          ) : null}

          {errorMsg ? (
            <ErrorState
              message={errorMsg}
              onRetry={() => setErrorMsg(null)}
            />
          ) : null}

          {/* Worker & Job Context Mini-Card */}
          <SaharaCard variant="lowest" style={styles.contextRow}>
            <View style={styles.workerCircle}>
              <Text style={styles.workerInitials}>
                {(job.selected_worker_name ?? 'TR').slice(0, 2).toUpperCase()}
              </Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.jobTitle} numberOfLines={1}>
                {job.title}
              </Text>
              <Text style={styles.workerMeta}>
                {job.selected_worker_name ?? 'Trabajador asignado'} • Calif.{' '}
                {(job.selected_worker_rating ?? 4.9).toFixed(1)}
              </Text>
            </View>
            <View style={styles.onSitePill}>
              <Text style={styles.onSitePillText}>En tu domicilio</Text>
            </View>
          </SaharaCard>

          {/* Financial Breakdown Card */}
          <SaharaCard variant="lowest" style={{ gap: 12 }}>
            <View style={styles.breakdownHeaderRow}>
              <Text style={styles.cardSectionTitle}>Resumen del pago</Text>
              <PaymentStatusBadge status={breakdown.status} />
            </View>

            <View style={styles.lineItemRow}>
              <Text style={styles.lineItemLabel}>Pago para el trabajador</Text>
              <Text style={styles.lineItemValue} testID="breakdown-job-amount">
                {formatCurrencyMXN(breakdown.job_amount_mxn)}
              </Text>
            </View>

            <View style={styles.lineItemRow}>
              <Text style={styles.lineItemLabel}>
                Comisión de la aplicación (10%)
              </Text>
              <Text style={styles.lineItemValue} testID="breakdown-fee-amount">
                {formatCurrencyMXN(breakdown.platform_fee_mxn)}
              </Text>
            </View>

            <View style={styles.totalHighlightBox}>
              <View>
                <Text style={styles.totalLabelMain}>Total a pagar</Text>
                <Text style={styles.totalLabelSub}>
                  Dinero protegido hasta que termine
                </Text>
              </View>
              <Text
                style={styles.totalAmountValue}
                testID="breakdown-total-amount">
                {formatCurrencyMXN(breakdown.total_charged_mxn)}
              </Text>
            </View>
          </SaharaCard>

          {/* Payment Method Selector */}
          <SaharaCard
            variant="lowest"
            style={{ gap: 10 }}>
            <View style={styles.breakdownHeaderRow}>
              <Text style={styles.cardSectionTitle}>
                Elige tu tarjeta
              </Text>
              <Text style={styles.pciTag}>Tarjeta protegida</Text>
            </View>

            <View
              accessibilityRole="radiogroup"
              accessibilityLabel="Elige una tarjeta para pagar"
              style={{ gap: 10 }}>
              <Pressable
                testID="select-card-visa-success"
                accessibilityRole="radio"
                accessibilityLabel="Tarjeta Visa terminada en 4242, recomendada para pagar"
                accessibilityState={{
                  checked: selectedMethod === 'visa_4242_success',
                }}
                onPress={() => setSelectedMethod('visa_4242_success')}
                style={[
                  styles.methodOptionCard,
                  selectedMethod === 'visa_4242_success'
                    ? styles.methodOptionCardActive
                    : undefined,
                ]}>
                <View style={styles.visaBadge}>
                  <Text style={styles.visaBadgeText}>VISA</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.methodTitle}>
                    Tarjeta Visa terminada en 4242 (Recomendada)
                  </Text>
                  <Text style={styles.methodSub}>
                    Vence 08/28 • Pago inmediato autorizado
                  </Text>
                </View>
                <SaharaIcon
                  name={
                    selectedMethod === 'visa_4242_success'
                      ? 'check_circle'
                      : 'radio_button_unchecked'
                  }
                  size={18}
                  color={
                    selectedMethod === 'visa_4242_success'
                      ? SaharaColors.primaryAccessible
                      : SaharaColors.outline
                  }
                />
              </Pressable>

              <Pressable
                testID="select-card-mc-decline"
                accessibilityRole="radio"
                accessibilityLabel="Tarjeta de prueba para simular error bancario"
                accessibilityState={{
                  checked: selectedMethod === 'mc_0002_decline',
                }}
                onPress={() => setSelectedMethod('mc_0002_decline')}
                style={[
                  styles.methodOptionCard,
                  selectedMethod === 'mc_0002_decline'
                    ? styles.methodOptionCardActive
                    : undefined,
                ]}>
                <View
                  style={[
                    styles.visaBadge,
                    { backgroundColor: SaharaColors.tertiary },
                  ]}>
                  <Text style={styles.visaBadgeText}>MC</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.methodTitle}>
                    Modo Prueba: Simular tarjeta rechazada (0002)
                  </Text>
                  <Text style={styles.methodSub}>
                    Solo para probar qué pasa cuando el banco rechaza el cobro
                  </Text>
                </View>
                <SaharaIcon
                  name={
                    selectedMethod === 'mc_0002_decline'
                      ? 'check_circle'
                      : 'radio_button_unchecked'
                  }
                  size={18}
                  color={
                    selectedMethod === 'mc_0002_decline'
                      ? SaharaColors.primaryAccessible
                      : SaharaColors.outline
                  }
                />
              </Pressable>
            </View>
          </SaharaCard>

          {/* Payment Protection Notice */}
          <SaharaCard variant="primaryFixed" style={styles.escrowProtectionRow}>
            <View style={styles.lockCircle}>
              <SaharaIcon
                name="lock"
                size={18}
                color={SaharaColors.primaryAccessible}
              />
            </View>
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={styles.escrowProtectionTitle}>
                Tu dinero está seguro
              </Text>
              <Text style={styles.escrowProtectionBody}>
                Guardamos el pago de forma segura y solo se lo entregamos al
                trabajador cuando confirmes que terminó el trabajo.
              </Text>
            </View>
          </SaharaCard>

          {/* Primary Pay Button */}
          <View style={{ gap: 8 }}>
            <SaharaButton
              testID="open-stripe-sheet-btn"
              label={`Pagar ${formatCurrencyMXN(breakdown.total_charged_mxn)} Ahora`}
              icon="lock"
              size="lg"
              disabled={
                breakdown.status === 'confirmed' ||
                breakdown.status === 'cancelled'
              }
              loading={isPaying}
              onPress={() => setShowPaymentSheet(true)}
            />
            <View style={styles.stripeFooterRow}>
              <SaharaIcon
                name="verified"
                size={13}
                color={SaharaColors.onSurfaceVariant}
              />
              <Text style={styles.stripeFooterText}>
                Pago protegido por Solidez MX y Stripe
              </Text>
            </View>
          </View>
        </>
      )}

      {/* Two-step Payment Confirmation Modal */}
      <Modal
        visible={showPaymentSheet}
        transparent
        animationType="slide"
        onRequestClose={() => setShowPaymentSheet(false)}>
        <View style={styles.sheetBackdrop}>
          <View style={styles.sheetCard}>
            <View style={styles.sheetHeaderRow}>
              <View style={styles.stripeBrandPill}>
                <SaharaIcon
                  name="lock"
                  size={14}
                  color={SaharaColors.onPrimary}
                />
                <Text style={styles.stripeBrandText}>
                  PAGO SEGURO SOLIDEZ MX
                </Text>
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Cerrar ventana de pago"
                onPress={() => setShowPaymentSheet(false)}
                style={styles.closeModalBtn}>
                <SaharaIcon
                  name="close"
                  size={16}
                  color={SaharaColors.onSurface}
                />
              </Pressable>
            </View>

            <Text style={styles.sheetTitle}>
              ¿Confirmar el pago del trabajo?
            </Text>
            <Text style={styles.sheetDesc}>
              Revisa el monto antes de confirmar el cargo a tu tarjeta:
            </Text>

            {breakdown ? (
              <View style={styles.sheetSummaryBox}>
                <View style={styles.lineItemRow}>
                  <Text style={styles.lineItemLabel}>Pago al trabajador:</Text>
                  <Text style={styles.lineItemValue}>
                    {formatCurrencyMXN(breakdown.job_amount_mxn)}
                  </Text>
                </View>
                <View style={styles.lineItemRow}>
                  <Text style={styles.lineItemLabel}>
                    Comisión de la aplicación (10%):
                  </Text>
                  <Text style={styles.lineItemValue}>
                    {formatCurrencyMXN(breakdown.platform_fee_mxn)}
                  </Text>
                </View>
                <View
                  style={[
                    styles.lineItemRow,
                    {
                      paddingTop: 6,
                      borderTopWidth: 1,
                      borderTopColor: SaharaColors.outlineVariant,
                    },
                  ]}>
                  <Text style={styles.totalLabelMain}>Total a pagar:</Text>
                  <Text
                    style={{
                      fontFamily: Fonts.headline,
                      fontSize: 19,
                      fontWeight: '700',
                      color: SaharaColors.primaryAccessible,
                    }}>
                    {formatCurrencyMXN(breakdown.total_charged_mxn)}
                  </Text>
                </View>
              </View>
            ) : null}

            <View style={{ flexDirection: 'row', gap: 10 }}>
              <View style={{ flex: 1 }}>
                <SaharaButton
                  label="Volver"
                  variant="outline"
                  disabled={isPaying}
                  onPress={() => setShowPaymentSheet(false)}
                />
              </View>
              <View style={{ flex: 1.4 }}>
                <SaharaButton
                  testID="confirm-stripe-payment-btn"
                  label="Confirmar y Pagar"
                  icon="verified_user"
                  loading={isPaying}
                  onPress={() => void handleExecuteStripePayment()}
                />
              </View>
            </View>
          </View>
        </View>
      </Modal>
    </SaharaScreenShell>
  );
}

const styles = StyleSheet.create({
  contextRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  workerCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: SaharaColors.primaryFixed,
    alignItems: 'center',
    justifyContent: 'center',
  },
  workerInitials: {
    fontFamily: Fonts.headline,
    fontSize: 17,
    fontWeight: '700',
    color: SaharaColors.onPrimaryFixedVariant,
  },
  jobTitle: {
    fontFamily: Fonts.label,
    fontSize: 14,
    fontWeight: '700',
    color: SaharaColors.onSurface,
  },
  workerMeta: {
    fontFamily: Fonts.body,
    fontSize: 12,
    color: SaharaColors.onSurfaceVariant,
  },
  onSitePill: {
    backgroundColor: SaharaColors.primaryFixed,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: Radius.full,
  },
  onSitePillText: {
    fontFamily: Fonts.label,
    fontSize: 11,
    fontWeight: '700',
    color: SaharaColors.onPrimaryFixed,
  },
  breakdownHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  cardSectionTitle: {
    fontFamily: Fonts.headline,
    fontSize: 18,
    fontWeight: '700',
    color: SaharaColors.onSurface,
  },
  lineItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  lineItemLabel: {
    fontFamily: Fonts.body,
    fontSize: 13,
    color: SaharaColors.onSurfaceVariant,
  },
  lineItemValue: {
    fontFamily: Fonts.label,
    fontSize: 13.5,
    fontWeight: '700',
    color: SaharaColors.onSurface,
  },
  totalHighlightBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: SaharaColors.surfaceContainerLow,
    padding: 14,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: SaharaColors.borderDefault,
  },
  totalLabelMain: {
    fontFamily: Fonts.label,
    fontSize: 13.5,
    fontWeight: '700',
    color: SaharaColors.onSurface,
  },
  totalLabelSub: {
    fontFamily: Fonts.body,
    fontSize: 11,
    color: SaharaColors.onSurfaceVariant,
  },
  totalAmountValue: {
    fontFamily: Fonts.headline,
    fontSize: 24,
    fontWeight: '700',
    color: SaharaColors.primaryAccessible,
  },
  pciTag: {
    fontFamily: Fonts.label,
    fontSize: 11,
    fontWeight: '700',
    color: SaharaColors.primaryAccessible,
  },
  methodOptionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 60,
    gap: 10,
    backgroundColor: SaharaColors.surfaceContainerLow,
    padding: 12,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: SaharaColors.borderDefault,
  },
  methodOptionCardActive: {
    borderColor: SaharaColors.primaryAccessible,
    backgroundColor: SaharaColors.surfaceContainerLowest,
  },
  visaBadge: {
    width: 44,
    height: 30,
    borderRadius: Radius.sm,
    backgroundColor: SaharaColors.primaryAccessible,
    alignItems: 'center',
    justifyContent: 'center',
  },
  visaBadgeText: {
    fontFamily: Fonts.label,
    fontSize: 11,
    fontWeight: '700',
    color: SaharaColors.onPrimary,
  },
  methodTitle: {
    fontFamily: Fonts.label,
    fontSize: 12.5,
    fontWeight: '700',
    color: SaharaColors.onSurface,
  },
  methodSub: {
    fontFamily: Fonts.body,
    fontSize: 11,
    color: SaharaColors.onSurfaceVariant,
  },
  escrowProtectionRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  lockCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: SaharaColors.surfaceContainerLowest,
    alignItems: 'center',
    justifyContent: 'center',
  },
  escrowProtectionTitle: {
    fontFamily: Fonts.label,
    fontSize: 13,
    fontWeight: '700',
    color: SaharaColors.onPrimaryFixed,
  },
  escrowProtectionBody: {
    fontFamily: Fonts.body,
    fontSize: 12,
    color: SaharaColors.onPrimaryFixedVariant,
    lineHeight: 17,
  },
  stripeFooterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  stripeFooterText: {
    fontFamily: Fonts.label,
    fontSize: 11,
    color: SaharaColors.onSurfaceVariant,
  },
  sheetBackdrop: {
    flex: 1,
    backgroundColor: SaharaColors.backdropOverlay,
    justifyContent: 'flex-end',
  },
  sheetCard: {
    backgroundColor: SaharaColors.surfaceContainerLowest,
    borderTopLeftRadius: Radius.xxl,
    borderTopRightRadius: Radius.xxl,
    padding: Spacing.lg,
    gap: 14,
  },
  sheetHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  stripeBrandPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: SaharaColors.primaryAccessible,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: Radius.full,
  },
  stripeBrandText: {
    fontFamily: Fonts.label,
    fontSize: 10.5,
    fontWeight: '700',
    color: SaharaColors.onPrimary,
  },
  closeModalBtn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: SaharaColors.surfaceContainerLow,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sheetTitle: {
    fontFamily: Fonts.headline,
    fontSize: 22,
    fontWeight: '700',
    color: SaharaColors.onSurface,
  },
  sheetDesc: {
    fontFamily: Fonts.body,
    fontSize: 13,
    color: SaharaColors.onSurfaceVariant,
  },
  sheetSummaryBox: {
    backgroundColor: SaharaColors.surfaceContainerLow,
    borderRadius: Radius.lg,
    padding: 14,
    gap: 8,
  },
});

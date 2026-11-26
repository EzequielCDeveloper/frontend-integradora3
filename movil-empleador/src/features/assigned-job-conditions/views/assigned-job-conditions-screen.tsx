/**
 * UI-EMP-06: Detalle de Trabajo Asignado y Condiciones (Poka-Yoke Guided & Low Cognitive Load)
 * Source of Truth: Especificacion_de_Arquitectura_de_Software_v2.md (Section 3.2 UI-EMP-06, RF-12, RF-16)
 * Poka-Yoke & Audit Fixes Applied:
 * - PY-06-1: Surfaces a prominent "Paso Actual" action card right at the top so the employer never has to scroll past 5 cards to find "Acepto las Condiciones"
 * - PY-06-2 & PY-SYS-01: Plain Spanish labels ("PASOS PARA INICIAR EL TRABAJO", "RESUMEN DEL PAGO") with zero internal spec codes
 * - PY-SYS-05: Isolates the demo arrival simulation button inside a clearly labeled "Modo de prueba (opcional)" card
 * - UI-EMP-06-1..02: Safe Linking.canOpenURL + 48dp Call/Chat buttons + grouped countdown label
 */
import React, { useCallback, useState } from 'react';
import {
  Linking,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import {
  Fonts,
  Radius,
  SaharaColors,
} from '@/constants/theme';
import {
  CountdownBanner,
  ErrorState,
  JobStatusBadge,
  LoadingSkeleton,
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
  formatSpanishDate,
  formatTimeRange,
} from '@/shared/utils/formatters';
import type {
  CounterpartContact,
  EmployerJobDetailView,
} from '@/types/database';

export function AssignedJobConditionsScreenView({ jobId }: { jobId: string }) {
  const router = useRouter();
  const storeVersion = useMockBackendStore((s) => s.version);

  const [job, setJob] = useState<EmployerJobDetailView | null>(null);
  const [contact, setContact] = useState<CounterpartContact | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const loadAssignedJob = useCallback(async () => {
    if (!jobId) return;
    setIsLoading(true);
    setErrorMsg(null);
    try {
      const detail = await employerRepository.getEmployerJobDetail(jobId);
      setJob(detail);
      if (detail.selected_worker_id) {
        const contactRes =
          await employerRepository.get_counterpart_contact(jobId);
        setContact(contactRes);
      }
    } catch (err) {
      const mapped = mapDomainErrorToUI(err);
      setErrorMsg(mapped.message);
    } finally {
      setIsLoading(false);
    }
  }, [jobId]);

  useAsyncLoad(loadAssignedJob, storeVersion);

  const { execute: handleConfirmConditions, isPending: isConfirming } =
    useIdempotentAction(async () => {
      if (!job) return;
      setErrorMsg(null);
      try {
        await employerRepository.confirm_conditions(job.id);
      } catch (err) {
        const mapped = mapDomainErrorToUI(err);
        setErrorMsg(mapped.message);
      }
    });

  const { execute: handleSimulateArrival, isPending: isSimulatingArrival } =
    useIdempotentAction(async () => {
      if (!job) return;
      setErrorMsg(null);
      try {
        await employerRepository.simulateWorkerArrival(job.id);
        router.push(`/(main)/job/${job.id}/checkout` as never);
      } catch (err) {
        const mapped = mapDomainErrorToUI(err);
        setErrorMsg(mapped.message);
      }
    });

  const handleDialWorker = async () => {
    if (!contact?.phone) return;
    const url = `tel:${contact.phone.replace(/\s+/g, '')}`;
    try {
      const supported = await Linking.canOpenURL(url);
      if (!supported) {
        setErrorMsg(
          `Este dispositivo no puede hacer llamadas directas. Marca desde tu teléfono al: ${contact.phone}`,
        );
        return;
      }
      await Linking.openURL(url);
    } catch {
      setErrorMsg(
        `No pudimos abrir la llamada. Marca directamente al ${contact.phone}.`,
      );
    }
  };

  return (
    <SaharaScreenShell
      header={
        <SaharaHeader
          title="Trabajo Asignado"
          subtitle={job ? `Folio ${formatFolio(job.id)}` : 'Detalles del acuerdo'}
          onBack={() => router.back()}
        />
      }>
      {isLoading ? (
        <LoadingSkeleton message="Cargando los datos del trabajador elegido..." />
      ) : !job ? (
        <ErrorState
          message={errorMsg ?? 'No encontramos este trabajo.'}
          onRetry={() => void loadAssignedJob()}
        />
      ) : (
        <>
          {errorMsg ? (
            <ErrorState
              message={errorMsg}
              onRetry={() => setErrorMsg(null)}
            />
          ) : null}

          {/* 24h Countdown Banner */}
          {job.status === 'assigned' && job.selection_expires_at ? (
            <CountdownBanner
              targetIso={job.selection_expires_at}
              title="Plazo de 24 horas para confirmar"
              subtitle="Tanto tú como el trabajador deben tocar 'Aceptar condiciones' antes de que termine el tiempo."
              mode="hms"
            />
          ) : null}

          {/* POKA-YOKE TOP ACTION CARD (PY-06-1: Immediate clarity on what the employer must do right now) */}
          <SaharaCard variant="primaryFixed" style={{ gap: 10 }}>
            <Text style={styles.stepCalloutSuper}>QUÉ DEBES HACER AHORA</Text>
            {!job.employer_confirmed && job.status === 'assigned' ? (
              <>
                <Text style={styles.stepCalloutTitle}>
                  Falta que aceptes las condiciones del trabajo
                </Text>
                <Text style={styles.stepCalloutBody}>
                  Toca el botón de abajo para confirmar que estás de acuerdo con
                  el horario y el pago.
                </Text>
                <SaharaButton
                  testID="confirm-conditions-btn"
                  label="Acepto las Condiciones del Trabajo"
                  icon="verified_user"
                  size="lg"
                  loading={isConfirming}
                  onPress={() => void handleConfirmConditions()}
                />
              </>
            ) : job.status === 'arrival_registered' ? (
              <>
                <Text style={styles.stepCalloutTitle}>
                  El trabajador ya llegó a tu domicilio
                </Text>
                <Text style={styles.stepCalloutBody}>
                  Tienes 30 minutos para realizar el pago seguro y que pueda
                  empezar a trabajar.
                </Text>
                <SaharaButton
                  testID="go-to-checkout-btn"
                  label="Ir a Pagar Ahora (30 min)"
                  icon="lock"
                  size="lg"
                  onPress={() =>
                    router.push(`/(main)/job/${job.id}/checkout` as never)
                  }
                />
              </>
            ) : job.status === 'in_progress' ||
              job.status === 'completion_requested' ? (
              <>
                <Text style={styles.stepCalloutTitle}>
                  El trabajo está en curso
                </Text>
                <Text style={styles.stepCalloutBody}>
                  Ve tu código de 6 números para dictárselo al trabajador cuando
                  termine.
                </Text>
                <SaharaButton
                  testID="go-to-completion-btn"
                  label="Ver Código de Cierre (6 Números)"
                  icon="verified_user"
                  size="lg"
                  onPress={() =>
                    router.push(`/(main)/job/${job.id}/completion` as never)
                  }
                />
              </>
            ) : (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <SaharaIcon
                  name="task_alt"
                  size={20}
                  color={SaharaColors.onPrimaryFixedVariant}
                />
                <View style={{ flex: 1 }}>
                  <Text style={styles.stepCalloutTitle}>
                    Ya aceptaste las condiciones
                  </Text>
                  <Text style={styles.stepCalloutBody}>
                    El cobro se activará cuando el trabajador llegue a tu
                    domicilio el día del trabajo.
                  </Text>
                </View>
              </View>
            )}
          </SaharaCard>

          {/* Selected Worker & Unlocked Contact Card */}
          <SaharaCard variant="lowest" style={{ gap: 14 }}>
            <View style={styles.workerHeaderRow}>
              <View style={styles.workerAvatar}>
                <Text style={styles.workerAvatarText}>
                  {(job.selected_worker_name ?? 'TR').slice(0, 2).toUpperCase()}
                </Text>
              </View>
              <View style={{ flex: 1, gap: 3 }}>
                <View style={styles.workerTitleRow}>
                  <Text style={styles.workerName}>
                    {job.selected_worker_name ?? 'Trabajador Elegido'}
                  </Text>
                  <JobStatusBadge status={job.status} />
                </View>
                <View style={styles.workerMetaChips}>
                  <View style={styles.ratingChip}>
                    <Text style={styles.ratingChipText}>
                      Calificación {(job.selected_worker_rating ?? 4.9).toFixed(1)}
                    </Text>
                  </View>
                </View>
              </View>
            </View>

            {/* Unlocked Direct Contact Box */}
            <View style={styles.contactBox}>
              <View style={styles.contactHeaderRow}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <SaharaIcon
                    name="lock_open"
                    size={15}
                    color={SaharaColors.primaryAccessible}
                  />
                  <Text style={styles.contactUnlockedLabel}>
                    Teléfono del trabajador:
                  </Text>
                </View>
                <Text style={styles.contactPhoneText} testID="unlocked-worker-phone">
                  {contact?.phone ?? 'Disponible'}
                </Text>
              </View>

              <View style={{ flexDirection: 'row', gap: 10 }}>
                <View style={{ flex: 1 }}>
                  <SaharaButton
                    label="Llamar"
                    accessibilityLabel={`Llamar al trabajador al ${contact?.phone ?? ''}`}
                    icon="call"
                    variant="secondary"
                    size="md"
                    onPress={() => void handleDialWorker()}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <SaharaButton
                    testID="open-chat-btn"
                    label="Abrir Chat"
                    icon="chat"
                    variant="secondary"
                    size="md"
                    onPress={() =>
                      router.push(`/(main)/job/${job.id}/chat` as never)
                    }
                  />
                </View>
              </View>
            </View>
          </SaharaCard>

          {/* Dual Confirmation Checklist in Plain Spanish */}
          <SaharaCard variant="lowest" style={{ gap: 10 }}>
            <Text style={styles.sectionLabel}>
              PASOS PARA INICIAR EL TRABAJO
            </Text>

            {/* 1. Worker Confirmation */}
            <View style={styles.checkItemBox}>
              <SaharaIcon
                name={
                  job.worker_confirmed
                    ? 'check_circle'
                    : 'radio_button_unchecked'
                }
                size={18}
                color={
                  job.worker_confirmed
                    ? SaharaColors.primaryAccessible
                    : SaharaColors.secondary
                }
              />
              <View style={{ flex: 1 }}>
                <Text style={styles.checkItemTitle}>
                  1. {job.selected_worker_name ?? 'El trabajador'} acepta el trabajo
                </Text>
                <Text style={styles.checkItemSub}>
                  {job.worker_confirmed
                    ? 'Ya confirmó que asistirá'
                    : 'Aún falta que confirme'}
                </Text>
              </View>
              <View
                style={[
                  styles.statusSmallPill,
                  job.worker_confirmed
                    ? styles.statusSmallPillReady
                    : undefined,
                ]}>
                <Text
                  style={[
                    styles.statusSmallText,
                    job.worker_confirmed
                      ? styles.statusSmallTextReady
                      : undefined,
                  ]}>
                  {job.worker_confirmed ? 'Listo' : 'Pendiente'}
                </Text>
              </View>
            </View>

            {/* 2. Worker Bank Account Status */}
            <View style={styles.checkItemBox}>
              <SaharaIcon
                name={
                  job.worker_stripe_ready
                    ? 'check_circle'
                    : 'radio_button_unchecked'
                }
                size={18}
                color={
                  job.worker_stripe_ready
                    ? SaharaColors.primaryAccessible
                    : SaharaColors.secondary
                }
              />
              <View style={{ flex: 1 }}>
                <Text style={styles.checkItemTitle}>
                  2. Cuenta bancaria del trabajador
                </Text>
                <Text style={styles.checkItemSub}>
                  {job.worker_stripe_ready
                    ? 'Lista para recibir el pago al terminar'
                    : 'En proceso de registro'}
                </Text>
              </View>
              <View
                style={[
                  styles.statusSmallPill,
                  job.worker_stripe_ready
                    ? styles.statusSmallPillReady
                    : undefined,
                ]}>
                <Text
                  style={[
                    styles.statusSmallText,
                    job.worker_stripe_ready
                      ? styles.statusSmallTextReady
                      : undefined,
                  ]}>
                  {job.worker_stripe_ready ? 'Lista' : 'Pendiente'}
                </Text>
              </View>
            </View>

            {/* 3. Employer Confirmation */}
            <View
              style={styles.checkItemBox}
              testID="employer-confirmation-row">
              <SaharaIcon
                name={
                  job.employer_confirmed
                    ? 'check_circle'
                    : 'radio_button_unchecked'
                }
                size={18}
                color={
                  job.employer_confirmed
                    ? SaharaColors.primaryAccessible
                    : SaharaColors.secondary
                }
              />
              <View style={{ flex: 1 }}>
                <Text style={styles.checkItemTitle}>3. Tu confirmación</Text>
                <Text style={styles.checkItemSub}>
                  {job.employer_confirmed
                    ? 'Ya aceptaste las condiciones'
                    : 'Falta que toques el botón Aceptar arriba'}
                </Text>
              </View>
              <View
                style={[
                  styles.statusSmallPill,
                  job.employer_confirmed
                    ? styles.statusSmallPillReady
                    : undefined,
                ]}>
                <Text
                  style={[
                    styles.statusSmallText,
                    job.employer_confirmed
                      ? styles.statusSmallTextReady
                      : undefined,
                  ]}>
                  {job.employer_confirmed ? 'Listo' : 'Pendiente'}
                </Text>
              </View>
            </View>
          </SaharaCard>

          {/* Operational Terms & Private Address */}
          <SaharaCard variant="lowest" style={{ gap: 12 }}>
            <View style={styles.sectionHeaderRow}>
              <Text style={styles.sectionLabel}>DETALLES DEL TRABAJO</Text>
              <Text style={styles.folioMono}>{formatFolio(job.id)}</Text>
            </View>

            <Text style={styles.jobTitle}>{job.title}</Text>
            <Text style={styles.jobDesc}>{job.description}</Text>

            <View style={styles.termItemRow}>
              <View style={styles.termIconCircle}>
                <SaharaIcon
                  name="calendar_today"
                  size={16}
                  color={SaharaColors.primaryAccessible}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.termTitle}>
                  {formatSpanishDate(job.job_date)}
                </Text>
                <Text style={styles.termSub}>
                  {formatTimeRange(job.start_time, job.end_time)}
                </Text>
              </View>
            </View>

            <View style={styles.termItemRow}>
              <View style={styles.termIconCircle}>
                <SaharaIcon
                  name="location_on"
                  size={16}
                  color={SaharaColors.primaryAccessible}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.termTitle}>
                  {job.private_data.exact_address}
                </Text>
                <Text style={styles.termSub}>
                  {job.neighborhood} · Visible para el trabajador elegido
                </Text>
              </View>
            </View>

            {job.conditions ? (
              <View style={styles.termItemRow}>
                <View style={styles.termIconCircle}>
                  <SaharaIcon
                    name="handyman"
                    size={16}
                    color={SaharaColors.primaryAccessible}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.termTitle}>
                    Herramientas y condiciones
                  </Text>
                  <Text style={styles.termSub}>{job.conditions}</Text>
                </View>
              </View>
            ) : null}
          </SaharaCard>

          {/* Financial Breakdown */}
          <SaharaCard variant="lowest" style={{ gap: 10 }}>
            <View style={styles.sectionHeaderRow}>
              <Text style={styles.sectionLabel}>RESUMEN DEL PAGO</Text>
              <View style={styles.stripeBadge}>
                <SaharaIcon
                  name="shield"
                  size={12}
                  color={SaharaColors.primaryAccessible}
                />
                <Text style={styles.stripeBadgeText}>Pago Protegido</Text>
              </View>
            </View>

            <View style={styles.breakdownRow}>
              <Text style={styles.breakdownLabel}>Pago para el trabajador</Text>
              <Text style={styles.breakdownValue}>
                {formatCurrencyMXN(job.fixed_payment_mxn)}
              </Text>
            </View>
            <View style={styles.breakdownRow}>
              <Text style={styles.breakdownLabel}>
                Comisión de la aplicación (10%)
              </Text>
              <Text style={styles.breakdownValue}>
                {formatCurrencyMXN(job.platform_fee_mxn)}
              </Text>
            </View>
            <View style={[styles.breakdownRow, styles.breakdownTotalRow]}>
              <Text style={styles.breakdownTotalLabel}>Total a pagar</Text>
              <Text style={styles.breakdownTotalValue}>
                {formatCurrencyMXN(job.total_charged_mxn)}
              </Text>
            </View>
          </SaharaCard>

          {/* Isolated Demo Simulation Box (PY-SYS-05: Clearly separated so real users aren't confused) */}
          {job.status === 'assigned' &&
          job.employer_confirmed &&
          job.worker_confirmed ? (
            <SaharaCard variant="low" style={{ gap: 8 }}>
              <Text style={styles.sectionLabel}>
                MODO DE PRUEBA (OPCIONAL)
              </Text>
              <Text style={styles.termSub}>
                Usa este botón solo si quieres simular ahora mismo que el
                trabajador ya llegó a tu domicilio y pasar a la pantalla de pago:
              </Text>
              <SaharaButton
                testID="simulate-arrival-btn"
                label="Modo Prueba: Simular que el trabajador ya llegó"
                icon="navigation"
                variant="secondary"
                size="sm"
                loading={isSimulatingArrival}
                onPress={() => void handleSimulateArrival()}
              />
            </SaharaCard>
          ) : null}

          {/* Support / Claim Action */}
          <SaharaButton
            testID="open-case-from-assigned-btn"
            label="¿Tuviste un problema o necesitas cancelar? Pedir ayuda"
            variant="outline"
            icon="gavel"
            onPress={() =>
              router.push(`/(main)/cases/open?jobId=${job.id}` as never)
            }
          />
        </>
      )}
    </SaharaScreenShell>
  );
}

const styles = StyleSheet.create({
  stepCalloutSuper: {
    fontFamily: Fonts.label,
    fontSize: 10.5,
    fontWeight: '700',
    letterSpacing: 0.9,
    color: SaharaColors.onPrimaryFixedVariant,
  },
  stepCalloutTitle: {
    fontFamily: Fonts.headline,
    fontSize: 19,
    fontWeight: '700',
    color: SaharaColors.onPrimaryFixed,
  },
  stepCalloutBody: {
    fontFamily: Fonts.body,
    fontSize: 12.5,
    color: SaharaColors.onPrimaryFixedVariant,
    lineHeight: 18,
  },
  workerHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  workerAvatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: SaharaColors.primaryFixed,
    alignItems: 'center',
    justifyContent: 'center',
  },
  workerAvatarText: {
    fontFamily: Fonts.headline,
    fontSize: 20,
    fontWeight: '700',
    color: SaharaColors.onPrimaryFixedVariant,
  },
  workerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  workerName: {
    flex: 1,
    fontFamily: Fonts.headline,
    fontSize: 19,
    fontWeight: '700',
    color: SaharaColors.onSurface,
  },
  workerMetaChips: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 2,
  },
  ratingChip: {
    backgroundColor: SaharaColors.surfaceContainer,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: Radius.full,
  },
  ratingChipText: {
    fontFamily: Fonts.label,
    fontSize: 11.5,
    fontWeight: '700',
    color: SaharaColors.primaryAccessible,
  },
  contactBox: {
    backgroundColor: SaharaColors.surfaceContainerLow,
    borderRadius: Radius.lg,
    padding: 12,
    gap: 10,
  },
  contactHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  contactUnlockedLabel: {
    fontFamily: Fonts.label,
    fontSize: 12,
    color: SaharaColors.onSurfaceVariant,
  },
  contactPhoneText: {
    fontFamily: Fonts.label,
    fontSize: 13.5,
    fontWeight: '700',
    color: SaharaColors.onSurface,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sectionLabel: {
    fontFamily: Fonts.label,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
    color: SaharaColors.onSurfaceVariant,
  },
  folioMono: {
    fontFamily: Fonts.mono,
    fontSize: 11.5,
    fontWeight: '700',
    color: SaharaColors.onPrimaryFixedVariant,
    backgroundColor: SaharaColors.primaryFixed,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: Radius.xs,
  },
  jobTitle: {
    fontFamily: Fonts.headline,
    fontSize: 18,
    fontWeight: '700',
    color: SaharaColors.onSurface,
  },
  jobDesc: {
    fontFamily: Fonts.body,
    fontSize: 12.5,
    color: SaharaColors.onSurfaceVariant,
    lineHeight: 18,
  },
  termItemRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  termIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: SaharaColors.surfaceContainer,
    alignItems: 'center',
    justifyContent: 'center',
  },
  termTitle: {
    fontFamily: Fonts.label,
    fontSize: 12.5,
    fontWeight: '700',
    color: SaharaColors.onSurface,
  },
  termSub: {
    fontFamily: Fonts.body,
    fontSize: 12,
    color: SaharaColors.onSurfaceVariant,
    lineHeight: 17,
  },
  stripeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: SaharaColors.surfaceContainer,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: Radius.full,
  },
  stripeBadgeText: {
    fontFamily: Fonts.label,
    fontSize: 10.5,
    fontWeight: '600',
    color: SaharaColors.onSurface,
  },
  breakdownRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  breakdownLabel: {
    fontFamily: Fonts.body,
    fontSize: 12.5,
    color: SaharaColors.onSurfaceVariant,
  },
  breakdownValue: {
    fontFamily: Fonts.label,
    fontSize: 13,
    fontWeight: '600',
    color: SaharaColors.onSurface,
  },
  breakdownTotalRow: {
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: SaharaColors.borderDefault,
  },
  breakdownTotalLabel: {
    fontFamily: Fonts.label,
    fontSize: 13.5,
    fontWeight: '700',
    color: SaharaColors.onSurface,
  },
  breakdownTotalValue: {
    fontFamily: Fonts.headline,
    fontSize: 20,
    fontWeight: '700',
    color: SaharaColors.primaryAccessible,
  },
  checkItemBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: SaharaColors.surfaceContainerLow,
    padding: 11,
    borderRadius: Radius.md,
  },
  checkItemTitle: {
    fontFamily: Fonts.label,
    fontSize: 12.5,
    fontWeight: '700',
    color: SaharaColors.onSurface,
  },
  checkItemSub: {
    fontFamily: Fonts.body,
    fontSize: 11.5,
    color: SaharaColors.onSurfaceVariant,
  },
  statusSmallPill: {
    backgroundColor: SaharaColors.surfaceContainerHighest,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: Radius.xs,
  },
  statusSmallPillReady: {
    backgroundColor: SaharaColors.primaryFixed,
  },
  statusSmallText: {
    fontFamily: Fonts.label,
    fontSize: 11,
    fontWeight: '600',
    color: SaharaColors.onSurface,
  },
  statusSmallTextReady: {
    color: SaharaColors.onPrimaryFixed,
    fontWeight: '700',
  },
});

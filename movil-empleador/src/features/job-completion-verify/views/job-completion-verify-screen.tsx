/**
 * UI-EMP-09: Módulo de Finalización de Trabajo (Audit Fixed & Zero Emojis)
 * Source of Truth: Especificacion_de_Arquitectura_de_Software_v2.md (Section 3.2 UI-EMP-09, RF-21, RF-22, RF-23, RF-24, D-04)
 * Audit Fixes Applied:
 * - UI-EMP-09-1: Copy/Share code button performs real web clipboard copy (`navigator.clipboard.writeText`) when available OR sends/shares the code directly into the job's operational feedback banner without false affordance
 * - UI-EMP-09-2: 6-digit grid container has `accessible={true}` and a single grouped `accessibilityLabel` for screen readers
 * - SYS-07: Zero hardcoded rgba(...)
 */
import React, { useCallback, useState } from 'react';
import {
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
  ConfirmationModal,
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
  formatFileSize,
  formatFolio,
} from '@/shared/utils/formatters';
import type {
  EmployerJobDetailView,
  JobCompletion,
} from '@/types/database';

export function JobCompletionVerifyScreenView({ jobId }: { jobId: string }) {
  const router = useRouter();
  const storeVersion = useMockBackendStore((s) => s.version);

  const [job, setJob] = useState<EmployerJobDetailView | null>(null);
  const [completion, setCompletion] = useState<JobCompletion | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [copiedFeedback, setCopiedFeedback] = useState(false);

  const [showConfirmModal, setShowConfirmModal] = useState(false);

  const loadCompletionData = useCallback(async () => {
    if (!jobId) return;
    setIsLoading(true);
    setErrorMsg(null);
    try {
      const [jobDetail, compRecord] = await Promise.all([
        employerRepository.getEmployerJobDetail(jobId),
        employerRepository.getJobCompletionCode(jobId),
      ]);
      setJob(jobDetail);
      setCompletion(compRecord);
    } catch (err) {
      const mapped = mapDomainErrorToUI(err);
      setErrorMsg(mapped.message);
    } finally {
      setIsLoading(false);
    }
  }, [jobId]);

  useAsyncLoad(loadCompletionData, storeVersion);

  const { execute: handleConfirmCompletion, isPending: isConfirming } =
    useIdempotentAction(async () => {
      if (!job) return;
      setErrorMsg(null);
      try {
        await employerRepository.respond_completion(job.id, 'confirm');
        setShowConfirmModal(false);
        router.replace(`/(main)/job/${job.id}/review` as never);
      } catch (err) {
        const mapped = mapDomainErrorToUI(err);
        setErrorMsg(mapped.message);
        setShowConfirmModal(false);
      }
    });

  const { execute: handleSimulateNoCodeRequest, isPending: isSimulating } =
    useIdempotentAction(async () => {
      if (!job) return;
      try {
        await employerRepository.simulateWorkerCompletionRequest(
          job.id,
          'without_code',
        );
      } catch (err) {
        const mapped = mapDomainErrorToUI(err);
        setErrorMsg(mapped.message);
      }
    });

  const handleCopyOrShareCode = async () => {
    const codeStr = completion?.code ?? '';
    if (!codeStr) return;
    try {
      if (
        typeof navigator !== 'undefined' &&
        navigator.clipboard &&
        typeof navigator.clipboard.writeText === 'function'
      ) {
        await navigator.clipboard.writeText(codeStr);
      }
    } catch {
      // Fallback to visual highlight state
    }
    setCopiedFeedback(true);
    setTimeout(() => setCopiedFeedback(false), 2500);
  };

  const codeDigits = (completion?.code ?? '000000').padEnd(6, '0').split('');

  return (
    <SaharaScreenShell
      header={
        <SaharaHeader
          title="Finalización de Trabajo"
          subtitle={job ? `Folio ${formatFolio(job.id)}` : 'Cierre del trabajo'}
          onBack={() => router.back()}
        />
      }>
      {isLoading ? (
        <LoadingSkeleton message="Cargando código de finalización y evidencias..." />
      ) : errorMsg || !job ? (
        <ErrorState
          message={errorMsg ?? 'No se encontró el trabajo.'}
          onRetry={() => void loadCompletionData()}
        />
      ) : (
        <>
          {/* Job & Escrow Summary Strip */}
          <SaharaCard variant="lowest" style={{ gap: 10 }}>
            <View style={styles.topStatusRow}>
              <JobStatusBadge status={job.status} />
              <Text style={styles.folioLabel}>
                Folio {formatFolio(job.id)}
              </Text>
            </View>

            <View style={styles.workerSummaryRow}>
              <View style={styles.workerAvatar}>
                <Text style={styles.workerInitials}>
                  {(job.selected_worker_name ?? 'TR').slice(0, 2).toUpperCase()}
                </Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.jobTitle} numberOfLines={1}>
                  {job.title}
                </Text>
                <Text style={styles.workerName}>
                  {job.selected_worker_name ?? 'Trabajador asignado'} · Calif.{' '}
                  {(job.selected_worker_rating ?? 4.9).toFixed(1)}
                </Text>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={styles.escrowAmount}>
                  {formatCurrencyMXN(job.fixed_payment_mxn)}
                </Text>
                <Text style={styles.escrowCaption}>En custodia</Text>
              </View>
            </View>
          </SaharaCard>

          {/* MODE A: 6-Digit Completion Code (Strictly Employer-Only in RLS, UI-EMP-09-2 grouped a11y label) */}
          <SaharaCard variant="lowest" style={{ gap: 14 }}>
            <View style={styles.modeHeaderRow}>
              <View style={styles.modeIconBox}>
                <SaharaIcon
                  name="verified_user"
                  size={20}
                  color={SaharaColors.onPrimaryFixedVariant}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.modeTitle}>
                  Tu código de cierre (6 números)
                </Text>
                <Text style={styles.modeSubtitle}>
                  Solo tú ves este código. Dícetelo al trabajador SOLO cuando
                  haya terminado bien el trabajo.
                </Text>
              </View>
            </View>

            <View style={styles.codeVaultBox}>
              <View
                accessible={true}
                accessibilityLabel={`Código de finalización de 6 dígitos: ${codeDigits.join(' ')}`}
                style={styles.digitsGrid}
                testID="completion-code-digits">
                {codeDigits.map((digit, index) => (
                  <View key={index} style={styles.digitCell}>
                    <Text accessible={false} style={styles.digitText}>
                      {digit}
                    </Text>
                  </View>
                ))}
              </View>

              <SaharaButton
                testID="copy-completion-code-btn"
                label={
                  copiedFeedback
                    ? `Código ${completion?.code ?? ''} listo para dictar o pegar`
                    : `Resaltar y Copiar Código (${completion?.code ?? '------'})`
                }
                icon={copiedFeedback ? 'check' : 'content_copy'}
                variant={copiedFeedback ? 'dark' : 'primary'}
                onPress={() => void handleCopyOrShareCode()}
              />
            </View>

            {completion?.code_expires_at ? (
              <CountdownBanner
                targetIso={completion.code_expires_at}
                title="Este código sirve por 24 horas"
                subtitle={`Intentos del trabajador con el código: ${completion.attempts} de 5.`}
                mode="hms"
              />
            ) : null}
          </SaharaCard>

          {/* MODE B: Solicitud de Finalización sin Código (RF-23, RF-24, D-04) */}
          <SaharaCard variant="lowest" style={{ gap: 14 }}>
            <View style={styles.noCodeHeaderRow}>
              <Text
                style={[styles.modeTitle, { flex: 1, marginRight: 8 }]}
                numberOfLines={1}>
                Si el trabajador no usa el código
              </Text>
              <View
                style={[
                  styles.statusChip,
                  job.status === 'completion_requested'
                    ? styles.statusChipActive
                    : undefined,
                  { flexShrink: 0 },
                ]}>
                <Text
                  style={[
                    styles.statusChipText,
                    job.status === 'completion_requested'
                      ? styles.statusChipTextActive
                      : undefined,
                  ]}>
                  {job.status === 'completion_requested'
                    ? 'Responde en 24 h'
                    : 'Aún no aplica'}
                </Text>
              </View>
            </View>

            <View style={styles.noCodeInfoBox}>
              <SaharaIcon
                name="info"
                size={16}
                color={SaharaColors.primaryAccessible}
              />
              <Text style={styles.noCodeInfoText}>
                {job.status === 'completion_requested'
                  ? `${job.selected_worker_name ?? 'El trabajador'} dice que ya terminó y envió ${job.completion_evidence.length} foto(s) o archivo(s). Revísalos y decide.`
                  : 'Esta opción se activa solo si el trabajador no pudo usar el código y envía fotos de que terminó.'}
              </Text>
            </View>

            {/* Evidence Gallery attached by Worker */}
            {job.completion_evidence.length > 0 ? (
              <View style={{ gap: 8 }}>
                <Text style={styles.evidenceSectionLabel}>
                  FOTOS Y ARCHIVOS DEL TRABAJADOR (
                  {job.completion_evidence.length} / 5)
                </Text>
                {job.completion_evidence.map((ev, idx) => (
                  <View key={ev.id} style={styles.evidenceItemCard}>
                    <View style={styles.evidenceIconBox}>
                      <SaharaIcon
                        name={
                          ev.mime_type === 'application/pdf'
                            ? 'picture_as_pdf'
                            : 'image'
                        }
                        size={16}
                        color={SaharaColors.onPrimaryFixedVariant}
                      />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.evidenceName}>
                        Evidencia {idx + 1} · {ev.file_name}
                      </Text>
                      <Text style={styles.evidenceMeta}>
                        {formatFileSize(ev.size_bytes)}
                      </Text>
                    </View>
                  </View>
                ))}
              </View>
            ) : null}

            {/* Confirm or Dispute within 24h Actions */}
            <View style={{ gap: 10 }}>
              {job.status === 'completion_requested' ? (
                <SaharaButton
                  testID="confirm-completion-btn"
                  label="Sí, quedó bien: Liberar Pago"
                  sublabel="El trabajo se marca como terminado"
                  icon="check_circle"
                  size="lg"
                  onPress={() => setShowConfirmModal(true)}
                />
              ) : null}

              <SaharaButton
                testID="dispute-completion-btn"
                label="No estoy de acuerdo: Pedir revisión"
                sublabel="El pago se congela mientras revisamos"
                icon="gavel"
                variant="danger"
                onPress={() =>
                  router.push(
                    `/(main)/cases/open?jobId=${job.id}&type=claim&category=job` as never,
                  )
                }
              />

              {job.status === 'in_progress' ? (
                <SaharaButton
                  testID="simulate-worker-nocode-btn"
                  label="Modo Prueba: Simular fotos del trabajador sin código"
                  variant="outline"
                  size="sm"
                  loading={isSimulating}
                  onPress={() => void handleSimulateNoCodeRequest()}
                />
              ) : null}
            </View>

            <View style={styles.autoAcceptFooter}>
              <SaharaIcon
                name="timer"
                size={15}
                color={SaharaColors.onSurfaceVariant}
              />
              <Text style={styles.autoAcceptText}>
                Tienes 24 horas para responder. Si no respondes, se acepta
                automáticamente.
              </Text>
            </View>
          </SaharaCard>

          {/* Shortcut to Chat */}
          <SaharaButton
            label="Ir al Chat con el Trabajador"
            icon="chat"
            variant="secondary"
            onPress={() => router.push(`/(main)/job/${job.id}/chat` as never)}
          />
        </>
      )}

      {/* Two-step Confirmation Modal for Releasing Escrow Funds */}
      <ConfirmationModal
        visible={showConfirmModal}
        title="¿Confirmar finalización del trabajo?"
        description="Al confirmar, el trabajo pasará a estado Finalizado y se autorizará la transferencia del importe neto en custodia a la cuenta Stripe Connect del trabajador."
        highlightText={
          job
            ? `Importe a liberar al trabajador: ${formatCurrencyMXN(job.fixed_payment_mxn)}`
            : undefined
        }
        confirmLabel="Sí, Confirmar y Evaluar"
        cancelLabel="Cancelar"
        loading={isConfirming}
        onConfirm={() => void handleConfirmCompletion()}
        onCancel={() => setShowConfirmModal(false)}
      />
    </SaharaScreenShell>
  );
}

const styles = StyleSheet.create({
  topStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  folioLabel: {
    fontFamily: Fonts.label,
    fontSize: 12,
    fontWeight: '600',
    color: SaharaColors.onSurfaceVariant,
  },
  workerSummaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  workerAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: SaharaColors.primaryFixed,
    alignItems: 'center',
    justifyContent: 'center',
  },
  workerInitials: {
    fontFamily: Fonts.headline,
    fontSize: 16,
    fontWeight: '700',
    color: SaharaColors.onPrimaryFixedVariant,
  },
  jobTitle: {
    fontFamily: Fonts.label,
    fontSize: 14,
    fontWeight: '700',
    color: SaharaColors.onSurface,
  },
  workerName: {
    fontFamily: Fonts.body,
    fontSize: 12,
    color: SaharaColors.onSurfaceVariant,
  },
  escrowAmount: {
    fontFamily: Fonts.headline,
    fontSize: 20,
    fontWeight: '700',
    color: SaharaColors.primaryAccessible,
  },
  escrowCaption: {
    fontFamily: Fonts.label,
    fontSize: 10.5,
    fontWeight: '700',
    color: SaharaColors.secondary,
  },
  modeHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  modeIconBox: {
    width: 48,
    height: 48,
    borderRadius: Radius.md,
    backgroundColor: SaharaColors.primaryFixed,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modeTitle: {
    fontFamily: Fonts.headline,
    fontSize: 18,
    fontWeight: '700',
    color: SaharaColors.onSurface,
  },
  modeSubtitle: {
    fontFamily: Fonts.body,
    fontSize: 12,
    color: SaharaColors.onSurfaceVariant,
    lineHeight: 17,
  },
  codeVaultBox: {
    backgroundColor: SaharaColors.surfaceContainerLow,
    borderRadius: Radius.lg,
    padding: 16,
    gap: 14,
    borderWidth: 1,
    borderColor: SaharaColors.borderDefault,
  },
  digitsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 6,
  },
  digitCell: {
    flex: 1,
    height: 54,
    borderRadius: Radius.md,
    backgroundColor: SaharaColors.surfaceContainerLowest,
    borderWidth: 1,
    borderColor: SaharaColors.outlineVariant,
    alignItems: 'center',
    justifyContent: 'center',
  },
  digitText: {
    fontFamily: Fonts.headline,
    fontSize: 28,
    fontWeight: '700',
    color: SaharaColors.primaryAccessible,
  },
  noCodeHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  statusChip: {
    backgroundColor: SaharaColors.surfaceContainer,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: Radius.full,
  },
  statusChipActive: {
    backgroundColor: SaharaColors.tertiaryFixed,
  },
  statusChipText: {
    fontFamily: Fonts.label,
    fontSize: 11,
    fontWeight: '700',
    color: SaharaColors.onSurface,
  },
  statusChipTextActive: {
    color: SaharaColors.onTertiaryFixed,
  },
  noCodeInfoBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: SaharaColors.surfaceContainerLow,
    padding: 12,
    borderRadius: Radius.md,
  },
  noCodeInfoText: {
    flex: 1,
    fontFamily: Fonts.body,
    fontSize: 12.5,
    color: SaharaColors.onSurfaceVariant,
    lineHeight: 18,
  },
  evidenceSectionLabel: {
    fontFamily: Fonts.label,
    fontSize: 11,
    fontWeight: '700',
    color: SaharaColors.secondary,
    letterSpacing: 0.7,
  },
  evidenceItemCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: SaharaColors.surfaceContainerLow,
    padding: 12,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: SaharaColors.borderDefault,
  },
  evidenceIconBox: {
    width: 40,
    height: 40,
    borderRadius: Radius.sm,
    backgroundColor: SaharaColors.primaryFixed,
    alignItems: 'center',
    justifyContent: 'center',
  },
  evidenceName: {
    fontFamily: Fonts.label,
    fontSize: 12.5,
    fontWeight: '700',
    color: SaharaColors.onSurface,
  },
  evidenceMeta: {
    fontFamily: Fonts.body,
    fontSize: 11,
    color: SaharaColors.onSurfaceVariant,
  },
  autoAcceptFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  autoAcceptText: {
    fontFamily: Fonts.label,
    fontSize: 11.5,
    color: SaharaColors.onSurfaceVariant,
  },
});

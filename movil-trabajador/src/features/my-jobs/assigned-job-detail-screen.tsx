/**
 * MÓDULO 8: CONFIRMACIÓN DE CONDICIONES, DOMICILIO DESBLOQUEADO Y REGISTRO DE LLEGADA
 * - Dirección y punto exacto desbloqueados para el trabajador seleccionado
 * - Teléfono de contacto del empleador y acceso directo al chat
 * - Botón «Acepto las condiciones» + estado de confirmación de ambas partes
 * - Estado de alta de Stripe Connect (con acceso directo al flujo de alta)
 * - Registro de llegada (desde 30 min antes de inicio hasta fin, ambas confirmaciones, Stripe listo, sin GPS)
 * - Línea visual del ciclo de vida de los 10 estados del trabajo
 * - Acceso directo a Finalización (Módulo 9), Evaluación (Módulo 14) y Reclamaciones (Módulo 13)
 */
import React, { useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Fonts, Radius, SaharaColors, Spacing } from '@/constants/theme';
import {
  ConfirmationModal,
  CountdownBanner,
  EmptyState,
  FeedbackBanner,
  InteractiveMapCanvas,
  JobStatusBadge,
  PaymentStatusBadge,
  RatingStars,
  SaharaButton,
  SaharaCard,
  SaharaHeader,
  SaharaIcon,
  SaharaScreenShell,
} from '@/components/ui';
import { useWorkerStore, workerStore } from '@/services/worker-store';
import { mapDomainErrorToMessage } from '@/shared/utils/error-mapper';
import {
  formatCurrencyMXN,
  formatFolio,
  formatSpanishDate,
  formatTimeRange,
  JOB_CATEGORY_LABELS,
  JOB_STATUS_LABELS,
} from '@/shared/utils/formatters';
import type { JobStatus } from '@/types/database';

const LIFECYCLE_STEPS: JobStatus[] = [
  'published',
  'has_applications',
  'assigned',
  'arrival_registered',
  'in_progress',
  'completion_requested',
  'completed',
];

export function AssignedJobDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const version = useWorkerStore((s) => s.version);

  const [feedback, setFeedback] = useState<{
    tone: 'success' | 'error' | 'info';
    text: string;
  } | null>(null);
  const [confirmArrivalModal, setConfirmArrivalModal] = useState(false);

  const detail = useMemo(() => {
    void version;
    return id ? workerStore.getAssignedJobDetail(id) : null;
  }, [id, version]);

  if (!detail) {
    return (
      <SaharaScreenShell
        header={<SaharaHeader title="Trabajo asignado" onBack={() => router.back()} />}>
        <EmptyState
          icon="work"
          title="Trabajo no encontrado"
          description="Este trabajo no está asignado a tu cuenta."
          actionLabel="Volver a Mis trabajos"
          onAction={() => router.replace('/(main)/my-jobs' as never)}
        />
      </SaharaScreenShell>
    );
  }

  const arrivalCheck = workerStore.getArrivalWindowStatus(detail);
  const { job } = detail;
  const currentStepIndex = LIFECYCLE_STEPS.indexOf(job.status);

  const completionDeadlineIso = job.completion_requested_at
    ? new Date(
        new Date(job.completion_requested_at).getTime() + 24 * 3600 * 1000,
      ).toISOString()
    : null;

  const handleAcceptConditions = () => {
    setFeedback(null);
    try {
      workerStore.acceptJobConditions(job.id);
      setFeedback({
        tone: 'success',
        text: 'Has aceptado las condiciones acordadas para este trabajo.',
      });
    } catch (err) {
      setFeedback({ tone: 'error', text: mapDomainErrorToMessage(err) });
    }
  };

  const handleRegisterArrival = () => {
    setFeedback(null);
    try {
      workerStore.registerArrival(job.id);
      setConfirmArrivalModal(false);
      setFeedback({
        tone: 'success',
        text: 'Llegada registrada correctamente. Se notificó al empleador para confirmar el pago e iniciar el trabajo.',
      });
    } catch (err) {
      setConfirmArrivalModal(false);
      setFeedback({ tone: 'error', text: mapDomainErrorToMessage(err) });
    }
  };

  const handleCheckPaymentUpdate = () => {
    setFeedback(null);
    try {
      workerStore.refreshPaymentAndStartJob(job.id);
      setFeedback({
        tone: 'success',
        text: 'El pago quedó confirmado y el trabajo ahora está En curso.',
      });
    } catch (err) {
      setFeedback({ tone: 'error', text: mapDomainErrorToMessage(err) });
    }
  };

  return (
    <SaharaScreenShell
      header={
        <SaharaHeader
          title="Detalle del trabajo"
          subtitle={formatFolio(job.id, 'TRB')}
          onBack={() => router.back()}
        />
      }>
      {feedback ? (
        <FeedbackBanner
          tone={feedback.tone}
          message={feedback.text}
          onDismiss={() => setFeedback(null)}
        />
      ) : null}

      {/* Cabecera del trabajo y pago */}
      <SaharaCard
        variant="lowest"
        accentColor={SaharaColors.primaryAccessible}
        style={{ gap: 10 }}>
        <View style={styles.topBadges}>
          <JobStatusBadge status={job.status} />
          {detail.payment ? (
            <PaymentStatusBadge status={detail.payment.status} />
          ) : null}
        </View>

        <Text style={styles.categoryLine}>
          {JOB_CATEGORY_LABELS[job.category]} · {detail.employer_name}
        </Text>
        <Text style={styles.title}>{job.title}</Text>
        <Text style={styles.description}>{job.description}</Text>

        <View style={styles.summaryGrid}>
          <View style={styles.summaryBox}>
            <Text style={styles.summaryLabel}>Pago acordado</Text>
            <Text style={styles.summaryAmount}>
              {formatCurrencyMXN(job.fixed_payment_mxn)}
            </Text>
          </View>
          <View style={styles.summaryBox}>
            <Text style={styles.summaryLabel}>Fecha y horario</Text>
            <Text style={styles.summaryDate}>
              {formatSpanishDate(job.job_date)}
            </Text>
            <Text style={styles.summaryTime}>
              {formatTimeRange(job.start_time, job.end_time)}
            </Text>
          </View>
        </View>

        <View style={styles.contactRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.contactLabel}>Contacto del empleador</Text>
            <Text style={styles.contactValue}>{detail.employer_phone}</Text>
          </View>
          <SaharaButton
            label="Abrir chat"
            icon="chat"
            variant="outline"
            size="sm"
            fullWidth={false}
            onPress={() => router.push(`/(main)/chat/${job.id}` as never)}
          />
        </View>
      </SaharaCard>

      {/* Temporizadores relevantes */}
      {job.status === 'assigned' &&
      job.selection_expires_at &&
      (!detail.worker_confirmed || !detail.employer_confirmed) ? (
        <CountdownBanner
          targetIso={job.selection_expires_at}
          title="Ventana de confirmación (24 horas)"
          subtitle="Ambas partes deben aceptar las condiciones y tu cuenta conectada debe estar activa antes de vencer el plazo."
        />
      ) : null}

      {job.status === 'completion_requested' && completionDeadlineIso ? (
        <CountdownBanner
          targetIso={completionDeadlineIso}
          title="Finalización pendiente de confirmación"
          subtitle="El empleador cuenta con un máximo de 24 horas para confirmar tu solicitud sin código."
          variant="tertiary"
        />
      ) : null}

      {job.status === 'in_claim' ? (
        <SaharaCard variant="tertiaryFixed" style={{ gap: 8 }}>
          <Text style={styles.alertHeading}>Trabajo en reclamación</Text>
          <Text style={styles.alertBody}>
            Los fondos del trabajo permanecen bloqueados de forma segura mientras el equipo de soporte revisa y cierra el caso.
          </Text>
          <SaharaButton
            label="Consultar mi reclamación"
            variant="outline"
            size="sm"
            onPress={() => router.push('/(main)/cases' as never)}
          />
        </SaharaCard>
      ) : null}

      {/* Domicilio y punto exacto desbloqueado */}
      <SaharaCard variant="lowest" style={{ gap: 10 }}>
        <View style={styles.unlockedHeader}>
          <SaharaIcon name="lock_open" size={15} color={SaharaColors.success} />
          <Text style={styles.sectionTitle}>Domicilio exacto desbloqueado</Text>
        </View>
        <Text style={styles.exactAddress}>{detail.exact_address}</Text>
        <InteractiveMapCanvas
          mode="assigned"
          latitude={detail.exact_latitude}
          longitude={detail.exact_longitude}
          pinLabel={detail.exact_address}
          interactive={false}
        />
      </SaharaCard>

      {/* Condiciones, confirmaciones y alta de Stripe Connect */}
      <SaharaCard variant="lowest" style={{ gap: 12 }}>
        <Text style={styles.sectionTitle}>Condiciones y requisitos previos</Text>
        <View style={styles.conditionsBox}>
          <Text style={styles.conditionsText}>
            {job.conditions ??
              'Cumplir con el horario acordado, respetar las normas de seguridad del lugar y notificar cualquier incidencia por el chat.'}
          </Text>
        </View>

        <View style={styles.checklistBox}>
          <View style={styles.checkRow}>
            <SaharaIcon
              name={detail.employer_confirmed ? 'check_circle' : 'hourglass_top'}
              size={15}
              color={
                detail.employer_confirmed
                  ? SaharaColors.success
                  : SaharaColors.warning
              }
            />
            <Text style={styles.checkText}>
              Empleador:{' '}
              {detail.employer_confirmed
                ? 'Condiciones aceptadas'
                : 'Pendiente de confirmar'}
            </Text>
          </View>
          <View style={styles.checkRow}>
            <SaharaIcon
              name={detail.worker_confirmed ? 'check_circle' : 'hourglass_top'}
              size={15}
              color={
                detail.worker_confirmed
                  ? SaharaColors.success
                  : SaharaColors.warning
              }
            />
            <Text style={styles.checkText}>
              Tú:{' '}
              {detail.worker_confirmed
                ? 'Condiciones aceptadas'
                : 'Pendiente de tu confirmación'}
            </Text>
          </View>
          <View style={styles.checkRow}>
            <SaharaIcon
              name={detail.worker_stripe_ready ? 'verified_user' : 'warning'}
              size={15}
              color={
                detail.worker_stripe_ready
                  ? SaharaColors.success
                  : SaharaColors.error
              }
            />
            <Text style={styles.checkText}>
              Cuenta conectada (Stripe Connect):{' '}
              {detail.worker_stripe_ready ? 'Alta completa' : 'Pendiente de alta'}
            </Text>
          </View>
        </View>

        {job.status === 'assigned' && !detail.worker_confirmed ? (
          <SaharaButton
            label="Acepto las condiciones"
            icon="handshake"
            onPress={handleAcceptConditions}
          />
        ) : null}

        {!detail.worker_stripe_ready ? (
          <SaharaButton
            label="Completar alta de cuenta conectada"
            variant="secondary"
            icon="account_balance"
            onPress={() => router.push('/(main)/stripe-connect' as never)}
          />
        ) : null}

        {/* Registro de llegada sin GPS */}
        {job.status === 'assigned' ? (
          <View style={{ gap: 8 }}>
            <SaharaButton
              label="Registrar llegada al lugar"
              icon="pin_drop"
              disabled={!arrivalCheck.canRegister}
              onPress={() => setConfirmArrivalModal(true)}
            />
            <Text style={styles.windowHint}>
              {arrivalCheck.canRegister
                ? 'Ventana de llegada abierta. El registro no requiere permisos ni validación GPS.'
                : arrivalCheck.reason}
            </Text>
          </View>
        ) : null}

        {/* Paso intermedio cuando ya se registró llegada y se espera confirmación de pago */}
        {job.status === 'arrival_registered' ? (
          <View style={styles.arrivalWaitingBox}>
            <Text style={styles.arrivalWaitingTitle}>
              Llegada registrada · Pago en proceso
            </Text>
            <Text style={styles.arrivalWaitingBody}>
              El empleador dispone de 30 minutos para confirmar el pago del trabajo. Una vez confirmado, la jornada pasará automáticamente a «En curso».
            </Text>
            <SaharaButton
              label="Actualizar estado de pago"
              variant="secondary"
              size="sm"
              onPress={handleCheckPaymentUpdate}
            />
          </View>
        ) : null}
      </SaharaCard>

      {/* Acciones para trabajo En curso / Finalizado */}
      {job.status === 'in_progress' ? (
        <SaharaCard variant="primaryFixed" style={{ gap: 10 }}>
          <Text style={styles.sectionTitle}>¿Concluiste el trabajo?</Text>
          <Text style={styles.bodyDark}>
            Puedes finalizar inmediatamente ingresando el código de 6 dígitos del empleador, o solicitar finalización sin código adjuntando evidencias.
          </Text>
          <SaharaButton
            label="Finalizar trabajo"
            icon="task_alt"
            onPress={() => router.push(`/(main)/job/${job.id}/completion` as never)}
          />
        </SaharaCard>
      ) : null}

      {job.status === 'completion_requested' ? (
        <SaharaCard variant="low" style={{ gap: 8 }}>
          <Text style={styles.sectionTitle}>Evidencias enviadas</Text>
          <Text style={styles.bodyMuted}>
            Tu solicitud de cierre sin código fue registrada con{' '}
            {detail.completion_evidence.length}{' '}
            {detail.completion_evidence.length === 1 ? 'archivo adjunto' : 'archivos adjuntos'}.
          </Text>
          {detail.completion_evidence.map((ev) => (
            <Text key={ev.id} style={styles.evidenceFile}>
              • {ev.file_name}
            </Text>
          ))}
        </SaharaCard>
      ) : null}

      {job.status === 'completed' ? (
        <SaharaCard variant="lowest" style={{ gap: 10 }}>
          <Text style={styles.sectionTitle}>Evaluación del empleador</Text>
          {detail.worker_reviewed && detail.worker_review ? (
            <View style={{ gap: 6 }}>
              <RatingStars rating={detail.worker_review.rating} size={18} />
              <Text style={styles.bodyMuted}>{detail.worker_review.comment}</Text>
              <Text style={styles.reviewDoneTag}>Evaluación publicada</Text>
            </View>
          ) : (
            <>
              <Text style={styles.bodyMuted}>
                Comparte tu experiencia trabajando con {detail.employer_name}.
              </Text>
              <SaharaButton
                label="Calificar empleador"
                icon="star"
                onPress={() => router.push(`/(main)/job/${job.id}/review` as never)}
              />
            </>
          )}
        </SaharaCard>
      ) : null}

      {/* Ciclo de vida visual de estados del trabajo */}
      <SaharaCard variant="low" style={{ gap: 10 }}>
        <Text style={styles.sectionTitle}>Estado del proceso</Text>
        <View style={styles.timelineWrap}>
          {LIFECYCLE_STEPS.map((st, idx) => {
            const reached = currentStepIndex >= idx;
            const isCurrent = job.status === st;
            return (
              <View key={st} style={styles.timelineRow}>
                <View
                  style={[
                    styles.timelineDot,
                    reached ? styles.timelineDotReached : undefined,
                    isCurrent ? styles.timelineDotCurrent : undefined,
                  ]}
                />
                <Text
                  style={[
                    styles.timelineText,
                    isCurrent ? styles.timelineTextCurrent : undefined,
                  ]}>
                  {JOB_STATUS_LABELS[st]}
                </Text>
              </View>
            );
          })}
          {['in_claim', 'cancelled', 'expired'].includes(job.status) ? (
            <View style={styles.timelineRow}>
              <View style={[styles.timelineDot, styles.timelineDotAlert]} />
              <Text style={[styles.timelineText, styles.timelineTextCurrent]}>
                Estado actual: {JOB_STATUS_LABELS[job.status]}
              </Text>
            </View>
          ) : null}
        </View>
      </SaharaCard>

      {/* Acceso a abrir reclamación o ticket */}
      {!['cancelled', 'expired'].includes(job.status) && !detail.open_claim_id ? (
        <SaharaButton
          label="Reportar incidencia o abrir reclamación"
          variant="outline"
          icon="gavel"
          onPress={() =>
            router.push({
              pathname: '/(main)/cases/new',
              params: { jobId: job.id, type: 'claim' },
            } as never)
          }
        />
      ) : null}

      <ConfirmationModal
        visible={confirmArrivalModal}
        title="Confirmar registro de llegada"
        description="Al confirmar, notificaremos al empleador que ya te encuentras en el domicilio acordado para iniciar el trabajo."
        highlightText={detail.exact_address}
        confirmLabel="Sí, registrar llegada"
        onConfirm={handleRegisterArrival}
        onCancel={() => setConfirmArrivalModal(false)}
      />
    </SaharaScreenShell>
  );
}

const styles = StyleSheet.create({
  topBadges: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  categoryLine: {
    fontFamily: Fonts.label,
    fontSize: 12,
    fontWeight: '700',
    color: SaharaColors.secondary,
  },
  title: {
    fontFamily: Fonts.headline,
    fontSize: 22,
    fontWeight: '600',
    color: SaharaColors.onSurface,
  },
  description: {
    fontFamily: Fonts.body,
    fontSize: 13.5,
    color: SaharaColors.onSurfaceVariant,
    lineHeight: 20,
  },
  summaryGrid: {
    flexDirection: 'row',
    gap: 10,
  },
  summaryBox: {
    flex: 1,
    backgroundColor: SaharaColors.surfaceContainerLow,
    padding: 12,
    borderRadius: Radius.lg,
    gap: 2,
  },
  summaryLabel: {
    fontFamily: Fonts.label,
    fontSize: 11,
    color: SaharaColors.secondary,
  },
  summaryAmount: {
    fontFamily: Fonts.headline,
    fontSize: 19,
    fontWeight: '700',
    color: SaharaColors.primaryAccessible,
  },
  summaryDate: {
    fontFamily: Fonts.label,
    fontSize: 13,
    fontWeight: '700',
    color: SaharaColors.onSurface,
  },
  summaryTime: {
    fontFamily: Fonts.body,
    fontSize: 11.5,
    color: SaharaColors.onSurfaceVariant,
  },
  contactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: SaharaColors.borderSubtle,
    gap: 10,
  },
  contactLabel: {
    fontFamily: Fonts.label,
    fontSize: 11,
    color: SaharaColors.secondary,
  },
  contactValue: {
    fontFamily: Fonts.label,
    fontSize: 14,
    fontWeight: '700',
    color: SaharaColors.onSurface,
  },
  unlockedHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  sectionTitle: {
    fontFamily: Fonts.headline,
    fontSize: 18,
    fontWeight: '600',
    color: SaharaColors.onSurface,
  },
  exactAddress: {
    fontFamily: Fonts.label,
    fontSize: 13.5,
    fontWeight: '600',
    color: SaharaColors.onSurface,
  },
  conditionsBox: {
    backgroundColor: SaharaColors.surfaceContainerLow,
    padding: 12,
    borderRadius: Radius.lg,
    borderLeftWidth: 3,
    borderLeftColor: SaharaColors.primaryAccessible,
  },
  conditionsText: {
    fontFamily: Fonts.body,
    fontSize: 13,
    color: SaharaColors.onSurface,
    lineHeight: 19,
  },
  checklistBox: {
    gap: 8,
  },
  checkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  checkText: {
    flex: 1,
    fontFamily: Fonts.label,
    fontSize: 12.5,
    color: SaharaColors.onSurface,
  },
  windowHint: {
    fontFamily: Fonts.body,
    fontSize: 12,
    color: SaharaColors.onSurfaceVariant,
    lineHeight: 17,
  },
  arrivalWaitingBox: {
    backgroundColor: SaharaColors.warningContainer,
    padding: 12,
    borderRadius: Radius.lg,
    gap: 8,
  },
  arrivalWaitingTitle: {
    fontFamily: Fonts.label,
    fontSize: 13,
    fontWeight: '700',
    color: SaharaColors.onWarningContainer,
  },
  arrivalWaitingBody: {
    fontFamily: Fonts.body,
    fontSize: 12,
    color: SaharaColors.onWarningContainer,
    lineHeight: 17,
  },
  bodyDark: {
    fontFamily: Fonts.body,
    fontSize: 13,
    color: SaharaColors.onPrimaryFixed,
    lineHeight: 19,
  },
  bodyMuted: {
    fontFamily: Fonts.body,
    fontSize: 13,
    color: SaharaColors.onSurfaceVariant,
    lineHeight: 19,
  },
  evidenceFile: {
    fontFamily: Fonts.label,
    fontSize: 12.5,
    color: SaharaColors.onSurface,
  },
  reviewDoneTag: {
    fontFamily: Fonts.label,
    fontSize: 11.5,
    fontWeight: '700',
    color: SaharaColors.success,
  },
  alertHeading: {
    fontFamily: Fonts.headline,
    fontSize: 17,
    fontWeight: '700',
    color: SaharaColors.onTertiaryFixed,
  },
  alertBody: {
    fontFamily: Fonts.body,
    fontSize: 12.5,
    color: SaharaColors.onTertiaryFixedVariant,
    lineHeight: 18,
  },
  timelineWrap: {
    gap: 8,
  },
  timelineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  timelineDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: SaharaColors.surfaceDim,
  },
  timelineDotReached: {
    backgroundColor: SaharaColors.primaryAccessible,
  },
  timelineDotCurrent: {
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: SaharaColors.onPrimaryFixed,
  },
  timelineDotAlert: {
    backgroundColor: SaharaColors.error,
  },
  timelineText: {
    fontFamily: Fonts.body,
    fontSize: 12.5,
    color: SaharaColors.onSurfaceVariant,
  },
  timelineTextCurrent: {
    fontFamily: Fonts.label,
    fontWeight: '700',
    color: SaharaColors.onSurface,
  },
});

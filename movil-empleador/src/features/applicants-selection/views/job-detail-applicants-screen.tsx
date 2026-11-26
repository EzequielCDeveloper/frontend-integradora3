/**
 * UI-EMP-04: Detalle de Publicación y Postulantes (Audit Fixed & Zero Emojis)
 * Source of Truth: Especificacion_de_Arquitectura_de_Software_v2.md (Section 3.2 UI-EMP-04, RF-06, RF-12)
 * Audit Fixes Applied:
 * - SYS-05: Virtualized with FlatList (`scrollable={false}` on SaharaScreenShell)
 * - UI-EMP-04-1: Added two-step ConfirmationModal (`rejectTarget`) before rejecting an applicant
 * - UI-EMP-04-2: Restructured applicant card actions so primary CTA "Seleccionar candidato" is full-width (`minHeight: 48`) and "Ver perfil" / "Rechazar" sit on a spacious 2-column row (`minHeight: 48`)
 * - SYS-07: Zero hardcoded rgba(...)
 */
import React, { useCallback, useState } from 'react';
import {
  FlatList,
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
  ApplicationStatusBadge,
  ConfirmationModal,
  EmptyState,
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
  JOB_CATEGORY_LABELS,
} from '@/shared/utils/formatters';
import type { ApplicantSummary, EmployerJobDetailView } from '@/types/database';

export function JobDetailApplicantsScreenView({ jobId }: { jobId: string }) {
  const router = useRouter();
  const storeVersion = useMockBackendStore((s) => s.version);

  const [job, setJob] = useState<EmployerJobDetailView | null>(null);
  const [applicants, setApplicants] = useState<ApplicantSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Two-step confirmation modals (Select, Reject, Cancel Job)
  const [selectTarget, setSelectTarget] = useState<ApplicantSummary | null>(
    null,
  );
  const [rejectTarget, setRejectTarget] = useState<ApplicantSummary | null>(
    null,
  );
  const [showCancelModal, setShowCancelModal] = useState(false);

  const loadData = useCallback(async () => {
    if (!jobId) return;
    setIsLoading(true);
    setErrorMsg(null);
    try {
      const [jobDetail, appList] = await Promise.all([
        employerRepository.getEmployerJobDetail(jobId),
        employerRepository.get_applicants(jobId),
      ]);
      setJob(jobDetail);
      setApplicants(appList);
    } catch (err) {
      const mapped = mapDomainErrorToUI(err);
      setErrorMsg(mapped.message);
    } finally {
      setIsLoading(false);
    }
  }, [jobId]);

  useAsyncLoad(loadData, storeVersion);

  const { execute: handleConfirmSelect, isPending: isSelecting } =
    useIdempotentAction(async () => {
      if (!selectTarget || !job) return;
      try {
        await employerRepository.select_worker(selectTarget.application_id);
        setSelectTarget(null);
        router.replace(`/(main)/job/${job.id}/assigned` as never);
      } catch (err) {
        const mapped = mapDomainErrorToUI(err);
        setErrorMsg(mapped.message);
        setSelectTarget(null);
      }
    });

  const { execute: handleConfirmReject, isPending: isRejecting } =
    useIdempotentAction(async () => {
      if (!rejectTarget) return;
      try {
        await employerRepository.reject_application(
          rejectTarget.application_id,
        );
        setRejectTarget(null);
      } catch (err) {
        const mapped = mapDomainErrorToUI(err);
        setErrorMsg(mapped.message);
        setRejectTarget(null);
      }
    });

  const { execute: handleConfirmCancelJob, isPending: isCancelling } =
    useIdempotentAction(async () => {
      if (!job) return;
      try {
        await employerRepository.cancel_job(job.id);
        setShowCancelModal(false);
        router.replace('/(main)/feed');
      } catch (err) {
        const mapped = mapDomainErrorToUI(err);
        setErrorMsg(mapped.message);
        setShowCancelModal(false);
      }
    });

  const canEditOrCancel =
    job !== null &&
    (job.status === 'published' || job.status === 'has_applications') &&
    job.selected_worker_id === null;

  const renderHeaderSummary = () => {
    if (!job) return null;
    return (
      <View style={{ gap: Spacing.md, marginBottom: 4 }}>
        {/* Job Summary Card */}
        <SaharaCard variant="lowest" style={{ gap: 14 }}>
          <View style={styles.topSummaryRow}>
            <View style={{ flex: 1, gap: 6 }}>
              <JobStatusBadge status={job.status} />
              <Text style={styles.jobTitle}>{job.title}</Text>
              <Text style={styles.categoryTag}>
                Categoría: {JOB_CATEGORY_LABELS[job.category]} ·{' '}
                {job.neighborhood}
              </Text>
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={styles.priceMain}>
                {formatCurrencyMXN(job.fixed_payment_mxn)}
              </Text>
              <Text style={styles.priceFee}>
                + {formatCurrencyMXN(job.platform_fee_mxn)} com. (10%)
              </Text>
            </View>
          </View>

          <Text style={styles.descriptionText}>{job.description}</Text>

          <View style={styles.metaBar}>
            <View style={styles.metaItem}>
              <SaharaIcon
                name="calendar_today"
                size={15}
                color={SaharaColors.primaryAccessible}
              />
              <Text style={styles.metaText}>
                {formatSpanishDate(job.job_date)} •{' '}
                {formatTimeRange(job.start_time, job.end_time)}
              </Text>
            </View>
            <View style={styles.metaItem}>
              <SaharaIcon
                name="verified_user"
                size={15}
                color={SaharaColors.primaryAccessible}
              />
              <Text style={styles.metaText}>Pago protegido</Text>
            </View>
          </View>

          {job.conditions ? (
            <View style={styles.conditionsBox}>
              <Text style={styles.conditionsLabel}>
                Qué debe llevar el trabajador:
              </Text>
              <Text style={styles.conditionsBody}>{job.conditions}</Text>
            </View>
          ) : null}

          <View style={styles.privateAddressBox}>
            <SaharaIcon
              name="lock"
              size={14}
              color={SaharaColors.primaryAccessible}
            />
            <View style={{ flex: 1 }}>
              <Text style={styles.privateAddressTitle}>
                Tu domicilio exacto (oculto a quienes aún no eliges):
              </Text>
              <Text style={styles.privateAddressValue}>
                {job.private_data.exact_address}
              </Text>
            </View>
          </View>

          {/* Pre-Selection Edit & Cancel Buttons */}
          {canEditOrCancel ? (
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <View style={{ flex: 1 }}>
                <SaharaButton
                  testID="detail-edit-job-btn"
                  label="Modificar"
                  icon="edit"
                  variant="outline"
                  onPress={() =>
                    router.push(
                      `/(main)/post-job?editJobId=${job.id}` as never,
                    )
                  }
                />
              </View>
              <View style={{ flex: 1 }}>
                <SaharaButton
                  testID="detail-cancel-job-btn"
                  label="Cancelar anuncio"
                  icon="cancel"
                  variant="danger"
                  onPress={() => setShowCancelModal(true)}
                />
              </View>
            </View>
          ) : (
            <View style={styles.lockedEditBanner}>
              <SaharaIcon
                name="info"
                size={15}
                color={SaharaColors.primaryAccessible}
              />
              <Text style={styles.lockedEditText}>
                Ya elegiste a un trabajador para este anuncio.
              </Text>
              {job.selected_worker_id ? (
                <SaharaButton
                  label="Ver Trabajo Asignado"
                  size="sm"
                  fullWidth={false}
                  onPress={() =>
                    router.push(`/(main)/job/${job.id}/assigned` as never)
                  }
                />
              ) : null}
            </View>
          )}
        </SaharaCard>

        {/* Single Short Guidance Note */}
        <SaharaCard variant="primaryFixed" style={styles.infoNoteRow}>
          <SaharaIcon
            name="info"
            size={18}
            color={SaharaColors.onPrimaryFixedVariant}
          />
          <Text style={styles.infoNoteText}>
            Elige a un candidato para ver su teléfono y darle 24 horas para
            confirmar.
          </Text>
        </SaharaCard>

        {/* Applicants Section Header */}
        <View style={styles.applicantsHeaderRow}>
          <Text style={styles.applicantsSectionTitle}>
            Candidatos ({applicants.length})
          </Text>
          <Text style={styles.applicantsSortCaption}>
            Teléfono visible al elegir
          </Text>
        </View>
      </View>
    );
  };

  const renderApplicantCard = ({ item: applicant }: { item: ApplicantSummary }) => {
    if (!job) return null;
    const isPendingApp = applicant.status === 'pending';

    return (
      <SaharaCard
        testID={`applicant-card-${applicant.application_id}`}
        variant="lowest"
        style={{ gap: 12 }}>
        <View style={styles.applicantTopRow}>
          <View style={styles.applicantAvatarBox}>
            <Text style={styles.applicantAvatarInitials}>
              {applicant.full_name.slice(0, 2).toUpperCase()}
            </Text>
          </View>
          <View style={{ flex: 1, gap: 3 }}>
            <View style={styles.applicantNameRow}>
              <Text style={styles.applicantName} numberOfLines={1}>
                {applicant.full_name}
              </Text>
              <ApplicationStatusBadge status={applicant.status} />
            </View>
            <View style={styles.ratingRow}>
              <Text style={styles.ratingValue}>
                Calificación {applicant.rating.toFixed(1)} / 5.0
              </Text>
              <Text style={styles.reviewCountText}>
                • {applicant.review_count} reseñas verificadas
              </Text>
            </View>
          </View>
        </View>

        <Text style={styles.skillsText}>
          {applicant.skills ??
            'Especialista con experiencia verificada en oficios temporales.'}
        </Text>

        {applicant.availability ? (
          <View style={styles.availabilityBox}>
            <SaharaIcon
              name="event_available"
              size={14}
              color={SaharaColors.primaryAccessible}
            />
            <Text style={styles.availabilityText}>
              {applicant.availability}
            </Text>
          </View>
        ) : null}

        {/* Actions: Restructured for 360dp & font_scale 2.0 resilience (UI-EMP-04-2 fix) */}
        <View style={{ gap: 8 }}>
          {canEditOrCancel && isPendingApp ? (
            <SaharaButton
              testID={`select-applicant-btn-${applicant.application_id}`}
              label="Seleccionar candidato"
              icon="handshake"
              variant="primary"
              size="md"
              onPress={() => setSelectTarget(applicant)}
            />
          ) : null}
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <View style={{ flex: 1 }}>
              <SaharaButton
                testID={`view-applicant-profile-btn-${applicant.application_id}`}
                label="Ver perfil"
                variant="outline"
                size="sm"
                onPress={() =>
                  router.push(
                    `/(main)/job/${job.id}/applicant/${applicant.application_id}` as never,
                  )
                }
              />
            </View>
            {canEditOrCancel && isPendingApp ? (
              <View style={{ flex: 1 }}>
                <SaharaButton
                  testID={`reject-applicant-btn-${applicant.application_id}`}
                  label="Rechazar"
                  variant="danger"
                  size="sm"
                  onPress={() => setRejectTarget(applicant)}
                />
              </View>
            ) : null}
          </View>
        </View>
      </SaharaCard>
    );
  };

  return (
    <SaharaScreenShell
      scrollable={false}
      header={
        <SaharaHeader
          title="Detalle de Publicación"
          subtitle={job ? `Folio ${formatFolio(job.id)}` : 'Cargando...'}
          onBack={() => router.back()}
        />
      }>
      {isLoading ? (
        <View style={{ padding: Spacing.md }}>
          <LoadingSkeleton message="Consultando publicación y candidatos postulados..." />
        </View>
      ) : errorMsg || !job ? (
        <View style={{ padding: Spacing.md }}>
          <ErrorState
            message={errorMsg ?? 'No se encontró la publicación.'}
            onRetry={() => void loadData()}
          />
        </View>
      ) : (
        <FlatList
          data={applicants}
          keyExtractor={(item) => item.application_id}
          renderItem={renderApplicantCard}
          ListHeaderComponent={renderHeaderSummary}
          ListEmptyComponent={
            <EmptyState
              icon="group"
              title="Aún no hay candidatos postulados"
              description="Tu publicación ya es visible para los trabajadores dentro del radio de búsqueda. Te notificaremos en cuanto llegue la primera postulación."
            />
          }
          contentContainerStyle={styles.flatListContent}
          showsVerticalScrollIndicator={false}
        />
      )}

      {/* Confirm Selection Modal */}
      <ConfirmationModal
        visible={selectTarget !== null}
        title="¿Elegir a este candidato?"
        description={
          selectTarget
            ? `Vas a elegir a ${selectTarget.full_name}. Se mostrará su teléfono y ambos tendrán 24 horas para aceptar las condiciones del trabajo.`
            : ''
        }
        highlightText={
          job
            ? `Pago del trabajo: ${formatCurrencyMXN(job.fixed_payment_mxn)} (+10% comisión)`
            : undefined
        }
        confirmLabel="Sí, elegir candidato"
        cancelLabel="Volver"
        loading={isSelecting}
        onConfirm={() => void handleConfirmSelect()}
        onCancel={() => setSelectTarget(null)}
      />

      {/* Two-step Confirm Rejection Modal (UI-EMP-04-1 Fix) */}
      <ConfirmationModal
        visible={rejectTarget !== null}
        title="¿Rechazar postulación?"
        description={
          rejectTarget
            ? `La postulación de ${rejectTarget.full_name} cambiará a estado Rechazada. Esta acción no se puede deshacer.`
            : ''
        }
        confirmLabel="Sí, rechazar"
        cancelLabel="Cancelar"
        variant="danger"
        loading={isRejecting}
        onConfirm={() => void handleConfirmReject()}
        onCancel={() => setRejectTarget(null)}
      />

      {/* Confirm Job Cancellation Modal */}
      <ConfirmationModal
        visible={showCancelModal}
        title="¿Cancelar publicación?"
        description={`Se notificará a los ${applicants.length} postulantes que la vacante ha sido cerrada antes de la selección. Esta acción no tiene costo.`}
        confirmLabel="Sí, cancelar"
        cancelLabel="Mantener"
        variant="danger"
        loading={isCancelling}
        onConfirm={() => void handleConfirmCancelJob()}
        onCancel={() => setShowCancelModal(false)}
      />
    </SaharaScreenShell>
  );
}

const styles = StyleSheet.create({
  flatListContent: {
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.md,
    paddingBottom: 100,
    gap: Spacing.md,
  },
  topSummaryRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
  },
  jobTitle: {
    fontFamily: Fonts.headline,
    fontSize: 20,
    fontWeight: '700',
    color: SaharaColors.onSurface,
    lineHeight: 25,
  },
  categoryTag: {
    fontFamily: Fonts.label,
    fontSize: 12,
    color: SaharaColors.onSurfaceVariant,
  },
  priceMain: {
    fontFamily: Fonts.headline,
    fontSize: 22,
    fontWeight: '700',
    color: SaharaColors.primaryAccessible,
  },
  priceFee: {
    fontFamily: Fonts.label,
    fontSize: 11,
    color: SaharaColors.secondary,
  },
  descriptionText: {
    fontFamily: Fonts.body,
    fontSize: 13.5,
    color: SaharaColors.onSurface,
    lineHeight: 20,
  },
  metaBar: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    backgroundColor: SaharaColors.surfaceContainerLow,
    padding: 10,
    borderRadius: Radius.md,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  metaText: {
    fontFamily: Fonts.label,
    fontSize: 12,
    fontWeight: '600',
    color: SaharaColors.onSurface,
  },
  conditionsBox: {
    backgroundColor: SaharaColors.surfaceContainer,
    padding: 10,
    borderRadius: Radius.md,
    gap: 2,
  },
  conditionsLabel: {
    fontFamily: Fonts.label,
    fontSize: 11.5,
    fontWeight: '700',
    color: SaharaColors.onSurface,
  },
  conditionsBody: {
    fontFamily: Fonts.body,
    fontSize: 12,
    color: SaharaColors.onSurfaceVariant,
  },
  privateAddressBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: SaharaColors.surfaceContainerLow,
    padding: 10,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: SaharaColors.borderDefault,
  },
  privateAddressTitle: {
    fontFamily: Fonts.label,
    fontSize: 11,
    fontWeight: '700',
    color: SaharaColors.secondary,
  },
  privateAddressValue: {
    fontFamily: Fonts.body,
    fontSize: 12.5,
    color: SaharaColors.onSurface,
  },
  lockedEditBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: SaharaColors.surfaceContainer,
    padding: 10,
    borderRadius: Radius.md,
  },
  lockedEditText: {
    flex: 1,
    fontFamily: Fonts.body,
    fontSize: 11.5,
    color: SaharaColors.onSurfaceVariant,
  },
  infoNoteRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  infoNoteText: {
    flex: 1,
    fontFamily: Fonts.body,
    fontSize: 12.5,
    color: SaharaColors.onPrimaryFixed,
    lineHeight: 18,
  },
  applicantsHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 2,
  },
  applicantsSectionTitle: {
    fontFamily: Fonts.headline,
    fontSize: 20,
    fontWeight: '700',
    color: SaharaColors.onSurface,
  },
  applicantsSortCaption: {
    fontFamily: Fonts.label,
    fontSize: 11.5,
    color: SaharaColors.onSurfaceVariant,
  },
  applicantTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  applicantAvatarBox: {
    width: 48,
    height: 48,
    borderRadius: Radius.md,
    backgroundColor: SaharaColors.primaryFixed,
    alignItems: 'center',
    justifyContent: 'center',
  },
  applicantAvatarInitials: {
    fontFamily: Fonts.headline,
    fontSize: 18,
    fontWeight: '700',
    color: SaharaColors.onPrimaryFixedVariant,
  },
  applicantNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  applicantName: {
    flex: 1,
    fontFamily: Fonts.headline,
    fontSize: 17,
    fontWeight: '700',
    color: SaharaColors.onSurface,
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  ratingValue: {
    fontFamily: Fonts.label,
    fontSize: 12.5,
    fontWeight: '700',
    color: SaharaColors.primaryAccessible,
  },
  reviewCountText: {
    fontFamily: Fonts.body,
    fontSize: 12,
    color: SaharaColors.onSurfaceVariant,
  },
  skillsText: {
    fontFamily: Fonts.body,
    fontSize: 13,
    color: SaharaColors.onSurfaceVariant,
    lineHeight: 18,
  },
  availabilityBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: SaharaColors.surfaceContainerLow,
    paddingHorizontal: 10,
    paddingVertical: 10,
    borderRadius: Radius.md,
  },
  availabilityText: {
    flex: 1,
    fontFamily: Fonts.label,
    fontSize: 12,
    color: SaharaColors.onSurface,
  },
});

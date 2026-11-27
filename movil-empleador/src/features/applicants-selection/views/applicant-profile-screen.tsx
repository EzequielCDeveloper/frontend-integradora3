/**
 * UI-EMP-05: Perfil del Candidato Postulado (Audit Fixed & Zero Emojis)
 * Source of Truth: Especificacion_de_Arquitectura_de_Software_v2.md (Section 3.2 UI-EMP-05, RF-12)
 * Audit Fixes Applied:
 * - SYS-05: Virtualized reviews list with FlatList (`scrollable={false}` on SaharaScreenShell)
 * - UI-EMP-05-1: Added two-step ConfirmationModal (`showRejectModal`) before rejecting application
 * - UI-EMP-05-2: Grouped read-only RatingStars accessibility label
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
  LoadingSkeleton,
  RatingStars,
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
import { formatSpanishDate } from '@/shared/utils/formatters';
import type { ApplicantPublicProfile } from '@/types/database';

export function ApplicantProfileScreenView({
  jobId,
  applicationId,
}: {
  jobId: string;
  applicationId: string;
}) {
  const router = useRouter();
  const storeVersion = useMockBackendStore((s) => s.version);

  const [applicant, setApplicant] = useState<ApplicantPublicProfile | null>(
    null,
  );
  const [isLoading, setIsLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [showSelectModal, setShowSelectModal] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);

  const loadApplicant = useCallback(async () => {
    if (!jobId || !applicationId) return;
    setIsLoading(true);
    setErrorMsg(null);
    try {
      const profile = await employerRepository.getApplicantPublicProfile(
        jobId,
        applicationId,
      );
      setApplicant(profile);
    } catch (err) {
      const mapped = mapDomainErrorToUI(err);
      setErrorMsg(mapped.message);
    } finally {
      setIsLoading(false);
    }
  }, [jobId, applicationId]);

  useAsyncLoad(loadApplicant, storeVersion);

  const { execute: handleSelectWorker, isPending: isSelecting } =
    useIdempotentAction(async () => {
      if (!applicant) return;
      try {
        await employerRepository.select_worker(applicant.application_id);
        setShowSelectModal(false);
        router.replace(`/(main)/job/${jobId}/assigned` as never);
      } catch (err) {
        const mapped = mapDomainErrorToUI(err);
        setErrorMsg(mapped.message);
        setShowSelectModal(false);
      }
    });

  const { execute: handleRejectWorker, isPending: isRejecting } =
    useIdempotentAction(async () => {
      if (!applicant) return;
      try {
        await employerRepository.reject_application(applicant.application_id);
        setShowRejectModal(false);
        router.back();
      } catch (err) {
        const mapped = mapDomainErrorToUI(err);
        setErrorMsg(mapped.message);
        setShowRejectModal(false);
      }
    });

  const renderProfileHeader = () => {
    if (!applicant) return null;
    return (
      <View style={{ gap: Spacing.md, marginBottom: 4 }}>
        {/* Candidate Hero Card */}
        <SaharaCard variant="lowest" style={{ gap: 14 }}>
          <View style={styles.heroRow}>
            <View style={styles.avatarCircle}>
              <Text style={styles.avatarInitials}>
                {applicant.full_name.slice(0, 2).toUpperCase()}
              </Text>
            </View>
            <View style={{ flex: 1, gap: 4 }}>
              <View style={styles.nameBadgeRow}>
                <Text style={styles.candidateName}>
                  {applicant.full_name}
                </Text>
                <ApplicationStatusBadge status={applicant.status} />
              </View>

              <View style={styles.ratingSummaryRow}>
                <RatingStars rating={applicant.rating} size={16} />
                <Text style={styles.ratingNum}>
                  {applicant.rating.toFixed(1)}
                </Text>
                <Text style={styles.reviewTotal}>
                  ({applicant.review_count} evaluaciones)
                </Text>
              </View>

              <View style={styles.trustBadgesRow}>
                <View style={styles.miniChip}>
                  <SaharaIcon
                    name="verified_user"
                    size={12}
                    color={SaharaColors.primaryAccessible}
                  />
                  <Text style={styles.miniChipText}>
                    Identidad validada
                  </Text>
                </View>
              </View>
            </View>
          </View>

          {/* Privacy Notice */}
          <View style={styles.privacyBanner}>
            <SaharaIcon
              name="shield_lock"
              size={15}
              color={SaharaColors.primaryAccessible}
            />
            <Text style={styles.privacyText}>
              El teléfono del candidato se muestra en cuanto lo elijas para el
              trabajo.
            </Text>
          </View>
        </SaharaCard>

        {/* Skills & Availability */}
        <SaharaCard variant="lowest" style={{ gap: 12 }}>
          <View style={{ gap: 4 }}>
            <Text style={styles.sectionLabel}>EXPERIENCIA Y OFICIOS</Text>
            <Text style={styles.bodyText}>
              {applicant.skills ??
                'Sin descripción de habilidades registrada.'}
            </Text>
          </View>

          <View style={styles.divider} />

          <View style={{ gap: 4 }}>
            <Text style={styles.sectionLabel}>HORARIOS DISPONIBLES</Text>
            <View style={styles.availRow}>
              <SaharaIcon
                name="schedule"
                size={15}
                color={SaharaColors.primaryAccessible}
              />
              <Text style={styles.bodyText}>
                {applicant.availability ??
                  'Disponible para el horario de tu anuncio.'}
              </Text>
            </View>
          </View>
        </SaharaCard>

        {/* Reviews List Header */}
        <View style={styles.reviewsHeader}>
          <Text style={styles.reviewsTitle}>
            Opiniones de otros empleadores ({applicant.reviews.length})
          </Text>
        </View>
      </View>
    );
  };

  return (
    <SaharaScreenShell
      scrollable={false}
      header={
        <SaharaHeader
          title="Perfil del Candidato"
          subtitle="Experiencia y calificaciones"
          onBack={() => router.back()}
        />
      }>
      {isLoading ? (
        <View style={{ padding: Spacing.md }}>
          <LoadingSkeleton message="Cargando perfil público y reseñas del trabajador..." />
        </View>
      ) : errorMsg || !applicant ? (
        <View style={{ padding: Spacing.md }}>
          <ErrorState
            message={errorMsg ?? 'No se encontró el perfil del candidato.'}
            onRetry={() => void loadApplicant()}
          />
        </View>
      ) : (
        <FlatList
          data={applicant.reviews}
          keyExtractor={(item) => item.id}
          ListHeaderComponent={renderProfileHeader}
          renderItem={({ item: rev }) => (
            <SaharaCard variant="low" style={{ gap: 8 }}>
              <View style={styles.reviewHeaderRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.reviewerName}>{rev.reviewer_name}</Text>
                  <Text style={styles.reviewJobTitle}>{rev.job_title}</Text>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <RatingStars rating={rev.rating} size={14} />
                  <Text style={styles.reviewDate}>
                    {formatSpanishDate(rev.created_at)}
                  </Text>
                </View>
              </View>
              {rev.comment ? (
                <Text style={styles.reviewComment}>“{rev.comment}”</Text>
              ) : null}
            </SaharaCard>
          )}
          ListEmptyComponent={
            <EmptyState
              icon="star"
              title="Sin evaluaciones previas"
              description="Este candidato aún no cuenta con reseñas públicas registradas en trabajos concluidos."
            />
          }
          ListFooterComponent={
            applicant.status === 'pending' ? (
              <View style={{ gap: 10, marginTop: 8 }}>
                <SaharaButton
                  testID="profile-select-worker-btn"
                  label="Elegir a este Candidato"
                  sublabel="Muestra su teléfono e inicia el plazo de 24 horas para confirmar"
                  icon="handshake"
                  size="lg"
                  onPress={() => setShowSelectModal(true)}
                />
                <SaharaButton
                  testID="profile-reject-worker-btn"
                  label="Descartar Candidato"
                  variant="danger"
                  loading={isRejecting}
                  onPress={() => setShowRejectModal(true)}
                />
              </View>
            ) : undefined
          }
          contentContainerStyle={styles.flatListContent}
          showsVerticalScrollIndicator={false}
        />
      )}

      <ConfirmationModal
        visible={showSelectModal}
        title="Confirmar selección de candidato"
        description={
          applicant
            ? `¿Deseas asignar este trabajo a ${applicant.full_name}? Se abrirá una nueva ronda de selección con plazo de 24 horas para que ambas partes acepten las condiciones.`
            : ''
        }
        confirmLabel="Confirmar y Asignar"
        cancelLabel="Cancelar"
        loading={isSelecting}
        onConfirm={() => void handleSelectWorker()}
        onCancel={() => setShowSelectModal(false)}
      />

      {/* Two-step Reject Confirmation Modal (UI-EMP-05-1 Fix) */}
      <ConfirmationModal
        visible={showRejectModal}
        title="¿Rechazar postulación?"
        description={
          applicant
            ? `La postulación de ${applicant.full_name} pasará a estado Rechazada. Esta acción es definitiva.`
            : ''
        }
        confirmLabel="Sí, rechazar"
        cancelLabel="Volver"
        variant="danger"
        loading={isRejecting}
        onConfirm={() => void handleRejectWorker()}
        onCancel={() => setShowRejectModal(false)}
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
  heroRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  avatarCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: SaharaColors.primaryFixed,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitials: {
    fontFamily: Fonts.headline,
    fontSize: 24,
    fontWeight: '700',
    color: SaharaColors.onPrimaryFixedVariant,
  },
  nameBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  candidateName: {
    flex: 1,
    fontFamily: Fonts.headline,
    fontSize: 20,
    fontWeight: '700',
    color: SaharaColors.onSurface,
  },
  ratingSummaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  ratingNum: {
    fontFamily: Fonts.label,
    fontSize: 13.5,
    fontWeight: '700',
    color: SaharaColors.onSurface,
  },
  reviewTotal: {
    fontFamily: Fonts.body,
    fontSize: 12,
    color: SaharaColors.onSurfaceVariant,
  },
  trustBadgesRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 2,
  },
  miniChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: SaharaColors.surfaceContainer,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: Radius.full,
  },
  miniChipText: {
    fontFamily: Fonts.label,
    fontSize: 10.5,
    fontWeight: '600',
    color: SaharaColors.onSurface,
  },
  privacyBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: SaharaColors.surfaceContainerLow,
    padding: 10,
    borderRadius: Radius.md,
  },
  privacyText: {
    flex: 1,
    fontFamily: Fonts.body,
    fontSize: 11.5,
    color: SaharaColors.onSurfaceVariant,
    lineHeight: 16,
  },
  sectionLabel: {
    fontFamily: Fonts.label,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.7,
    color: SaharaColors.secondary,
  },
  bodyText: {
    fontFamily: Fonts.body,
    fontSize: 13.5,
    color: SaharaColors.onSurface,
    lineHeight: 20,
  },
  divider: {
    height: 1,
    backgroundColor: SaharaColors.borderDefault,
  },
  availRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  reviewsHeader: {
    paddingHorizontal: 2,
  },
  reviewsTitle: {
    fontFamily: Fonts.headline,
    fontSize: 19,
    fontWeight: '700',
    color: SaharaColors.onSurface,
  },
  reviewHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  reviewerName: {
    fontFamily: Fonts.label,
    fontSize: 13,
    fontWeight: '700',
    color: SaharaColors.onSurface,
  },
  reviewJobTitle: {
    fontFamily: Fonts.body,
    fontSize: 11.5,
    color: SaharaColors.secondary,
  },
  reviewDate: {
    fontFamily: Fonts.label,
    fontSize: 10.5,
    color: SaharaColors.secondary,
    marginTop: 2,
  },
  reviewComment: {
    fontFamily: Fonts.body,
    fontSize: 13,
    fontStyle: 'italic',
    color: SaharaColors.onSurface,
    lineHeight: 19,
  },
});

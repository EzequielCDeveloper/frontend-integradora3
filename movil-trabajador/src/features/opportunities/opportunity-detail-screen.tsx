/**
 * MÓDULO 5: DETALLE DE LA OPORTUNIDAD (Pre-selección)
 * - Título, descripción, categoría, fotografías (cuando existan), pago fijo MXN, fecha, horario,
 *   condiciones, colonia/localidad, rango de distancia (NUNCA domicilio exacto antes de selección).
 * - Nombre del empleador, calificación y evaluaciones (o "Sin evaluaciones").
 * - Postularse (única vez, bloqueado si no disponible), retirar postulación pendiente,
 *   reportar publicación, cuenta o reseña.
 */
import React, { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Fonts, Radius, SaharaColors, Spacing } from '@/constants/theme';
import {
  ApplicationStatusBadge,
  ConfirmationModal,
  EmptyState,
  FeedbackBanner,
  RatingStars,
  ReportContentModal,
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
  formatFileSize,
  formatSpanishDate,
  formatTimeRange,
  JOB_CATEGORY_ICONS,
  JOB_CATEGORY_LABELS,
} from '@/shared/utils/formatters';
import type { ReportTarget } from '@/types/database';

export function OpportunityDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const version = useWorkerStore((s) => s.version);

  const detail = useMemo(() => {
    void version;
    return id ? workerStore.getOpportunityDetail(id) : null;
  }, [id, version]);

  const [feedback, setFeedback] = useState<{
    tone: 'success' | 'error';
    text: string;
  } | null>(null);
  const [confirmWithdraw, setConfirmWithdraw] = useState(false);
  const [reportTarget, setReportTarget] = useState<{
    type: ReportTarget;
    targetId: string;
    label: string;
    reportedUserId?: string;
  } | null>(null);

  if (!detail) {
    return (
      <SaharaScreenShell
        header={
          <SaharaHeader
            title="Oportunidad"
            onBack={() => router.back()}
          />
        }>
        <EmptyState
          icon="work"
          title="Publicación no disponible"
          description="Esta oportunidad ya no se encuentra activa o fue cerrada."
          actionLabel="Volver a explorar"
          onAction={() => router.replace('/(main)/explore' as never)}
        />
      </SaharaScreenShell>
    );
  }

  const isAvailable =
    detail.status === 'published' || detail.status === 'has_applications';
  const canApply = isAvailable && !detail.my_application_id;
  const canWithdraw = detail.my_application_status === 'pending';

  const handleApply = () => {
    setFeedback(null);
    try {
      workerStore.applyToJob(detail.id);
      setFeedback({
        tone: 'success',
        text: 'Tu postulación fue enviada correctamente. Puedes consultar su estado en Mis postulaciones.',
      });
    } catch (err) {
      setFeedback({ tone: 'error', text: mapDomainErrorToMessage(err) });
    }
  };

  const handleWithdraw = () => {
    if (!detail.my_application_id) return;
    setFeedback(null);
    try {
      workerStore.withdrawApplication(detail.my_application_id);
      setConfirmWithdraw(false);
      setFeedback({
        tone: 'success',
        text: 'Has retirado tu postulación correctamente.',
      });
    } catch (err) {
      setConfirmWithdraw(false);
      setFeedback({ tone: 'error', text: mapDomainErrorToMessage(err) });
    }
  };

  const handleReportSubmit = (reason: string) => {
    if (!reportTarget) return;
    try {
      workerStore.createCase({
        case_type: 'report',
        target_type: reportTarget.type,
        target_id: reportTarget.targetId,
        reported_user_id: reportTarget.reportedUserId ?? null,
        job_id: detail.id,
        description: reason,
      });
      setFeedback({
        tone: 'success',
        text: 'Tu reporte fue registrado y será revisado por el equipo de soporte.',
      });
    } catch (err) {
      setFeedback({ tone: 'error', text: mapDomainErrorToMessage(err) });
    }
  };

  return (
    <SaharaScreenShell
      header={
        <SaharaHeader
          title="Detalle de oportunidad"
          subtitle={JOB_CATEGORY_LABELS[detail.category]}
          onBack={() => router.back()}
          rightAction={
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Reportar publicación"
              onPress={() =>
                setReportTarget({
                  type: 'job',
                  targetId: detail.id,
                  label: detail.title,
                  reportedUserId: detail.employer_id,
                })
              }
              style={styles.reportIconBtn}>
              <SaharaIcon name="flag" size={16} color={SaharaColors.tertiary} />
            </Pressable>
          }
        />
      }
      footer={
        <View style={styles.stickyFooter}>
          {canApply ? (
            <SaharaButton
              label="Postularme a este trabajo"
              sublabel={`Pago fijo ${formatCurrencyMXN(detail.fixed_payment_mxn)}`}
              icon="check_circle"
              onPress={handleApply}
            />
          ) : canWithdraw ? (
            <View style={styles.footerTwoBtns}>
              <View style={{ flex: 1 }}>
                <SaharaButton
                  label="Retirar postulación"
                  variant="danger"
                  onPress={() => setConfirmWithdraw(true)}
                />
              </View>
              <View style={{ flex: 1 }}>
                <SaharaButton
                  label="Ver postulaciones"
                  variant="outline"
                  onPress={() => router.push('/(main)/applications' as never)}
                />
              </View>
            </View>
          ) : detail.my_application_status === 'accepted' ? (
            <SaharaButton
              label="Ir a mi trabajo asignado"
              icon="work"
              onPress={() => router.push(`/(main)/job/${detail.id}` as never)}
            />
          ) : (
            <SaharaButton
              label={
                detail.my_application_id
                  ? 'Ya registraste una postulación en esta publicación'
                  : 'Esta oportunidad ya no está disponible'
              }
              disabled
              onPress={() => {}}
            />
          )}
        </View>
      }>
      {feedback ? (
        <FeedbackBanner
          tone={feedback.tone}
          message={feedback.text}
          onDismiss={() => setFeedback(null)}
        />
      ) : null}

      {/* Encabezado principal de la oportunidad */}
      <SaharaCard
        variant="lowest"
        accentColor={SaharaColors.primaryAccessible}
        style={{ gap: 10 }}>
        <View style={styles.badgeRow}>
          <View style={styles.categoryChip}>
            <SaharaIcon
              name={JOB_CATEGORY_ICONS[detail.category]}
              size={13}
              color={SaharaColors.onPrimaryFixedVariant}
            />
            <Text style={styles.categoryText}>
              {JOB_CATEGORY_LABELS[detail.category]}
            </Text>
          </View>
          {detail.is_out_of_range ? (
            <View style={styles.outBadge}>
              <Text style={styles.outBadgeText}>Fuera de alcance</Text>
            </View>
          ) : null}
          {detail.my_application_status ? (
            <ApplicationStatusBadge status={detail.my_application_status} />
          ) : null}
        </View>

        <Text style={styles.title}>{detail.title}</Text>

        <View style={styles.paymentBox}>
          <View>
            <Text style={styles.paymentLabel}>Pago fijo ofrecido</Text>
            <Text style={styles.paymentAmount}>
              {formatCurrencyMXN(detail.fixed_payment_mxn)}
            </Text>
          </View>
          <View style={styles.distanceBadge}>
            <SaharaIcon
              name="location_on"
              size={13}
              color={SaharaColors.onPrimaryFixedVariant}
            />
            <Text style={styles.distanceText}>{detail.distance_range}</Text>
          </View>
        </View>

        <View style={styles.infoGrid}>
          <View style={styles.infoRow}>
            <SaharaIcon name="calendar_today" size={14} color={SaharaColors.secondary} />
            <Text style={styles.infoText}>
              Fecha: {formatSpanishDate(detail.job_date)}
            </Text>
          </View>
          <View style={styles.infoRow}>
            <SaharaIcon name="schedule" size={14} color={SaharaColors.secondary} />
            <Text style={styles.infoText}>
              Horario: {formatTimeRange(detail.start_time, detail.end_time)}
            </Text>
          </View>
          <View style={styles.infoRow}>
            <SaharaIcon
              name="location_on"
              size={14}
              color={SaharaColors.primaryAccessible}
            />
            <Text style={styles.infoText}>
              Colonia / localidad: {detail.neighborhood}
            </Text>
          </View>
        </View>

        {/* Aviso de privacidad de dirección */}
        <View style={styles.privacyNotice}>
          <SaharaIcon name="lock" size={13} color={SaharaColors.secondary} />
          <Text style={styles.privacyText}>
            Por seguridad, el domicilio exacto y el punto en mapa se muestran únicamente si el empleador te selecciona.
          </Text>
        </View>
      </SaharaCard>

      {/* Descripción y condiciones */}
      <SaharaCard variant="lowest" style={{ gap: 12 }}>
        <View style={{ gap: 4 }}>
          <Text style={styles.sectionTitle}>Descripción del trabajo</Text>
          <Text style={styles.bodyText}>{detail.description}</Text>
        </View>

        {detail.conditions ? (
          <View style={styles.conditionsBox}>
            <Text style={styles.conditionsLabel}>Condiciones y requisitos</Text>
            <Text style={styles.bodyText}>{detail.conditions}</Text>
          </View>
        ) : null}
      </SaharaCard>

      {/* Fotografías del lugar (cuando existan) */}
      {detail.photos.length > 0 ? (
        <SaharaCard variant="lowest" style={{ gap: 10 }}>
          <Text style={styles.sectionTitle}>
            Fotografías de referencia ({detail.photos.length})
          </Text>
          <View style={{ gap: 8 }}>
            {detail.photos.map((photo) => (
              <View key={photo.id} style={styles.photoCard}>
                <View style={styles.photoIconBox}>
                  <SaharaIcon
                    name="image"
                    size={18}
                    color={SaharaColors.onPrimaryFixedVariant}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.photoTitle}>{photo.file_name}</Text>
                  <Text style={styles.photoCaption}>
                    {photo.caption ?? 'Imagen adjunta por el empleador'} ·{' '}
                    {formatFileSize(photo.size_bytes)}
                  </Text>
                </View>
              </View>
            ))}
          </View>
        </SaharaCard>
      ) : null}

      {/* Información y evaluaciones del empleador */}
      <SaharaCard variant="lowest" style={{ gap: 12 }}>
        <View style={styles.empHeader}>
          <View style={{ flex: 1, gap: 3 }}>
            <Text style={styles.sectionOverline}>Publicado por</Text>
            <Text style={styles.sectionTitle}>{detail.employer_name}</Text>
          </View>
          <Pressable
            onPress={() =>
              setReportTarget({
                type: 'user',
                targetId: detail.employer_id,
                label: detail.employer_name,
                reportedUserId: detail.employer_id,
              })
            }>
            <Text style={styles.reportTextLink}>Reportar cuenta</Text>
          </Pressable>
        </View>

        {detail.employer_rating !== null && detail.employer_review_count > 0 ? (
          <View style={styles.ratingSummaryRow}>
            <RatingStars rating={detail.employer_rating} size={18} />
            <Text style={styles.ratingSummaryText}>
              {detail.employer_rating.toFixed(1)} de 5 ({detail.employer_review_count}{' '}
              {detail.employer_review_count === 1 ? 'evaluación' : 'evaluaciones'})
            </Text>
          </View>
        ) : (
          <View style={styles.noEvalBox}>
            <Text style={styles.noEvalText}>Sin evaluaciones</Text>
          </View>
        )}

        {detail.employer_reviews.length > 0 ? (
          <View style={{ gap: 10 }}>
            {detail.employer_reviews.map((rev) => (
              <View key={rev.id} style={styles.reviewItem}>
                <View style={styles.reviewHeader}>
                  <Text style={styles.reviewerName}>{rev.reviewer_name}</Text>
                  <RatingStars rating={rev.rating} size={14} />
                </View>
                {rev.comment ? (
                  <Text style={styles.reviewComment}>{rev.comment}</Text>
                ) : null}
                <View style={styles.reviewFooter}>
                  <Text style={styles.reviewDate}>
                    {formatSpanishDate(rev.created_at)}
                  </Text>
                  <Pressable
                    onPress={() =>
                      setReportTarget({
                        type: 'review',
                        targetId: rev.id,
                        label: `Reseña de ${rev.reviewer_name}`,
                      })
                    }>
                    <Text style={styles.reportSmallLink}>Reportar reseña</Text>
                  </Pressable>
                </View>
              </View>
            ))}
          </View>
        ) : null}
      </SaharaCard>

      <ConfirmationModal
        visible={confirmWithdraw}
        title="¿Retirar tu postulación?"
        description="Si retiras esta solicitud dejarás de ser considerado para este trabajo y no podrás volver a postularte a la misma publicación."
        highlightText={detail.title}
        confirmLabel="Sí, retirar"
        variant="danger"
        onConfirm={handleWithdraw}
        onCancel={() => setConfirmWithdraw(false)}
      />

      {reportTarget ? (
        <ReportContentModal
          visible={Boolean(reportTarget)}
          targetType={reportTarget.type}
          targetLabel={reportTarget.label}
          onClose={() => setReportTarget(null)}
          onSubmit={handleReportSubmit}
        />
      ) : null}
    </SaharaScreenShell>
  );
}

const styles = StyleSheet.create({
  reportIconBtn: {
    width: 42,
    height: 42,
    borderRadius: Radius.full,
    backgroundColor: SaharaColors.tertiaryFixed,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    alignItems: 'center',
  },
  categoryChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: SaharaColors.primaryFixed,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: Radius.full,
  },
  categoryText: {
    fontFamily: Fonts.label,
    fontSize: 11.5,
    fontWeight: '700',
    color: SaharaColors.onPrimaryFixedVariant,
  },
  outBadge: {
    backgroundColor: SaharaColors.tertiaryFixed,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: Radius.full,
  },
  outBadgeText: {
    fontFamily: Fonts.label,
    fontSize: 11,
    fontWeight: '700',
    color: SaharaColors.onTertiaryFixedVariant,
  },
  title: {
    fontFamily: Fonts.headline,
    fontSize: 23,
    fontWeight: '600',
    color: SaharaColors.onSurface,
    lineHeight: 29,
  },
  paymentBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: SaharaColors.surfaceContainerLow,
    padding: 12,
    borderRadius: Radius.lg,
    gap: 10,
  },
  paymentLabel: {
    fontFamily: Fonts.label,
    fontSize: 11,
    color: SaharaColors.secondary,
  },
  paymentAmount: {
    fontFamily: Fonts.headline,
    fontSize: 22,
    fontWeight: '700',
    color: SaharaColors.primaryAccessible,
  },
  distanceBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: SaharaColors.primaryFixed,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: Radius.full,
  },
  distanceText: {
    fontFamily: Fonts.label,
    fontSize: 11.5,
    fontWeight: '700',
    color: SaharaColors.onPrimaryFixed,
  },
  infoGrid: {
    gap: 7,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  infoText: {
    fontFamily: Fonts.label,
    fontSize: 13,
    color: SaharaColors.onSurface,
  },
  privacyNotice: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: SaharaColors.surfaceContainer,
    padding: 10,
    borderRadius: Radius.md,
  },
  privacyText: {
    flex: 1,
    fontFamily: Fonts.body,
    fontSize: 12,
    color: SaharaColors.onSurfaceVariant,
    lineHeight: 17,
  },
  sectionOverline: {
    fontFamily: Fonts.label,
    fontSize: 10.5,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.7,
    color: SaharaColors.secondary,
  },
  sectionTitle: {
    fontFamily: Fonts.headline,
    fontSize: 19,
    fontWeight: '600',
    color: SaharaColors.onSurface,
  },
  bodyText: {
    fontFamily: Fonts.body,
    fontSize: 13.5,
    color: SaharaColors.onSurfaceVariant,
    lineHeight: 21,
  },
  conditionsBox: {
    backgroundColor: SaharaColors.surfaceContainerLow,
    padding: 12,
    borderRadius: Radius.lg,
    gap: 4,
    borderLeftWidth: 3,
    borderLeftColor: SaharaColors.primaryAccessible,
  },
  conditionsLabel: {
    fontFamily: Fonts.label,
    fontSize: 12.5,
    fontWeight: '700',
    color: SaharaColors.onSurface,
  },
  photoCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 10,
    borderRadius: Radius.lg,
    backgroundColor: SaharaColors.surfaceContainerLow,
    borderWidth: 1,
    borderColor: SaharaColors.borderSubtle,
  },
  photoIconBox: {
    width: 44,
    height: 44,
    borderRadius: Radius.md,
    backgroundColor: SaharaColors.primaryFixed,
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoTitle: {
    fontFamily: Fonts.label,
    fontSize: 12.5,
    fontWeight: '700',
    color: SaharaColors.onSurface,
  },
  photoCaption: {
    fontFamily: Fonts.body,
    fontSize: 11.5,
    color: SaharaColors.onSurfaceVariant,
  },
  empHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 10,
  },
  reportTextLink: {
    fontFamily: Fonts.label,
    fontSize: 12,
    fontWeight: '700',
    color: SaharaColors.tertiary,
  },
  ratingSummaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  ratingSummaryText: {
    fontFamily: Fonts.label,
    fontSize: 13,
    fontWeight: '700',
    color: SaharaColors.onSurface,
  },
  noEvalBox: {
    backgroundColor: SaharaColors.surfaceContainerLow,
    padding: 12,
    borderRadius: Radius.md,
  },
  noEvalText: {
    fontFamily: Fonts.label,
    fontSize: 13,
    color: SaharaColors.onSurfaceVariant,
  },
  reviewItem: {
    backgroundColor: SaharaColors.surfaceContainerLow,
    padding: 12,
    borderRadius: Radius.lg,
    gap: 6,
  },
  reviewHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
  },
  reviewerName: {
    fontFamily: Fonts.label,
    fontSize: 12.5,
    fontWeight: '700',
    color: SaharaColors.onSurface,
  },
  reviewComment: {
    fontFamily: Fonts.body,
    fontSize: 12.5,
    color: SaharaColors.onSurfaceVariant,
    lineHeight: 18,
  },
  reviewFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  reviewDate: {
    fontFamily: Fonts.body,
    fontSize: 11,
    color: SaharaColors.secondary,
  },
  reportSmallLink: {
    fontFamily: Fonts.label,
    fontSize: 11,
    fontWeight: '600',
    color: SaharaColors.tertiary,
  },
  stickyFooter: {
    paddingHorizontal: Spacing.md,
    paddingVertical: 12,
    backgroundColor: SaharaColors.surface,
    borderTopWidth: 1,
    borderTopColor: SaharaColors.borderDefault,
  },
  footerTwoBtns: {
    flexDirection: 'row',
    gap: 10,
  },
});

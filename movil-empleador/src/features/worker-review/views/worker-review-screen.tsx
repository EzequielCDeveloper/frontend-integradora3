/**
 * UI-EMP-11: Evaluación y Calificación del Trabajador
 * Source of Truth: Especificacion_de_Arquitectura_de_Software_v2.md (Section 3.2 UI-EMP-11, RF-31)
 * Rules enforced:
 * - Interactive 1 to 5 star selector (`rating`)
 * - Comment input initialized empty (`comment`)
 * - Submit review via `submit_review` RPC contract
 */
import React, { useCallback, useState } from 'react';
import {
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
} from '@/constants/theme';
import {
  ErrorState,
  LoadingSkeleton,
  RatingStars,
  SaharaButton,
  SaharaCard,
  SaharaHeader,
  SaharaIcon,
  SaharaInput,
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
import { validateReviewInput } from '@/shared/utils/validators';
import type { EmployerJobDetailView } from '@/types/database';

const RATING_LABELS: Record<number, string> = {
  1: '1.0 · Deficiente · No cumplió expectativas',
  2: '2.0 · Regular · Detalles importantes por corregir',
  3: '3.0 · Aceptable · Trabajo estándar realizado',
  4: '4.0 · Muy bueno · Cumplió con calidad y rigor',
  5: '5.0 · Excelente trabajo y profesionalismo',
};

const HIGHLIGHT_CRITERIA = [
  'Puntualidad en la llegada',
  'Calidad técnica del servicio',
  'Cuidado y limpieza del espacio',
  'Herramienta adecuada',
  'Buena comunicación',
];

export function WorkerReviewScreenView({ jobId }: { jobId: string }) {
  const router = useRouter();
  const storeVersion = useMockBackendStore((s) => s.version);

  const [job, setJob] = useState<EmployerJobDetailView | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Interactive Rating & Empty Comment Form
  const [rating, setRating] = useState<number>(5);
  const [comment, setComment] = useState('');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [formError, setFormError] = useState<string | null>(null);

  const loadJob = useCallback(async () => {
    if (!jobId) return;
    setIsLoading(true);
    setErrorMsg(null);
    try {
      const detail = await employerRepository.getEmployerJobDetail(jobId);
      setJob(detail);
    } catch (err) {
      const mapped = mapDomainErrorToUI(err);
      setErrorMsg(mapped.message);
    } finally {
      setIsLoading(false);
    }
  }, [jobId]);

  useAsyncLoad(loadJob, storeVersion);

  const toggleTag = (tag: string) => {
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag],
    );
  };

  const { execute: handleSubmitReview, isPending: isSubmitting } =
    useIdempotentAction(async () => {
      if (!job || !job.selected_worker_id) return;
      setFormError(null);
      setErrorMsg(null);

      const valErr = validateReviewInput(rating, comment, selectedTags);
      if (valErr) {
        setFormError(valErr);
        return;
      }

      const finalComment =
        selectedTags.length > 0
          ? `[Aspectos: ${selectedTags.join(', ')}] ${comment.trim()}`.slice(
              0,
              500,
            )
          : comment.trim();

      try {
        await employerRepository.submit_review({
          job_id: job.id,
          reviewee_id: job.selected_worker_id,
          rating,
          comment: finalComment,
        });
        router.replace('/(main)/payment-history');
      } catch (err) {
        const mapped = mapDomainErrorToUI(err);
        setErrorMsg(mapped.message);
      }
    });

  return (
    <SaharaScreenShell
      header={
        <SaharaHeader
          title="Evaluación del Servicio"
          subtitle={job ? `Folio ${formatFolio(job.id)}` : 'Calificar'}
          onBack={() => router.back()}
        />
      }>
      {isLoading ? (
        <LoadingSkeleton message="Cargando resumen de trabajo concluido..." />
      ) : errorMsg || !job ? (
        <ErrorState
          message={errorMsg ?? 'No se encontró el trabajo finalizado.'}
          onRetry={() => void loadJob()}
        />
      ) : job.status !== 'completed' ? (
        <ErrorState
          message="Solo puedes evaluar trabajos que hayan concluido. Esta publicación aún se encuentra en curso o no es elegible para evaluación."
          secondaryLabel="Volver a mis trabajos"
          onSecondaryAction={() => router.replace('/(main)/feed')}
        />
      ) : (
        <>
          {/* Status Strip & Released Escrow Banner */}
          <View style={{ gap: 8 }}>
            <View style={styles.topRow}>
              <View style={styles.completedBadge}>
                <SaharaIcon
                  name="check_circle"
                  size={15}
                  color={SaharaColors.primary}
                />
                <Text style={styles.completedBadgeText}>
                  Trabajo terminado
                </Text>
              </View>
              <Text style={styles.folioText}>Folio {formatFolio(job.id)}</Text>
            </View>

            <SaharaCard variant="low" style={styles.releasedPaymentRow}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <SaharaIcon
                  name="payments"
                  size={18}
                  color={SaharaColors.primary}
                />
                <Text style={styles.releasedLabel}>
                  Pago entregado al trabajador
                </Text>
              </View>
              <Text style={styles.releasedAmount}>
                {formatCurrencyMXN(job.fixed_payment_mxn)}
              </Text>
            </SaharaCard>
          </View>

          {/* Worker Summary Card */}
          <SaharaCard variant="lowest" style={{ gap: 12 }}>
            <View style={styles.workerRow}>
              <View style={styles.workerAvatar}>
                <Text style={styles.workerInitials}>
                  {(job.selected_worker_name ?? 'TR').slice(0, 2).toUpperCase()}
                </Text>
              </View>
              <View style={{ flex: 1, gap: 3 }}>
                <Text style={styles.workerName}>
                  {job.selected_worker_name ?? 'Trabajador Evaluado'}
                </Text>
                <Text style={styles.jobTitleSub}>
                  Servicio: {job.title}
                </Text>
              </View>
            </View>
          </SaharaCard>

          {/* Interactive 1..5 Star Rating Card */}
          <SaharaCard variant="lowest" style={styles.ratingCard}>
            <Text style={styles.ratingSuper}>EVALUACIÓN DE DESEMPEÑO</Text>
            <Text style={styles.ratingTitle}>
              ¿Cómo calificarías el trabajo de{' '}
              {job.selected_worker_name ?? 'este especialista'}?
            </Text>
            <Text style={styles.ratingSub}>
              Tu reseña se publicará en el perfil del trabajador y respaldará su
              reputación dentro de Solidez MX.
            </Text>

            <RatingStars rating={rating} onChange={setRating} size={36} />

            <View style={styles.scoreLabelPill}>
              <Text style={styles.scoreLabelText} testID="selected-rating-label">
                {RATING_LABELS[rating]}
              </Text>
            </View>
          </SaharaCard>

          {/* Optional Highlight Criteria Tags (48dp height + checkbox semantics + [OK] prefix) */}
          <SaharaCard variant="lowest" style={{ gap: 10 }}>
            <Text style={styles.sectionLabel}>ASPECTOS DESTACADOS</Text>
            <View style={styles.tagsWrap}>
              {HIGHLIGHT_CRITERIA.map((tag) => {
                const selected = selectedTags.includes(tag);
                return (
                  <Pressable
                    key={tag}
                    accessibilityRole="checkbox"
                    accessibilityLabel={tag}
                    accessibilityState={{ checked: selected }}
                    onPress={() => toggleTag(tag)}
                    style={[
                      styles.tagPill,
                      selected ? styles.tagPillActive : undefined,
                    ]}>
                    <Text
                      style={[
                        styles.tagPillText,
                        selected ? styles.tagPillTextActive : undefined,
                      ]}>
                      {selected ? '✓ ' : ''}
                      {tag}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </SaharaCard>

          {/* Review Comment Textarea (Initialized Empty) */}
          <SaharaCard variant="lowest" style={{ gap: 8 }}>
            <SaharaInput
              testID="review-comment-input"
              label="Comentario (opcional)"
              rightBadge={`${comment.length} / 500`}
              placeholder="Describe cómo fue la experiencia técnica, puntualidad y trato con el trabajador..."
              multiline
              value={comment}
              onChangeText={setComment}
              onBlur={() => setFormError(validateReviewInput(rating, comment, selectedTags))}
              errorText={formError}
              helperText="Elige un aspecto arriba o escribe al menos 10 letras."
            />
          </SaharaCard>

          {/* Community Trust Banner */}
          <SaharaCard variant="default" style={styles.trustRow}>
            <SaharaIcon
              name="shield_person"
              size={20}
              color={SaharaColors.primary}
            />
            <View style={{ flex: 1 }}>
              <Text style={styles.trustTitle}>
                Tu opinión ayuda a otros
              </Text>
              <Text style={styles.trustBody}>
                Tu calificación se publicará en el perfil del trabajador.
              </Text>
            </View>
          </SaharaCard>

          {/* Submit & Secondary Actions */}
          <View style={{ gap: 10 }}>
            <SaharaButton
              testID="submit-review-btn"
              label={
                job.employer_reviewed
                  ? 'Evaluación Ya Registrada'
                  : 'Publicar Evaluación y Finalizar Folio'
              }
              trailingIcon="arrow_forward"
              size="lg"
              disabled={job.employer_reviewed}
              loading={isSubmitting}
              onPress={() => void handleSubmitReview()}
            />
            <SaharaButton
              label="Evaluar más tarde (ir a Historial de Pagos)"
              variant="ghost"
              onPress={() => router.replace('/(main)/payment-history')}
            />
          </View>
        </>
      )}
    </SaharaScreenShell>
  );
}

const styles = StyleSheet.create({
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  completedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: SaharaColors.surfaceContainer,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: Radius.full,
  },
  completedBadgeText: {
    fontFamily: Fonts.label,
    fontSize: 12,
    fontWeight: '700',
    color: SaharaColors.onSurface,
  },
  folioText: {
    fontFamily: Fonts.label,
    fontSize: 12,
    color: SaharaColors.onSurfaceVariant,
  },
  releasedPaymentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
  },
  releasedLabel: {
    fontFamily: Fonts.label,
    fontSize: 12,
    color: SaharaColors.onSurfaceVariant,
  },
  releasedAmount: {
    fontFamily: Fonts.label,
    fontSize: 14,
    fontWeight: '700',
    color: SaharaColors.onSurface,
  },
  workerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  workerAvatar: {
    width: 52,
    height: 52,
    borderRadius: Radius.lg,
    backgroundColor: SaharaColors.primaryFixed,
    alignItems: 'center',
    justifyContent: 'center',
  },
  workerInitials: {
    fontFamily: Fonts.headline,
    fontSize: 20,
    fontWeight: '700',
    color: SaharaColors.primary,
  },
  workerName: {
    fontFamily: Fonts.headline,
    fontSize: 19,
    fontWeight: '700',
    color: SaharaColors.onSurface,
  },
  jobTitleSub: {
    fontFamily: Fonts.body,
    fontSize: 12.5,
    color: SaharaColors.onSurfaceVariant,
  },
  ratingCard: {
    alignItems: 'center',
    gap: 10,
    paddingVertical: 22,
  },
  ratingSuper: {
    fontFamily: Fonts.label,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1,
    color: SaharaColors.primary,
  },
  ratingTitle: {
    fontFamily: Fonts.headline,
    fontSize: 22,
    fontWeight: '700',
    color: SaharaColors.onSurface,
    textAlign: 'center',
  },
  ratingSub: {
    fontFamily: Fonts.body,
    fontSize: 12.5,
    color: SaharaColors.onSurfaceVariant,
    textAlign: 'center',
    lineHeight: 18,
  },
  scoreLabelPill: {
    backgroundColor: SaharaColors.primaryFixed,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: Radius.full,
  },
  scoreLabelText: {
    fontFamily: Fonts.label,
    fontSize: 12,
    fontWeight: '700',
    color: SaharaColors.onPrimaryFixed,
  },
  sectionLabel: {
    fontFamily: Fonts.label,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
    color: SaharaColors.onSurfaceVariant,
  },
  tagsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  tagPill: {
    backgroundColor: SaharaColors.surfaceContainerHigh,
    paddingHorizontal: 14,
    paddingVertical: 10,
    minHeight: 48,
    minWidth: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: SaharaColors.borderSubtle,
  },
  tagPillActive: {
    backgroundColor: SaharaColors.primaryAccessible,
    borderColor: SaharaColors.primaryAccessible,
  },
  tagPillText: {
    fontFamily: Fonts.label,
    fontSize: 12.5,
    fontWeight: '600',
    color: SaharaColors.onSurface,
  },
  tagPillTextActive: {
    color: SaharaColors.onPrimary,
    fontWeight: '700',
  },
  trustRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  trustTitle: {
    fontFamily: Fonts.headline,
    fontSize: 15,
    fontWeight: '700',
    color: SaharaColors.onSurface,
  },
  trustBody: {
    fontFamily: Fonts.body,
    fontSize: 12,
    color: SaharaColors.onSurfaceVariant,
    lineHeight: 17,
  },
});

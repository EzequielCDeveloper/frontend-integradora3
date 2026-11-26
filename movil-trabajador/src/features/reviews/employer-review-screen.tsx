/**
 * MÓDULO 14: EVALUACIÓN DEL EMPLEADOR
 * - Solo disponible para trabajos finalizados con ese empleador
 * - Calificación de 1 a 5 estrellas + comentario + confirmación de publicación
 * - Visualización de evaluación enviada y bloqueo de duplicados
 */
import React, { useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Fonts, Radius, SaharaColors, Spacing } from '@/constants/theme';
import {
  ConfirmationModal,
  EmptyState,
  FeedbackBanner,
  RatingStars,
  SaharaButton,
  SaharaCard,
  SaharaHeader,
  SaharaInput,
  SaharaScreenShell,
} from '@/components/ui';
import { useWorkerStore, workerStore } from '@/services/worker-store';
import { mapDomainErrorToMessage } from '@/shared/utils/error-mapper';
import { formatSpanishDate } from '@/shared/utils/formatters';

export function EmployerReviewScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const version = useWorkerStore((s) => s.version);

  const detail = useMemo(() => {
    void version;
    return id ? workerStore.getAssignedJobDetail(id) : null;
  }, [id, version]);

  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');
  const [confirmPublish, setConfirmPublish] = useState(false);
  const [feedback, setFeedback] = useState<{
    tone: 'success' | 'error';
    text: string;
  } | null>(null);

  if (!detail) {
    return (
      <SaharaScreenShell
        header={<SaharaHeader title="Evaluación" onBack={() => router.back()} />}>
        <EmptyState
          icon="star"
          title="Trabajo no encontrado"
          description="No se pudo localizar el trabajo seleccionado."
          actionLabel="Volver"
          onAction={() => router.back()}
        />
      </SaharaScreenShell>
    );
  }

  const handleConfirmPublish = () => {
    setFeedback(null);
    try {
      workerStore.submitEmployerReview(detail.job.id, rating, comment);
      setConfirmPublish(false);
      setFeedback({
        tone: 'success',
        text: 'Tu evaluación al empleador fue publicada correctamente.',
      });
    } catch (err) {
      setConfirmPublish(false);
      setFeedback({ tone: 'error', text: mapDomainErrorToMessage(err) });
    }
  };

  return (
    <SaharaScreenShell
      header={
        <SaharaHeader
          title="Evaluar empleador"
          subtitle={detail.employer_name}
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

      <SaharaCard variant="low" style={{ gap: 4 }}>
        <Text style={styles.overline}>Trabajo finalizado</Text>
        <Text style={styles.jobTitle}>{detail.job.title}</Text>
        <Text style={styles.metaText}>
          Empleador: {detail.employer_name} ·{' '}
          {formatSpanishDate(detail.job.job_date)}
        </Text>
      </SaharaCard>

      {detail.job.status !== 'completed' ? (
        <EmptyState
          icon="lock"
          title="Evaluación aún no disponible"
          description="Podrás calificar a este empleador una vez que el trabajo se encuentre en estado Finalizado."
          actionLabel="Volver al trabajo"
          onAction={() => router.back()}
        />
      ) : detail.worker_reviewed && detail.worker_review ? (
        <SaharaCard
          variant="lowest"
          accentColor={SaharaColors.success}
          style={{ gap: 12 }}>
          <Text style={styles.cardHeading}>Evaluación enviada</Text>
          <RatingStars rating={detail.worker_review.rating} size={22} />
          <Text style={styles.reviewText}>{detail.worker_review.comment}</Text>
          <Text style={styles.metaText}>
            Publicada el {formatSpanishDate(detail.worker_review.created_at)}
          </Text>
          <SaharaButton
            label="Volver a Mis trabajos"
            variant="outline"
            onPress={() => router.replace('/(main)/my-jobs' as never)}
          />
        </SaharaCard>
      ) : (
        <SaharaCard variant="lowest" style={{ gap: 16 }}>
          <View style={{ gap: 8 }}>
            <Text style={styles.cardHeading}>¿Cómo fue tu experiencia?</Text>
            <Text style={styles.bodyText}>
              Califica el trato, claridad de instrucciones y cumplimiento de condiciones por parte del empleador.
            </Text>
          </View>

          <View style={{ gap: 8, alignItems: 'center' }}>
            <RatingStars rating={rating} onChange={setRating} />
            <Text style={styles.ratingHint}>
              Calificación seleccionada: {rating} de 5 estrellas
            </Text>
          </View>

          <SaharaInput
            label="Comentario sobre el empleador *"
            multiline
            maxLength={500}
            rightBadge={`${comment.length}/500`}
            placeholder="Describe brevemente cómo fue la comunicación, el entorno de trabajo y la puntualidad..."
            value={comment}
            onChangeText={setComment}
          />

          <SaharaButton
            label="Publicar evaluación"
            icon="star"
            onPress={() => setConfirmPublish(true)}
          />
        </SaharaCard>
      )}

      <ConfirmationModal
        visible={confirmPublish}
        title="Confirmar evaluación"
        description="Tu calificación será visible para otros trabajadores y no podrá enviarse nuevamente para este mismo trabajo."
        highlightText={`${rating} estrellas · ${detail.employer_name}`}
        confirmLabel="Sí, publicar"
        onConfirm={handleConfirmPublish}
        onCancel={() => setConfirmPublish(false)}
      />
    </SaharaScreenShell>
  );
}

const styles = StyleSheet.create({
  overline: {
    fontFamily: Fonts.label,
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    color: SaharaColors.secondary,
  },
  jobTitle: {
    fontFamily: Fonts.headline,
    fontSize: 19,
    fontWeight: '600',
    color: SaharaColors.onSurface,
  },
  metaText: {
    fontFamily: Fonts.body,
    fontSize: 12,
    color: SaharaColors.onSurfaceVariant,
  },
  cardHeading: {
    fontFamily: Fonts.headline,
    fontSize: 20,
    fontWeight: '600',
    color: SaharaColors.onSurface,
  },
  bodyText: {
    fontFamily: Fonts.body,
    fontSize: 13.5,
    color: SaharaColors.onSurfaceVariant,
    lineHeight: 20,
  },
  ratingHint: {
    fontFamily: Fonts.label,
    fontSize: 12.5,
    fontWeight: '700',
    color: SaharaColors.primaryAccessible,
  },
  reviewText: {
    fontFamily: Fonts.body,
    fontSize: 14,
    color: SaharaColors.onSurface,
    lineHeight: 21,
  },
});

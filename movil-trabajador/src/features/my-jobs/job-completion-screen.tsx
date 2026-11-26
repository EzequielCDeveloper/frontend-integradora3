/**
 * MÓDULO 9: FINALIZACIÓN DEL TRABAJO
 * Opción A: Finalización mediante código de 6 dígitos
 *   - Validación de 6 dígitos
 *   - Máximo 5 intentos (se bloquea después de 5 intentos inválidos)
 *   - Vigencia de 24 horas y solicitud de código de reemplazo 1 sola vez
 * Opción B: Finalización sin código
 *   - Evidencias opcionales JPG, PNG, PDF (máximo 5 archivos, máx 10 MB c/u)
 *   - Pendiente de confirmación del empleador hasta por 24 horas
 */
import React, { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Fonts, Radius, SaharaColors, Spacing } from '@/constants/theme';
import {
  AttachmentPicker,
  CountdownBanner,
  EmptyState,
  FeedbackBanner,
  JobStatusBadge,
  SaharaButton,
  SaharaCard,
  SaharaHeader,
  SaharaInput,
  SaharaScreenShell,
  type AttachmentDraft,
} from '@/components/ui';
import { useWorkerStore, workerStore } from '@/services/worker-store';
import { mapDomainErrorToMessage } from '@/shared/utils/error-mapper';

type CompletionTab = 'with_code' | 'without_code';

export function JobCompletionScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const version = useWorkerStore((s) => s.version);

  const detail = useMemo(() => {
    void version;
    return id ? workerStore.getAssignedJobDetail(id) : null;
  }, [id, version]);

  const isCodeBlocked = detail?.completion_meta?.is_blocked ?? false;
  const [tab, setTab] = useState<CompletionTab>(
    isCodeBlocked ? 'without_code' : 'with_code',
  );
  const [codeInput, setCodeInput] = useState('');
  const [notes, setNotes] = useState('');
  const [evidences, setEvidences] = useState<AttachmentDraft[]>([]);
  const [attachError, setAttachError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{
    tone: 'success' | 'error' | 'info' | 'warning';
    text: string;
  } | null>(null);

  if (!detail) {
    return (
      <SaharaScreenShell
        header={<SaharaHeader title="Finalización" onBack={() => router.back()} />}>
        <EmptyState
          icon="task_alt"
          title="Trabajo no encontrado"
          description="No se pudo localizar el trabajo seleccionado."
          actionLabel="Volver"
          onAction={() => router.back()}
        />
      </SaharaScreenShell>
    );
  }

  const { job, completion_meta: meta } = detail;
  const remainingAttempts = meta ? Math.max(0, meta.max_attempts - meta.attempts) : 5;
  const canRequestReplacement = meta ? meta.renewals < meta.max_renewals : true;

  const handleVerifyCode = () => {
    setFeedback(null);
    try {
      const res = workerStore.verifyCompletionCode(job.id, codeInput);
      if (res.status === 'ok') {
        setFeedback({ tone: 'success', text: res.message });
      } else if (res.status === 'blocked') {
        setFeedback({ tone: 'error', text: res.message });
        setTab('without_code');
      } else {
        setFeedback({ tone: 'warning', text: res.message });
      }
    } catch (err) {
      setFeedback({ tone: 'error', text: mapDomainErrorToMessage(err) });
    }
  };

  const handleRequestReplacement = () => {
    setFeedback(null);
    try {
      const msg = workerStore.requestReplacementCode(job.id);
      setFeedback({ tone: 'info', text: msg });
    } catch (err) {
      setFeedback({ tone: 'error', text: mapDomainErrorToMessage(err) });
    }
  };

  const handleSubmitWithoutCode = () => {
    setFeedback(null);
    setAttachError(null);
    try {
      workerStore.requestCompletionWithoutCode(
        job.id,
        evidences.map((e) => ({
          file_name: e.file_name,
          mime_type: e.mime_type,
          size_bytes: e.size_bytes,
        })),
        notes,
      );
      setFeedback({
        tone: 'success',
        text: 'Solicitud de finalización enviada. El empleador tiene hasta 24 horas para confirmar el cierre.',
      });
    } catch (err) {
      setFeedback({ tone: 'error', text: mapDomainErrorToMessage(err) });
    }
  };

  return (
    <SaharaScreenShell
      header={
        <SaharaHeader
          title="Finalizar trabajo"
          subtitle={job.title}
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

      <SaharaCard variant="low" style={styles.statusHeaderCard}>
        <JobStatusBadge status={job.status} />
        <Text style={styles.jobName}>{job.title}</Text>
        <Text style={styles.employerName}>{detail.employer_name}</Text>
      </SaharaCard>

      {/* Si ya se completó o ya está en solicitud pendiente */}
      {job.status === 'completed' ? (
        <SaharaCard variant="lowest" style={{ gap: 12 }}>
          <Text style={styles.cardHeading}>Trabajo finalizado</Text>
          <Text style={styles.bodyText}>
            El cierre de este trabajo quedó registrado correctamente. Ahora puedes evaluar al empleador y consultar el estado de tu pago.
          </Text>
          <SaharaButton
            label="Calificar al empleador"
            icon="star"
            onPress={() => router.replace(`/(main)/job/${job.id}/review` as never)}
          />
          <SaharaButton
            label="Ver pagos e ingresos"
            variant="outline"
            onPress={() => router.replace('/(main)/payments' as never)}
          />
        </SaharaCard>
      ) : job.status === 'completion_requested' ? (
        <SaharaCard variant="lowest" style={{ gap: 12 }}>
          <Text style={styles.cardHeading}>
            Solicitud de finalización pendiente
          </Text>
          <Text style={styles.bodyText}>
            Tu solicitud sin código está en espera de confirmación del empleador por un plazo máximo de 24 horas.
          </Text>
          {job.completion_requested_at ? (
            <CountdownBanner
              targetIso={new Date(
                new Date(job.completion_requested_at).getTime() + 24 * 3600 * 1000,
              ).toISOString()}
              title="Plazo de confirmación del empleador"
              subtitle="Si el empleador no responde dentro de 24 horas, el trabajo se confirmará automáticamente."
            />
          ) : null}
          <SaharaButton
            label="Volver al detalle del trabajo"
            variant="outline"
            onPress={() => router.replace(`/(main)/job/${job.id}` as never)}
          />
        </SaharaCard>
      ) : (
        <>
          {/* Selector de método */}
          <View style={styles.tabSwitch}>
            <Pressable
              onPress={() => setTab('with_code')}
              style={[
                styles.tabBtn,
                tab === 'with_code' ? styles.tabBtnActive : undefined,
              ]}>
              <Text
                style={[
                  styles.tabText,
                  tab === 'with_code' ? styles.tabTextActive : undefined,
                ]}>
                Opción A · Con código
              </Text>
            </Pressable>
            <Pressable
              onPress={() => setTab('without_code')}
              style={[
                styles.tabBtn,
                tab === 'without_code' ? styles.tabBtnActive : undefined,
              ]}>
              <Text
                style={[
                  styles.tabText,
                  tab === 'without_code' ? styles.tabTextActive : undefined,
                ]}>
                Opción B · Sin código
              </Text>
            </Pressable>
          </View>

          {tab === 'with_code' ? (
            <SaharaCard variant="lowest" style={{ gap: 14 }}>
              <Text style={styles.cardHeading}>
                Ingresa el código de 6 dígitos
              </Text>
              <Text style={styles.bodyText}>
                Solicita al empleador el código de cierre de 6 dígitos al terminar tu jornada. Al validarlo, el trabajo se marcará como finalizado de inmediato.
              </Text>

              {meta ? (
                <CountdownBanner
                  targetIso={meta.code_expires_at}
                  title="Vigencia del código (24 horas)"
                  subtitle={`Intentos disponibles: ${remainingAttempts} de ${meta.max_attempts}.`}
                />
              ) : null}

              {meta?.is_blocked ? (
                <FeedbackBanner
                  tone="error"
                  message="El código se bloqueó tras 5 intentos inválidos. Cambia a la Opción B (finalización sin código)."
                />
              ) : (
                <>
                  <SaharaInput
                    label="Código numérico de 6 dígitos"
                    icon="key"
                    keyboardType="number-pad"
                    maxLength={6}
                    placeholder="000000"
                    rightBadge={`${remainingAttempts} intentos`}
                    value={codeInput}
                    onChangeText={(v) =>
                      setCodeInput(v.replace(/\D/g, '').slice(0, 6))
                    }
                  />

                  <SaharaButton
                    label="Validar código y finalizar"
                    icon="check_circle"
                    disabled={codeInput.length !== 6}
                    onPress={handleVerifyCode}
                  />
                </>
              )}

              <View style={styles.divider} />

              <View style={{ gap: 6 }}>
                <Text style={styles.subHeading}>¿El código venció o no lo recibiste?</Text>
                <SaharaButton
                  label={
                    canRequestReplacement
                      ? 'Solicitar código de reemplazo (1 disponible)'
                      : 'Reemplazo único ya utilizado'
                  }
                  variant="outline"
                  size="sm"
                  disabled={!canRequestReplacement}
                  onPress={handleRequestReplacement}
                />
                <SaharaButton
                  label="Ir al chat con el empleador"
                  variant="ghost"
                  size="sm"
                  icon="chat"
                  onPress={() => router.push(`/(main)/chat/${job.id}` as never)}
                />
              </View>
            </SaharaCard>
          ) : (
            <SaharaCard variant="lowest" style={{ gap: 14 }}>
              <Text style={styles.cardHeading}>
                Solicitar finalización sin código
              </Text>
              <Text style={styles.bodyText}>
                Si no cuentas con el código del empleador o este se bloqueó, envía tu solicitud de finalización. Puedes adjuntar evidencias opcionales y el empleador tendrá hasta 24 horas para confirmar.
              </Text>

              <SaharaInput
                label="Comentario de entrega (opcional)"
                multiline
                placeholder="Ej. Área limpia y mobiliario entregado conforme a lo acordado."
                value={notes}
                onChangeText={setNotes}
              />

              <AttachmentPicker
                kind="completion_evidence"
                items={evidences}
                errorText={attachError}
                onValidationError={setAttachError}
                onAdd={(file) => {
                  setAttachError(null);
                  setEvidences((prev) => [...prev, file]);
                }}
                onRemove={(attId) =>
                  setEvidences((prev) => prev.filter((item) => item.id !== attId))
                }
              />

              <SaharaButton
                label="Enviar solicitud de finalización"
                icon="send"
                onPress={handleSubmitWithoutCode}
              />
            </SaharaCard>
          )}
        </>
      )}
    </SaharaScreenShell>
  );
}

const styles = StyleSheet.create({
  statusHeaderCard: {
    gap: 6,
  },
  jobName: {
    fontFamily: Fonts.headline,
    fontSize: 19,
    fontWeight: '600',
    color: SaharaColors.onSurface,
  },
  employerName: {
    fontFamily: Fonts.label,
    fontSize: 12.5,
    color: SaharaColors.secondary,
  },
  tabSwitch: {
    flexDirection: 'row',
    backgroundColor: SaharaColors.surfaceContainerHigh,
    borderRadius: Radius.xl,
    padding: 4,
    gap: 4,
  },
  tabBtn: {
    flex: 1,
    paddingVertical: 11,
    borderRadius: Radius.lg,
    alignItems: 'center',
  },
  tabBtnActive: {
    backgroundColor: SaharaColors.surfaceContainerLowest,
  },
  tabText: {
    fontFamily: Fonts.label,
    fontSize: 12.5,
    fontWeight: '600',
    color: SaharaColors.onSurfaceVariant,
  },
  tabTextActive: {
    color: SaharaColors.primaryAccessible,
    fontWeight: '700',
  },
  cardHeading: {
    fontFamily: Fonts.headline,
    fontSize: 20,
    fontWeight: '600',
    color: SaharaColors.onSurface,
  },
  subHeading: {
    fontFamily: Fonts.label,
    fontSize: 12.5,
    fontWeight: '700',
    color: SaharaColors.onSurface,
  },
  bodyText: {
    fontFamily: Fonts.body,
    fontSize: 13.5,
    color: SaharaColors.onSurfaceVariant,
    lineHeight: 20,
  },
  divider: {
    height: 1,
    backgroundColor: SaharaColors.borderSubtle,
  },
});

/**
 * MÓDULO 13B: CREAR TICKET DE SOPORTE O ABRIR RECLAMACIÓN
 * - Categorías de ticket: Cuenta, Publicación, Postulación, Trabajo, Pago, Técnica
 * - Reclamaciones de pago ligadas a un trabajo (muestra bloqueo de fondos)
 * - Adjuntar evidencias opcionales (JPG, PNG, PDF, máx 5 archivos, 10 MB)
 */
import React, { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Fonts, Radius, SaharaColors, Spacing } from '@/constants/theme';
import {
  AttachmentPicker,
  FeedbackBanner,
  SaharaButton,
  SaharaCard,
  SaharaHeader,
  SaharaIcon,
  SaharaInput,
  SaharaScreenShell,
  type AttachmentDraft,
} from '@/components/ui';
import { useWorkerStore, workerStore } from '@/services/worker-store';
import { mapDomainErrorToMessage } from '@/shared/utils/error-mapper';
import {
  formatCurrencyMXN,
  TICKET_CATEGORY_LABELS,
} from '@/shared/utils/formatters';
import { VALID_TICKET_CATEGORIES } from '@/shared/utils/validators';
import type { TicketCategory } from '@/types/database';

export function NewCaseScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ jobId?: string; type?: string }>();
  const version = useWorkerStore((s) => s.version);

  const [caseType, setCaseType] = useState<'ticket' | 'claim'>(
    params.type === 'claim' ? 'claim' : 'ticket',
  );
  const [ticketCategory, setTicketCategory] = useState<TicketCategory>('job');
  const [selectedJobId, setSelectedJobId] = useState<string | null>(
    params.jobId ?? null,
  );
  const [description, setDescription] = useState('');
  const [attachments, setAttachments] = useState<AttachmentDraft[]>([]);
  const [attachError, setAttachError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{
    tone: 'success' | 'error';
    text: string;
  } | null>(null);

  const myJobs = useMemo(() => {
    void version;
    return workerStore.listMyJobs();
  }, [version]);

  const handleSubmit = () => {
    setFeedback(null);
    try {
      workerStore.createCase({
        case_type: caseType,
        job_id: caseType === 'claim' ? selectedJobId : null,
        ticket_category: caseType === 'ticket' ? ticketCategory : null,
        description,
        attachments: attachments.map((a) => ({
          file_name: a.file_name,
          mime_type: a.mime_type,
          size_bytes: a.size_bytes,
        })),
      });
      router.replace('/(main)/cases' as never);
    } catch (err) {
      setFeedback({ tone: 'error', text: mapDomainErrorToMessage(err) });
    }
  };

  return (
    <SaharaScreenShell
      header={
        <SaharaHeader
          title={
            caseType === 'claim' ? 'Abrir reclamación' : 'Nuevo ticket de soporte'
          }
          subtitle="Centro de atención"
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

      {/* Selector de tipo */}
      <View style={styles.switchRow}>
        <Pressable
          onPress={() => setCaseType('ticket')}
          style={[
            styles.switchBtn,
            caseType === 'ticket' ? styles.switchBtnActive : undefined,
          ]}>
          <Text
            style={[
              styles.switchText,
              caseType === 'ticket' ? styles.switchTextActive : undefined,
            ]}>
            Ticket de soporte
          </Text>
        </Pressable>
        <Pressable
          onPress={() => setCaseType('claim')}
          style={[
            styles.switchBtn,
            caseType === 'claim' ? styles.switchBtnActive : undefined,
          ]}>
          <Text
            style={[
              styles.switchText,
              caseType === 'claim' ? styles.switchTextActive : undefined,
            ]}>
            Reclamación de pago
          </Text>
        </Pressable>
      </View>

      {caseType === 'ticket' ? (
        <SaharaCard variant="lowest" style={{ gap: 12 }}>
          <Text style={styles.cardTitle}>Categoría del ticket</Text>
          <View style={styles.chipsWrap}>
            {VALID_TICKET_CATEGORIES.map((cat) => {
              const active = ticketCategory === cat;
              return (
                <Pressable
                  key={cat}
                  onPress={() => setTicketCategory(cat)}
                  style={[
                    styles.chip,
                    active ? styles.chipActive : undefined,
                  ]}>
                  <Text
                    style={[
                      styles.chipText,
                      active ? styles.chipTextActive : undefined,
                    ]}>
                    {TICKET_CATEGORY_LABELS[cat]}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </SaharaCard>
      ) : (
        <SaharaCard variant="lowest" style={{ gap: 12 }}>
          <View style={styles.lockedBanner}>
            <SaharaIcon name="lock" size={15} color={SaharaColors.error} />
            <Text style={styles.lockedText}>
              Al abrir una reclamación de pago, los fondos del trabajo permanecen bloqueados mientras el caso no esté cerrado.
            </Text>
          </View>
          <Text style={styles.cardTitle}>Selecciona el trabajo</Text>
          <View style={{ gap: 8 }}>
            {myJobs.map((item) => {
              const selected = selectedJobId === item.job.id;
              return (
                <Pressable
                  key={item.job.id}
                  onPress={() => setSelectedJobId(item.job.id)}
                  style={[
                    styles.jobOption,
                    selected ? styles.jobOptionActive : undefined,
                  ]}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.jobOptionTitle}>{item.job.title}</Text>
                    <Text style={styles.jobOptionSub}>
                      {item.employer_name} ·{' '}
                      {formatCurrencyMXN(item.job.fixed_payment_mxn)}
                    </Text>
                  </View>
                  {selected ? (
                    <SaharaIcon
                      name="check_circle"
                      size={16}
                      color={SaharaColors.primaryAccessible}
                    />
                  ) : null}
                </Pressable>
              );
            })}
          </View>
        </SaharaCard>
      )}

      <SaharaCard variant="lowest" style={{ gap: 14 }}>
        <SaharaInput
          label="Describe lo sucedido *"
          multiline
          placeholder="Explica con claridad tu consulta o situación (mínimo 10 caracteres)..."
          value={description}
          onChangeText={setDescription}
        />

        <AttachmentPicker
          kind="case_evidence"
          items={attachments}
          errorText={attachError}
          onValidationError={setAttachError}
          onAdd={(file) => {
            setAttachError(null);
            setAttachments((prev) => [...prev, file]);
          }}
          onRemove={(attId) =>
            setAttachments((prev) => prev.filter((a) => a.id !== attId))
          }
        />

        <SaharaButton
          label={
            caseType === 'claim' ? 'Registrar reclamación' : 'Enviar ticket'
          }
          icon="send"
          onPress={handleSubmit}
        />
      </SaharaCard>
    </SaharaScreenShell>
  );
}

const styles = StyleSheet.create({
  switchRow: {
    flexDirection: 'row',
    backgroundColor: SaharaColors.surfaceContainerHigh,
    borderRadius: Radius.xl,
    padding: 4,
    gap: 4,
  },
  switchBtn: {
    flex: 1,
    paddingVertical: 11,
    borderRadius: Radius.lg,
    alignItems: 'center',
  },
  switchBtnActive: {
    backgroundColor: SaharaColors.surfaceContainerLowest,
  },
  switchText: {
    fontFamily: Fonts.label,
    fontSize: 12.5,
    fontWeight: '600',
    color: SaharaColors.onSurfaceVariant,
  },
  switchTextActive: {
    color: SaharaColors.primaryAccessible,
    fontWeight: '700',
  },
  cardTitle: {
    fontFamily: Fonts.headline,
    fontSize: 18,
    fontWeight: '600',
    color: SaharaColors.onSurface,
  },
  chipsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: Radius.full,
    backgroundColor: SaharaColors.surfaceContainerLow,
    borderWidth: 1,
    borderColor: SaharaColors.borderSubtle,
  },
  chipActive: {
    backgroundColor: SaharaColors.primaryAccessible,
    borderColor: SaharaColors.primaryAccessible,
  },
  chipText: {
    fontFamily: Fonts.label,
    fontSize: 12.5,
    fontWeight: '600',
    color: SaharaColors.onSurface,
  },
  chipTextActive: {
    color: SaharaColors.onPrimary,
  },
  lockedBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: SaharaColors.errorContainer,
    padding: 12,
    borderRadius: Radius.lg,
  },
  lockedText: {
    flex: 1,
    fontFamily: Fonts.label,
    fontSize: 12,
    color: SaharaColors.onErrorContainer,
    lineHeight: 17,
  },
  jobOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 12,
    borderRadius: Radius.lg,
    backgroundColor: SaharaColors.surfaceContainerLow,
    borderWidth: 1,
    borderColor: SaharaColors.borderSubtle,
  },
  jobOptionActive: {
    borderColor: SaharaColors.primaryAccessible,
    backgroundColor: SaharaColors.primaryFixed,
  },
  jobOptionTitle: {
    fontFamily: Fonts.label,
    fontSize: 13,
    fontWeight: '700',
    color: SaharaColors.onSurface,
  },
  jobOptionSub: {
    fontFamily: Fonts.body,
    fontSize: 11.5,
    color: SaharaColors.onSurfaceVariant,
  },
});

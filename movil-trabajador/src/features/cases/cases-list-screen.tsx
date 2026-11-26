/**
 * MÓDULO 13A: CASOS, RECLAMACIONES, REPORTES Y SOPORTE
 * - Solo consulta y administra casos propios del trabajador
 * - Pestañas: Todos, Tickets, Reclamaciones, Reportes
 * - Hilo de respuestas, adjuntos, aviso de fondos bloqueados en reclamaciones y objeción en 7 días
 */
import React, { useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Fonts, Radius, SaharaColors, Spacing } from '@/constants/theme';
import {
  CaseStatusBadge,
  CountdownBanner,
  EmptyState,
  FeedbackBanner,
  FilterPill,
  SaharaButton,
  SaharaCard,
  SaharaHeader,
  SaharaIcon,
  SaharaInput,
  SaharaScreenShell,
  WorkerBottomNav,
} from '@/components/ui';
import { useWorkerStore, workerStore } from '@/services/worker-store';
import { mapDomainErrorToMessage } from '@/shared/utils/error-mapper';
import {
  CASE_TYPE_LABELS,
  formatCurrencyMXN,
  formatSpanishDateTime,
  REPORT_TARGET_LABELS,
  TICKET_CATEGORY_LABELS,
} from '@/shared/utils/formatters';
import type { CaseType } from '@/types/database';

export function CasesListScreen() {
  const router = useRouter();
  const version = useWorkerStore((s) => s.version);

  const [typeFilter, setTypeFilter] = useState<CaseType | 'all'>('all');
  const [selectedCaseId, setSelectedCaseId] = useState<string | null>(null);
  const [replyText, setReplyText] = useState('');
  const [objectionText, setObjectionText] = useState('');
  const [showObjectionBox, setShowObjectionBox] = useState(false);
  const [feedback, setFeedback] = useState<{
    tone: 'success' | 'error';
    text: string;
  } | null>(null);

  const cases = useMemo(() => {
    void version;
    return workerStore.listMyCases();
  }, [version]);

  const filtered = useMemo(() => {
    if (typeFilter === 'all') return cases;
    return cases.filter((c) => c.case_type === typeFilter);
  }, [cases, typeFilter]);

  const activeCase = useMemo(
    () => cases.find((c) => c.id === selectedCaseId) ?? null,
    [cases, selectedCaseId],
  );

  const handleSendReply = () => {
    if (!activeCase) return;
    setFeedback(null);
    try {
      workerStore.addCaseReply(activeCase.id, replyText);
      setReplyText('');
      setFeedback({ tone: 'success', text: 'Respuesta enviada en el hilo del caso.' });
    } catch (err) {
      setFeedback({ tone: 'error', text: mapDomainErrorToMessage(err) });
    }
  };

  const handleSendObjection = () => {
    if (!activeCase) return;
    setFeedback(null);
    try {
      workerStore.objectCaseResolution(activeCase.id, objectionText);
      setObjectionText('');
      setShowObjectionBox(false);
      setFeedback({
        tone: 'success',
        text: 'Tu objeción fue registrada y el caso regresó a «En revisión».',
      });
    } catch (err) {
      setFeedback({ tone: 'error', text: mapDomainErrorToMessage(err) });
    }
  };

  return (
    <SaharaScreenShell
      header={
        <SaharaHeader
          title="Casos y soporte"
          subtitle="Atención al trabajador"
          onBack={() => router.back()}
          rightAction={
            <Pressable
              onPress={() => router.push('/(main)/cases/new' as never)}
              style={styles.newCaseBtn}>
              <SaharaIcon name="add" size={14} color={SaharaColors.onPrimary} />
              <Text style={styles.newCaseText}>Nuevo</Text>
            </Pressable>
          }
        />
      }
      footer={<WorkerBottomNav />}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.filtersRow}>
        <FilterPill
          label="Todos"
          count={cases.length}
          active={typeFilter === 'all'}
          onPress={() => setTypeFilter('all')}
        />
        <FilterPill
          label="Tickets"
          count={cases.filter((c) => c.case_type === 'ticket').length}
          active={typeFilter === 'ticket'}
          onPress={() => setTypeFilter('ticket')}
        />
        <FilterPill
          label="Reclamaciones"
          count={cases.filter((c) => c.case_type === 'claim').length}
          active={typeFilter === 'claim'}
          onPress={() => setTypeFilter('claim')}
        />
        <FilterPill
          label="Reportes"
          count={cases.filter((c) => c.case_type === 'report').length}
          active={typeFilter === 'report'}
          onPress={() => setTypeFilter('report')}
        />
      </ScrollView>

      {filtered.length === 0 ? (
        <EmptyState
          icon="support_agent"
          title="Sin casos registrados"
          description="Si necesitas ayuda con tu cuenta, un pago o un trabajo, puedes abrir un ticket o una reclamación."
          actionLabel="Crear ticket de soporte"
          onAction={() => router.push('/(main)/cases/new' as never)}
        />
      ) : (
        <View style={{ gap: 10 }}>
          {filtered.map((item) => (
            <SaharaCard
              key={item.id}
              variant="lowest"
              accentColor={
                item.case_type === 'claim'
                  ? SaharaColors.error
                  : item.case_type === 'report'
                    ? SaharaColors.tertiary
                    : SaharaColors.primaryAccessible
              }
              onPress={() => {
                setFeedback(null);
                setShowObjectionBox(false);
                setSelectedCaseId(item.id);
              }}
              style={{ gap: 8 }}>
              <View style={styles.cardTop}>
                <View style={styles.typePill}>
                  <Text style={styles.typePillText}>
                    {CASE_TYPE_LABELS[item.case_type]} · {item.folio}
                  </Text>
                </View>
                <CaseStatusBadge status={item.status} />
              </View>

              {item.ticket_category ? (
                <Text style={styles.metaStrong}>
                  Categoría: {TICKET_CATEGORY_LABELS[item.ticket_category]}
                </Text>
              ) : null}
              {item.target_type ? (
                <Text style={styles.metaStrong}>
                  Elemento reportado: {REPORT_TARGET_LABELS[item.target_type]}
                </Text>
              ) : null}
              {item.job_title ? (
                <Text style={styles.metaStrong}>
                  Trabajo: {item.job_title}
                  {item.job_amount_mxn
                    ? ` (${formatCurrencyMXN(item.job_amount_mxn)})`
                    : ''}
                </Text>
              ) : null}

              <Text style={styles.descText} numberOfLines={3}>
                {item.description}
              </Text>

              {item.case_type === 'claim' && item.status !== 'closed' ? (
                <View style={styles.lockedFundsStrip}>
                  <SaharaIcon name="lock" size={13} color={SaharaColors.error} />
                  <Text style={styles.lockedFundsText}>
                    Los fondos permanecen bloqueados mientras el caso no esté cerrado.
                  </Text>
                </View>
              ) : null}

              <View style={styles.cardBottom}>
                <Text style={styles.dateText}>
                  Actualizado: {formatSpanishDateTime(item.updated_at)}
                </Text>
                <Text style={styles.openThreadText}>
                  Ver seguimiento ({item.messages.length}) →
                </Text>
              </View>
            </SaharaCard>
          ))}
        </View>
      )}

      {/* Modal de detalle e hilo del caso */}
      <Modal
        visible={Boolean(activeCase)}
        animationType="slide"
        onRequestClose={() => setSelectedCaseId(null)}>
        <SaharaScreenShell
          header={
            <SaharaHeader
              title={activeCase?.folio ?? 'Caso'}
              subtitle={
                activeCase ? CASE_TYPE_LABELS[activeCase.case_type] : undefined
              }
              onBack={() => setSelectedCaseId(null)}
            />
          }>
          {activeCase ? (
            <>
              {feedback ? (
                <FeedbackBanner
                  tone={feedback.tone}
                  message={feedback.text}
                  onDismiss={() => setFeedback(null)}
                />
              ) : null}

              <SaharaCard variant="lowest" style={{ gap: 10 }}>
                <View style={styles.cardTop}>
                  <CaseStatusBadge status={activeCase.status} />
                  <Text style={styles.dateText}>
                    {formatSpanishDateTime(activeCase.created_at)}
                  </Text>
                </View>

                {activeCase.job_title ? (
                  <Text style={styles.metaStrong}>
                    Trabajo: {activeCase.job_title}
                  </Text>
                ) : null}

                <Text style={styles.fullDesc}>{activeCase.description}</Text>

                {activeCase.case_type === 'claim' &&
                activeCase.status !== 'closed' ? (
                  <View style={styles.lockedFundsStrip}>
                    <SaharaIcon
                      name="lock"
                      size={14}
                      color={SaharaColors.error}
                    />
                    <Text style={styles.lockedFundsText}>
                      Reclamación de pago activa: los fondos permanecen bloqueados de forma segura hasta que el caso quede cerrado.
                    </Text>
                  </View>
                ) : null}

                {activeCase.resolution_notes ? (
                  <View style={styles.resolutionBox}>
                    <Text style={styles.resolutionLabel}>Resolución registrada</Text>
                    <Text style={styles.fullDesc}>
                      {activeCase.resolution_notes}
                    </Text>
                  </View>
                ) : null}

                {activeCase.attachments.length > 0 ? (
                  <View style={{ gap: 4 }}>
                    <Text style={styles.metaStrong}>
                      Evidencias adjuntas ({activeCase.attachments.length})
                    </Text>
                    {activeCase.attachments.map((a) => (
                      <Text key={a.id} style={styles.attLine}>
                        • {a.file_name}
                      </Text>
                    ))}
                  </View>
                ) : null}
              </SaharaCard>

              {activeCase.status === 'resolved' &&
              activeCase.auto_close_deadline ? (
                <CountdownBanner
                  targetIso={activeCase.auto_close_deadline}
                  mode="days"
                  title="Plazo para objetar la resolución"
                  subtitle="Si no estás de acuerdo con la resolución, puedes objetarla antes de que el caso se cierre automáticamente."
                />
              ) : null}

              {/* Hilo de mensajes */}
              <SaharaCard variant="low" style={{ gap: 10 }}>
                <Text style={styles.threadHeading}>Respuestas y seguimiento</Text>
                {activeCase.messages.length === 0 ? (
                  <Text style={styles.dateText}>
                    Aún no hay respuestas adicionales en este caso.
                  </Text>
                ) : (
                  activeCase.messages.map((m) => (
                    <View
                      key={m.id}
                      style={[
                        styles.msgItem,
                        m.author_role === 'admin'
                          ? styles.msgAdmin
                          : styles.msgWorker,
                      ]}>
                      <Text style={styles.msgAuthor}>{m.author_name}</Text>
                      <Text style={styles.msgBody}>{m.body}</Text>
                      <Text style={styles.dateText}>
                        {formatSpanishDateTime(m.created_at)}
                      </Text>
                    </View>
                  ))
                )}
              </SaharaCard>

              {/* Responder al hilo */}
              {activeCase.status !== 'closed' &&
              activeCase.status !== 'dismissed' ? (
                <SaharaCard variant="lowest" style={{ gap: 10 }}>
                  <SaharaInput
                    label="Agregar comentario o seguimiento"
                    multiline
                    placeholder="Escribe una actualización o respuesta..."
                    value={replyText}
                    onChangeText={setReplyText}
                  />
                  <SaharaButton
                    label="Enviar respuesta"
                    icon="send"
                    onPress={handleSendReply}
                  />

                  {activeCase.status === 'resolved' ? (
                    showObjectionBox ? (
                      <View style={{ gap: 8, marginTop: 6 }}>
                        <SaharaInput
                          label="Motivo de tu objeción"
                          multiline
                          placeholder="Explica por qué solicitas una nueva revisión..."
                          value={objectionText}
                          onChangeText={setObjectionText}
                        />
                        <SaharaButton
                          label="Enviar objeción"
                          variant="danger"
                          onPress={handleSendObjection}
                        />
                      </View>
                    ) : (
                      <SaharaButton
                        label="Objetar resolución"
                        variant="outline"
                        onPress={() => setShowObjectionBox(true)}
                      />
                    )
                  ) : null}
                </SaharaCard>
              ) : null}
            </>
          ) : null}
        </SaharaScreenShell>
      </Modal>
    </SaharaScreenShell>
  );
}

const styles = StyleSheet.create({
  newCaseBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: SaharaColors.primaryAccessible,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: Radius.full,
  },
  newCaseText: {
    fontFamily: Fonts.label,
    fontSize: 12,
    fontWeight: '700',
    color: SaharaColors.onPrimary,
  },
  filtersRow: {
    gap: 8,
    paddingVertical: 2,
  },
  cardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  typePill: {
    backgroundColor: SaharaColors.surfaceContainerHigh,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: Radius.full,
  },
  typePillText: {
    fontFamily: Fonts.label,
    fontSize: 11,
    fontWeight: '700',
    color: SaharaColors.onSurface,
  },
  metaStrong: {
    fontFamily: Fonts.label,
    fontSize: 12.5,
    fontWeight: '700',
    color: SaharaColors.onSurface,
  },
  descText: {
    fontFamily: Fonts.body,
    fontSize: 13,
    color: SaharaColors.onSurfaceVariant,
    lineHeight: 19,
  },
  fullDesc: {
    fontFamily: Fonts.body,
    fontSize: 13.5,
    color: SaharaColors.onSurface,
    lineHeight: 20,
  },
  lockedFundsStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: SaharaColors.errorContainer,
    padding: 10,
    borderRadius: Radius.md,
  },
  lockedFundsText: {
    flex: 1,
    fontFamily: Fonts.label,
    fontSize: 11.5,
    fontWeight: '600',
    color: SaharaColors.onErrorContainer,
  },
  cardBottom: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    paddingTop: 4,
  },
  dateText: {
    fontFamily: Fonts.body,
    fontSize: 11,
    color: SaharaColors.secondary,
  },
  openThreadText: {
    fontFamily: Fonts.label,
    fontSize: 12,
    fontWeight: '700',
    color: SaharaColors.primaryAccessible,
  },
  resolutionBox: {
    backgroundColor: SaharaColors.successContainer,
    padding: 12,
    borderRadius: Radius.lg,
    gap: 4,
  },
  resolutionLabel: {
    fontFamily: Fonts.label,
    fontSize: 12,
    fontWeight: '700',
    color: SaharaColors.onSuccessContainer,
  },
  attLine: {
    fontFamily: Fonts.body,
    fontSize: 12,
    color: SaharaColors.onSurfaceVariant,
  },
  threadHeading: {
    fontFamily: Fonts.headline,
    fontSize: 18,
    fontWeight: '600',
    color: SaharaColors.onSurface,
  },
  msgItem: {
    padding: 12,
    borderRadius: Radius.lg,
    gap: 4,
  },
  msgAdmin: {
    backgroundColor: SaharaColors.surfaceContainerLowest,
    borderLeftWidth: 3,
    borderLeftColor: SaharaColors.primaryAccessible,
  },
  msgWorker: {
    backgroundColor: SaharaColors.primaryFixed,
  },
  msgAuthor: {
    fontFamily: Fonts.label,
    fontSize: 12,
    fontWeight: '700',
    color: SaharaColors.onSurface,
  },
  msgBody: {
    fontFamily: Fonts.body,
    fontSize: 13,
    color: SaharaColors.onSurface,
    lineHeight: 19,
  },
});

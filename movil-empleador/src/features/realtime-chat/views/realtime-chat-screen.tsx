/**
 * UI-EMP-08: Chat en Tiempo Real Empleador (Audit Fixed & Zero Emojis)
 * Source of Truth: Especificacion_de_Arquitectura_de_Software_v2.md (Section 3.2 UI-EMP-08, RF-14, RF-29)
 * Audit Fixes Applied:
 * - SYS-01 & SYS-05: Virtualized with FlatList (`scrollable={false}` on SaharaScreenShell) inside KeyboardAvoidingView
 * - UI-EMP-08-1: Quick reply chips elevated to minHeight: 48dp with gap: 8dp; Send button elevated to 48x48dp
 * - UI-EMP-08-2: Report button inside chat bubble elevated to minHeight: 44dp with explicit contextual accessibilityLabel
 * - UI-EMP-08-3: Auto-scrolls to bottom (`flatListRef.current?.scrollToEnd`) when sending a message
 * - SYS-07: Zero hardcoded rgba(...)
 */
import React, { useCallback, useRef, useState } from 'react';
import {
  FlatList,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
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
} from '@/shared/utils/formatters';
import { validateChatMessageBody } from '@/shared/utils/validators';
import type { ChatMessage, EmployerJobDetailView } from '@/types/database';

const QUICK_REPLIES = [
  'Ya estoy esperándote en la entrada principal',
  'Por favor confirma al llegar al acceso indicado',
  'Tu pago ya está protegido hasta que termine el trabajo',
];

const REPORT_REASONS = [
  'Intento de cobro o pago fuera de Solidez MX (Efectivo/Transferencia)',
  'Comportamiento inadecuado o lenguaje ofensivo',
  'Incumplimiento de términos operativos',
];

export function RealtimeChatScreenView({ jobId }: { jobId: string }) {
  const router = useRouter();
  const flatListRef = useRef<FlatList<ChatMessage> | null>(null);
  const storeVersion = useMockBackendStore((s) => s.version);
  const activeEmployerId = useMockBackendStore((s) => s.activeEmployerId);

  const [job, setJob] = useState<EmployerJobDetailView | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [draftText, setDraftText] = useState('');
  const [inputError, setInputError] = useState<string | null>(null);

  // Report modal state (RF-29)
  const [reportTargetMsg, setReportTargetMsg] = useState<ChatMessage | null>(
    null,
  );
  const [selectedReportReason, setSelectedReportReason] = useState(
    REPORT_REASONS[0],
  );
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const loadChat = useCallback(async () => {
    if (!jobId) return;
    setIsLoading(true);
    setErrorMsg(null);
    try {
      const [jobDetail, msgList] = await Promise.all([
        employerRepository.getEmployerJobDetail(jobId),
        employerRepository.listChatMessages(jobId),
      ]);
      setJob(jobDetail);
      setMessages(msgList);
    } catch (err) {
      const mapped = mapDomainErrorToUI(err);
      setErrorMsg(mapped.message);
    } finally {
      setIsLoading(false);
    }
  }, [jobId]);

  useAsyncLoad(loadChat, storeVersion);

  const { execute: handleSendMessage, isPending: isSending } =
    useIdempotentAction(async () => {
      setInputError(null);
      const err = validateChatMessageBody(draftText);
      if (err) {
        setInputError(err);
        return;
      }
      try {
        await employerRepository.sendChatMessage(jobId, draftText);
        setDraftText('');
        setTimeout(() => {
          flatListRef.current?.scrollToEnd({ animated: true });
        }, 80);
      } catch (e) {
        const mapped = mapDomainErrorToUI(e);
        setInputError(mapped.message);
      }
    });

  const { execute: handleReportMessage, isPending: isReporting } =
    useIdempotentAction(async () => {
      if (!reportTargetMsg) return;
      try {
        await employerRepository.reportChatMessage(
          reportTargetMsg.id,
          selectedReportReason,
        );
        setReportTargetMsg(null);
        setToastMessage(
          'Reporte enviado. Nuestro equipo lo revisará.',
        );
      } catch (e) {
        const mapped = mapDomainErrorToUI(e);
        setErrorMsg(mapped.message);
        setReportTargetMsg(null);
      }
    });

  const renderHeaderContext = () => {
    if (!job) return null;
    return (
      <View style={{ gap: Spacing.md, marginBottom: 4 }}>
        {/* Sticky Job Context Bar */}
        <SaharaCard variant="low" style={styles.jobContextCard}>
          <View style={styles.jobContextTop}>
            <View style={{ flex: 1 }}>
              <Text style={styles.jobFolioText}>
                {formatFolio(job.id)}
              </Text>
              <Text style={styles.jobTitleText} numberOfLines={1}>
                {job.title}
              </Text>
            </View>
            <View style={{ alignItems: 'flex-end', gap: 4 }}>
              <Text style={styles.jobAmountPill}>
                {formatCurrencyMXN(job.total_charged_mxn)}
              </Text>
              <JobStatusBadge status={job.status} />
            </View>
          </View>
        </SaharaCard>

        {/* Escrow & Security Trust Shield Notice */}
        <SaharaCard variant="default" style={styles.shieldNoticeRow}>
          <SaharaIcon
            name="verified_user"
            size={18}
            color={SaharaColors.primaryAccessible}
          />
          <View style={{ flex: 1 }}>
            <Text style={styles.shieldTitle}>
              Chat seguro con el trabajador
            </Text>
            <Text style={styles.shieldBody}>
              Por tu seguridad, acuerda todo por aquí y nunca pagues
              en efectivo fuera de la app.
            </Text>
          </View>
        </SaharaCard>

        {toastMessage ? (
          <SaharaCard variant="primaryFixed">
            <Text style={styles.toastText}>{toastMessage}</Text>
          </SaharaCard>
        ) : null}
      </View>
    );
  };

  return (
    <SaharaScreenShell
      scrollable={false}
      header={
        <SaharaHeader
          title="Chat y Coordinación"
          subtitle={
            job
              ? job.selected_worker_name ?? 'Trabajador'
              : 'Mensajes'
          }
          onBack={() => router.back()}
        />
      }
      footer={
        job ? (
          <View style={styles.bottomComposer}>
            {/* Quick Reply Chips (48dp height & 8dp gap) */}
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.quickChipsRow}>
              {QUICK_REPLIES.map((reply) => (
                <Pressable
                  key={reply}
                  accessibilityRole="button"
                  accessibilityLabel={`Respuesta rápida: ${reply}`}
                  onPress={() => setDraftText(reply)}
                  style={styles.quickChip}>
                  <Text style={styles.quickChipText}>{reply}</Text>
                </Pressable>
              ))}
            </ScrollView>

            {inputError ? (
              <Text style={styles.inputErrorText}>{inputError}</Text>
            ) : null}

            <View style={styles.inputRow}>
              <TextInput
                testID="chat-message-input"
                accessibilityLabel="Escribir mensaje de chat al trabajador"
                placeholder="Escribe un mensaje seguro (máx. 2,000 caracteres)..."
                placeholderTextColor={SaharaColors.onSurfaceVariant}
                value={draftText}
                onChangeText={setDraftText}
                style={styles.chatInput}
              />
              <Pressable
                testID="chat-send-btn"
                accessibilityRole="button"
                accessibilityLabel="Enviar mensaje"
                accessibilityState={{ disabled: isSending }}
                disabled={isSending}
                onPress={() => void handleSendMessage()}
                style={[
                  styles.sendBtnCircle,
                  isSending ? { opacity: 0.5 } : undefined,
                ]}>
                <SaharaIcon
                  name="send"
                  size={17}
                  color={SaharaColors.onPrimary}
                />
              </Pressable>
            </View>
            <Text style={styles.composerCaption}>
              Chat protegido por Solidez MX
            </Text>
          </View>
        ) : undefined
      }>
      {isLoading ? (
        <View style={{ padding: Spacing.md }}>
          <LoadingSkeleton message="Conectando con hilo de chat en tiempo real..." />
        </View>
      ) : errorMsg || !job ? (
        <View style={{ padding: Spacing.md }}>
          <ErrorState
            message={errorMsg ?? 'No se encontró la conversación.'}
            onRetry={() => void loadChat()}
          />
        </View>
      ) : (
        <FlatList
          ref={flatListRef}
          data={messages}
          keyExtractor={(item) => item.id}
          ListHeaderComponent={renderHeaderContext}
          renderItem={({ item: msg }) => {
            const isOwn = msg.sender_id === activeEmployerId;

            return (
              <View
                testID={`chat-bubble-${msg.id}`}
                style={[
                  styles.messageWrapper,
                  isOwn
                    ? styles.messageWrapperOwn
                    : styles.messageWrapperOther,
                ]}>
                {!isOwn ? (
                  <Text style={styles.senderNameLabel}>
                    {job.selected_worker_name ?? 'Trabajador'}
                  </Text>
                ) : null}

                <View
                  style={[
                    styles.bubble,
                    isOwn ? styles.bubbleOwn : styles.bubbleOther,
                  ]}>
                  <Text
                    style={[
                      styles.bubbleBodyText,
                      isOwn
                        ? styles.bubbleBodyTextOwn
                        : styles.bubbleBodyTextOther,
                    ]}>
                    {msg.body}
                  </Text>

                  <View style={styles.bubbleFooterRow}>
                    {!isOwn ? (
                      <Pressable
                        testID={`report-msg-btn-${msg.id}`}
                        accessibilityRole="button"
                        accessibilityLabel={`Reportar mensaje de ${job.selected_worker_name ?? 'trabajador'}`}
                        onPress={() => setReportTargetMsg(msg)}
                        style={styles.reportBtn}>
                        <SaharaIcon
                          name="flag"
                          size={12}
                          color={SaharaColors.error}
                        />
                        <Text style={styles.reportBtnText}>Reportar</Text>
                      </Pressable>
                    ) : (
                      <View />
                    )}
                    <Text
                      style={[
                        styles.timestampText,
                        isOwn
                          ? { color: SaharaColors.onPrimary }
                          : undefined,
                      ]}>
                      {new Date(msg.created_at).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </Text>
                  </View>
                </View>
              </View>
            );
          }}
          ListEmptyComponent={
            <EmptyState
              icon="chat"
              title="Inicia la conversación con el trabajador"
              description="Coordina detalles de llegada, estacionamiento o acceso para el turno asignado."
            />
          }
          contentContainerStyle={styles.flatListContent}
          showsVerticalScrollIndicator={false}
        />
      )}

      {/* Report Message Modal (RF-29 Compliance -> creates case_type = 'report') */}
      <Modal
        visible={reportTargetMsg !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setReportTargetMsg(null)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <SaharaIcon name="flag" size={20} color={SaharaColors.error} />
              <Text style={styles.modalTitle}>Reportar mensaje o conducta</Text>
            </View>
            <Text style={styles.modalSub}>
              Solidez MX no permite pedir pagos fuera de la app ni lenguaje
              ofensivo. Enviaremos tu reporte al equipo de revisión.
            </Text>

            {reportTargetMsg ? (
              <View style={styles.previewQuoteBox}>
                <Text style={styles.previewQuoteText} numberOfLines={2}>
                  “{reportTargetMsg.body}”
                </Text>
              </View>
            ) : null}

            <View
              accessibilityRole="radiogroup"
              accessibilityLabel="Selecciona el motivo del reporte"
              style={{ gap: 8 }}>
              <Text style={styles.reasonLabel}>MOTIVO DEL REPORTE</Text>
              {REPORT_REASONS.map((reason) => {
                const selected = selectedReportReason === reason;
                return (
                  <Pressable
                    key={reason}
                    accessibilityRole="radio"
                    accessibilityLabel={reason}
                    accessibilityState={{ checked: selected }}
                    onPress={() => setSelectedReportReason(reason)}
                    style={[
                      styles.reasonOption,
                      selected ? styles.reasonOptionActive : undefined,
                    ]}>
                    <Text
                      style={[
                        styles.reasonOptionText,
                        selected ? { fontWeight: '700' } : undefined,
                      ]}>
                      {selected ? '[OK] ' : ''}
                      {reason}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            <View style={{ flexDirection: 'row', gap: 10 }}>
              <View style={{ flex: 1 }}>
                <SaharaButton
                  label="Cancelar"
                  variant="outline"
                  onPress={() => setReportTargetMsg(null)}
                />
              </View>
              <View style={{ flex: 1.2 }}>
                <SaharaButton
                  testID="confirm-report-msg-btn"
                  label="Enviar Reporte"
                  variant="danger"
                  loading={isReporting}
                  onPress={() => void handleReportMessage()}
                />
              </View>
            </View>
          </View>
        </View>
      </Modal>
    </SaharaScreenShell>
  );
}

const styles = StyleSheet.create({
  flatListContent: {
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.md,
    paddingBottom: 24,
    gap: 12,
  },
  jobContextCard: {
    paddingVertical: 12,
  },
  jobContextTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  jobFolioText: {
    fontFamily: Fonts.label,
    fontSize: 10.5,
    fontWeight: '700',
    color: SaharaColors.primaryAccessible,
  },
  jobTitleText: {
    fontFamily: Fonts.label,
    fontSize: 13.5,
    fontWeight: '700',
    color: SaharaColors.onSurface,
  },
  jobAmountPill: {
    fontFamily: Fonts.label,
    fontSize: 12,
    fontWeight: '700',
    color: SaharaColors.onSurface,
  },
  shieldNoticeRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  shieldTitle: {
    fontFamily: Fonts.label,
    fontSize: 12,
    fontWeight: '700',
    color: SaharaColors.onSurface,
  },
  shieldBody: {
    fontFamily: Fonts.body,
    fontSize: 11.5,
    color: SaharaColors.onSurfaceVariant,
    lineHeight: 16,
  },
  toastText: {
    fontFamily: Fonts.label,
    fontSize: 12,
    fontWeight: '700',
    color: SaharaColors.onPrimaryFixed,
    textAlign: 'center',
  },
  messageWrapper: {
    maxWidth: '84%',
    gap: 3,
  },
  messageWrapperOwn: {
    alignSelf: 'flex-end',
  },
  messageWrapperOther: {
    alignSelf: 'flex-start',
  },
  senderNameLabel: {
    fontFamily: Fonts.label,
    fontSize: 11,
    fontWeight: '700',
    color: SaharaColors.onSurfaceVariant,
    marginLeft: 4,
  },
  bubble: {
    borderRadius: Radius.xl,
    padding: 12,
    gap: 6,
  },
  bubbleOwn: {
    backgroundColor: SaharaColors.primaryAccessible,
    borderTopRightRadius: 4,
  },
  bubbleOther: {
    backgroundColor: SaharaColors.surfaceContainerLow,
    borderTopLeftRadius: 4,
    borderWidth: 1,
    borderColor: SaharaColors.borderDefault,
  },
  bubbleBodyText: {
    fontFamily: Fonts.body,
    fontSize: 13.5,
    lineHeight: 19,
  },
  bubbleBodyTextOwn: {
    color: SaharaColors.onPrimary,
  },
  bubbleBodyTextOther: {
    color: SaharaColors.onSurface,
  },
  bubbleFooterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  reportBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 44,
    paddingHorizontal: 8,
    paddingVertical: 6,
    gap: 4,
  },
  reportBtnText: {
    fontFamily: Fonts.label,
    fontSize: 11,
    fontWeight: '700',
    color: SaharaColors.error,
  },
  timestampText: {
    fontFamily: Fonts.label,
    fontSize: 10.5,
    color: SaharaColors.onSurfaceVariant,
  },
  bottomComposer: {
    backgroundColor: SaharaColors.surface,
    borderTopWidth: 1,
    borderTopColor: SaharaColors.borderDefault,
    paddingHorizontal: Spacing.md,
    paddingVertical: 10,
    gap: 8,
  },
  quickChipsRow: {
    gap: 8,
    paddingVertical: 2,
  },
  quickChip: {
    minHeight: 48,
    backgroundColor: SaharaColors.surfaceContainerHigh,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: Radius.full,
    justifyContent: 'center',
  },
  quickChipText: {
    fontFamily: Fonts.label,
    fontSize: 12,
    color: SaharaColors.onSurface,
  },
  inputErrorText: {
    fontFamily: Fonts.label,
    fontSize: 11.5,
    color: SaharaColors.error,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: SaharaColors.surfaceContainerLowest,
    borderRadius: Radius.full,
    paddingLeft: 14,
    paddingRight: 6,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: SaharaColors.outlineVariant,
  },
  chatInput: {
    flex: 1,
    minHeight: 48,
    fontFamily: Fonts.body,
    fontSize: 13.5,
    color: SaharaColors.onSurface,
    paddingVertical: 8,
  },
  sendBtnCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: SaharaColors.primaryAccessible,
    alignItems: 'center',
    justifyContent: 'center',
  },
  composerCaption: {
    fontFamily: Fonts.label,
    fontSize: 10.5,
    color: SaharaColors.onSurfaceVariant,
    textAlign: 'center',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: SaharaColors.backdropOverlay,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.md,
  },
  modalCard: {
    width: '100%',
    maxWidth: 400,
    backgroundColor: SaharaColors.surfaceContainerLowest,
    borderRadius: Radius.xl,
    padding: Spacing.lg,
    gap: 12,
  },
  modalTitle: {
    fontFamily: Fonts.headline,
    fontSize: 19,
    fontWeight: '700',
    color: SaharaColors.onSurface,
  },
  modalSub: {
    fontFamily: Fonts.body,
    fontSize: 12.5,
    color: SaharaColors.onSurfaceVariant,
    lineHeight: 18,
  },
  previewQuoteBox: {
    backgroundColor: SaharaColors.surfaceContainer,
    padding: 10,
    borderRadius: Radius.md,
  },
  previewQuoteText: {
    fontFamily: Fonts.body,
    fontSize: 12,
    fontStyle: 'italic',
    color: SaharaColors.onSurface,
  },
  reasonLabel: {
    fontFamily: Fonts.label,
    fontSize: 10.5,
    fontWeight: '700',
    color: SaharaColors.secondary,
  },
  reasonOption: {
    minHeight: 48,
    justifyContent: 'center',
    backgroundColor: SaharaColors.surfaceContainerLow,
    padding: 12,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: SaharaColors.borderSubtle,
  },
  reasonOptionActive: {
    borderColor: SaharaColors.primaryAccessible,
    backgroundColor: SaharaColors.primaryFixed,
  },
  reasonOptionText: {
    fontFamily: Fonts.body,
    fontSize: 12.5,
    color: SaharaColors.onSurface,
  },
});

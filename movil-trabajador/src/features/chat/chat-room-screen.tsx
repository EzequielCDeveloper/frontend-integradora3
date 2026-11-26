/**
 * MÓDULO 10B: PANTALLA DE CONVERSACIÓN CON EMPLEADOR
 * - Solo entre trabajador y empleador seleccionado
 * - Sin archivos adjuntos (mensajes de texto únicamente)
 * - Orden cronológico y reporte individual de mensajes
 */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Fonts, Radius, SaharaColors, Spacing } from '@/constants/theme';
import {
  EmptyState,
  FeedbackBanner,
  ReportContentModal,
  SaharaHeader,
  SaharaIcon,
  SaharaScreenShell,
} from '@/components/ui';
import { useWorkerStore, workerStore } from '@/services/worker-store';
import { mapDomainErrorToMessage } from '@/shared/utils/error-mapper';
import { formatSpanishDateTime } from '@/shared/utils/formatters';
import type { ChatMessage } from '@/types/database';

export function ChatRoomScreen() {
  const router = useRouter();
  const { jobId } = useLocalSearchParams<{ jobId: string }>();
  const version = useWorkerStore((s) => s.version);
  const activeWorkerId = useWorkerStore((s) => s.activeWorkerId);

  const [draft, setDraft] = useState('');
  const [feedback, setFeedback] = useState<{
    tone: 'success' | 'error';
    text: string;
  } | null>(null);
  const [reportMsg, setReportMsg] = useState<ChatMessage | null>(null);
  const scrollRef = useRef<React.ComponentRef<typeof ScrollView>>(null);

  const thread = useMemo(() => {
    void version;
    return jobId ? workerStore.getChatThread(jobId) : null;
  }, [jobId, version]);

  useEffect(() => {
    if (jobId && thread && thread.unread_count > 0) {
      workerStore.markThreadRead(jobId);
    }
  }, [jobId, thread]);

  if (!thread) {
    return (
      <SaharaScreenShell
        header={<SaharaHeader title="Chat" onBack={() => router.back()} />}>
        <EmptyState
          icon="chat"
          title="Conversación no disponible"
          description="Solo puedes chatear con empleadores en trabajos donde hayas sido seleccionado."
          actionLabel="Volver a Chat"
          onAction={() => router.replace('/(main)/chat' as never)}
        />
      </SaharaScreenShell>
    );
  }

  const handleSend = () => {
    setFeedback(null);
    try {
      workerStore.sendChatMessage(thread.job_id, draft);
      setDraft('');
      setTimeout(() => {
        scrollRef.current?.scrollToEnd({ animated: true });
      }, 60);
    } catch (err) {
      setFeedback({ tone: 'error', text: mapDomainErrorToMessage(err) });
    }
  };

  const handleReportMessage = (reason: string) => {
    if (!reportMsg) return;
    try {
      workerStore.createCase({
        case_type: 'report',
        target_type: 'chat_message',
        target_id: reportMsg.id,
        job_id: thread.job_id,
        reported_user_id: reportMsg.sender_id,
        description: reason,
      });
      setFeedback({
        tone: 'success',
        text: 'El mensaje fue reportado al equipo de moderación.',
      });
    } catch (err) {
      setFeedback({ tone: 'error', text: mapDomainErrorToMessage(err) });
    }
  };

  return (
    <SaharaScreenShell
      scrollable={false}
      header={
        <SaharaHeader
          title={thread.employer_name}
          subtitle={thread.job_title}
          onBack={() => router.back()}
          rightAction={
            <Pressable
              onPress={() => router.push(`/(main)/job/${thread.job_id}` as never)}
              style={styles.jobLinkBtn}>
              <Text style={styles.jobLinkText}>Ver trabajo</Text>
            </Pressable>
          }
        />
      }
      footer={
        <View style={styles.composerBar}>
          <TextInput
            value={draft}
            onChangeText={setDraft}
            placeholder="Escribe un mensaje de texto..."
            placeholderTextColor={SaharaColors.onSurfaceVariant}
            multiline
            maxLength={2000}
            style={styles.composerInput}
          />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Enviar mensaje"
            disabled={!draft.trim()}
            onPress={handleSend}
            style={[
              styles.sendBtn,
              !draft.trim() ? { opacity: 0.45 } : undefined,
            ]}>
            <SaharaIcon name="send" size={16} color={SaharaColors.onPrimary} />
          </Pressable>
        </View>
      }>
      <View style={styles.rulesBanner}>
        <SaharaIcon name="info" size={13} color={SaharaColors.secondary} />
        <Text style={styles.rulesText}>
          Solo mensajes de texto para coordinar tu trabajo. No se permiten archivos adjuntos.
        </Text>
      </View>

      {feedback ? (
        <View style={{ paddingHorizontal: Spacing.md, paddingTop: 8 }}>
          <FeedbackBanner
            tone={feedback.tone}
            message={feedback.text}
            onDismiss={() => setFeedback(null)}
          />
        </View>
      ) : null}

      <ScrollView
        ref={scrollRef}
        style={{ flex: 1 }}
        contentContainerStyle={styles.messagesContainer}
        onContentSizeChange={() =>
          scrollRef.current?.scrollToEnd({ animated: false })
        }>
        {thread.messages.length === 0 ? (
          <EmptyState
            icon="chat"
            title="Inicia la conversación"
            description="Envía un mensaje para coordinar tu horario de llegada o detalles del trabajo."
          />
        ) : (
          thread.messages.map((msg) => {
            const isMine = msg.sender_id === activeWorkerId;
            return (
              <View
                key={msg.id}
                style={[
                  styles.bubbleWrap,
                  isMine ? styles.bubbleWrapMine : styles.bubbleWrapOther,
                ]}>
                <View
                  style={[
                    styles.bubble,
                    isMine ? styles.bubbleMine : styles.bubbleOther,
                  ]}>
                  <Text
                    style={[
                      styles.bubbleText,
                      isMine ? styles.bubbleTextMine : undefined,
                    ]}>
                    {msg.body}
                  </Text>
                </View>
                <View style={styles.bubbleMetaRow}>
                  <Text style={styles.bubbleTime}>
                    {formatSpanishDateTime(msg.created_at)}
                  </Text>
                  {!isMine ? (
                    <Pressable onPress={() => setReportMsg(msg)}>
                      <Text style={styles.reportLink}>Reportar</Text>
                    </Pressable>
                  ) : null}
                </View>
              </View>
            );
          })
        )}
      </ScrollView>

      {reportMsg ? (
        <ReportContentModal
          visible={Boolean(reportMsg)}
          targetType="chat_message"
          targetLabel={reportMsg.body.slice(0, 60)}
          onClose={() => setReportMsg(null)}
          onSubmit={handleReportMessage}
        />
      ) : null}
    </SaharaScreenShell>
  );
}

const styles = StyleSheet.create({
  jobLinkBtn: {
    backgroundColor: SaharaColors.primaryFixed,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: Radius.full,
  },
  jobLinkText: {
    fontFamily: Fonts.label,
    fontSize: 11.5,
    fontWeight: '700',
    color: SaharaColors.onPrimaryFixed,
  },
  rulesBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: SaharaColors.surfaceContainerLow,
    paddingHorizontal: Spacing.md,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: SaharaColors.borderSubtle,
  },
  rulesText: {
    flex: 1,
    fontFamily: Fonts.body,
    fontSize: 11.5,
    color: SaharaColors.onSurfaceVariant,
  },
  messagesContainer: {
    padding: Spacing.md,
    gap: 12,
    paddingBottom: 24,
  },
  bubbleWrap: {
    maxWidth: '84%',
    gap: 4,
  },
  bubbleWrapMine: {
    alignSelf: 'flex-end',
    alignItems: 'flex-end',
  },
  bubbleWrapOther: {
    alignSelf: 'flex-start',
    alignItems: 'flex-start',
  },
  bubble: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: Radius.xl,
  },
  bubbleMine: {
    backgroundColor: SaharaColors.primaryAccessible,
    borderBottomRightRadius: Radius.xs,
  },
  bubbleOther: {
    backgroundColor: SaharaColors.surfaceContainerLowest,
    borderWidth: 1,
    borderColor: SaharaColors.borderSubtle,
    borderBottomLeftRadius: Radius.xs,
  },
  bubbleText: {
    fontFamily: Fonts.body,
    fontSize: 13.5,
    color: SaharaColors.onSurface,
    lineHeight: 19,
  },
  bubbleTextMine: {
    color: SaharaColors.onPrimary,
  },
  bubbleMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  bubbleTime: {
    fontFamily: Fonts.body,
    fontSize: 10.5,
    color: SaharaColors.secondary,
  },
  reportLink: {
    fontFamily: Fonts.label,
    fontSize: 11,
    fontWeight: '700',
    color: SaharaColors.tertiary,
  },
  composerBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
    paddingHorizontal: Spacing.md,
    paddingVertical: 10,
    backgroundColor: SaharaColors.surface,
    borderTopWidth: 1,
    borderTopColor: SaharaColors.borderDefault,
  },
  composerInput: {
    flex: 1,
    minHeight: 46,
    maxHeight: 110,
    backgroundColor: SaharaColors.surfaceContainerLowest,
    borderWidth: 1,
    borderColor: SaharaColors.outlineVariant,
    borderRadius: Radius.xl,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontFamily: Fonts.body,
    fontSize: 14,
    color: SaharaColors.onSurface,
  },
  sendBtn: {
    width: 46,
    height: 46,
    borderRadius: Radius.full,
    backgroundColor: SaharaColors.primaryAccessible,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

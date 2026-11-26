/**
 * MÓDULO 10A: LISTA DE CONVERSACIONES CON EMPLEADORES
 * Exclusivamente para trabajos donde el trabajador ha sido seleccionado.
 */
import React, { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Fonts, Radius, SaharaColors } from '@/constants/theme';
import {
  AvatarBadge,
  EmptyState,
  JobStatusBadge,
  SaharaCard,
  SaharaHeader,
  SaharaScreenShell,
  WorkerBottomNav,
} from '@/components/ui';
import { useWorkerStore, workerStore } from '@/services/worker-store';
import { formatSpanishDateTime } from '@/shared/utils/formatters';

export function ChatListScreen() {
  const router = useRouter();
  const version = useWorkerStore((s) => s.version);

  const threads = useMemo(() => {
    void version;
    return workerStore.listChatThreads();
  }, [version]);

  return (
    <SaharaScreenShell
      header={
        <SaharaHeader
          title="Chat"
          subtitle="Mensajería con empleadores"
          badgeText={`${threads.length} activas`}
        />
      }
      footer={<WorkerBottomNav />}>
      {threads.length === 0 ? (
        <EmptyState
          icon="chat"
          title="Sin conversaciones disponibles"
          description="El chat se habilita automáticamente cuando un empleador te selecciona para un trabajo."
          actionLabel="Explorar trabajos"
          onAction={() => router.push('/(main)/explore' as never)}
        />
      ) : (
        <View style={{ gap: 10 }}>
          {threads.map((thread) => (
            <SaharaCard
              key={thread.job_id}
              variant="lowest"
              accentColor={
                thread.unread_count > 0
                  ? SaharaColors.primaryAccessible
                  : undefined
              }
              onPress={() =>
                router.push(`/(main)/chat/${thread.job_id}` as never)
              }
              style={styles.threadCard}>
              <View style={styles.row}>
                <AvatarBadge
                  initials={thread.employer_initials}
                  tone={thread.employer_tone}
                  size={48}
                />
                <View style={{ flex: 1, gap: 3 }}>
                  <View style={styles.topLine}>
                    <Text style={styles.employerName} numberOfLines={1}>
                      {thread.employer_name}
                    </Text>
                    {thread.unread_count > 0 ? (
                      <View style={styles.unreadBadge}>
                        <Text style={styles.unreadText}>
                          {thread.unread_count} nuevo
                          {thread.unread_count > 1 ? 's' : ''}
                        </Text>
                      </View>
                    ) : null}
                  </View>

                  <Text style={styles.jobTitle} numberOfLines={1}>
                    {thread.job_title}
                  </Text>

                  <Text
                    style={[
                      styles.lastMsg,
                      thread.unread_count > 0 ? styles.lastMsgUnread : undefined,
                    ]}
                    numberOfLines={2}>
                    {thread.last_message}
                  </Text>

                  <View style={styles.bottomLine}>
                    <JobStatusBadge status={thread.job_status} />
                    <Text style={styles.timeText}>
                      {formatSpanishDateTime(thread.last_message_at)}
                    </Text>
                  </View>
                </View>
              </View>
            </SaharaCard>
          ))}
        </View>
      )}
    </SaharaScreenShell>
  );
}

const styles = StyleSheet.create({
  threadCard: {
    gap: 8,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  topLine: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  employerName: {
    flex: 1,
    fontFamily: Fonts.headline,
    fontSize: 17,
    fontWeight: '600',
    color: SaharaColors.onSurface,
  },
  unreadBadge: {
    backgroundColor: SaharaColors.primaryAccessible,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: Radius.full,
  },
  unreadText: {
    fontFamily: Fonts.label,
    fontSize: 10.5,
    fontWeight: '700',
    color: SaharaColors.onPrimary,
  },
  jobTitle: {
    fontFamily: Fonts.label,
    fontSize: 12,
    fontWeight: '700',
    color: SaharaColors.primaryAccessible,
  },
  lastMsg: {
    fontFamily: Fonts.body,
    fontSize: 13,
    color: SaharaColors.onSurfaceVariant,
    lineHeight: 18,
  },
  lastMsgUnread: {
    color: SaharaColors.onSurface,
    fontWeight: '600',
  },
  bottomLine: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 4,
    gap: 8,
    flexWrap: 'wrap',
  },
  timeText: {
    fontFamily: Fonts.body,
    fontSize: 11,
    color: SaharaColors.secondary,
  },
});

/**
 * MÓDULO 12: BANDEJA DE NOTIFICACIONES
 * - Icono, título, descripción, fecha/hora, estado de lectura y navegación a la pantalla correspondiente
 * - Sin datos personales ni financieros sensibles
 */
import React, { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Fonts, Radius, SaharaColors } from '@/constants/theme';
import {
  EmptyState,
  FilterPill,
  SaharaCard,
  SaharaHeader,
  SaharaIcon,
  SaharaScreenShell,
  WorkerBottomNav,
} from '@/components/ui';
import { useWorkerStore, workerStore } from '@/services/worker-store';
import { formatSpanishDateTime } from '@/shared/utils/formatters';
import type { NotificationCategory } from '@/types/database';

const CATEGORY_ICON: Record<NotificationCategory, string> = {
  postulaciones: 'assignment',
  trabajos: 'work',
  mensajes: 'chat',
  pagos: 'payments',
  casos: 'gavel',
  cuenta: 'verified_user',
};

export function NotificationsScreen() {
  const router = useRouter();
  const version = useWorkerStore((s) => s.version);
  const [onlyUnread, setOnlyUnread] = useState(false);

  const notifications = useMemo(() => {
    void version;
    return workerStore.listNotifications();
  }, [version]);

  const unreadCount = notifications.filter((n) => !n.read_at).length;
  const visibleList = onlyUnread
    ? notifications.filter((n) => !n.read_at)
    : notifications;

  return (
    <SaharaScreenShell
      header={
        <SaharaHeader
          title="Notificaciones"
          subtitle="Actividad de tu cuenta"
          onBack={() => router.back()}
          rightAction={
            unreadCount > 0 ? (
              <Pressable
                onPress={() => workerStore.markAllNotificationsRead()}
                style={styles.markAllBtn}>
                <Text style={styles.markAllText}>Marcar leídas</Text>
              </Pressable>
            ) : undefined
          }
        />
      }
      footer={<WorkerBottomNav />}>
      <View style={styles.filterRow}>
        <FilterPill
          label="Todas"
          count={notifications.length}
          active={!onlyUnread}
          onPress={() => setOnlyUnread(false)}
        />
        <FilterPill
          label="Sin leer"
          count={unreadCount}
          active={onlyUnread}
          onPress={() => setOnlyUnread(true)}
        />
      </View>

      {visibleList.length === 0 ? (
        <EmptyState
          icon="notifications"
          title="Sin notificaciones pendientes"
          description="Te avisaremos aquí sobre tus postulaciones, trabajos asignados, mensajes, pagos y casos."
        />
      ) : (
        <View style={{ gap: 10 }}>
          {visibleList.map((notif) => {
            const isUnread = !notif.read_at;
            return (
              <SaharaCard
                key={notif.id}
                variant={isUnread ? 'lowest' : 'low'}
                accentColor={
                  isUnread ? SaharaColors.primaryAccessible : undefined
                }
                onPress={() => {
                  workerStore.markNotificationRead(notif.id);
                  if (notif.target_route) {
                    router.push(notif.target_route as never);
                  }
                }}
                style={styles.notifCard}>
                <View style={styles.row}>
                  <View
                    style={[
                      styles.iconCircle,
                      isUnread ? styles.iconCircleUnread : undefined,
                    ]}>
                    <SaharaIcon
                      name={CATEGORY_ICON[notif.category]}
                      size={16}
                      color={
                        isUnread
                          ? SaharaColors.onPrimary
                          : SaharaColors.onPrimaryFixedVariant
                      }
                    />
                  </View>
                  <View style={{ flex: 1, gap: 4 }}>
                    <View style={styles.titleRow}>
                      <Text style={styles.title}>{notif.title}</Text>
                      {isUnread ? <View style={styles.unreadDot} /> : null}
                    </View>
                    <Text style={styles.body}>{notif.body}</Text>
                    <Text style={styles.time}>
                      {formatSpanishDateTime(notif.created_at)}
                    </Text>
                  </View>
                </View>
              </SaharaCard>
            );
          })}
        </View>
      )}
    </SaharaScreenShell>
  );
}

const styles = StyleSheet.create({
  markAllBtn: {
    backgroundColor: SaharaColors.primaryFixed,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: Radius.full,
  },
  markAllText: {
    fontFamily: Fonts.label,
    fontSize: 11.5,
    fontWeight: '700',
    color: SaharaColors.onPrimaryFixed,
  },
  filterRow: {
    flexDirection: 'row',
    gap: 8,
  },
  notifCard: {
    gap: 6,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  iconCircle: {
    width: 40,
    height: 40,
    borderRadius: Radius.full,
    backgroundColor: SaharaColors.primaryFixed,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconCircleUnread: {
    backgroundColor: SaharaColors.primaryAccessible,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  title: {
    flex: 1,
    fontFamily: Fonts.label,
    fontSize: 13.5,
    fontWeight: '700',
    color: SaharaColors.onSurface,
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: SaharaColors.primaryAccessible,
  },
  body: {
    fontFamily: Fonts.body,
    fontSize: 12.5,
    color: SaharaColors.onSurfaceVariant,
    lineHeight: 18,
  },
  time: {
    fontFamily: Fonts.body,
    fontSize: 11,
    color: SaharaColors.secondary,
  },
});

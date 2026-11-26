/**
 * UI-EMP-NOTIF: Vista de Notificaciones y Alertas del Empleador
 * Source of Truth: Especificacion_de_Arquitectura_de_Software_v2.md (Hito 4, RF-32)
 * Visual reference: mocks/movil-trabajador/ui_trab_14_notificaciones_y_alertas
 * Rules enforced:
 * - Lists system notifications with read/unread indicator (`read_at`) via FlatList
 * - Category filter (`all`, `asignaciones`, `pagos`, `casos`) with 48dp touch targets
 * - Mark individual or all notifications as read
 * - Device push token registration toggle (`device_tokens`)
 * - Deep-link navigation to the corresponding job, checkout, completion, or case screen (`target_screen` + `target_id`) via single dedicated CTA
 */
import React, { useCallback, useMemo, useState } from 'react';
import {
  FlatList,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
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
  formatSpanishDate,
  NOTIFICATION_TARGET_LABELS,
} from '@/shared/utils/formatters';
import type { DeviceToken, Notification } from '@/types/database';

type NotifCategory = 'all' | 'asignaciones' | 'pagos' | 'casos';

export function NotificationsScreenView() {
  const router = useRouter();
  const storeVersion = useMockBackendStore((s) => s.version);

  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [deviceToken, setDeviceToken] = useState<DeviceToken | null>(null);
  const [selectedCat, setSelectedCat] = useState<NotifCategory>('all');
  const [isLoading, setIsLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const loadNotifications = useCallback(async () => {
    setIsLoading(true);
    setErrorMsg(null);
    try {
      const [list, token] = await Promise.all([
        employerRepository.listNotifications(),
        employerRepository.getDeviceToken(),
      ]);
      setNotifications(list);
      setDeviceToken(token);
    } catch (err) {
      const mapped = mapDomainErrorToUI(err);
      setErrorMsg(mapped.message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useAsyncLoad(loadNotifications, storeVersion);

  const filteredNotifs = useMemo(() => {
    if (selectedCat === 'all') return notifications;
    return notifications.filter((n) => n.category === selectedCat);
  }, [notifications, selectedCat]);

  const unreadCount = useMemo(
    () => notifications.filter((n) => !n.read_at).length,
    [notifications],
  );

  const { execute: handleMarkAllRead, isPending: isMarkingAll } =
    useIdempotentAction(async () => {
      try {
        await employerRepository.markAllNotificationsAsRead();
      } catch (err) {
        const mapped = mapDomainErrorToUI(err);
        setErrorMsg(mapped.message);
      }
    });

  const { execute: handleTogglePush, isPending: isTogglingPush } =
    useIdempotentAction(async () => {
      try {
        const nextToken = await employerRepository.togglePushNotifications(
          deviceToken === null,
        );
        setDeviceToken(nextToken);
      } catch (err) {
        const mapped = mapDomainErrorToUI(err);
        setErrorMsg(mapped.message);
      }
    });

  const handleOpenDeepLink = async (notif: Notification) => {
    if (!notif.read_at) {
      await employerRepository.markNotificationAsRead(notif.id);
    }

    const targetId = notif.target_id;
    switch (notif.target_screen) {
      case 'UI-EMP-04':
        if (targetId) router.push(`/(main)/job/${targetId}` as never);
        break;
      case 'UI-EMP-06':
        if (targetId) router.push(`/(main)/job/${targetId}/assigned` as never);
        break;
      case 'UI-EMP-07':
        if (targetId) router.push(`/(main)/job/${targetId}/checkout` as never);
        break;
      case 'UI-EMP-08':
        if (targetId) router.push(`/(main)/job/${targetId}/chat` as never);
        break;
      case 'UI-EMP-09':
        if (targetId)
          router.push(`/(main)/job/${targetId}/completion` as never);
        break;
      case 'UI-EMP-11':
        if (targetId) router.push(`/(main)/job/${targetId}/review` as never);
        break;
      case 'UI-EMP-12':
        router.push('/(main)/payment-history');
        break;
      case 'UI-EMP-14':
        router.push('/(main)/cases');
        break;
      default:
        router.push('/(main)/feed');
        break;
    }
  };

  const renderHeader = () => (
    <View style={{ gap: Spacing.md }}>
      {/* Subtitle & Mark All as Read */}
      <View style={styles.topRow}>
        <View>
          <Text style={styles.superText}>NOTIFICACIONES</Text>
          <Text style={styles.headingText}>Tus Avisos</Text>
        </View>
        <SaharaButton
          testID="mark-all-read-btn"
          label={unreadCount > 0 ? `Marcar leídas (${unreadCount})` : 'Al día'}
          icon="done_all"
          size="sm"
          variant={unreadCount > 0 ? 'primary' : 'secondary'}
          fullWidth={false}
          disabled={unreadCount === 0}
          loading={isMarkingAll}
          onPress={() => void handleMarkAllRead()}
        />
      </View>

      {/* Device Push Token Status Card (`device_tokens`) */}
      <SaharaCard variant="low" style={styles.pushCardRow}>
        <View style={styles.pushIconCircle}>
          <SaharaIcon
            name="notifications_active"
            size={18}
            color={SaharaColors.primary}
          />
        </View>
        <View style={{ flex: 1 }}>
          <View style={styles.pushTitleRow}>
            <Text style={styles.pushTitle}>
              Avisos en este celular
            </Text>
            <View style={styles.platformBadge}>
              <Text style={styles.platformBadgeText}>
                {deviceToken ? 'Activados' : 'Pausados'}
              </Text>
            </View>
          </View>
          <Text style={styles.tokenText} numberOfLines={1}>
            {deviceToken
              ? 'Recibirás avisos inmediatos en tu celular'
              : 'No recibirás avisos hasta activarlos'}
          </Text>
        </View>
        <SaharaButton
          testID="toggle-push-token-btn"
          label={deviceToken ? 'Pausar' : 'Activar'}
          size="sm"
          variant="outline"
          fullWidth={false}
          loading={isTogglingPush}
          onPress={() => void handleTogglePush()}
        />
      </SaharaCard>

      {/* Category Filter Chips (48dp touch targets + tab semantics) */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        accessibilityRole="tablist"
        contentContainerStyle={styles.filterRow}>
        {(
          [
            { key: 'all', label: 'Todas' },
            { key: 'asignaciones', label: 'Asignaciones' },
            { key: 'pagos', label: 'Pagos' },
            { key: 'casos', label: 'Casos' },
          ] as const
        ).map((tab) => {
          const active = selectedCat === tab.key;
          const count =
            tab.key === 'all'
              ? notifications.length
              : notifications.filter((n) => n.category === tab.key).length;

          return (
            <Pressable
              key={tab.key}
              testID={`notif-filter-${tab.key}`}
              accessibilityRole="tab"
              accessibilityLabel={`Filtrar notificaciones por ${tab.label}, ${count} avisos`}
              accessibilityState={{ selected: active }}
              onPress={() => setSelectedCat(tab.key)}
              style={[
                styles.filterChip,
                active ? styles.filterChipActive : undefined,
              ]}>
              <Text
                style={[
                  styles.filterChipText,
                  active ? styles.filterChipTextActive : undefined,
                ]}>
                {tab.label} ({count})
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );

  const renderNotifItem = ({ item: n }: { item: Notification }) => {
    const isUnread = !n.read_at;
    const iconName =
      n.category === 'pagos'
        ? 'account_balance_wallet'
        : n.category === 'casos'
          ? 'gavel'
          : 'work';

    return (
      <SaharaCard
        testID={`notif-card-${n.id}`}
        variant={isUnread ? 'lowest' : 'low'}
        accentColor={isUnread ? SaharaColors.primary : undefined}
        style={{ gap: 10 }}>
        <View style={styles.notifTopRow}>
          <View
            style={[
              styles.notifIconCircle,
              isUnread
                ? { backgroundColor: SaharaColors.primaryFixed }
                : { backgroundColor: SaharaColors.surfaceContainerHigh },
            ]}>
            <SaharaIcon
              name={iconName}
              size={18}
              color={
                isUnread
                  ? SaharaColors.primary
                  : SaharaColors.onSurfaceVariant
              }
            />
          </View>
          <View style={{ flex: 1, gap: 2 }}>
            <View style={styles.notifMetaRow}>
              <Text style={styles.notifCategoryLabel}>
                {n.category.toUpperCase()} · {formatSpanishDate(n.created_at)}
              </Text>
              {isUnread ? (
                <View style={styles.unreadPill}>
                  <Text style={styles.unreadPillText}>NUEVA</Text>
                </View>
              ) : null}
            </View>
            <Text style={styles.notifTitle}>{n.title}</Text>
            <Text style={styles.notifBody}>{n.body}</Text>
          </View>
        </View>

        <View style={styles.notifActionRow}>
          <Text style={styles.deepLinkHint}>
            {NOTIFICATION_TARGET_LABELS[n.target_screen ?? ''] ?? 'Mis Trabajos'}
          </Text>
          <SaharaButton
            testID={`notif-deeplink-btn-${n.id}`}
            label="Abrir"
            trailingIcon="arrow_forward"
            size="sm"
            fullWidth={false}
            onPress={() => void handleOpenDeepLink(n)}
          />
        </View>
      </SaharaCard>
    );
  };

  return (
    <SaharaScreenShell
      scrollable={false}
      header={
        <SaharaHeader
          title="Avisos"
          subtitle="Tus avisos"
          onBack={() => router.back()}
        />
      }>
      <FlatList
        data={isLoading || errorMsg ? [] : filteredNotifs}
        keyExtractor={(item) => item.id}
        renderItem={renderNotifItem}
        ListHeaderComponent={renderHeader}
        ListEmptyComponent={
          isLoading ? (
            <LoadingSkeleton message="Sincronizando bandeja de avisos del sistema..." />
          ) : errorMsg ? (
            <ErrorState
              message={errorMsg}
              onRetry={() => void loadNotifications()}
            />
          ) : (
            <EmptyState
              icon="notifications"
              title="Sin notificaciones en esta categoría"
              description="Te avisaremos en tiempo real sobre postulaciones, llegadas registradas, pagos y respuestas a tus casos."
            />
          )
        }
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
      />
    </SaharaScreenShell>
  );
}

const styles = StyleSheet.create({
  listContent: {
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.xxl,
    gap: Spacing.md,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  superText: {
    fontFamily: Fonts.label,
    fontSize: 10.5,
    fontWeight: '700',
    letterSpacing: 0.9,
    color: SaharaColors.primary,
  },
  headingText: {
    fontFamily: Fonts.headline,
    fontSize: 24,
    fontWeight: '700',
    color: SaharaColors.onSurface,
  },
  pushCardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  pushIconCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: SaharaColors.primaryFixed,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pushTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap',
  },
  pushTitle: {
    fontFamily: Fonts.label,
    fontSize: 12,
    fontWeight: '700',
    color: SaharaColors.onSurface,
  },
  platformBadge: {
    backgroundColor: SaharaColors.surfaceContainerHighest,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: Radius.full,
  },
  platformBadgeText: {
    fontFamily: Fonts.label,
    fontSize: 10,
    fontWeight: '600',
    color: SaharaColors.onSurfaceVariant,
  },
  tokenText: {
    fontFamily: Fonts.mono,
    fontSize: 10.5,
    color: SaharaColors.onSurfaceVariant,
    marginTop: 2,
  },
  filterRow: {
    gap: 8,
    paddingVertical: 4,
  },
  filterChip: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    minHeight: 48,
    minWidth: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: Radius.full,
    backgroundColor: SaharaColors.surfaceContainerHigh,
  },
  filterChipActive: {
    backgroundColor: SaharaColors.primaryAccessible,
  },
  filterChipText: {
    fontFamily: Fonts.label,
    fontSize: 12.5,
    fontWeight: '600',
    color: SaharaColors.onSurfaceVariant,
  },
  filterChipTextActive: {
    color: SaharaColors.onPrimary,
    fontWeight: '700',
  },
  notifTopRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  notifIconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  notifMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  notifCategoryLabel: {
    fontFamily: Fonts.label,
    fontSize: 10.5,
    fontWeight: '700',
    color: SaharaColors.primary,
  },
  unreadPill: {
    backgroundColor: SaharaColors.primaryFixed,
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: Radius.full,
  },
  unreadPillText: {
    fontFamily: Fonts.label,
    fontSize: 9.5,
    fontWeight: '700',
    color: SaharaColors.primary,
  },
  notifTitle: {
    fontFamily: Fonts.headline,
    fontSize: 17,
    fontWeight: '700',
    color: SaharaColors.onSurface,
  },
  notifBody: {
    fontFamily: Fonts.body,
    fontSize: 12.5,
    color: SaharaColors.onSurfaceVariant,
    lineHeight: 18,
  },
  notifActionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: SaharaColors.borderDefault,
  },
  deepLinkHint: {
    fontFamily: Fonts.mono,
    fontSize: 11,
    color: SaharaColors.secondary,
  },
});

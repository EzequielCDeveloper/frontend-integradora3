/**
 * Barra de navegación inferior del trabajador (5 apartados principales)
 * Consistente con la identidad visual Sahara de la app del empleador.
 */
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { usePathname, useRouter } from 'expo-router';
import {
  Fonts,
  Radius,
  SaharaColors,
  SaharaShadows,
} from '@/constants/theme';
import { SaharaIcon } from './sahara-primitives';
import { useWorkerStore } from '@/services/worker-store';

const NAV_ITEMS = [
  {
    key: 'home',
    label: 'Inicio',
    icon: 'home',
    href: '/(main)/home',
    matches: ['/home', '/notifications', '/location', '/applications'],
  },
  {
    key: 'explore',
    label: 'Explorar',
    icon: 'search',
    href: '/(main)/explore',
    matches: ['/explore', '/opportunity'],
  },
  {
    key: 'my-jobs',
    label: 'Mis trabajos',
    icon: 'work',
    href: '/(main)/my-jobs',
    matches: ['/my-jobs', '/job/', '/payments', '/stripe-connect'],
  },
  {
    key: 'chat',
    label: 'Chat',
    icon: 'chat',
    href: '/(main)/chat',
    matches: ['/chat'],
  },
  {
    key: 'profile',
    label: 'Perfil',
    icon: 'person',
    href: '/(main)/profile',
    matches: ['/profile', '/cases'],
  },
] as const;

export function WorkerBottomNav() {
  const router = useRouter();
  const pathname = usePathname();
  const unreadChatCount = useWorkerStore((s) =>
    s.db.chatMessages.filter(
      (m) =>
        m.worker_id === s.activeWorkerId &&
        m.sender_id !== s.activeWorkerId &&
        !m.read_by_worker,
    ).length,
  );

  return (
    <View
      accessibilityRole="tablist"
      style={[styles.navBar, SaharaShadows.soft]}>
      {NAV_ITEMS.map((item) => {
        const isActive = item.matches.some((m) => pathname.includes(m));
        const showBadge = item.key === 'chat' && unreadChatCount > 0;

        return (
          <Pressable
            key={item.key}
            accessibilityRole="tab"
            accessibilityLabel={item.label}
            accessibilityState={{ selected: isActive }}
            onPress={() => router.replace(item.href as never)}
            style={styles.navItem}>
            <View style={styles.iconWrap}>
              <View
                style={[
                  styles.iconPill,
                  isActive ? styles.iconPillActive : undefined,
                ]}>
                <SaharaIcon
                  name={item.icon}
                  size={17}
                  color={
                    isActive
                      ? SaharaColors.onPrimary
                      : SaharaColors.onSurfaceVariant
                  }
                />
              </View>
              {showBadge ? (
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>
                    {unreadChatCount > 9 ? '9+' : unreadChatCount}
                  </Text>
                </View>
              ) : null}
            </View>
            <Text
              maxFontSizeMultiplier={1.25}
              numberOfLines={1}
              style={[
                styles.navLabel,
                isActive ? styles.navLabelActive : undefined,
              ]}>
              {item.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  navBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    minHeight: 68,
    paddingHorizontal: 6,
    paddingVertical: 6,
    gap: 4,
    backgroundColor: SaharaColors.surface,
    borderTopWidth: 1,
    borderTopColor: SaharaColors.borderDefault,
  },
  navItem: {
    flex: 1,
    minHeight: 52,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 4,
  },
  iconWrap: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconPill: {
    width: 36,
    height: 28,
    borderRadius: Radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconPillActive: {
    backgroundColor: SaharaColors.primaryAccessible,
  },
  navLabel: {
    fontFamily: Fonts.label,
    fontSize: 10.5,
    fontWeight: '500',
    color: SaharaColors.onSurfaceVariant,
  },
  navLabelActive: {
    color: SaharaColors.primaryAccessible,
    fontWeight: '700',
  },
  badge: {
    position: 'absolute',
    top: -4,
    right: -6,
    minWidth: 17,
    height: 17,
    borderRadius: Radius.full,
    backgroundColor: SaharaColors.tertiary,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  badgeText: {
    fontFamily: Fonts.label,
    fontSize: 9.5,
    fontWeight: '700',
    color: SaharaColors.onTertiary,
  },
});

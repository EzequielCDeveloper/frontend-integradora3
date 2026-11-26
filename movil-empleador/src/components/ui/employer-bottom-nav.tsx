/**
 * Sahara Employer Bottom Navigation Bar (WCAG 2.2 AA & MD3 48dp Hardened)
 * Provides direct 1-tap navigation across the primary employer modules.
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

const NAV_ITEMS = [
  {
    key: 'feed',
    label: 'Publicaciones',
    icon: 'folder_shared',
    href: '/(main)/feed',
    matches: ['/feed', '/job/'],
  },
  {
    key: 'create',
    label: 'Publicar',
    icon: 'add',
    href: '/(main)/post-job',
    isPrimaryCTA: true,
    matches: ['/post-job'],
  },
  {
    key: 'history',
    label: 'Movimientos',
    icon: 'receipt_long',
    href: '/(main)/payment-history',
    matches: ['/payment-history'],
  },
  {
    key: 'cases',
    label: 'Casos',
    icon: 'gavel',
    href: '/(main)/cases',
    matches: ['/cases'],
  },
  {
    key: 'profile',
    label: 'Perfil',
    icon: 'person',
    href: '/(main)/profile',
    matches: ['/profile'],
  },
] as const;

export function EmployerBottomNav() {
  const router = useRouter();
  const pathname = usePathname();

  return (
    <View
      accessibilityRole="tablist"
      style={[styles.navBar, SaharaShadows.soft]}>
      {NAV_ITEMS.map((item) => {
        const isActive = item.matches.some((m) => pathname.includes(m));
        if ('isPrimaryCTA' in item && item.isPrimaryCTA) {
          return (
            <Pressable
              key={item.key}
              accessibilityRole="tab"
              accessibilityLabel={item.label}
              accessibilityState={{ selected: isActive }}
              onPress={() => router.push(item.href as never)}
              style={styles.navItem}>
              <View style={styles.primaryCircle}>
                <SaharaIcon
                  name={item.icon}
                  size={18}
                  color={SaharaColors.onPrimary}
                />
              </View>
              <Text
                maxFontSizeMultiplier={1.3}
                style={[
                  styles.navLabel,
                  isActive ? styles.navLabelActive : undefined,
                ]}>
                {item.label}
              </Text>
            </Pressable>
          );
        }

        return (
          <Pressable
            key={item.key}
            accessibilityRole="tab"
            accessibilityLabel={item.label}
            accessibilityState={{ selected: isActive }}
            onPress={() => router.push(item.href as never)}
            style={styles.navItem}>
            <SaharaIcon
              name={item.icon}
              size={18}
              color={
                isActive
                  ? SaharaColors.primaryAccessible
                  : SaharaColors.onSurfaceVariant
              }
            />
            <Text
              maxFontSizeMultiplier={1.3}
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
    paddingHorizontal: 8,
    paddingVertical: 6,
    gap: 8,
    backgroundColor: SaharaColors.surface,
    borderTopWidth: 1,
    borderTopColor: SaharaColors.borderDefault,
  },
  navItem: {
    flex: 1,
    minHeight: 52,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
    paddingVertical: 6,
  },
  primaryCircle: {
    width: 34,
    height: 34,
    borderRadius: Radius.full,
    backgroundColor: SaharaColors.primaryAccessible,
    alignItems: 'center',
    justifyContent: 'center',
  },
  navLabel: {
    fontFamily: Fonts.label,
    fontSize: 11,
    fontWeight: '500',
    color: SaharaColors.onSurfaceVariant,
  },
  navLabelActive: {
    color: SaharaColors.primaryAccessible,
    fontWeight: '700',
  },
});

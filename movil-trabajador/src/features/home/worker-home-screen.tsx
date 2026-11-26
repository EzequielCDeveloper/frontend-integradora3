/**
 * MÓDULO 2: PANTALLA PRINCIPAL DEL TRABAJADOR (Inicio)
 * Saludo personalizado, avatar, barra de búsqueda, notificaciones, ubicación y radio actual,
 * categorías, resumen de actividad, accesos rápidos a postulaciones y trabajos activos,
 * trabajos recomendados y trabajos recientes.
 */
import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Fonts, Radius, SaharaColors, Spacing } from '@/constants/theme';
import {
  AvatarBadge,
  EmptyState,
  JobStatusBadge,
  OpportunityCard,
  SaharaCard,
  SaharaIcon,
  SaharaInput,
  SaharaScreenShell,
  SectionHeader,
  WorkerBottomNav,
} from '@/components/ui';
import { useWorkerStore, workerStore } from '@/services/worker-store';
import {
  formatCurrencyMXN,
  formatSpanishDate,
  formatTimeRange,
  getInitials,
  JOB_CATEGORY_ICONS,
  JOB_CATEGORY_LABELS,
} from '@/shared/utils/formatters';
import { VALID_JOB_CATEGORIES } from '@/shared/utils/validators';
import type { JobCategory } from '@/types/database';

export function WorkerHomeScreen() {
  const router = useRouter();
  const version = useWorkerStore((s) => s.version);
  const worker = useWorkerStore((s) =>
    s.db.profiles.find((p) => p.id === s.activeWorkerId),
  );
  const unreadNotifs = useWorkerStore(
    (s) =>
      s.db.notifications.filter(
        (n) => n.user_id === s.activeWorkerId && !n.read_at,
      ).length,
  );

  const [quickSearch, setQuickSearch] = useState('');

  const data = useMemo(() => {
    void version;
    if (!worker) return null;
    const location = workerStore.getWorkerLocation();
    const opps = workerStore.listOpportunities();
    const myJobs = workerStore.listMyJobs();
    const apps = workerStore.listMyApplications();
    const payments = workerStore.getPaymentsSummaryAndHistory();

    const activeJobs = myJobs.filter((j) =>
      ['assigned', 'arrival_registered', 'in_progress', 'completion_requested'].includes(
        j.job.status,
      ),
    );
    const pendingAppsCount = apps.filter((a) => a.status === 'pending').length;
    const recommended = opps.withinRadius.slice(0, 3);
    const recent = [...opps.all]
      .sort(
        (a, b) =>
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
      )
      .slice(0, 3);

    return {
      location,
      recommended,
      recent,
      activeJobs,
      pendingAppsCount,
      totalAppsCount: apps.length,
      totalTransferredMxn: payments.totalTransferredMxn,
      completedCount: myJobs.filter((j) => j.job.status === 'completed').length,
    };
  }, [version, worker]);

  if (!worker || !data) return null;

  const firstName = worker.full_name.split(' ')[0] ?? worker.full_name;

  const handleSearchSubmit = () => {
    router.push({
      pathname: '/(main)/explore',
      params: quickSearch.trim() ? { q: quickSearch.trim() } : {},
    } as never);
  };

  const handleCategoryPress = (category: JobCategory) => {
    router.push({
      pathname: '/(main)/explore',
      params: { category },
    } as never);
  };

  return (
    <SaharaScreenShell
      header={
        <View style={styles.topHeader}>
          <Pressable
            onPress={() => router.push('/(main)/profile' as never)}
            style={styles.userRow}>
            <AvatarBadge
              initials={worker.avatar_initials ?? getInitials(worker.full_name)}
              size={44}
              tone={worker.avatar_tone ?? SaharaColors.primaryFixed}
            />
            <View style={{ flex: 1 }}>
              <Text style={styles.greetingSub}>Solidez MX · Trabajador</Text>
              <Text style={styles.greetingTitle} numberOfLines={1}>
                Hola, {firstName}
              </Text>
            </View>
          </Pressable>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Notificaciones, ${unreadNotifs} sin leer`}
            onPress={() => router.push('/(main)/notifications' as never)}
            style={styles.notifBtn}>
            <SaharaIcon
              name="notifications"
              size={18}
              color={SaharaColors.onSurface}
            />
            {unreadNotifs > 0 ? (
              <View style={styles.notifDot}>
                <Text style={styles.notifDotText}>
                  {unreadNotifs > 9 ? '9+' : unreadNotifs}
                </Text>
              </View>
            ) : null}
          </Pressable>
        </View>
      }
      footer={<WorkerBottomNav />}>
      {/* Ubicación de referencia y radio actual */}
      <Pressable
        onPress={() => router.push('/(main)/location' as never)}
        style={styles.locationBanner}>
        <View style={styles.locationIconBox}>
          <SaharaIcon
            name="location_on"
            size={16}
            color={SaharaColors.onPrimary}
          />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.locationLabel}>Ubicación de referencia</Text>
          <Text style={styles.locationValue} numberOfLines={1}>
            {data.location.label} · Radio de {data.location.search_radius_km} km
          </Text>
        </View>
        <View style={styles.changePill}>
          <Text style={styles.changePillText}>Ajustar</Text>
        </View>
      </Pressable>

      {/* Barra de búsqueda */}
      <View style={styles.searchRow}>
        <View style={{ flex: 1 }}>
          <SaharaInput
            icon="search"
            placeholder="Buscar limpieza, pintura, colonia..."
            value={quickSearch}
            onChangeText={setQuickSearch}
            returnKeyType="search"
            onSubmitEditing={handleSearchSubmit}
          />
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Buscar oportunidades"
          onPress={handleSearchSubmit}
          style={styles.searchGoBtn}>
          <SaharaIcon name="arrow_forward" size={18} color={SaharaColors.onPrimary} />
        </Pressable>
      </View>

      {/* Resumen de actividad del trabajador */}
      <SaharaCard variant="low" style={styles.summaryCard}>
        <Text style={styles.summaryOverline}>Resumen de tu actividad</Text>
        <View style={styles.kpiRow}>
          <View style={styles.kpiCell}>
            <Text style={styles.kpiNumber}>{data.activeJobs.length}</Text>
            <Text style={styles.kpiLabel}>Trabajos activos</Text>
          </View>
          <View style={styles.kpiDivider} />
          <View style={styles.kpiCell}>
            <Text style={styles.kpiNumber}>{data.pendingAppsCount}</Text>
            <Text style={styles.kpiLabel}>Postulaciones pendientes</Text>
          </View>
          <View style={styles.kpiDivider} />
          <View style={styles.kpiCell}>
            <Text style={styles.kpiNumber} numberOfLines={1}>
              {formatCurrencyMXN(data.totalTransferredMxn).replace(' MXN', '')}
            </Text>
            <Text style={styles.kpiLabel}>Ingresos transferidos</Text>
          </View>
        </View>
      </SaharaCard>

      {/* Accesos rápidos a Postulaciones, Trabajos activos y Pagos */}
      <View style={styles.quickAccessRow}>
        <SaharaCard
          variant="lowest"
          onPress={() => router.push('/(main)/applications' as never)}
          style={styles.quickCard}>
          <View style={styles.quickIconCircle}>
            <SaharaIcon
              name="assignment"
              size={16}
              color={SaharaColors.onPrimaryFixedVariant}
            />
          </View>
          <Text style={styles.quickTitle}>Mis postulaciones</Text>
          <Text style={styles.quickMeta}>
            {data.totalAppsCount} solicitudes registradas
          </Text>
        </SaharaCard>

        <SaharaCard
          variant="lowest"
          onPress={() => router.push('/(main)/my-jobs' as never)}
          style={styles.quickCard}>
          <View style={styles.quickIconCircle}>
            <SaharaIcon
              name="work"
              size={16}
              color={SaharaColors.onPrimaryFixedVariant}
            />
          </View>
          <Text style={styles.quickTitle}>Trabajos activos</Text>
          <Text style={styles.quickMeta}>
            {data.activeJobs.length} en agenda y curso
          </Text>
        </SaharaCard>
      </View>

      {/* Próximo trabajo activo destacado */}
      {data.activeJobs.length > 0 ? (
        <View style={{ gap: 10 }}>
          <SectionHeader
            title="Tu siguiente compromiso"
            actionLabel="Ver todos"
            onAction={() => router.push('/(main)/my-jobs' as never)}
          />
          {data.activeJobs.slice(0, 1).map((item) => (
            <SaharaCard
              key={item.job.id}
              variant="primaryFixed"
              onPress={() => router.push(`/(main)/job/${item.job.id}` as never)}
              style={{ gap: 8 }}>
              <View style={styles.activeTopRow}>
                <JobStatusBadge status={item.job.status} />
                <Text style={styles.activePrice}>
                  {formatCurrencyMXN(item.job.fixed_payment_mxn)}
                </Text>
              </View>
              <Text style={styles.activeTitle}>{item.job.title}</Text>
              <Text style={styles.activeMeta}>
                {item.employer_name} · {formatSpanishDate(item.job.job_date)} ·{' '}
                {formatTimeRange(item.job.start_time, item.job.end_time)}
              </Text>
              <Text style={styles.activeActionHint}>
                Toca para ver dirección exacta, condiciones y registro de llegada →
              </Text>
            </SaharaCard>
          ))}
        </View>
      ) : null}

      {/* Categorías de trabajo */}
      <View style={{ gap: 10 }}>
        <SectionHeader
          title="Categorías"
          actionLabel="Explorar"
          onAction={() => router.push('/(main)/explore' as never)}
        />
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.categoryScroll}>
          {VALID_JOB_CATEGORIES.map((cat) => (
            <Pressable
              key={cat}
              onPress={() => handleCategoryPress(cat)}
              style={styles.catTile}>
              <View style={styles.catIconCircle}>
                <SaharaIcon
                  name={JOB_CATEGORY_ICONS[cat]}
                  size={16}
                  color={SaharaColors.primaryAccessible}
                />
              </View>
              <Text style={styles.catLabel}>{JOB_CATEGORY_LABELS[cat]}</Text>
            </Pressable>
          ))}
        </ScrollView>
      </View>

      {/* Trabajos recomendados dentro del radio */}
      <View style={{ gap: 12 }}>
        <SectionHeader
          title="Recomendados cerca de ti"
          actionLabel="Ver catálogo"
          onAction={() => router.push('/(main)/explore' as never)}
        />
        {data.recommended.length > 0 ? (
          data.recommended.map((opp) => (
            <OpportunityCard
              key={opp.id}
              item={opp}
              onPress={() =>
                router.push(`/(main)/opportunity/${opp.id}` as never)
              }
            />
          ))
        ) : (
          <EmptyState
            icon="location_on"
            title="Sin oportunidades en tu radio actual"
            description="Amplía tu radio de búsqueda o ajusta tu ubicación de referencia para ver más trabajos cercanos."
            actionLabel="Configurar ubicación"
            onAction={() => router.push('/(main)/location' as never)}
          />
        )}
      </View>

      {/* Trabajos recientes */}
      <View style={{ gap: 12 }}>
        <SectionHeader
          title="Publicados recientemente"
          actionLabel="Explorar todo"
          onAction={() => router.push('/(main)/explore' as never)}
        />
        {data.recent.map((opp) => (
          <OpportunityCard
            key={`recent-${opp.id}`}
            item={opp}
            onPress={() =>
              router.push(`/(main)/opportunity/${opp.id}` as never)
            }
          />
        ))}
      </View>
    </SaharaScreenShell>
  );
}

const styles = StyleSheet.create({
  topHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.md,
    paddingVertical: 12,
    backgroundColor: SaharaColors.surface,
    borderBottomWidth: 1,
    borderBottomColor: SaharaColors.borderDefault,
    gap: 10,
  },
  userRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  greetingSub: {
    fontFamily: Fonts.label,
    fontSize: 10.5,
    fontWeight: '700',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    color: SaharaColors.secondary,
  },
  greetingTitle: {
    fontFamily: Fonts.headline,
    fontSize: 22,
    fontWeight: '600',
    color: SaharaColors.onSurface,
  },
  notifBtn: {
    width: 46,
    height: 46,
    borderRadius: Radius.full,
    backgroundColor: SaharaColors.surfaceContainerLow,
    borderWidth: 1,
    borderColor: SaharaColors.borderSubtle,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  notifDot: {
    position: 'absolute',
    top: 4,
    right: 4,
    minWidth: 18,
    height: 18,
    borderRadius: Radius.full,
    backgroundColor: SaharaColors.tertiary,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  notifDotText: {
    fontFamily: Fonts.label,
    fontSize: 10,
    fontWeight: '700',
    color: SaharaColors.onTertiary,
  },
  locationBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: SaharaColors.surfaceContainerLowest,
    borderRadius: Radius.xl,
    padding: 12,
    borderWidth: 1,
    borderColor: SaharaColors.borderDefault,
  },
  locationIconBox: {
    width: 38,
    height: 38,
    borderRadius: Radius.full,
    backgroundColor: SaharaColors.primaryAccessible,
    alignItems: 'center',
    justifyContent: 'center',
  },
  locationLabel: {
    fontFamily: Fonts.label,
    fontSize: 10.5,
    fontWeight: '700',
    color: SaharaColors.secondary,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  locationValue: {
    fontFamily: Fonts.label,
    fontSize: 13.5,
    fontWeight: '700',
    color: SaharaColors.onSurface,
  },
  changePill: {
    backgroundColor: SaharaColors.primaryFixed,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: Radius.full,
  },
  changePillText: {
    fontFamily: Fonts.label,
    fontSize: 11.5,
    fontWeight: '700',
    color: SaharaColors.onPrimaryFixed,
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  searchGoBtn: {
    width: 48,
    height: 48,
    borderRadius: Radius.md,
    backgroundColor: SaharaColors.primaryAccessible,
    alignItems: 'center',
    justifyContent: 'center',
  },
  summaryCard: {
    gap: 10,
  },
  summaryOverline: {
    fontFamily: Fonts.label,
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    color: SaharaColors.secondary,
  },
  kpiRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  kpiCell: {
    flex: 1,
    alignItems: 'center',
    gap: 2,
  },
  kpiDivider: {
    width: 1,
    height: 32,
    backgroundColor: SaharaColors.borderSubtle,
  },
  kpiNumber: {
    fontFamily: Fonts.headline,
    fontSize: 20,
    fontWeight: '700',
    color: SaharaColors.onSurface,
  },
  kpiLabel: {
    fontFamily: Fonts.body,
    fontSize: 11,
    color: SaharaColors.onSurfaceVariant,
    textAlign: 'center',
  },
  quickAccessRow: {
    flexDirection: 'row',
    gap: 12,
  },
  quickCard: {
    flex: 1,
    gap: 6,
  },
  quickIconCircle: {
    width: 36,
    height: 36,
    borderRadius: Radius.md,
    backgroundColor: SaharaColors.primaryFixed,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickTitle: {
    fontFamily: Fonts.headline,
    fontSize: 16,
    fontWeight: '600',
    color: SaharaColors.onSurface,
  },
  quickMeta: {
    fontFamily: Fonts.body,
    fontSize: 11.5,
    color: SaharaColors.onSurfaceVariant,
  },
  activeTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  activePrice: {
    fontFamily: Fonts.headline,
    fontSize: 16,
    fontWeight: '700',
    color: SaharaColors.onPrimaryFixed,
  },
  activeTitle: {
    fontFamily: Fonts.headline,
    fontSize: 18,
    fontWeight: '600',
    color: SaharaColors.onPrimaryFixed,
  },
  activeMeta: {
    fontFamily: Fonts.body,
    fontSize: 12.5,
    color: SaharaColors.onPrimaryFixedVariant,
  },
  activeActionHint: {
    fontFamily: Fonts.label,
    fontSize: 12,
    fontWeight: '700',
    color: SaharaColors.primaryAccessible,
  },
  categoryScroll: {
    gap: 10,
    paddingVertical: 2,
  },
  catTile: {
    width: 96,
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderRadius: Radius.xl,
    backgroundColor: SaharaColors.surfaceContainerLowest,
    borderWidth: 1,
    borderColor: SaharaColors.borderSubtle,
    alignItems: 'center',
    gap: 6,
  },
  catIconCircle: {
    width: 38,
    height: 38,
    borderRadius: Radius.full,
    backgroundColor: SaharaColors.primaryFixed,
    alignItems: 'center',
    justifyContent: 'center',
  },
  catLabel: {
    fontFamily: Fonts.label,
    fontSize: 12,
    fontWeight: '600',
    color: SaharaColors.onSurface,
    textAlign: 'center',
  },
});

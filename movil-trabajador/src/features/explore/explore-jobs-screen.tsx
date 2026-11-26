/**
 * MÓDULO 4: EXPLORAR Y BUSCAR TRABAJOS
 * - Barra de búsqueda
 * - Filtro por categoría (6 categorías oficiales)
 * - Filtro por rango de fechas (Hoy, Próximos 3 días, Próximos 7 días o fechas manuales)
 * - Orden por distancia: primero dentro del radio, luego máx. 10 "Fuera de alcance"
 * - Acceso a ubicación/radio y a postulaciones
 */
import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Fonts, Radius, SaharaColors, Spacing } from '@/constants/theme';
import {
  EmptyState,
  FilterPill,
  OpportunityCard,
  SaharaButton,
  SaharaCard,
  SaharaHeader,
  SaharaIcon,
  SaharaInput,
  SaharaScreenShell,
  WorkerBottomNav,
} from '@/components/ui';
import { useWorkerStore, workerStore } from '@/services/worker-store';
import {
  formatDateInputMask,
  getOffsetDateYMD,
  JOB_CATEGORY_ICONS,
  JOB_CATEGORY_LABELS,
} from '@/shared/utils/formatters';
import { VALID_JOB_CATEGORIES } from '@/shared/utils/validators';
import type { JobCategory } from '@/types/database';

type DatePreset = 'all' | 'next3' | 'next7' | 'custom';

export function ExploreJobsScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ q?: string; category?: string }>();
  const version = useWorkerStore((s) => s.version);

  const initialCategory =
    params.category &&
    VALID_JOB_CATEGORIES.includes(params.category as JobCategory)
      ? (params.category as JobCategory)
      : 'all';

  const [query, setQuery] = useState(params.q ?? '');
  const [selectedCategory, setSelectedCategory] = useState<JobCategory | 'all'>(
    initialCategory,
  );
  const [datePreset, setDatePreset] = useState<DatePreset>('all');
  const [customFrom, setCustomFrom] = useState(getOffsetDateYMD(0));
  const [customTo, setCustomTo] = useState(getOffsetDateYMD(7));

  const effectiveDates = useMemo(() => {
    if (datePreset === 'next3') {
      return { from: getOffsetDateYMD(0), to: getOffsetDateYMD(3) };
    }
    if (datePreset === 'next7') {
      return { from: getOffsetDateYMD(0), to: getOffsetDateYMD(7) };
    }
    if (datePreset === 'custom') {
      return {
        from: formatDateInputMask(customFrom),
        to: formatDateInputMask(customTo),
      };
    }
    return { from: '', to: '' };
  }, [datePreset, customFrom, customTo]);

  const { location, withinRadius, outOfRange } = useMemo(() => {
    void version;
    const loc = workerStore.getWorkerLocation();
    const res = workerStore.listOpportunities({
      query,
      category: selectedCategory,
      dateFrom: effectiveDates.from,
      dateTo: effectiveDates.to,
    });
    return { location: loc, ...res };
  }, [version, query, selectedCategory, effectiveDates]);

  const hasFilters =
    Boolean(query.trim()) ||
    selectedCategory !== 'all' ||
    datePreset !== 'all';

  const clearFilters = () => {
    setQuery('');
    setSelectedCategory('all');
    setDatePreset('all');
  };

  return (
    <SaharaScreenShell
      header={
        <SaharaHeader
          title="Explorar trabajos"
          subtitle="Ordenados por cercanía"
          rightAction={
            <Pressable
              onPress={() => router.push('/(main)/applications' as never)}
              style={styles.headerActionPill}>
              <SaharaIcon
                name="assignment"
                size={13}
                color={SaharaColors.onPrimaryFixed}
              />
              <Text style={styles.headerActionText}>Postulaciones</Text>
            </Pressable>
          }
        />
      }
      footer={<WorkerBottomNav />}>
      {/* Acceso directo a ubicación de referencia y radio */}
      <Pressable
        onPress={() => router.push('/(main)/location' as never)}
        style={styles.locStrip}>
        <SaharaIcon
          name="location_on"
          size={15}
          color={SaharaColors.primaryAccessible}
        />
        <Text style={styles.locStripText} numberOfLines={1}>
          {location.label} · Radio {location.search_radius_km} km
        </Text>
        <Text style={styles.locStripAction}>Cambiar</Text>
      </Pressable>

      {/* Barra de búsqueda */}
      <SaharaInput
        icon="search"
        placeholder="Buscar por título, actividad o empleador..."
        value={query}
        onChangeText={setQuery}
      />

      {/* Filtro por categoría */}
      <View style={{ gap: 8 }}>
        <Text style={styles.filterHeading}>Categoría</Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.pillsRow}>
          <FilterPill
            label="Todas"
            active={selectedCategory === 'all'}
            onPress={() => setSelectedCategory('all')}
          />
          {VALID_JOB_CATEGORIES.map((cat) => (
            <FilterPill
              key={cat}
              label={JOB_CATEGORY_LABELS[cat]}
              icon={JOB_CATEGORY_ICONS[cat]}
              active={selectedCategory === cat}
              onPress={() => setSelectedCategory(cat)}
            />
          ))}
        </ScrollView>
      </View>

      {/* Filtro por rango de fechas */}
      <View style={{ gap: 8 }}>
        <Text style={styles.filterHeading}>Rango de fechas</Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.pillsRow}>
          <FilterPill
            label="Cualquier fecha"
            active={datePreset === 'all'}
            onPress={() => setDatePreset('all')}
          />
          <FilterPill
            label="Próximos 3 días"
            active={datePreset === 'next3'}
            onPress={() => setDatePreset('next3')}
          />
          <FilterPill
            label="Próximos 7 días"
            active={datePreset === 'next7'}
            onPress={() => setDatePreset('next7')}
          />
          <FilterPill
            label="Personalizado"
            icon="calendar_today"
            active={datePreset === 'custom'}
            onPress={() => setDatePreset('custom')}
          />
        </ScrollView>

        {datePreset === 'custom' ? (
          <SaharaCard variant="low" style={styles.customDatesRow}>
            <View style={{ flex: 1 }}>
              <SaharaInput
                label="Desde (AAAA-MM-DD)"
                placeholder="2026-11-26"
                value={customFrom}
                onChangeText={(v) => setCustomFrom(formatDateInputMask(v))}
              />
            </View>
            <View style={{ flex: 1 }}>
              <SaharaInput
                label="Hasta (AAAA-MM-DD)"
                placeholder="2026-12-03"
                value={customTo}
                onChangeText={(v) => setCustomTo(formatDateInputMask(v))}
              />
            </View>
          </SaharaCard>
        ) : null}
      </View>

      {hasFilters ? (
        <View style={styles.clearRow}>
          <Text style={styles.resultCounter}>
            {withinRadius.length + outOfRange.length} resultados encontrados
          </Text>
          <Pressable onPress={clearFilters}>
            <Text style={styles.clearLink}>Limpiar filtros</Text>
          </Pressable>
        </View>
      ) : null}

      {/* Resultados DENTRO del radio */}
      {withinRadius.length === 0 && outOfRange.length === 0 ? (
        <EmptyState
          icon="search"
          title="No encontramos oportunidades"
          description="Prueba ajustando las palabras clave, eligiendo otra categoría o ampliando tu rango de fechas."
          actionLabel="Restablecer filtros"
          onAction={clearFilters}
        />
      ) : (
        <>
          <View style={{ gap: 12 }}>
            <View style={styles.groupHeader}>
              <Text style={styles.groupTitle}>
                Dentro de tu radio ({location.search_radius_km} km)
              </Text>
              <Text style={styles.groupCount}>{withinRadius.length}</Text>
            </View>
            {withinRadius.length > 0 ? (
              withinRadius.map((item) => (
                <OpportunityCard
                  key={item.id}
                  item={item}
                  onPress={() =>
                    router.push(`/(main)/opportunity/${item.id}` as never)
                  }
                />
              ))
            ) : (
              <SaharaCard variant="low" style={{ gap: 8 }}>
                <Text style={styles.emptyRadiusText}>
                  No hay publicaciones dentro de {location.search_radius_km} km con los filtros seleccionados.
                </Text>
                <SaharaButton
                  label="Ampliar radio de búsqueda"
                  variant="outline"
                  size="sm"
                  onPress={() => router.push('/(main)/location' as never)}
                />
              </SaharaCard>
            )}
          </View>

          {/* Resultados FUERA del radio (máximo 10) */}
          {outOfRange.length > 0 ? (
            <View style={{ gap: 12, marginTop: 8 }}>
              <View style={styles.groupHeader}>
                <Text style={styles.groupTitle}>Fuera de alcance</Text>
                <Text style={styles.groupCount}>
                  {outOfRange.length} (máx. 10)
                </Text>
              </View>
              <Text style={styles.outHint}>
                Estas oportunidades están fuera de tu radio de{' '}
                {location.search_radius_km} km, pero puedes consultarlas y postularte si te conviene trasladarte.
              </Text>
              {outOfRange.map((item) => (
                <OpportunityCard
                  key={item.id}
                  item={item}
                  onPress={() =>
                    router.push(`/(main)/opportunity/${item.id}` as never)
                  }
                />
              ))}
            </View>
          ) : null}
        </>
      )}
    </SaharaScreenShell>
  );
}

const styles = StyleSheet.create({
  headerActionPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: SaharaColors.primaryFixed,
    paddingHorizontal: 11,
    paddingVertical: 7,
    borderRadius: Radius.full,
  },
  headerActionText: {
    fontFamily: Fonts.label,
    fontSize: 11.5,
    fontWeight: '700',
    color: SaharaColors.onPrimaryFixed,
  },
  locStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: SaharaColors.surfaceContainerLow,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: SaharaColors.borderSubtle,
  },
  locStripText: {
    flex: 1,
    fontFamily: Fonts.label,
    fontSize: 12.5,
    fontWeight: '600',
    color: SaharaColors.onSurface,
  },
  locStripAction: {
    fontFamily: Fonts.label,
    fontSize: 12,
    fontWeight: '700',
    color: SaharaColors.primaryAccessible,
  },
  filterHeading: {
    fontFamily: Fonts.label,
    fontSize: 12,
    fontWeight: '700',
    color: SaharaColors.secondary,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  pillsRow: {
    gap: 8,
    paddingVertical: 2,
  },
  customDatesRow: {
    flexDirection: 'row',
    gap: 10,
  },
  clearRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  resultCounter: {
    fontFamily: Fonts.label,
    fontSize: 12.5,
    color: SaharaColors.onSurfaceVariant,
  },
  clearLink: {
    fontFamily: Fonts.label,
    fontSize: 12.5,
    fontWeight: '700',
    color: SaharaColors.primaryAccessible,
  },
  groupHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  groupTitle: {
    fontFamily: Fonts.headline,
    fontSize: 19,
    fontWeight: '600',
    color: SaharaColors.onSurface,
  },
  groupCount: {
    fontFamily: Fonts.label,
    fontSize: 12,
    fontWeight: '700',
    color: SaharaColors.secondary,
  },
  emptyRadiusText: {
    fontFamily: Fonts.body,
    fontSize: 13,
    color: SaharaColors.onSurfaceVariant,
  },
  outHint: {
    fontFamily: Fonts.body,
    fontSize: 12,
    color: SaharaColors.onSurfaceVariant,
    lineHeight: 18,
  },
});

/**
 * MÓDULO 3: UBICACIÓN Y RADIO DE BÚSQUEDA
 * - Mapa manual sin solicitud de permisos GPS (sin marcadores de trabajos disponibles)
 * - Radios: 5 km, 10 km (inicial), 25 km, 50 km
 * - Máximo 3 cambios del punto de referencia en cualquier periodo móvil de 24 horas
 * - Muestra cambios restantes y actualiza recomendaciones inmediatamente
 */
import React, { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Fonts, Radius, SaharaColors, Spacing } from '@/constants/theme';
import {
  CDMX_REFERENCE_ZONES,
  FeedbackBanner,
  InteractiveMapCanvas,
  SaharaButton,
  SaharaCard,
  SaharaHeader,
  SaharaIcon,
  SaharaScreenShell,
  WorkerBottomNav,
} from '@/components/ui';
import { useWorkerStore, workerStore } from '@/services/worker-store';
import { mapDomainErrorToMessage } from '@/shared/utils/error-mapper';
import type { SearchRadiusKm } from '@/types/database';

const RADII: SearchRadiusKm[] = [5, 10, 25, 50];

export function LocationRadiusScreen() {
  const router = useRouter();
  const version = useWorkerStore((s) => s.version);

  const currentLoc = useMemo(() => {
    void version;
    return workerStore.getWorkerLocation();
  }, [version]);

  const quota = useMemo(() => {
    void version;
    return workerStore.getRemainingLocationChanges();
  }, [version]);

  const [draftLat, setDraftLat] = useState(currentLoc.latitude);
  const [draftLon, setDraftLon] = useState(currentLoc.longitude);
  const [draftLabel, setDraftLabel] = useState(currentLoc.label);
  const [draftRadius, setDraftRadius] = useState<SearchRadiusKm>(
    currentLoc.search_radius_km,
  );
  const [feedback, setFeedback] = useState<{
    tone: 'success' | 'error';
    text: string;
  } | null>(null);

  const previewCounts = useMemo(() => {
    void version;
    const result = workerStore.listOpportunities();
    return {
      within: result.withinRadius.length,
      outside: result.outOfRange.length,
    };
  }, [version]);

  const pointChanged =
    Math.abs(draftLat - currentLoc.latitude) > 0.0002 ||
    Math.abs(draftLon - currentLoc.longitude) > 0.0002;

  const handleSave = () => {
    setFeedback(null);
    try {
      workerStore.saveWorkerLocation({
        label: draftLabel,
        latitude: draftLat,
        longitude: draftLon,
        search_radius_km: draftRadius,
      });
      setFeedback({
        tone: 'success',
        text: `Ubicación guardada en ${draftLabel} con radio de ${draftRadius} km. Tus oportunidades recomendadas se actualizaron.`,
      });
    } catch (err) {
      setFeedback({
        tone: 'error',
        text: mapDomainErrorToMessage(err),
      });
    }
  };

  return (
    <SaharaScreenShell
      header={
        <SaharaHeader
          title="Ubicación y radio"
          subtitle="Configuración manual"
          onBack={() => router.back()}
          badgeText={`${draftRadius} km`}
        />
      }
      footer={<WorkerBottomNav />}>
      {feedback ? (
        <FeedbackBanner
          tone={feedback.tone}
          message={feedback.text}
          onDismiss={() => setFeedback(null)}
        />
      ) : null}

      {/* Indicador de cambios restantes en 24h y aviso de privacidad sin GPS */}
      <SaharaCard variant="low" style={styles.quotaCard}>
        <View style={styles.quotaTop}>
          <View style={styles.quotaIcon}>
            <SaharaIcon
              name="shield"
              size={16}
              color={SaharaColors.onPrimaryFixedVariant}
            />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.quotaTitle}>
              Cambios de punto disponibles: {quota.remaining} de {quota.maxChanges}
            </Text>
            <Text style={styles.quotaSub}>
              Puedes modificar tu punto de referencia hasta 3 veces cada 24 horas. Cambiar solo el radio de búsqueda no consume cambios.
            </Text>
          </View>
        </View>
      </SaharaCard>

      {/* Mapa interactivo manual (sin GPS y sin marcadores de trabajos) */}
      <View style={{ gap: 8 }}>
        <Text style={styles.sectionLabel}>
          Marca manualmente tu punto de referencia
        </Text>
        <InteractiveMapCanvas
          mode="reference"
          latitude={draftLat}
          longitude={draftLon}
          radiusKm={draftRadius}
          pinLabel={draftLabel}
          onSelectPoint={({ latitude, longitude, label }) => {
            setDraftLat(latitude);
            setDraftLon(longitude);
            setDraftLabel(label);
            setFeedback(null);
          }}
        />
        <Text style={styles.helperNote}>
          Toca cualquier zona del mapa o elige una colonia de referencia abajo. No solicitamos permisos de ubicación GPS.
        </Text>
      </View>

      {/* Zonas de referencia rápida */}
      <SaharaCard variant="lowest" style={{ gap: 10 }}>
        <Text style={styles.cardHeading}>Zonas de referencia rápida</Text>
        <View style={styles.zonesGrid}>
          {CDMX_REFERENCE_ZONES.map((z) => {
            const active = draftLabel === z.label;
            return (
              <Pressable
                key={z.id}
                onPress={() => {
                  setDraftLat(z.latitude);
                  setDraftLon(z.longitude);
                  setDraftLabel(z.label);
                  setFeedback(null);
                }}
                style={[
                  styles.zoneChip,
                  active ? styles.zoneChipActive : undefined,
                ]}>
                <Text
                  style={[
                    styles.zoneChipText,
                    active ? styles.zoneChipTextActive : undefined,
                  ]}>
                  {z.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </SaharaCard>

      {/* Selector de radio de búsqueda */}
      <SaharaCard variant="lowest" style={{ gap: 12 }}>
        <Text style={styles.cardHeading}>Radio de búsqueda</Text>
        <Text style={styles.quotaSub}>
          Primero verás las oportunidades dentro de tu radio ordenadas por cercanía, y hasta 10 oportunidades adicionales etiquetadas como «Fuera de alcance».
        </Text>
        <View style={styles.radiiRow}>
          {RADII.map((r) => {
            const selected = draftRadius === r;
            return (
              <Pressable
                key={r}
                accessibilityRole="radio"
                accessibilityState={{ checked: selected }}
                onPress={() => setDraftRadius(r)}
                style={[
                  styles.radiusOption,
                  selected ? styles.radiusOptionActive : undefined,
                ]}>
                <Text
                  style={[
                    styles.radiusNumber,
                    selected ? styles.radiusTextActive : undefined,
                  ]}>
                  {r} km
                </Text>
                {r === 10 ? (
                  <Text
                    style={[
                      styles.radiusTag,
                      selected ? styles.radiusTextActive : undefined,
                    ]}>
                    Inicial
                  </Text>
                ) : null}
              </Pressable>
            );
          })}
        </View>

        <View style={styles.summaryStrip}>
          <Text style={styles.summaryText}>
            Configuración actual: {previewCounts.within} trabajos dentro del radio ·{' '}
            {previewCounts.outside} fuera de alcance
          </Text>
        </View>
      </SaharaCard>

      <SaharaButton
        label={
          pointChanged
            ? 'Guardar nueva ubicación y radio'
            : 'Guardar radio de búsqueda'
        }
        icon="check_circle"
        disabled={pointChanged && currentLoc.initialized && quota.remaining <= 0}
        onPress={handleSave}
      />

      <SaharaButton
        label="Ver oportunidades con esta ubicación"
        variant="outline"
        icon="search"
        onPress={() => router.push('/(main)/explore' as never)}
      />
    </SaharaScreenShell>
  );
}

const styles = StyleSheet.create({
  quotaCard: {
    gap: 8,
  },
  quotaTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  quotaIcon: {
    width: 36,
    height: 36,
    borderRadius: Radius.full,
    backgroundColor: SaharaColors.primaryFixed,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quotaTitle: {
    fontFamily: Fonts.label,
    fontSize: 13.5,
    fontWeight: '700',
    color: SaharaColors.onSurface,
  },
  quotaSub: {
    fontFamily: Fonts.body,
    fontSize: 12.5,
    color: SaharaColors.onSurfaceVariant,
    lineHeight: 18,
    marginTop: 2,
  },
  sectionLabel: {
    fontFamily: Fonts.headline,
    fontSize: 18,
    fontWeight: '600',
    color: SaharaColors.onSurface,
  },
  helperNote: {
    fontFamily: Fonts.body,
    fontSize: 11.5,
    color: SaharaColors.onSurfaceVariant,
  },
  cardHeading: {
    fontFamily: Fonts.headline,
    fontSize: 18,
    fontWeight: '600',
    color: SaharaColors.onSurface,
  },
  zonesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  zoneChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: Radius.full,
    backgroundColor: SaharaColors.surfaceContainerLow,
    borderWidth: 1,
    borderColor: SaharaColors.borderSubtle,
  },
  zoneChipActive: {
    backgroundColor: SaharaColors.primaryFixed,
    borderColor: SaharaColors.primaryAccessible,
  },
  zoneChipText: {
    fontFamily: Fonts.label,
    fontSize: 12,
    color: SaharaColors.onSurface,
  },
  zoneChipTextActive: {
    color: SaharaColors.onPrimaryFixed,
    fontWeight: '700',
  },
  radiiRow: {
    flexDirection: 'row',
    gap: 8,
  },
  radiusOption: {
    flex: 1,
    minHeight: 56,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: SaharaColors.outlineVariant,
    backgroundColor: SaharaColors.surfaceContainerLow,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
  },
  radiusOptionActive: {
    backgroundColor: SaharaColors.primaryAccessible,
    borderColor: SaharaColors.primaryAccessible,
  },
  radiusNumber: {
    fontFamily: Fonts.headline,
    fontSize: 16,
    fontWeight: '700',
    color: SaharaColors.onSurface,
  },
  radiusTag: {
    fontFamily: Fonts.label,
    fontSize: 10,
    color: SaharaColors.onSurfaceVariant,
  },
  radiusTextActive: {
    color: SaharaColors.onPrimary,
  },
  summaryStrip: {
    backgroundColor: SaharaColors.surfaceContainerLow,
    padding: 10,
    borderRadius: Radius.md,
  },
  summaryText: {
    fontFamily: Fonts.label,
    fontSize: 12,
    color: SaharaColors.onSurfaceVariant,
    textAlign: 'center',
  },
});

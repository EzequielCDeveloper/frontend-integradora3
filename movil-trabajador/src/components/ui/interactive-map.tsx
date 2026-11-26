/**
 * Mapa interactivo de referencia manual (sin permisos GPS)
 * - Modo "reference": permite marcar manualmente el punto de referencia y visualizar el radio de búsqueda (5, 10, 25, 50 km).
 *   Nunca muestra marcadores de trabajos disponibles.
 * - Modo "assigned": muestra el punto exacto desbloqueado de un trabajo asignado.
 */
import React, { useState } from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  View,
  type GestureResponderEvent,
  type LayoutChangeEvent,
} from 'react-native';
import { Fonts, Radius, SaharaColors, Spacing } from '@/constants/theme';
import { SaharaIcon } from './sahara-primitives';
import type { SearchRadiusKm } from '@/types/database';

export interface MapZonePreset {
  id: string;
  label: string;
  latitude: number;
  longitude: number;
}

export const CDMX_REFERENCE_ZONES: MapZonePreset[] = [
  { id: 'roma', label: 'Roma Norte, CDMX', latitude: 19.4194, longitude: -99.162 },
  { id: 'del-valle', label: 'Del Valle Centro, CDMX', latitude: 19.3834, longitude: -99.1645 },
  { id: 'polanco', label: 'Polanco, CDMX', latitude: 19.4338, longitude: -99.1945 },
  { id: 'coyoacan', label: 'Coyoacán, CDMX', latitude: 19.3467, longitude: -99.1617 },
  { id: 'santa-fe', label: 'Santa Fe, CDMX', latitude: 19.3659, longitude: -99.2615 },
  { id: 'lindavista', label: 'Lindavista, CDMX', latitude: 19.4926, longitude: -99.1312 },
  { id: 'xochimilco', label: 'Xochimilco, CDMX', latitude: 19.2636, longitude: -99.1047 },
  { id: 'satelite', label: 'Ciudad Satélite, Edo. Méx.', latitude: 19.5092, longitude: -99.2368 },
];

// Límites geográficos del lienzo del mapa metropolitano
const MAP_BOUNDS = {
  minLat: 19.22,
  maxLat: 19.56,
  minLon: -99.32,
  maxLon: -99.02,
};

function coordsToPercent(lat: number, lon: number): { xPct: number; yPct: number } {
  const xNorm = (lon - MAP_BOUNDS.minLon) / (MAP_BOUNDS.maxLon - MAP_BOUNDS.minLon);
  const yNorm = 1 - (lat - MAP_BOUNDS.minLat) / (MAP_BOUNDS.maxLat - MAP_BOUNDS.minLat);
  return {
    xPct: Math.max(8, Math.min(92, xNorm * 100)),
    yPct: Math.max(10, Math.min(90, yNorm * 100)),
  };
}

function percentToCoords(xNorm: number, yNorm: number): { lat: number; lon: number } {
  const clampedX = Math.max(0.05, Math.min(0.95, xNorm));
  const clampedY = Math.max(0.05, Math.min(0.95, yNorm));
  const lon = MAP_BOUNDS.minLon + clampedX * (MAP_BOUNDS.maxLon - MAP_BOUNDS.minLon);
  const lat = MAP_BOUNDS.maxLat - clampedY * (MAP_BOUNDS.maxLat - MAP_BOUNDS.minLat);
  return {
    lat: Number(lat.toFixed(4)),
    lon: Number(lon.toFixed(4)),
  };
}

export function findNearestZoneLabel(lat: number, lon: number): string {
  let best = CDMX_REFERENCE_ZONES[0];
  let bestDist = Infinity;
  for (const z of CDMX_REFERENCE_ZONES) {
    const d = Math.hypot(z.latitude - lat, z.longitude - lon);
    if (d < bestDist) {
      bestDist = d;
      best = z;
    }
  }
  return bestDist < 0.03 ? best.label : `Zona cercana a ${best.label}`;
}

export function InteractiveMapCanvas({
  mode,
  latitude,
  longitude,
  radiusKm = 10,
  pinLabel,
  interactive = true,
  onSelectPoint,
}: {
  mode: 'reference' | 'assigned';
  latitude: number;
  longitude: number;
  radiusKm?: SearchRadiusKm;
  pinLabel: string;
  interactive?: boolean;
  onSelectPoint?: (coords: { latitude: number; longitude: number; label: string }) => void;
}) {
  const [canvasSize, setCanvasSize] = useState({ width: 320, height: 220 });

  const handleLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    if (width > 0 && height > 0) {
      setCanvasSize({ width, height });
    }
  };

  const handleTap = (e: GestureResponderEvent) => {
    if (!interactive || !onSelectPoint) return;
    const { locationX, locationY } = e.nativeEvent;
    const xNorm = locationX / canvasSize.width;
    const yNorm = locationY / canvasSize.height;
    const { lat, lon } = percentToCoords(xNorm, yNorm);
    onSelectPoint({
      latitude: lat,
      longitude: lon,
      label: findNearestZoneLabel(lat, lon),
    });
  };

  const pos = coordsToPercent(latitude, longitude);
  const ringPx =
    radiusKm === 5 ? 58 : radiusKm === 10 ? 92 : radiusKm === 25 ? 142 : 196;

  return (
    <View style={styles.wrapper}>
      <Pressable
        accessibilityRole={interactive ? 'button' : 'image'}
        accessibilityLabel={
          mode === 'reference'
            ? `Mapa de ubicación de referencia en ${pinLabel}. Toca para mover el punto manualmente.`
            : `Mapa con ubicación exacta del trabajo en ${pinLabel}`
        }
        disabled={!interactive}
        onLayout={handleLayout}
        onPress={handleTap}
        style={styles.mapCanvas}>
        {/* Retícula cartográfica cálida */}
        <View style={styles.gridRow1} />
        <View style={styles.gridRow2} />
        <View style={styles.gridRow3} />
        <View style={styles.gridCol1} />
        <View style={styles.gridCol2} />
        <View style={styles.gridCol3} />

        {/* Avenidas principales estilizadas */}
        <View style={styles.avenueDiagonal} />
        <View style={styles.avenueHorizontal} />
        <View style={styles.avenueVertical} />

        {/* Etiquetas sutiles de orientación */}
        <Text style={[styles.zoneTag, { top: 14, left: 16 }]}>Satélite</Text>
        <Text style={[styles.zoneTag, { top: 20, right: 18 }]}>Lindavista</Text>
        <Text style={[styles.zoneTag, { top: 82, left: 26 }]}>Polanco</Text>
        <Text style={[styles.zoneTag, { bottom: 48, left: 18 }]}>Santa Fe</Text>
        <Text style={[styles.zoneTag, { bottom: 26, right: 24 }]}>Coyoacán</Text>

        {/* Radio de búsqueda en modo referencia */}
        {mode === 'reference' ? (
          <View
            pointerEvents="none"
            style={[
              styles.radiusRing,
              {
                width: ringPx,
                height: ringPx,
                borderRadius: ringPx / 2,
                left: `${pos.xPct}%`,
                top: `${pos.yPct}%`,
                transform: [
                  { translateX: -ringPx / 2 },
                  { translateY: -ringPx / 2 },
                ],
              },
            ]}
          />
        ) : null}

        {/* Pin seleccionado */}
        <View
          pointerEvents="none"
          style={[
            styles.pinAnchor,
            {
              left: `${pos.xPct}%`,
              top: `${pos.yPct}%`,
            },
          ]}>
          <View
            style={[
              styles.pinHead,
              mode === 'assigned' ? styles.pinHeadAssigned : undefined,
            ]}>
            <SaharaIcon
              name={mode === 'assigned' ? 'pin_drop' : 'location_on'}
              size={14}
              color={SaharaColors.onPrimary}
            />
          </View>
          <View style={styles.pinTail} />
        </View>

        {/* Pastilla de ayuda superior */}
        <View pointerEvents="none" style={styles.mapLegendPill}>
          <Text style={styles.mapLegendText}>
            {mode === 'reference'
              ? `Radio activo: ${radiusKm} km · Toca el mapa para mover`
              : 'Ubicación exacta del trabajo'}
          </Text>
        </View>
      </Pressable>

      {/* Pie informativo */}
      <View style={styles.footerBar}>
        <View style={styles.footerLeft}>
          <SaharaIcon
            name="location_on"
            size={14}
            color={SaharaColors.primaryAccessible}
          />
          <Text style={styles.footerLabel} numberOfLines={1}>
            {pinLabel}
          </Text>
        </View>
        {mode === 'assigned' ? (
          <Text style={styles.coordsText}>
            {latitude.toFixed(4)}, {longitude.toFixed(4)}
          </Text>
        ) : (
          <Text style={styles.coordsText}>Selección manual</Text>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    borderRadius: Radius.xl,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: SaharaColors.borderDefault,
    backgroundColor: SaharaColors.surfaceContainerLow,
  },
  mapCanvas: {
    height: 224,
    width: '100%',
    backgroundColor: '#efe7dc',
    position: 'relative',
    overflow: 'hidden',
  },
  gridRow1: {
    position: 'absolute',
    top: '25%',
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: 'rgba(133, 123, 115, 0.18)',
  },
  gridRow2: {
    position: 'absolute',
    top: '50%',
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: 'rgba(133, 123, 115, 0.18)',
  },
  gridRow3: {
    position: 'absolute',
    top: '75%',
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: 'rgba(133, 123, 115, 0.18)',
  },
  gridCol1: {
    position: 'absolute',
    left: '25%',
    top: 0,
    bottom: 0,
    width: 1,
    backgroundColor: 'rgba(133, 123, 115, 0.18)',
  },
  gridCol2: {
    position: 'absolute',
    left: '50%',
    top: 0,
    bottom: 0,
    width: 1,
    backgroundColor: 'rgba(133, 123, 115, 0.18)',
  },
  gridCol3: {
    position: 'absolute',
    left: '75%',
    top: 0,
    bottom: 0,
    width: 1,
    backgroundColor: 'rgba(133, 123, 115, 0.18)',
  },
  avenueHorizontal: {
    position: 'absolute',
    top: '44%',
    left: 0,
    right: 0,
    height: 5,
    backgroundColor: 'rgba(255, 255, 255, 0.65)',
  },
  avenueVertical: {
    position: 'absolute',
    left: '52%',
    top: 0,
    bottom: 0,
    width: 5,
    backgroundColor: 'rgba(255, 255, 255, 0.65)',
  },
  avenueDiagonal: {
    position: 'absolute',
    top: '55%',
    left: -30,
    right: -30,
    height: 4,
    backgroundColor: 'rgba(224, 136, 80, 0.25)',
    transform: [{ rotate: '-18deg' }],
  },
  zoneTag: {
    position: 'absolute',
    fontFamily: Fonts.label,
    fontSize: 10,
    fontWeight: '600',
    color: SaharaColors.secondary,
    opacity: 0.78,
  },
  radiusRing: {
    position: 'absolute',
    backgroundColor: 'rgba(194, 101, 42, 0.16)',
    borderWidth: 1.5,
    borderColor: SaharaColors.primaryAccessible,
  },
  pinAnchor: {
    position: 'absolute',
    alignItems: 'center',
    transform: [{ translateX: -16 }, { translateY: -34 }],
  },
  pinHead: {
    width: 32,
    height: 32,
    borderRadius: Radius.full,
    backgroundColor: SaharaColors.primaryAccessible,
    borderWidth: 2,
    borderColor: SaharaColors.surfaceContainerLowest,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pinHeadAssigned: {
    backgroundColor: SaharaColors.success,
  },
  pinTail: {
    width: 0,
    height: 0,
    borderLeftWidth: 6,
    borderRightWidth: 6,
    borderTopWidth: 8,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderTopColor: SaharaColors.primaryAccessible,
    marginTop: -2,
  },
  mapLegendPill: {
    position: 'absolute',
    top: 10,
    alignSelf: 'center',
    backgroundColor: 'rgba(250, 245, 238, 0.94)',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: Radius.full,
    borderWidth: 1,
    borderColor: SaharaColors.borderSubtle,
  },
  mapLegendText: {
    fontFamily: Fonts.label,
    fontSize: 11,
    fontWeight: '700',
    color: SaharaColors.onSurface,
  },
  footerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.md,
    paddingVertical: 10,
    backgroundColor: SaharaColors.surfaceContainerLowest,
    borderTopWidth: 1,
    borderTopColor: SaharaColors.borderSubtle,
    gap: 8,
  },
  footerLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  footerLabel: {
    fontFamily: Fonts.label,
    fontSize: 12.5,
    fontWeight: '700',
    color: SaharaColors.onSurface,
  },
  coordsText: {
    fontFamily: Fonts.mono,
    fontSize: 11,
    color: SaharaColors.onSurfaceVariant,
  },
});

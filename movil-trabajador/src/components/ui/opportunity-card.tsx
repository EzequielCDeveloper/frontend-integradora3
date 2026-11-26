/**
 * Tarjeta reutilizable de oportunidad de trabajo (consistente con Sahara UI)
 * Respeta privacidad: muestra solo colonia/localidad y rango de distancia.
 */
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Fonts, Radius, SaharaColors, Spacing } from '@/constants/theme';
import {
  ApplicationStatusBadge,
  RatingStars,
  SaharaCard,
  SaharaIcon,
} from './sahara-primitives';
import {
  formatCurrencyMXN,
  formatSpanishDate,
  formatTimeRange,
  JOB_CATEGORY_ICONS,
  JOB_CATEGORY_LABELS,
} from '@/shared/utils/formatters';
import type { WorkerOpportunityCard } from '@/types/database';

export function OpportunityCard({
  item,
  onPress,
}: {
  item: WorkerOpportunityCard;
  onPress: () => void;
}) {
  return (
    <SaharaCard
      onPress={onPress}
      accentColor={
        item.is_out_of_range
          ? SaharaColors.outlineVariant
          : SaharaColors.primaryAccessible
      }
      accessibilityLabel={`Oportunidad: ${item.title}, pago ${formatCurrencyMXN(item.fixed_payment_mxn)}`}>
      {/* Fila superior: categoría + etiquetas de alcance / postulación */}
      <View style={styles.topRow}>
        <View style={styles.categoryChip}>
          <SaharaIcon
            name={JOB_CATEGORY_ICONS[item.category]}
            size={12}
            color={SaharaColors.onPrimaryFixedVariant}
          />
          <Text style={styles.categoryText}>
            {JOB_CATEGORY_LABELS[item.category]}
          </Text>
        </View>

        <View style={styles.topBadges}>
          {item.is_out_of_range ? (
            <View style={styles.outOfRangeBadge}>
              <Text style={styles.outOfRangeText}>Fuera de alcance</Text>
            </View>
          ) : null}
          {item.has_applied && item.my_application_status ? (
            <ApplicationStatusBadge status={item.my_application_status} />
          ) : null}
        </View>
      </View>

      {/* Título y pago */}
      <View style={styles.titleRow}>
        <Text style={styles.title} numberOfLines={2}>
          {item.title}
        </Text>
        <View style={styles.priceBox}>
          <Text style={styles.priceAmount}>
            {formatCurrencyMXN(item.fixed_payment_mxn)}
          </Text>
          <Text style={styles.priceCaption}>Pago fijo</Text>
        </View>
      </View>

      {/* Empleador y calificación */}
      <View style={styles.employerRow}>
        <View style={styles.employerLeft}>
          <SaharaIcon name="domain" size={13} color={SaharaColors.secondary} />
          <Text style={styles.employerName} numberOfLines={1}>
            {item.employer_name}
          </Text>
        </View>
        {item.employer_rating !== null && item.employer_review_count > 0 ? (
          <View style={styles.ratingWrap}>
            <RatingStars rating={item.employer_rating} size={14} />
            <Text style={styles.ratingValue}>
              {item.employer_rating.toFixed(1)} ({item.employer_review_count})
            </Text>
          </View>
        ) : (
          <Text style={styles.noReviewsText}>Sin evaluaciones</Text>
        )}
      </View>

      {/* Metadatos: fecha, horario, colonia y rango de distancia */}
      <View style={styles.metaGrid}>
        <View style={styles.metaItem}>
          <SaharaIcon
            name="calendar_today"
            size={12}
            color={SaharaColors.secondary}
          />
          <Text style={styles.metaText}>{formatSpanishDate(item.job_date)}</Text>
        </View>
        <View style={styles.metaItem}>
          <SaharaIcon name="schedule" size={12} color={SaharaColors.secondary} />
          <Text style={styles.metaText}>
            {formatTimeRange(item.start_time, item.end_time)}
          </Text>
        </View>
      </View>

      <View style={styles.footerRow}>
        <View style={styles.metaItem}>
          <SaharaIcon
            name="location_on"
            size={12}
            color={SaharaColors.primaryAccessible}
          />
          <Text style={styles.neighborhoodText} numberOfLines={1}>
            {item.neighborhood}
          </Text>
        </View>
        <View style={styles.distancePill}>
          <Text style={styles.distanceText}>{item.distance_range}</Text>
        </View>
      </View>
    </SaharaCard>
  );
}

const styles = StyleSheet.create({
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    marginBottom: 8,
    flexWrap: 'wrap',
  },
  categoryChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: SaharaColors.primaryFixed,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: Radius.full,
  },
  categoryText: {
    fontFamily: Fonts.label,
    fontSize: 11,
    fontWeight: '700',
    color: SaharaColors.onPrimaryFixedVariant,
  },
  topBadges: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap',
  },
  outOfRangeBadge: {
    backgroundColor: SaharaColors.tertiaryFixed,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: Radius.full,
  },
  outOfRangeText: {
    fontFamily: Fonts.label,
    fontSize: 10.5,
    fontWeight: '700',
    color: SaharaColors.onTertiaryFixedVariant,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 8,
  },
  title: {
    flex: 1,
    fontFamily: Fonts.headline,
    fontSize: 18,
    fontWeight: '600',
    color: SaharaColors.onSurface,
    lineHeight: 23,
  },
  priceBox: {
    alignItems: 'flex-end',
  },
  priceAmount: {
    fontFamily: Fonts.headline,
    fontSize: 17,
    fontWeight: '700',
    color: SaharaColors.primaryAccessible,
  },
  priceCaption: {
    fontFamily: Fonts.label,
    fontSize: 10,
    color: SaharaColors.onSurfaceVariant,
  },
  employerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    paddingVertical: 8,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: SaharaColors.borderSubtle,
    marginBottom: 8,
  },
  employerLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  employerName: {
    flex: 1,
    fontFamily: Fonts.label,
    fontSize: 12.5,
    fontWeight: '600',
    color: SaharaColors.onSurface,
  },
  ratingWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  ratingValue: {
    fontFamily: Fonts.label,
    fontSize: 11.5,
    fontWeight: '700',
    color: SaharaColors.onSurface,
  },
  noReviewsText: {
    fontFamily: Fonts.body,
    fontSize: 11.5,
    color: SaharaColors.onSurfaceVariant,
  },
  metaGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 14,
    marginBottom: 8,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  metaText: {
    fontFamily: Fonts.body,
    fontSize: 12,
    color: SaharaColors.onSurfaceVariant,
  },
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  neighborhoodText: {
    fontFamily: Fonts.label,
    fontSize: 12.5,
    fontWeight: '600',
    color: SaharaColors.onSurface,
    maxWidth: 185,
  },
  distancePill: {
    backgroundColor: SaharaColors.surfaceContainerLow,
    borderWidth: 1,
    borderColor: SaharaColors.borderSubtle,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: Radius.full,
  },
  distanceText: {
    fontFamily: Fonts.label,
    fontSize: 11,
    fontWeight: '700',
    color: SaharaColors.secondary,
  },
});

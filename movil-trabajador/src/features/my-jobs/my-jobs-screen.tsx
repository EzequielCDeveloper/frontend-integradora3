/**
 * MÓDULO 7: MIS TRABAJOS
 * Organizado en las 5 secciones solicitadas:
 * 1. Próximos trabajos (assigned, arrival_registered)
 * 2. Trabajos en curso (in_progress)
 * 3. Finalización pendiente (completion_requested, in_claim)
 * 4. Trabajos finalizados (completed)
 * 5. Trabajos cancelados (cancelled, expired)
 * Incluye acceso directo a Pagos e ingresos y Cuenta conectada.
 */
import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Fonts, Radius, SaharaColors, Spacing } from '@/constants/theme';
import {
  EmptyState,
  FilterPill,
  JobStatusBadge,
  PaymentStatusBadge,
  SaharaCard,
  SaharaHeader,
  SaharaIcon,
  SaharaScreenShell,
  WorkerBottomNav,
} from '@/components/ui';
import { useWorkerStore, workerStore } from '@/services/worker-store';
import {
  formatCurrencyMXN,
  formatSpanishDate,
  formatTimeRange,
  JOB_CATEGORY_LABELS,
} from '@/shared/utils/formatters';
import type { WorkerAssignedJobDetail } from '@/types/database';

type SectionKey =
  | 'all'
  | 'upcoming'
  | 'in_progress'
  | 'pending_completion'
  | 'completed'
  | 'cancelled';

const SECTION_DEFS: { key: Exclude<SectionKey, 'all'>; title: string }[] = [
  { key: 'upcoming', title: 'Próximos trabajos' },
  { key: 'in_progress', title: 'Trabajos en curso' },
  { key: 'pending_completion', title: 'Finalización pendiente' },
  { key: 'completed', title: 'Trabajos finalizados' },
  { key: 'cancelled', title: 'Trabajos cancelados' },
];

function classifyJob(item: WorkerAssignedJobDetail): Exclude<SectionKey, 'all'> {
  const st = item.job.status;
  if (st === 'assigned' || st === 'arrival_registered') return 'upcoming';
  if (st === 'in_progress') return 'in_progress';
  if (st === 'completion_requested' || st === 'in_claim')
    return 'pending_completion';
  if (st === 'completed') return 'completed';
  return 'cancelled';
}

function getNextStepHint(item: WorkerAssignedJobDetail): string {
  switch (item.job.status) {
    case 'assigned':
      if (!item.worker_confirmed) return 'Siguiente paso: Acepta las condiciones del trabajo.';
      if (!item.worker_stripe_ready) return 'Siguiente paso: Completa el alta de tu cuenta conectada.';
      return 'Siguiente paso: Revisa dirección exacta y registra tu llegada.';
    case 'arrival_registered':
      return 'Llegada registrada · En espera de confirmación de pago para iniciar.';
    case 'in_progress':
      return 'En curso · Al concluir, finaliza con código de 6 dígitos o sin código.';
    case 'completion_requested':
      return 'Solicitud de cierre enviada · Esperando confirmación del empleador (24 h).';
    case 'in_claim':
      return 'Reclamación abierta · Fondos bloqueados hasta el cierre del caso.';
    case 'completed':
      return item.worker_reviewed
        ? 'Trabajo concluido y evaluación registrada.'
        : 'Trabajo concluido · Ya puedes calificar al empleador.';
    case 'cancelled':
      return 'Trabajo cancelado.';
    case 'expired':
      return 'Trabajo vencido sin registro de llegada.';
    default:
      return 'Toca para ver detalle completo.';
  }
}

export function MyJobsScreen() {
  const router = useRouter();
  const version = useWorkerStore((s) => s.version);
  const [selectedSection, setSelectedSection] = useState<SectionKey>('all');

  const { grouped, totalCount, paymentsSummary } = useMemo(() => {
    void version;
    const all = workerStore.listMyJobs();
    const map: Record<Exclude<SectionKey, 'all'>, WorkerAssignedJobDetail[]> = {
      upcoming: [],
      in_progress: [],
      pending_completion: [],
      completed: [],
      cancelled: [],
    };
    all.forEach((item) => {
      map[classifyJob(item)].push(item);
    });
    return {
      grouped: map,
      totalCount: all.length,
      paymentsSummary: workerStore.getPaymentsSummaryAndHistory(),
    };
  }, [version]);

  const sectionsToRender =
    selectedSection === 'all'
      ? SECTION_DEFS
      : SECTION_DEFS.filter((s) => s.key === selectedSection);

  return (
    <SaharaScreenShell
      header={
        <SaharaHeader
          title="Mis trabajos"
          subtitle="Contrataciones activas e historial"
          rightAction={
            <Pressable
              onPress={() => router.push('/(main)/payments' as never)}
              style={styles.paymentsPill}>
              <SaharaIcon
                name="payments"
                size={13}
                color={SaharaColors.onPrimaryFixed}
              />
              <Text style={styles.paymentsPillText}>Pagos</Text>
            </Pressable>
          }
        />
      }
      footer={<WorkerBottomNav />}>
      {/* Resumen rápido de pagos e ingresos */}
      <SaharaCard
        variant="low"
        onPress={() => router.push('/(main)/payments' as never)}
        style={styles.incomeBanner}>
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={styles.incomeLabel}>Ingresos transferidos</Text>
          <Text style={styles.incomeValue}>
            {formatCurrencyMXN(paymentsSummary.totalTransferredMxn)}
          </Text>
          <Text style={styles.incomeMeta}>
            Pendientes: {formatCurrencyMXN(paymentsSummary.totalPendingMxn)} · En
            reclamación: {formatCurrencyMXN(paymentsSummary.totalInClaimMxn)}
          </Text>
        </View>
        <View style={styles.incomeArrow}>
          <SaharaIcon
            name="chevron_right"
            size={18}
            color={SaharaColors.primaryAccessible}
          />
        </View>
      </SaharaCard>

      {/* Filtro rápido por sección */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.filterRow}>
        <FilterPill
          label="Todos"
          count={totalCount}
          active={selectedSection === 'all'}
          onPress={() => setSelectedSection('all')}
        />
        {SECTION_DEFS.map((sec) => (
          <FilterPill
            key={sec.key}
            label={sec.title}
            count={grouped[sec.key].length}
            active={selectedSection === sec.key}
            onPress={() => setSelectedSection(sec.key)}
          />
        ))}
      </ScrollView>

      {totalCount === 0 ? (
        <EmptyState
          icon="work"
          title="Aún no tienes trabajos asignados"
          description="Cuando un empleador acepte tu postulación, el trabajo aparecerá aquí con su domicilio exacto y pasos de seguimiento."
          actionLabel="Explorar oportunidades"
          onAction={() => router.push('/(main)/explore' as never)}
        />
      ) : (
        sectionsToRender.map((sec) => {
          const items = grouped[sec.key];
          if (selectedSection === 'all' && items.length === 0) return null;
          return (
            <View key={sec.key} style={{ gap: 10 }}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>{sec.title}</Text>
                <Text style={styles.sectionCount}>{items.length}</Text>
              </View>

              {items.length === 0 ? (
                <SaharaCard variant="low">
                  <Text style={styles.emptySectionText}>
                    No tienes registros en «{sec.title}» por el momento.
                  </Text>
                </SaharaCard>
              ) : (
                items.map((item) => (
                  <SaharaCard
                    key={item.job.id}
                    variant="lowest"
                    accentColor={
                      item.job.status === 'in_progress' ||
                      item.job.status === 'assigned'
                        ? SaharaColors.primaryAccessible
                        : item.job.status === 'completed'
                          ? SaharaColors.success
                          : item.job.status === 'in_claim'
                            ? SaharaColors.error
                            : SaharaColors.outlineVariant
                    }
                    onPress={() =>
                      router.push(`/(main)/job/${item.job.id}` as never)
                    }
                    style={{ gap: 10 }}>
                    <View style={styles.cardTop}>
                      <JobStatusBadge status={item.job.status} />
                      <Text style={styles.amountText}>
                        {formatCurrencyMXN(item.job.fixed_payment_mxn)}
                      </Text>
                    </View>

                    <View style={{ gap: 2 }}>
                      <Text style={styles.employerLine}>
                        {JOB_CATEGORY_LABELS[item.job.category]} ·{' '}
                        {item.employer_name}
                      </Text>
                      <Text style={styles.jobTitle}>{item.job.title}</Text>
                    </View>

                    <View style={styles.metaGrid}>
                      <View style={styles.metaItem}>
                        <SaharaIcon
                          name="calendar_today"
                          size={12}
                          color={SaharaColors.secondary}
                        />
                        <Text style={styles.metaText}>
                          {formatSpanishDate(item.job.job_date)} ·{' '}
                          {formatTimeRange(
                            item.job.start_time,
                            item.job.end_time,
                          )}
                        </Text>
                      </View>
                      <View style={styles.metaItem}>
                        <SaharaIcon
                          name="pin_drop"
                          size={12}
                          color={SaharaColors.success}
                        />
                        <Text style={styles.addressUnlocked} numberOfLines={1}>
                          {item.exact_address}
                        </Text>
                      </View>
                    </View>

                    <View style={styles.bottomRow}>
                      {item.payment ? (
                        <PaymentStatusBadge status={item.payment.status} />
                      ) : (
                        <View />
                      )}
                      <Text style={styles.detailLink}>Abrir detalle →</Text>
                    </View>

                    <View style={styles.nextStepBox}>
                      <Text style={styles.nextStepText}>
                        {getNextStepHint(item)}
                      </Text>
                    </View>
                  </SaharaCard>
                ))
              )}
            </View>
          );
        })
      )}
    </SaharaScreenShell>
  );
}

const styles = StyleSheet.create({
  paymentsPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: SaharaColors.primaryFixed,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: Radius.full,
  },
  paymentsPillText: {
    fontFamily: Fonts.label,
    fontSize: 12,
    fontWeight: '700',
    color: SaharaColors.onPrimaryFixed,
  },
  incomeBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  incomeLabel: {
    fontFamily: Fonts.label,
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    color: SaharaColors.secondary,
  },
  incomeValue: {
    fontFamily: Fonts.headline,
    fontSize: 22,
    fontWeight: '700',
    color: SaharaColors.primaryAccessible,
  },
  incomeMeta: {
    fontFamily: Fonts.body,
    fontSize: 11.5,
    color: SaharaColors.onSurfaceVariant,
  },
  incomeArrow: {
    width: 36,
    height: 36,
    borderRadius: Radius.full,
    backgroundColor: SaharaColors.primaryFixed,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterRow: {
    gap: 8,
    paddingVertical: 2,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sectionTitle: {
    fontFamily: Fonts.headline,
    fontSize: 19,
    fontWeight: '600',
    color: SaharaColors.onSurface,
  },
  sectionCount: {
    fontFamily: Fonts.label,
    fontSize: 12,
    fontWeight: '700',
    color: SaharaColors.secondary,
  },
  emptySectionText: {
    fontFamily: Fonts.body,
    fontSize: 13,
    color: SaharaColors.onSurfaceVariant,
  },
  cardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  amountText: {
    fontFamily: Fonts.headline,
    fontSize: 17,
    fontWeight: '700',
    color: SaharaColors.primaryAccessible,
  },
  employerLine: {
    fontFamily: Fonts.label,
    fontSize: 11.5,
    fontWeight: '600',
    color: SaharaColors.secondary,
  },
  jobTitle: {
    fontFamily: Fonts.headline,
    fontSize: 18,
    fontWeight: '600',
    color: SaharaColors.onSurface,
  },
  metaGrid: {
    gap: 5,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  metaText: {
    fontFamily: Fonts.body,
    fontSize: 12,
    color: SaharaColors.onSurfaceVariant,
  },
  addressUnlocked: {
    flex: 1,
    fontFamily: Fonts.label,
    fontSize: 12,
    fontWeight: '600',
    color: SaharaColors.onSurface,
  },
  bottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  detailLink: {
    fontFamily: Fonts.label,
    fontSize: 12,
    fontWeight: '700',
    color: SaharaColors.primaryAccessible,
  },
  nextStepBox: {
    backgroundColor: SaharaColors.surfaceContainerLow,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: Radius.md,
  },
  nextStepText: {
    fontFamily: Fonts.label,
    fontSize: 11.5,
    color: SaharaColors.onSurfaceVariant,
  },
});

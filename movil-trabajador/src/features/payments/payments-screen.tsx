/**
 * MÓDULO 11: PAGOS E INGRESOS
 * - Resumen de ingresos: Total transferidos, Pagos pendientes, Pagos en reclamación
 * - Historial de movimientos con detalle completo de cada pago (todos los estados en MXN)
 * - No solicita ni almacena datos bancarios; no afirma procesamiento financiero real externo
 */
import React, { useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Fonts, Radius, SaharaColors, Spacing } from '@/constants/theme';
import {
  EmptyState,
  FilterPill,
  JobStatusBadge,
  PaymentStatusBadge,
  SaharaButton,
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
  JOB_CATEGORY_LABELS,
  PAYMENT_STATUS_LABELS,
} from '@/shared/utils/formatters';
import type { WorkerPaymentItem } from '@/types/database';

type PaymentFilter = 'all' | 'transferred' | 'pending' | 'in_claim' | 'other';

export function WorkerPaymentsScreen() {
  const router = useRouter();
  const version = useWorkerStore((s) => s.version);
  const worker = useWorkerStore((s) =>
    s.db.profiles.find((p) => p.id === s.activeWorkerId),
  );

  const [filter, setFilter] = useState<PaymentFilter>('all');
  const [selectedPayment, setSelectedPayment] =
    useState<WorkerPaymentItem | null>(null);

  const summary = useMemo(() => {
    void version;
    return workerStore.getPaymentsSummaryAndHistory();
  }, [version]);

  const filteredItems = useMemo(() => {
    return summary.items.filter((item) => {
      if (filter === 'all') return true;
      if (filter === 'transferred') {
        return (
          item.status === 'transferred' ||
          item.status === 'partial_settlement_completed'
        );
      }
      if (filter === 'pending') {
        return [
          'not_started',
          'payment_pending',
          'confirmed',
          'transfer_pending',
          'transfer_failed',
          'partial_settlement_pending',
          'partial_settlement_failed',
        ].includes(item.status);
      }
      if (filter === 'in_claim') return item.status === 'in_claim';
      return ['refunded', 'cancelled', 'failed', 'refund_failed'].includes(
        item.status,
      );
    });
  }, [summary.items, filter]);

  return (
    <SaharaScreenShell
      header={
        <SaharaHeader
          title="Pagos e ingresos"
          subtitle="Historial en MXN"
          onBack={() => router.back()}
        />
      }
      footer={<WorkerBottomNav />}>
      {/* Tarjeta principal de resumen */}
      <SaharaCard
        variant="lowest"
        accentColor={SaharaColors.primaryAccessible}
        style={{ gap: 12 }}>
        <Text style={styles.overline}>Resumen de ingresos</Text>
        <View>
          <Text style={styles.heroLabel}>Total de pagos transferidos</Text>
          <Text style={styles.heroAmount}>
            {formatCurrencyMXN(summary.totalTransferredMxn)}
          </Text>
        </View>

        <View style={styles.subTotalsRow}>
          <View style={styles.subTotalBox}>
            <Text style={styles.subTotalLabel}>Pagos pendientes</Text>
            <Text style={styles.subTotalValue}>
              {formatCurrencyMXN(summary.totalPendingMxn)}
            </Text>
          </View>
          <View style={[styles.subTotalBox, styles.subTotalClaim]}>
            <Text style={styles.subTotalLabel}>En reclamación</Text>
            <Text style={[styles.subTotalValue, { color: SaharaColors.error }]}>
              {formatCurrencyMXN(summary.totalInClaimMxn)}
            </Text>
          </View>
        </View>

        {/* Estado de cuenta conectada sin datos bancarios */}
        <Pressable
          onPress={() => router.push('/(main)/stripe-connect' as never)}
          style={styles.connectStrip}>
          <SaharaIcon
            name={
              worker?.stripe_onboarding_complete
                ? 'verified_user'
                : 'account_balance'
            }
            size={15}
            color={
              worker?.stripe_onboarding_complete
                ? SaharaColors.success
                : SaharaColors.warning
            }
          />
          <Text style={styles.connectText}>
            Cuenta conectada:{' '}
            {worker?.stripe_onboarding_complete
              ? 'Verificada para transferencias'
              : 'Alta pendiente'}
          </Text>
          <Text style={styles.connectAction}>Ver</Text>
        </Pressable>
      </SaharaCard>

      {/* Filtros de movimientos */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.filtersRow}>
        <FilterPill
          label="Todos"
          count={summary.items.length}
          active={filter === 'all'}
          onPress={() => setFilter('all')}
        />
        <FilterPill
          label="Transferidos"
          active={filter === 'transferred'}
          onPress={() => setFilter('transferred')}
        />
        <FilterPill
          label="Pendientes"
          active={filter === 'pending'}
          onPress={() => setFilter('pending')}
        />
        <FilterPill
          label="En reclamación"
          active={filter === 'in_claim'}
          onPress={() => setFilter('in_claim')}
        />
        <FilterPill
          label="Cancelados / Otros"
          active={filter === 'other'}
          onPress={() => setFilter('other')}
        />
      </ScrollView>

      {/* Historial de movimientos */}
      {filteredItems.length === 0 ? (
        <EmptyState
          icon="payments"
          title="Sin movimientos en esta vista"
          description="Cuando completes trabajos o registres llegadas, aquí verás el estado actualizado de cada pago."
        />
      ) : (
        <View style={{ gap: 10 }}>
          {filteredItems.map((item) => (
            <SaharaCard
              key={item.id}
              variant="lowest"
              onPress={() => setSelectedPayment(item)}
              style={{ gap: 8 }}>
              <View style={styles.rowTop}>
                <PaymentStatusBadge status={item.status} />
                <Text style={styles.amount}>
                  {formatCurrencyMXN(item.job_amount_mxn)}
                </Text>
              </View>
              <Text style={styles.jobTitle}>{item.job_title}</Text>
              <Text style={styles.metaLine}>
                {item.employer_name} · {formatSpanishDate(item.job_date)} ·{' '}
                {item.folio}
              </Text>
              {item.status === 'in_claim' ? (
                <Text style={styles.claimHint}>
                  Los fondos permanecen bloqueados mientras la reclamación siga abierta.
                </Text>
              ) : null}
            </SaharaCard>
          ))}
        </View>
      )}

      {/* Modal de detalle del movimiento */}
      <Modal
        visible={Boolean(selectedPayment)}
        transparent
        animationType="slide"
        onRequestClose={() => setSelectedPayment(null)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            {selectedPayment ? (
              <>
                <View style={styles.modalHeader}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.overline}>
                      Detalle de movimiento · {selectedPayment.folio}
                    </Text>
                    <Text style={styles.modalTitle}>
                      {selectedPayment.job_title}
                    </Text>
                  </View>
                </View>

                <View style={styles.detailGrid}>
                  <View style={styles.detailRow}>
                    <Text style={styles.detailKey}>Importe acordado</Text>
                    <Text style={styles.detailValStrong}>
                      {formatCurrencyMXN(selectedPayment.job_amount_mxn)}
                    </Text>
                  </View>
                  <View style={styles.detailRow}>
                    <Text style={styles.detailKey}>Estado del pago</Text>
                    <Text style={styles.detailVal}>
                      {PAYMENT_STATUS_LABELS[selectedPayment.status]}
                    </Text>
                  </View>
                  <View style={styles.detailRow}>
                    <Text style={styles.detailKey}>Empleador</Text>
                    <Text style={styles.detailVal}>
                      {selectedPayment.employer_name}
                    </Text>
                  </View>
                  <View style={styles.detailRow}>
                    <Text style={styles.detailKey}>Categoría</Text>
                    <Text style={styles.detailVal}>
                      {JOB_CATEGORY_LABELS[selectedPayment.category]}
                    </Text>
                  </View>
                  <View style={styles.detailRow}>
                    <Text style={styles.detailKey}>Fecha del trabajo</Text>
                    <Text style={styles.detailVal}>
                      {formatSpanishDate(selectedPayment.job_date)}
                    </Text>
                  </View>
                  <View style={styles.detailRow}>
                    <Text style={styles.detailKey}>Estado del trabajo</Text>
                    <JobStatusBadge status={selectedPayment.job_status} />
                  </View>
                </View>

                {selectedPayment.status === 'in_claim' ? (
                  <View style={styles.claimNotice}>
                    <Text style={styles.claimNoticeText}>
                      Este pago se encuentra vinculado a una reclamación abierta. Los fondos permanecen bloqueados hasta el cierre de la revisión.
                    </Text>
                  </View>
                ) : null}

                <View style={{ gap: 8 }}>
                  <SaharaButton
                    label="Ver trabajo relacionado"
                    variant="outline"
                    onPress={() => {
                      const jId = selectedPayment.job_id;
                      setSelectedPayment(null);
                      router.push(`/(main)/job/${jId}` as never);
                    }}
                  />
                  <SaharaButton
                    label="Cerrar"
                    onPress={() => setSelectedPayment(null)}
                  />
                </View>
              </>
            ) : null}
          </View>
        </View>
      </Modal>
    </SaharaScreenShell>
  );
}

const styles = StyleSheet.create({
  overline: {
    fontFamily: Fonts.label,
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.7,
    color: SaharaColors.secondary,
  },
  heroLabel: {
    fontFamily: Fonts.body,
    fontSize: 12.5,
    color: SaharaColors.onSurfaceVariant,
  },
  heroAmount: {
    fontFamily: Fonts.headline,
    fontSize: 30,
    fontWeight: '700',
    color: SaharaColors.primaryAccessible,
  },
  subTotalsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  subTotalBox: {
    flex: 1,
    backgroundColor: SaharaColors.surfaceContainerLow,
    padding: 12,
    borderRadius: Radius.lg,
    gap: 2,
  },
  subTotalClaim: {
    backgroundColor: SaharaColors.errorContainer,
  },
  subTotalLabel: {
    fontFamily: Fonts.label,
    fontSize: 11,
    color: SaharaColors.onSurfaceVariant,
  },
  subTotalValue: {
    fontFamily: Fonts.headline,
    fontSize: 16,
    fontWeight: '700',
    color: SaharaColors.onSurface,
  },
  connectStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: SaharaColors.borderSubtle,
  },
  connectText: {
    flex: 1,
    fontFamily: Fonts.label,
    fontSize: 12,
    color: SaharaColors.onSurface,
  },
  connectAction: {
    fontFamily: Fonts.label,
    fontSize: 12,
    fontWeight: '700',
    color: SaharaColors.primaryAccessible,
  },
  filtersRow: {
    gap: 8,
    paddingVertical: 2,
  },
  rowTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  amount: {
    fontFamily: Fonts.headline,
    fontSize: 17,
    fontWeight: '700',
    color: SaharaColors.onSurface,
  },
  jobTitle: {
    fontFamily: Fonts.headline,
    fontSize: 17,
    fontWeight: '600',
    color: SaharaColors.onSurface,
  },
  metaLine: {
    fontFamily: Fonts.body,
    fontSize: 12,
    color: SaharaColors.onSurfaceVariant,
  },
  claimHint: {
    fontFamily: Fonts.label,
    fontSize: 11.5,
    color: SaharaColors.error,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: SaharaColors.backdropOverlay,
    justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: SaharaColors.surfaceContainerLowest,
    borderTopLeftRadius: Radius.xxl,
    borderTopRightRadius: Radius.xxl,
    padding: Spacing.lg,
    gap: Spacing.md,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  modalTitle: {
    fontFamily: Fonts.headline,
    fontSize: 20,
    fontWeight: '600',
    color: SaharaColors.onSurface,
  },
  detailGrid: {
    gap: 10,
    backgroundColor: SaharaColors.surfaceContainerLow,
    padding: Spacing.md,
    borderRadius: Radius.xl,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  detailKey: {
    fontFamily: Fonts.body,
    fontSize: 12.5,
    color: SaharaColors.onSurfaceVariant,
  },
  detailVal: {
    fontFamily: Fonts.label,
    fontSize: 12.5,
    fontWeight: '600',
    color: SaharaColors.onSurface,
    textAlign: 'right',
    flexShrink: 1,
  },
  detailValStrong: {
    fontFamily: Fonts.headline,
    fontSize: 18,
    fontWeight: '700',
    color: SaharaColors.primaryAccessible,
  },
  claimNotice: {
    backgroundColor: SaharaColors.errorContainer,
    padding: 12,
    borderRadius: Radius.lg,
  },
  claimNoticeText: {
    fontFamily: Fonts.label,
    fontSize: 12,
    color: SaharaColors.onErrorContainer,
    lineHeight: 17,
  },
});

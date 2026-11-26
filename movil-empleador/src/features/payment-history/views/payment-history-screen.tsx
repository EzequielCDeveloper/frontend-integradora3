/**
 * UI-EMP-12: Historial de Trabajos y Pagos Empleador
 * Source of Truth: Especificacion_de_Arquitectura_de_Software_v2.md (Section 3.2 UI-EMP-12, RF-17, RF-18, D-02)
 * Rules enforced:
 * - Lists employer jobs and payments dynamically from `listEmployerPaymentHistory()` via FlatList
 * - Displays `job_amount_mxn`, `platform_fee_mxn`, `total_charged_mxn`, `payment_status` (confirmed, transferred, in_claim, refunded, partial_settlement_completed), and receipt detail modal
 */
import React, { useCallback, useMemo, useState } from 'react';
import {
  FlatList,
  Modal,
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
  JobStatusBadge,
  LoadingSkeleton,
  PaymentStatusBadge,
  SaharaButton,
  SaharaCard,
  SaharaHeader,
  SaharaIcon,
  SaharaScreenShell,
} from '@/components/ui/sahara-primitives';
import { EmployerBottomNav } from '@/components/ui/employer-bottom-nav';
import {
  employerRepository,
  useMockBackendStore,
} from '@/services/mocks/mock-employer-repository';
import { useAsyncLoad } from '@/shared/hooks/use-async-load';
import { mapDomainErrorToUI } from '@/shared/utils/error-mapper';
import {
  formatCurrencyMXN,
  formatSpanishDate,
  PAYMENT_STATUS_LABELS,
} from '@/shared/utils/formatters';
import type { EmployerPaymentHistoryItem } from '@/types/database';

type HistoryFilter = 'all' | 'transferred' | 'escrow' | 'refunded';

export function PaymentHistoryScreenView() {
  const router = useRouter();
  const storeVersion = useMockBackendStore((s) => s.version);

  const [items, setItems] = useState<EmployerPaymentHistoryItem[]>([]);
  const [filter, setFilter] = useState<HistoryFilter>('all');
  const [isLoading, setIsLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [receiptTarget, setReceiptTarget] =
    useState<EmployerPaymentHistoryItem | null>(null);

  const loadHistory = useCallback(async () => {
    setIsLoading(true);
    setErrorMsg(null);
    try {
      const list = await employerRepository.listEmployerPaymentHistory();
      setItems(list);
    } catch (err) {
      const mapped = mapDomainErrorToUI(err);
      setErrorMsg(mapped.message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useAsyncLoad(loadHistory, storeVersion);

  const filteredItems = useMemo(() => {
    if (filter === 'all') return items;
    if (filter === 'transferred') {
      return items.filter(
        (i) =>
          i.payment_status === 'transferred' ||
          i.payment_status === 'transfer_pending',
      );
    }
    if (filter === 'escrow') {
      return items.filter(
        (i) =>
          i.payment_status === 'confirmed' ||
          i.payment_status === 'payment_pending' ||
          i.payment_status === 'in_claim',
      );
    }
    return items.filter(
      (i) =>
        i.payment_status === 'refunded' ||
        i.payment_status === 'partial_settlement_completed' ||
        i.payment_status === 'partial_settlement_pending' ||
        i.case_decision === 'partial',
    );
  }, [items, filter]);

  const financialTotals = useMemo(() => {
    const totalCharged = items
      .filter((i) => i.payment_status !== 'cancelled')
      .reduce((acc, i) => acc + i.total_charged_mxn, 0);
    const inEscrow = items
      .filter(
        (i) =>
          i.payment_status === 'confirmed' || i.payment_status === 'in_claim',
      )
      .reduce((acc, i) => acc + i.total_charged_mxn, 0);
    const settled = items
      .filter(
        (i) =>
          i.payment_status === 'transferred' ||
          i.payment_status === 'partial_settlement_completed',
      )
      .reduce((acc, i) => acc + i.total_charged_mxn, 0);

    return { totalCharged, inEscrow, settled };
  }, [items]);

  const renderHeader = () => (
    <View style={{ gap: Spacing.md }}>
      {/* Section Header */}
      <View style={{ gap: 4 }}>
        <View style={styles.auditPill}>
          <SaharaIcon
            name="verified_user"
            size={13}
            color={SaharaColors.primary}
          />
          <Text style={styles.auditPillText}>RESUMEN DE TUS PAGOS</Text>
        </View>
        <Text style={styles.pageTitle}>Historial de Pagos</Text>
        <Text style={styles.pageSub}>
          Aquí ves cuánto pagaste en cada trabajo.
        </Text>
      </View>

      {/* Consolidated Balance Card */}
      <SaharaCard variant="default" style={{ gap: 12 }}>
        <View style={styles.balanceHeaderRow}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <SaharaIcon
              name="account_balance_wallet"
              size={18}
              color={SaharaColors.primary}
            />
            <Text style={styles.balanceSuper}>RESUMEN</Text>
          </View>
          <View style={styles.cfdiChip}>
            <Text style={styles.cfdiChipText}>Pago protegido</Text>
          </View>
        </View>

        <View>
          <Text style={styles.totalLabel}>Total Pagado</Text>
          <Text style={styles.totalAmount}>
            {formatCurrencyMXN(financialTotals.totalCharged)}
          </Text>
        </View>

        <View style={styles.splitMetricsBox}>
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={styles.splitLabel}>Dinero Protegido</Text>
            <Text style={styles.splitValue}>
              {formatCurrencyMXN(financialTotals.inEscrow)}
            </Text>
          </View>
          <View style={styles.verticalDivider} />
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={styles.splitLabel}>Entregado al Trabajador</Text>
            <Text style={styles.splitValue}>
              {formatCurrencyMXN(financialTotals.settled)}
            </Text>
          </View>
        </View>
      </SaharaCard>

      {/* Filter Tabs (48dp touch targets + tab semantics) */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        accessibilityRole="tablist"
        contentContainerStyle={styles.filterPillsRow}>
        {(
          [
            { key: 'all', label: 'Todos' },
            { key: 'transferred', label: 'Transferidos' },
            { key: 'escrow', label: 'Protegido' },
            { key: 'refunded', label: 'Devoluciones' },
          ] as const
        ).map((tab) => {
          const active = filter === tab.key;
          return (
            <Pressable
              key={tab.key}
              testID={`history-filter-${tab.key}`}
              accessibilityRole="tab"
              accessibilityLabel={`Filtrar pagos por ${tab.label}`}
              accessibilityState={{ selected: active }}
              onPress={() => setFilter(tab.key)}
              style={[
                styles.filterPill,
                active ? styles.filterPillActive : undefined,
              ]}>
              <Text
                style={[
                  styles.filterPillText,
                  active ? styles.filterPillTextActive : undefined,
                ]}>
                {tab.label}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );

  const renderPaymentItem = ({
    item,
  }: {
    item: EmployerPaymentHistoryItem;
  }) => (
    <SaharaCard
      testID={`payment-card-${item.job_id}`}
      variant="low"
      style={{ gap: 12 }}>
      {/* Top Row */}
      <View style={styles.itemHeaderRow}>
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={styles.itemFolio}>
            {item.folio} · {formatSpanishDate(item.job_date)}
          </Text>
          <Text style={styles.itemTitle}>{item.title}</Text>
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          <Text style={styles.itemTotal}>
            {formatCurrencyMXN(item.total_charged_mxn)}
          </Text>
          <Text style={styles.itemMethodSub}>Visa •••• 4242</Text>
        </View>
      </View>

      {/* Worker Snapshot */}
      {item.worker_name ? (
        <View style={styles.workerRow}>
          <View style={styles.workerInitials}>
            <Text style={styles.workerInitialsText}>
              {item.worker_name.slice(0, 2).toUpperCase()}
            </Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.workerName}>{item.worker_name}</Text>
            <Text style={styles.workerRating}>
              Calif. {item.worker_rating ?? 4.9} · Especialista verificado
            </Text>
          </View>
        </View>
      ) : null}

      {/* Arbitration Settlement Breakdown if applicable (D-02) */}
      {item.case_decision ? (
        <View style={styles.arbitrationBox}>
          <View style={styles.arbitrationHeader}>
            <SaharaIcon
              name="balance"
              size={14}
              color={SaharaColors.tertiary}
            />
            <Text style={styles.arbitrationTitle}>
              Resolución de Solidez MX
            </Text>
          </View>
          <View style={styles.breakdownLine}>
            <Text style={styles.breakdownLabel}>Te devolvimos:</Text>
            <Text
              style={[
                styles.breakdownValue,
                { color: SaharaColors.primary },
              ]}>
              +{formatCurrencyMXN(item.approved_refund_amount ?? 0)}
            </Text>
          </View>
          <View style={styles.breakdownLine}>
            <Text style={styles.breakdownLabel}>Se pagó al trabajador:</Text>
            <Text style={styles.breakdownValue}>
              {formatCurrencyMXN(item.approved_transfer_amount ?? 0)}
            </Text>
          </View>
        </View>
      ) : (
        <View style={{ gap: 4 }}>
          <View style={styles.breakdownLine}>
            <Text style={styles.breakdownLabel}>Pago al trabajador:</Text>
            <Text style={styles.breakdownValue}>
              {formatCurrencyMXN(item.job_amount_mxn)}
            </Text>
          </View>
          <View style={styles.breakdownLine}>
            <Text style={styles.breakdownLabel}>
              Comisión (10%):
            </Text>
            <Text style={styles.breakdownValue}>
              {formatCurrencyMXN(item.platform_fee_mxn)}
            </Text>
          </View>
        </View>
      )}

      {/* Badges Row */}
      <View style={styles.badgesRow}>
        <JobStatusBadge status={item.job_status} />
        <PaymentStatusBadge status={item.payment_status} />
        {item.employer_review_rating ? (
          <View style={styles.reviewedPill}>
            <Text style={styles.reviewedPillText}>
              Evaluado {item.employer_review_rating}.0
            </Text>
          </View>
        ) : null}
      </View>

      {/* Actions */}
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <View style={{ flex: 1 }}>
          <SaharaButton
            testID={`view-receipt-btn-${item.job_id}`}
            label="Ver Comprobante"
            icon="receipt"
            variant="outline"
            size="sm"
            onPress={() => setReceiptTarget(item)}
          />
        </View>
        {item.job_status === 'completed' && !item.employer_review_rating ? (
          <View style={{ flex: 1 }}>
            <SaharaButton
              label="Evaluar Trabajador"
              icon="star"
              size="sm"
              onPress={() =>
                router.push(`/(main)/job/${item.job_id}/review` as never)
              }
            />
          </View>
        ) : null}
      </View>
    </SaharaCard>
  );

  return (
    <SaharaScreenShell
      scrollable={false}
      header={
        <SaharaHeader
          title="Movimientos y Pagos"
          subtitle="Tus pagos"
          rightAction={
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Ir al centro de notificaciones"
              onPress={() => router.push('/(main)/notifications')}
              style={styles.iconBtn}>
              <SaharaIcon
                name="notifications"
                size={19}
                color={SaharaColors.onSurface}
              />
            </Pressable>
          }
        />
      }
      footer={<EmployerBottomNav />}>
      <FlatList
        data={isLoading || errorMsg ? [] : filteredItems}
        keyExtractor={(item) => item.job_id}
        renderItem={renderPaymentItem}
        ListHeaderComponent={renderHeader}
        ListEmptyComponent={
          isLoading ? (
            <LoadingSkeleton message="Cargando historial financiero de trabajos y pagos..." />
          ) : errorMsg ? (
            <ErrorState message={errorMsg} onRetry={() => void loadHistory()} />
          ) : (
            <EmptyState
              icon="receipt_long"
              title="Sin movimientos en esta categoría"
              description="No se encontraron transacciones bajo el filtro seleccionado."
            />
          )
        }
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
      />

      {/* Receipt Detail Modal */}
      <Modal
        visible={receiptTarget !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setReceiptTarget(null)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeaderRow}>
              <Text style={styles.modalTitle}>
                Comprobante {receiptTarget?.folio}
              </Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Cerrar comprobante"
                onPress={() => setReceiptTarget(null)}
                style={styles.closeModalBtn}>
                <SaharaIcon name="close" size={18} />
              </Pressable>
            </View>

            {receiptTarget ? (
              <View style={styles.receiptBox}>
                <Text style={styles.receiptJobTitle}>
                  {receiptTarget.title}
                </Text>
                <Text style={styles.receiptSub}>
                  Referencia de pago:{' '}
                  {receiptTarget.stripe_payment_intent_id ?? 'En proceso'}
                </Text>
                <View style={styles.breakdownLine}>
                  <Text style={styles.breakdownLabel}>Pago al trabajador:</Text>
                  <Text style={styles.breakdownValue}>
                    {formatCurrencyMXN(receiptTarget.job_amount_mxn)}
                  </Text>
                </View>
                <View style={styles.breakdownLine}>
                  <Text style={styles.breakdownLabel}>
                    Comisión (10%):
                  </Text>
                  <Text style={styles.breakdownValue}>
                    {formatCurrencyMXN(receiptTarget.platform_fee_mxn)}
                  </Text>
                </View>
                <View style={styles.breakdownLine}>
                  <Text style={styles.breakdownLabel}>Total pagado:</Text>
                  <Text
                    style={[
                      styles.breakdownValue,
                      { color: SaharaColors.primary },
                    ]}>
                    {formatCurrencyMXN(receiptTarget.total_charged_mxn)}
                  </Text>
                </View>
                <View style={styles.breakdownLine}>
                  <Text style={styles.breakdownLabel}>Estado del pago:</Text>
                  <Text style={styles.breakdownValue}>
                    {PAYMENT_STATUS_LABELS[receiptTarget.payment_status]}
                  </Text>
                </View>
              </View>
            ) : null}

            <SaharaButton
              label="Cerrar Comprobante"
              onPress={() => setReceiptTarget(null)}
            />
          </View>
        </View>
      </Modal>
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
  iconBtn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: SaharaColors.surfaceContainerLow,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeModalBtn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: SaharaColors.surfaceContainerLow,
    alignItems: 'center',
    justifyContent: 'center',
  },
  auditPill: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 5,
    backgroundColor: SaharaColors.primaryFixed,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: Radius.full,
  },
  auditPillText: {
    fontFamily: Fonts.label,
    fontSize: 10.5,
    fontWeight: '700',
    color: SaharaColors.primary,
  },
  pageTitle: {
    fontFamily: Fonts.headline,
    fontSize: 26,
    fontWeight: '700',
    color: SaharaColors.onSurface,
  },
  pageSub: {
    fontFamily: Fonts.body,
    fontSize: 12.5,
    color: SaharaColors.onSurfaceVariant,
    lineHeight: 18,
  },
  balanceHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  balanceSuper: {
    fontFamily: Fonts.label,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
    color: SaharaColors.secondary,
  },
  cfdiChip: {
    backgroundColor: SaharaColors.surfaceContainerHighest,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: Radius.sm,
  },
  cfdiChipText: {
    fontFamily: Fonts.label,
    fontSize: 11,
    fontWeight: '700',
    color: SaharaColors.primary,
  },
  totalLabel: {
    fontFamily: Fonts.label,
    fontSize: 12,
    color: SaharaColors.onSurfaceVariant,
  },
  totalAmount: {
    fontFamily: Fonts.headline,
    fontSize: 28,
    fontWeight: '700',
    color: SaharaColors.onSurface,
  },
  splitMetricsBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: SaharaColors.surfaceContainerLowest,
    padding: 12,
    borderRadius: Radius.lg,
    gap: 12,
  },
  splitLabel: {
    fontFamily: Fonts.label,
    fontSize: 11,
    color: SaharaColors.onSurfaceVariant,
  },
  splitValue: {
    fontFamily: Fonts.headline,
    fontSize: 16,
    fontWeight: '700',
    color: SaharaColors.onSurface,
  },
  verticalDivider: {
    width: 1,
    height: 30,
    backgroundColor: SaharaColors.outlineVariant,
  },
  filterPillsRow: {
    gap: 8,
    paddingVertical: 4,
  },
  filterPill: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    minHeight: 48,
    minWidth: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: Radius.full,
    backgroundColor: SaharaColors.surfaceContainerHigh,
  },
  filterPillActive: {
    backgroundColor: SaharaColors.primaryAccessible,
  },
  filterPillText: {
    fontFamily: Fonts.label,
    fontSize: 12.5,
    fontWeight: '600',
    color: SaharaColors.onSurfaceVariant,
  },
  filterPillTextActive: {
    color: SaharaColors.onPrimary,
    fontWeight: '700',
  },
  itemHeaderRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 10,
  },
  itemFolio: {
    fontFamily: Fonts.label,
    fontSize: 11,
    fontWeight: '700',
    color: SaharaColors.secondary,
  },
  itemTitle: {
    fontFamily: Fonts.headline,
    fontSize: 17,
    fontWeight: '700',
    color: SaharaColors.onSurface,
  },
  itemTotal: {
    fontFamily: Fonts.headline,
    fontSize: 18,
    fontWeight: '700',
    color: SaharaColors.onSurface,
  },
  itemMethodSub: {
    fontFamily: Fonts.label,
    fontSize: 10.5,
    color: SaharaColors.secondary,
  },
  workerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: SaharaColors.surfaceContainerLowest,
    padding: 10,
    borderRadius: Radius.md,
  },
  workerInitials: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: SaharaColors.primaryFixed,
    alignItems: 'center',
    justifyContent: 'center',
  },
  workerInitialsText: {
    fontFamily: Fonts.label,
    fontSize: 12,
    fontWeight: '700',
    color: SaharaColors.primary,
  },
  workerName: {
    fontFamily: Fonts.label,
    fontSize: 12.5,
    fontWeight: '700',
    color: SaharaColors.onSurface,
  },
  workerRating: {
    fontFamily: Fonts.body,
    fontSize: 11,
    color: SaharaColors.secondary,
  },
  arbitrationBox: {
    backgroundColor: SaharaColors.tertiaryFixed,
    padding: 10,
    borderRadius: Radius.md,
    gap: 4,
  },
  arbitrationHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  arbitrationTitle: {
    fontFamily: Fonts.label,
    fontSize: 12,
    fontWeight: '700',
    color: SaharaColors.onTertiaryContainer,
  },
  breakdownLine: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  breakdownLabel: {
    fontFamily: Fonts.body,
    fontSize: 12,
    color: SaharaColors.secondary,
  },
  breakdownValue: {
    fontFamily: Fonts.label,
    fontSize: 12.5,
    fontWeight: '700',
    color: SaharaColors.onSurface,
  },
  badgesRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  reviewedPill: {
    backgroundColor: SaharaColors.primaryFixed,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: Radius.full,
  },
  reviewedPillText: {
    fontFamily: Fonts.label,
    fontSize: 11,
    fontWeight: '700',
    color: SaharaColors.primary,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: SaharaColors.backdropOverlay,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.md,
  },
  modalCard: {
    width: '100%',
    maxWidth: 400,
    backgroundColor: SaharaColors.surfaceContainerLowest,
    borderRadius: Radius.xl,
    padding: Spacing.lg,
    gap: 14,
  },
  modalHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  modalTitle: {
    fontFamily: Fonts.headline,
    fontSize: 19,
    fontWeight: '700',
    color: SaharaColors.onSurface,
    flex: 1,
  },
  receiptBox: {
    backgroundColor: SaharaColors.surfaceContainerLow,
    borderRadius: Radius.lg,
    padding: 14,
    gap: 8,
  },
  receiptJobTitle: {
    fontFamily: Fonts.label,
    fontSize: 14,
    fontWeight: '700',
    color: SaharaColors.onSurface,
  },
  receiptSub: {
    fontFamily: Fonts.mono,
    fontSize: 11,
    color: SaharaColors.secondary,
  },
});

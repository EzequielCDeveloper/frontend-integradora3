/**
 * UI-EMP-14: Mis Casos y Tickets
 * Source of Truth: Especificacion_de_Arquitectura_de_Software_v2.md (Section 3.2 UI-EMP-14, RF-25, RF-28, D-02)
 * Rules enforced:
 * - Lists open and historical cases (`open`, `in_review`, `resolved`, `closed`) via FlatList
 * - Detail thread view (`case_messages`) with direct reply composer and per-case error state
 * - Arbitration resolution breakdown (`decision`, `approved_transfer_amount`, `approved_refund_amount`, `resolution_notes`)
 * - 7-day objection window countdown (`auto_close_deadline`) and CTA to Object (`object_case` -> returns case to `in_review`) or Accept & Close (with two-step ConfirmationModal)
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
  CaseStatusBadge,
  ConfirmationModal,
  CountdownBanner,
  EmptyState,
  ErrorState,
  LoadingSkeleton,
  SaharaButton,
  SaharaCard,
  SaharaHeader,
  SaharaIcon,
  SaharaInput,
  SaharaScreenShell,
} from '@/components/ui/sahara-primitives';
import { EmployerBottomNav } from '@/components/ui/employer-bottom-nav';
import {
  employerRepository,
  useMockBackendStore,
} from '@/services/mocks/mock-employer-repository';
import { useAsyncLoad } from '@/shared/hooks/use-async-load';
import { useIdempotentAction } from '@/shared/hooks/use-idempotent-action';
import { mapDomainErrorToUI } from '@/shared/utils/error-mapper';
import {
  CASE_STATUS_LABELS,
  CASE_TYPE_LABELS,
  formatCurrencyMXN,
  formatSpanishDate,
  TICKET_CATEGORY_LABELS,
} from '@/shared/utils/formatters';
import { validateCaseMessageBody } from '@/shared/utils/validators';
import type { CaseStatus, CaseWithThread } from '@/types/database';

const CASE_FILTERS: (CaseStatus | 'all')[] = [
  'all',
  'open',
  'in_review',
  'resolved',
  'closed',
];

export function MyCasesScreenView() {
  const router = useRouter();
  const storeVersion = useMockBackendStore((s) => s.version);

  const [selectedFilter, setSelectedFilter] = useState<CaseStatus | 'all'>(
    'all',
  );
  const [cases, setCases] = useState<CaseWithThread[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Expanded thread & per-case reply state
  const [expandedCaseId, setExpandedCaseId] = useState<string | null>(null);
  const [replyTexts, setReplyTexts] = useState<Record<string, string>>({});
  const [replyErrors, setReplyErrors] = useState<Record<string, string | null>>(
    {},
  );

  // 7-day Objection Modal state (`object_case`)
  const [objectTargetCase, setObjectTargetCase] =
    useState<CaseWithThread | null>(null);
  const [objectionNotes, setObjectionNotes] = useState('');
  const [objectionError, setObjectionError] = useState<string | null>(null);

  // Two-step Confirmation Modal for accepting arbitral settlement (`acceptResolvedCase`)
  const [acceptTargetCase, setAcceptTargetCase] =
    useState<CaseWithThread | null>(null);

  const loadCases = useCallback(async () => {
    setIsLoading(true);
    setErrorMsg(null);
    try {
      const list = await employerRepository.listMyCases('all');
      setCases(list);
    } catch (err) {
      const mapped = mapDomainErrorToUI(err);
      setErrorMsg(mapped.message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useAsyncLoad(loadCases, storeVersion);

  const filteredCases = useMemo(() => {
    if (selectedFilter === 'all') return cases;
    return cases.filter((c) => c.status === selectedFilter);
  }, [cases, selectedFilter]);

  const { execute: handleSendReply, isPending: isSendingReply } =
    useIdempotentAction(async (caseId: string) => {
      setReplyErrors((prev) => ({ ...prev, [caseId]: null }));
      const body = replyTexts[caseId] ?? '';
      const err = validateCaseMessageBody(body);
      if (err) {
        setReplyErrors((prev) => ({ ...prev, [caseId]: err }));
        return;
      }
      try {
        await employerRepository.sendCaseMessage(caseId, body);
        setReplyTexts((prev) => ({ ...prev, [caseId]: '' }));
      } catch (e) {
        const mapped = mapDomainErrorToUI(e);
        setReplyErrors((prev) => ({ ...prev, [caseId]: mapped.message }));
      }
    });

  const { execute: handleObjectResolution, isPending: isObjecting } =
    useIdempotentAction(async () => {
      if (!objectTargetCase) return;
      setObjectionError(null);
      const err = validateCaseMessageBody(objectionNotes);
      if (err) {
        setObjectionError(err);
        return;
      }
      try {
        await employerRepository.object_case(
          objectTargetCase.id,
          objectionNotes,
        );
        setObjectTargetCase(null);
        setObjectionNotes('');
      } catch (e) {
        const mapped = mapDomainErrorToUI(e);
        setObjectionError(mapped.message);
      }
    });

  const { execute: handleAcceptResolution, isPending: isAccepting } =
    useIdempotentAction(async () => {
      if (!acceptTargetCase) return;
      setErrorMsg(null);
      try {
        await employerRepository.acceptResolvedCase(acceptTargetCase.id);
        setAcceptTargetCase(null);
      } catch (e) {
        const mapped = mapDomainErrorToUI(e);
        setErrorMsg(mapped.message);
        setAcceptTargetCase(null);
      }
    });

  const renderHeader = () => (
    <View style={{ gap: Spacing.md }}>
      {/* Top Action Strip */}
      <View style={styles.topRow}>
        <Text style={styles.topSubText}>
          Aquí ves tus reclamos y consultas de ayuda
        </Text>
      </View>

      {/* Filter Chips (48dp touch targets + tab semantics) */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        accessibilityRole="tablist"
        contentContainerStyle={styles.filterRow}>
        {CASE_FILTERS.map((st) => {
          const isActive = selectedFilter === st;
          const label = st === 'all' ? 'Todos' : CASE_STATUS_LABELS[st];
          const count =
            st === 'all'
              ? cases.length
              : cases.filter((c) => c.status === st).length;

          return (
            <Pressable
              key={st}
              testID={`case-filter-${st}`}
              accessibilityRole="tab"
              accessibilityLabel={`Filtrar casos por ${label}, ${count} expedientes`}
              accessibilityState={{ selected: isActive }}
              onPress={() => setSelectedFilter(st)}
              style={[
                styles.filterChip,
                isActive ? styles.filterChipActive : undefined,
              ]}>
              <Text
                style={[
                  styles.filterChipText,
                  isActive ? styles.filterChipTextActive : undefined,
                ]}>
                {label} ({count})
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );

  const renderCaseCard = ({ item: c }: { item: CaseWithThread }) => {
    const isExpanded = expandedCaseId === c.id;
    const isResolvedWithDeadline =
      c.status === 'resolved' && c.auto_close_deadline !== null;
    const caseReplyError = replyErrors[c.id] ?? null;

    return (
      <SaharaCard
        testID={`case-card-${c.id}`}
        variant="lowest"
        accentColor={
          c.status === 'resolved'
            ? SaharaColors.primary
            : c.status === 'open'
              ? SaharaColors.tertiary
              : undefined
        }
        style={{ gap: 14 }}>
        {/* Header */}
        <View style={styles.cardHeaderRow}>
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={styles.caseTypeSuper}>
              {c.folio} · {CASE_TYPE_LABELS[c.case_type]}
            </Text>
            <Text style={styles.caseTitle}>
              {c.job_title
                ? `${c.job_title} · ${c.job_folio}`
                : c.ticket_category
                  ? TICKET_CATEGORY_LABELS[c.ticket_category]
                  : 'Expediente de Soporte'}
            </Text>
          </View>
          <CaseStatusBadge status={c.status} />
        </View>

        <Text style={styles.caseDesc}>{c.description}</Text>

        {/* Arbitration Resolution Breakdown (D-02) */}
        {c.decision ? (
          <View style={styles.resolutionBox}>
            <View style={styles.resolutionHeaderRow}>
              <SaharaIcon
                name="gavel"
                size={16}
                color={SaharaColors.primary}
              />
              <Text style={styles.resolutionTitle}>
                Resolución de Solidez MX
              </Text>
            </View>
            {c.resolution_notes ? (
              <Text style={styles.resolutionNotes}>{c.resolution_notes}</Text>
            ) : null}

            <View style={styles.amountsBreakdownBox}>
              <View style={styles.amountLine}>
                <Text style={styles.amountLabel}>
                  Te devolvemos:
                </Text>
                <Text
                  style={[
                    styles.amountValue,
                    { color: SaharaColors.primary },
                  ]}>
                  {formatCurrencyMXN(c.approved_refund_amount ?? 0)}
                </Text>
              </View>
              <View style={styles.amountLine}>
                <Text style={styles.amountLabel}>
                  Se paga al trabajador:
                </Text>
                <Text style={styles.amountValue}>
                  {formatCurrencyMXN(c.approved_transfer_amount ?? 0)}
                </Text>
              </View>
            </View>
          </View>
        ) : null}

        {/* 7-Day Objection Window Countdown & Actions (`object_case`) */}
        {isResolvedWithDeadline ? (
          <View style={{ gap: 10 }}>
            <CountdownBanner
              targetIso={c.auto_close_deadline}
              title="Tienes 7 días para responder"
              subtitle="Si estás de acuerdo toca Aceptar. Si no, toca No estoy de acuerdo."
              mode="days"
              variant="tertiary"
            />

            <View style={{ flexDirection: 'row', gap: 10 }}>
              <View style={{ flex: 1 }}>
                <SaharaButton
                  testID={`object-case-btn-${c.id}`}
                  label="No estoy de acuerdo"
                  variant="outline"
                  size="sm"
                  onPress={() => {
                    setObjectionError(null);
                    setObjectionNotes('');
                    setObjectTargetCase(c);
                  }}
                />
              </View>
              <View style={{ flex: 1 }}>
                <SaharaButton
                  testID={`accept-case-btn-${c.id}`}
                  label="Aceptar"
                  variant="primary"
                  size="sm"
                  loading={isAccepting}
                  onPress={() => setAcceptTargetCase(c)}
                />
              </View>
            </View>
          </View>
        ) : null}

        {/* Thread Toggle & Message History (`case_messages`) */}
        <View style={styles.threadHeaderRow}>
          <Text style={styles.threadCountText}>
            Hilo del caso ({c.messages.length}{' '}
            {c.messages.length === 1 ? 'mensaje' : 'mensajes'} ·{' '}
            {c.attachments.length}{' '}
            {c.attachments.length === 1 ? 'evidencia' : 'evidencias'})
          </Text>
          <Pressable
            testID={`toggle-case-thread-btn-${c.id}`}
            accessibilityRole="button"
            accessibilityLabel={
              isExpanded
                ? `Ocultar hilo de mensajes del caso ${c.folio}`
                : `Ver hilo completo del caso ${c.folio}`
            }
            onPress={() => setExpandedCaseId(isExpanded ? null : c.id)}
            style={styles.expandBtn}>
            <Text style={styles.expandLinkText}>
              {isExpanded ? 'Ocultar hilo (-)' : 'Ver hilo completo (+)'}
            </Text>
          </Pressable>
        </View>

        {/* Latest Message Preview or Full Thread */}
        {c.messages.length > 0 ? (
          <View style={{ gap: 8 }}>
            {(isExpanded
              ? c.messages
              : [c.messages[c.messages.length - 1]]
            ).map((msg) => (
              <View key={msg.id} style={styles.messageItemBox}>
                <View style={styles.messageHeaderRow}>
                  <Text
                    style={[styles.messageAuthor, { flex: 1, marginRight: 8 }]}
                    numberOfLines={1}>
                    {msg.author_name}{' '}
                    {msg.author_role === 'admin' ? '(Admin)' : '(Tú)'}
                  </Text>
                  <Text style={[styles.messageDate, { flexShrink: 0 }]}>
                    {formatSpanishDate(msg.created_at)}
                  </Text>
                </View>
                <Text style={styles.messageBody}>{msg.body}</Text>
              </View>
            ))}
          </View>
        ) : null}

        {/* Quick Reply Composer for active cases */}
        {c.status !== 'closed' ? (
          <View style={{ gap: 8 }}>
            {caseReplyError ? (
              <Text style={styles.errText}>{caseReplyError}</Text>
            ) : null}
            <View style={styles.replyRow}>
              <View style={{ flex: 1 }}>
                <SaharaInput
                  testID={`case-reply-input-${c.id}`}
                  placeholder="Escribir respuesta al equipo de soporte..."
                  value={replyTexts[c.id] ?? ''}
                  onChangeText={(v) =>
                    setReplyTexts((prev) => ({ ...prev, [c.id]: v }))
                  }
                />
              </View>
              <SaharaButton
                testID={`case-reply-send-btn-${c.id}`}
                label="Enviar"
                icon="send"
                size="sm"
                fullWidth={false}
                loading={isSendingReply}
                onPress={() => void handleSendReply(c.id)}
              />
            </View>
          </View>
        ) : null}
      </SaharaCard>
    );
  };

  return (
    <SaharaScreenShell
      scrollable={false}
      header={
        <SaharaHeader
          title="Mis Casos"
          subtitle="Ayuda y reclamos"
          rightAction={
            <SaharaButton
              testID="header-open-new-case-btn"
              label="+ Pedir ayuda"
              size="sm"
              fullWidth={false}
              onPress={() => router.push('/(main)/cases/open')}
            />
          }
        />
      }
      footer={<EmployerBottomNav />}>
      <FlatList
        data={isLoading || errorMsg ? [] : filteredCases}
        keyExtractor={(item) => item.id}
        renderItem={renderCaseCard}
        ListHeaderComponent={renderHeader}
        ListEmptyComponent={
          isLoading ? (
            <LoadingSkeleton message="Cargando tus casos..." />
          ) : errorMsg ? (
            <ErrorState message={errorMsg} onRetry={() => void loadCases()} />
          ) : (
            <EmptyState
              icon="inbox"
              title="Todo en orden por ahora"
              description="No tienes casos aquí. Si tienes un problema con un trabajo o pago, pide ayuda."
              actionLabel="Pedir ayuda"
              onAction={() => router.push('/(main)/cases/open')}
            />
          )
        }
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
      />

      {/* Two-Step Confirmation Modal for Accepting Arbitration Settlement (Poka-Yoke Rule 2.1) */}
      <ConfirmationModal
        visible={acceptTargetCase !== null}
        title="¿Aceptar la resolución?"
        description={
          acceptTargetCase
            ? `Al aceptar el dictamen del expediente ${acceptTargetCase.folio}, ya no podrás cambiar tu decisión y se hará el pago final (Te devolvemos: ${formatCurrencyMXN(acceptTargetCase.approved_refund_amount ?? 0)} · Se paga al trabajador: ${formatCurrencyMXN(acceptTargetCase.approved_transfer_amount ?? 0)}).`
            : ''
        }
        confirmLabel="Sí, aceptar"
        cancelLabel="Revisar de nuevo"
        loading={isAccepting}
        onConfirm={() => void handleAcceptResolution()}
        onCancel={() => setAcceptTargetCase(null)}
      />

      {/* 7-Day Resolution Objection Modal (`object_case`) */}
      <Modal
        visible={objectTargetCase !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setObjectTargetCase(null)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>
              Objetar Resolución ({objectTargetCase?.folio})
            </Text>
            <Text style={styles.modalDesc}>
              Si no estás de acuerdo, el caso vuelve a revisión y tu dinero
              sigue protegido.
            </Text>

            <SaharaInput
              testID="object-case-notes-input"
              label="Motivo y argumentos de la objeción"
              placeholder="Explica por qué no estás de acuerdo con el dictamen..."
              multiline
              value={objectionNotes}
              onChangeText={setObjectionNotes}
              errorText={objectionError}
            />

            <View style={{ flexDirection: 'row', gap: 10 }}>
              <View style={{ flex: 1 }}>
                <SaharaButton
                  label="Cancelar"
                  variant="outline"
                  onPress={() => setObjectTargetCase(null)}
                />
              </View>
              <View style={{ flex: 1.3 }}>
                <SaharaButton
                  testID="confirm-object-case-btn"
                  label="Confirmar Objeción"
                  variant="primary"
                  loading={isObjecting}
                  onPress={() => void handleObjectResolution()}
                />
              </View>
            </View>
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
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  topSubText: {
    fontFamily: Fonts.label,
    fontSize: 12.5,
    color: SaharaColors.onSurfaceVariant,
  },
  filterRow: {
    gap: 8,
    paddingVertical: 4,
  },
  filterChip: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    minHeight: 48,
    minWidth: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: Radius.full,
    backgroundColor: SaharaColors.surfaceContainer,
  },
  filterChipActive: {
    backgroundColor: SaharaColors.primaryAccessible,
  },
  filterChipText: {
    fontFamily: Fonts.label,
    fontSize: 12.5,
    fontWeight: '600',
    color: SaharaColors.onSurfaceVariant,
  },
  filterChipTextActive: {
    color: SaharaColors.onPrimary,
    fontWeight: '700',
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 10,
  },
  caseTypeSuper: {
    fontFamily: Fonts.label,
    fontSize: 11.5,
    fontWeight: '700',
    color: SaharaColors.primary,
  },
  caseTitle: {
    fontFamily: Fonts.headline,
    fontSize: 19,
    fontWeight: '700',
    color: SaharaColors.onSurface,
  },
  caseDesc: {
    fontFamily: Fonts.body,
    fontSize: 13,
    color: SaharaColors.onSurfaceVariant,
    lineHeight: 19,
  },
  resolutionBox: {
    backgroundColor: SaharaColors.surfaceContainerLow,
    borderRadius: Radius.lg,
    padding: 12,
    gap: 8,
    borderWidth: 1,
    borderColor: SaharaColors.borderDefault,
  },
  resolutionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  resolutionTitle: {
    fontFamily: Fonts.label,
    fontSize: 12.5,
    fontWeight: '700',
    color: SaharaColors.onSurface,
  },
  resolutionNotes: {
    fontFamily: Fonts.body,
    fontSize: 12.5,
    color: SaharaColors.onSurfaceVariant,
    lineHeight: 18,
  },
  amountsBreakdownBox: {
    backgroundColor: SaharaColors.surfaceContainerLowest,
    borderRadius: Radius.md,
    padding: 10,
    gap: 4,
  },
  amountLine: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  amountLabel: {
    fontFamily: Fonts.body,
    fontSize: 12,
    color: SaharaColors.secondary,
  },
  amountValue: {
    fontFamily: Fonts.label,
    fontSize: 12.5,
    fontWeight: '700',
    color: SaharaColors.onSurface,
  },
  threadHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: SaharaColors.borderDefault,
  },
  threadCountText: {
    fontFamily: Fonts.label,
    fontSize: 11.5,
    color: SaharaColors.secondary,
    flex: 1,
  },
  expandBtn: {
    minHeight: 48,
    paddingHorizontal: 10,
    justifyContent: 'center',
  },
  expandLinkText: {
    fontFamily: Fonts.label,
    fontSize: 12.5,
    fontWeight: '700',
    color: SaharaColors.primary,
  },
  messageItemBox: {
    backgroundColor: SaharaColors.surfaceContainerLow,
    borderRadius: Radius.md,
    padding: 10,
    gap: 4,
  },
  messageHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  messageAuthor: {
    fontFamily: Fonts.label,
    fontSize: 12,
    fontWeight: '700',
    color: SaharaColors.onSurface,
  },
  messageDate: {
    fontFamily: Fonts.label,
    fontSize: 10.5,
    color: SaharaColors.outline,
  },
  messageBody: {
    fontFamily: Fonts.body,
    fontSize: 12.5,
    color: SaharaColors.onSurfaceVariant,
    lineHeight: 18,
  },
  replyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  errText: {
    fontFamily: Fonts.label,
    fontSize: 11.5,
    color: SaharaColors.error,
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
    maxWidth: 420,
    backgroundColor: SaharaColors.surfaceContainerLowest,
    borderRadius: Radius.xl,
    padding: Spacing.lg,
    gap: 14,
  },
  modalTitle: {
    fontFamily: Fonts.headline,
    fontSize: 20,
    fontWeight: '700',
    color: SaharaColors.onSurface,
  },
  modalDesc: {
    fontFamily: Fonts.body,
    fontSize: 12.5,
    color: SaharaColors.onSurfaceVariant,
    lineHeight: 18,
  },
});

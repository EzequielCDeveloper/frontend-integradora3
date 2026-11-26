/**
 * UI-EMP-02: Feed / Mis Publicaciones (Poka-Yoke Guided & Low Cognitive Load)
 * Source of Truth: Especificacion_de_Arquitectura_de_Software_v2.md (Section 3.2 UI-EMP-02, Section 4.1, Section 5.5)
 * Poka-Yoke & Audit Fixes Applied:
 * - PY-02-1: Hides status filter pills that have 0 jobs (while adding an optional "Ver todos los estados" toggle) to prevent choice paralysis from 11 empty tabs
 * - PY-02-2: Eliminates duplicate "Publicar" CTA banners when jobs exist; adds a clear 1-line "Siguiente paso:" guide on every job card
 * - PY-SYS-01 & PY-SYS-03: Plain Spanish labels ("Dinero Protegido", "Mis Trabajos") without internal spec codes
 * - SYS-05 & UI-EMP-02-1..04: FlatList virtualization, 48x48dp touch targets, zero emojis
 */
import React, { useCallback, useMemo, useState } from 'react';
import {
  FlatList,
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
  ConfirmationModal,
  EmptyState,
  ErrorState,
  JobStatusBadge,
  LoadingSkeleton,
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
import { useIdempotentAction } from '@/shared/hooks/use-idempotent-action';
import { mapDomainErrorToUI } from '@/shared/utils/error-mapper';
import {
  formatCurrencyMXN,
  formatFolio,
  formatSpanishDate,
  formatTimeRange,
  JOB_CATEGORY_ICONS,
  JOB_CATEGORY_LABELS,
  JOB_STATUS_LABELS,
} from '@/shared/utils/formatters';
import type { EmployerJobCardItem, JobStatus } from '@/types/database';

const ALL_STATUS_FILTERS: (JobStatus | 'all')[] = [
  'all',
  'published',
  'has_applications',
  'assigned',
  'arrival_registered',
  'in_progress',
  'completion_requested',
  'in_claim',
  'completed',
  'cancelled',
  'expired',
];

export function MyJobPostsScreenView() {
  const router = useRouter();
  const storeVersion = useMockBackendStore((s) => s.version);
  const unreadNotifCount = useMockBackendStore(
    (s) =>
      s.db.notifications.filter(
        (n) => n.user_id === s.activeEmployerId && !n.read_at,
      ).length,
  );

  const [selectedFilter, setSelectedFilter] = useState<JobStatus | 'all'>('all');
  const [showEmptyFilters, setShowEmptyFilters] = useState(false);
  const [jobs, setJobs] = useState<EmployerJobCardItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [cancelTargetJob, setCancelTargetJob] =
    useState<EmployerJobCardItem | null>(null);

  const loadJobs = useCallback(async () => {
    setIsLoading(true);
    setErrorMsg(null);
    try {
      const list = await employerRepository.listEmployerJobs('all');
      setJobs(list);
    } catch (err) {
      const mapped = mapDomainErrorToUI(err);
      setErrorMsg(mapped.message);
      if (mapped.requiresLoginRedirect) {
        router.replace('/(auth)/login');
      }
    } finally {
      setIsLoading(false);
    }
  }, [router]);

  useAsyncLoad(loadJobs, storeVersion);

  const filteredJobs = useMemo(() => {
    if (selectedFilter === 'all') return jobs;
    return jobs.filter((j) => j.status === selectedFilter);
  }, [jobs, selectedFilter]);

  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = { all: jobs.length };
    ALL_STATUS_FILTERS.forEach((st) => {
      if (st !== 'all') {
        counts[st] = jobs.filter((j) => j.status === st).length;
      }
    });
    return counts;
  }, [jobs]);

  // Poka-Yoke PY-02-1: Only show filters that actually have jobs (or the currently active filter), unless user expands all
  const visibleFilters = useMemo(() => {
    if (showEmptyFilters) return ALL_STATUS_FILTERS;
    return ALL_STATUS_FILTERS.filter(
      (key) =>
        key === 'all' ||
        key === selectedFilter ||
        (statusCounts[key] ?? 0) > 0,
    );
  }, [showEmptyFilters, selectedFilter, statusCounts]);

  const escrowMetrics = useMemo(() => {
    const activeEscrowStatuses: JobStatus[] = [
      'arrival_registered',
      'in_progress',
      'completion_requested',
      'in_claim',
    ];
    const inExecution = jobs.filter((j) =>
      activeEscrowStatuses.includes(j.status),
    );
    const totalEscrowMxn = inExecution.reduce(
      (sum, j) => sum + j.total_charged_mxn,
      0,
    );
    return {
      totalCreated: jobs.length,
      inExecutionCount: inExecution.length,
      totalEscrowMxn,
    };
  }, [jobs]);

  const { execute: handleConfirmCancel, isPending: isCancelling } =
    useIdempotentAction(async () => {
      if (!cancelTargetJob) return;
      try {
        await employerRepository.cancel_job(cancelTargetJob.id);
        setCancelTargetJob(null);
      } catch (err) {
        const mapped = mapDomainErrorToUI(err);
        setErrorMsg(mapped.message);
        setCancelTargetJob(null);
      }
    });

  const navigateForJob = (job: EmployerJobCardItem) => {
    switch (job.status) {
      case 'published':
      case 'has_applications':
        router.push(`/(main)/job/${job.id}` as never);
        break;
      case 'assigned':
        router.push(`/(main)/job/${job.id}/assigned` as never);
        break;
      case 'arrival_registered':
        router.push(`/(main)/job/${job.id}/checkout` as never);
        break;
      case 'in_progress':
      case 'completion_requested':
        router.push(`/(main)/job/${job.id}/completion` as never);
        break;
      case 'completed':
        router.push(`/(main)/job/${job.id}/review` as never);
        break;
      case 'in_claim':
        router.push('/(main)/cases');
        break;
      default:
        router.push(`/(main)/job/${job.id}` as never);
        break;
    }
  };

  const getPrimaryCTAForJob = (job: EmployerJobCardItem): {
    label: string;
    icon: string;
    nextStepHint: string;
  } => {
    switch (job.status) {
      case 'published':
        return {
          label: 'Ver anuncio',
          icon: 'visibility',
          nextStepHint: 'Esperando a que se postulen trabajadores cercanos.',
        };
      case 'has_applications':
        return {
          label: `Elegir entre ${job.pending_applicant_count || job.applicant_count} candidatos`,
          icon: 'group',
          nextStepHint: 'Tienes candidatos listos. Revisa sus perfiles y elige a uno.',
        };
      case 'assigned':
        return {
          label: 'Aceptar condiciones y ver teléfono',
          icon: 'handshake',
          nextStepHint: 'Confirma las condiciones para que el trabajador pueda asistir.',
        };
      case 'arrival_registered':
        return {
          label: 'Pagar ahora (30 min)',
          icon: 'lock',
          nextStepHint: 'El trabajador ya llegó a tu domicilio. Realiza el pago para que inicie.',
        };
      case 'in_progress':
        return {
          label: 'Ver código de cierre y chat',
          icon: 'verified_user',
          nextStepHint: 'Trabajo en curso. Al terminar, dicta tu código de 6 números al trabajador.',
        };
      case 'completion_requested':
        return {
          label: 'Revisar fotos y liberar pago',
          icon: 'task_alt',
          nextStepHint: 'El trabajador envió fotos de que ya terminó. Confirma si quedó bien.',
        };
      case 'completed':
        return {
          label: 'Calificar trabajador',
          icon: 'star',
          nextStepHint: 'Trabajo terminado. Deja tu calificación del servicio.',
        };
      case 'in_claim':
        return {
          label: 'Ver estado del reclamo',
          icon: 'gavel',
          nextStepHint: 'El pago está congelado mientras Solidez MX revisa tu caso.',
        };
      default:
        return {
          label: 'Ver detalle',
          icon: 'folder_open',
          nextStepHint: 'Anuncio cerrado sin cargos pendientes.',
        };
    }
  };

  const renderHeaderSection = () => (
    <View style={styles.listHeaderWrapper}>
      {/* Clear Header & Single Primary Publish Button */}
      <View style={{ gap: 10 }}>
        <View style={styles.sectionTitleRow}>
          <View>
            <Text style={styles.sectionSuper}>PANEL PRINCIPAL</Text>
            <Text style={styles.sectionHeading}>Mis Trabajos</Text>
          </View>
          <SaharaButton
            testID="top-publish-job-btn"
            label="+ Publicar Trabajo"
            size="sm"
            fullWidth={false}
            onPress={() => router.push('/(main)/post-job')}
          />
        </View>

        <SaharaCard variant="low" style={{ gap: 10 }}>
          <View style={styles.escrowMetricsRow}>
            <View style={{ flex: 1 }}>
              <View style={styles.escrowLabelRow}>
                <SaharaIcon
                  name="lock_clock"
                  size={15}
                  color={SaharaColors.primaryAccessible}
                />
                <Text style={styles.escrowLabelText}>Dinero Protegido</Text>
              </View>
              <Text style={styles.escrowAmountText}>
                {formatCurrencyMXN(escrowMetrics.totalEscrowMxn)}
              </Text>
            </View>

            <View style={styles.escrowStatsRight}>
              <View style={styles.statColumn}>
                <Text style={styles.statLabel}>Publicados</Text>
                <Text style={styles.statValue}>{escrowMetrics.totalCreated}</Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.statColumn}>
                <Text style={styles.statLabel}>Activos hoy</Text>
                <Text
                  style={[
                    styles.statValue,
                    { color: SaharaColors.primaryAccessible },
                  ]}>
                  {escrowMetrics.inExecutionCount}
                </Text>
              </View>
            </View>
          </View>

          <View style={styles.escrowFooterRow}>
            <Text style={styles.escrowFooterNote}>
              Tu dinero solo se entrega cuando el trabajo termina.
            </Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Ver historial de pagos"
              onPress={() => router.push('/(main)/payment-history')}
              style={styles.escrowDetailsBtn}>
              <Text style={styles.escrowDetailsLink}>Ver pagos &gt;</Text>
            </Pressable>
          </View>
        </SaharaCard>
      </View>

      {/* Filter Pills: Clean & Focused (Hides 0-count filters unless toggled) */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        accessibilityRole="tablist"
        contentContainerStyle={styles.filterPillsRow}>
        {visibleFilters.map((filterKey) => {
          const isActive = selectedFilter === filterKey;
          const label =
            filterKey === 'all' ? 'Todos' : JOB_STATUS_LABELS[filterKey];
          const count = statusCounts[filterKey] ?? 0;

          return (
            <Pressable
              key={filterKey}
              testID={`filter-pill-${filterKey}`}
              accessibilityRole="tab"
              accessibilityLabel={`Filtrar por ${label}, ${count} trabajos`}
              accessibilityState={{ selected: isActive }}
              onPress={() => setSelectedFilter(filterKey)}
              style={[
                styles.filterPill,
                isActive ? styles.filterPillActive : undefined,
              ]}>
              <Text
                style={[
                  styles.filterPillText,
                  isActive ? styles.filterPillTextActive : undefined,
                ]}>
                {label} ({count})
              </Text>
            </Pressable>
          );
        })}

        <Pressable
          accessibilityRole="button"
          accessibilityLabel={
            showEmptyFilters
              ? 'Ocultar filtros vacíos'
              : 'Mostrar todos los filtros de estado'
          }
          onPress={() => setShowEmptyFilters((prev) => !prev)}
          style={styles.toggleAllFiltersBtn}>
          <Text style={styles.toggleAllFiltersText}>
            {showEmptyFilters ? 'Menos filtros' : 'Ver todos los estados'}
          </Text>
        </Pressable>
      </ScrollView>
    </View>
  );

  const renderJobCard = ({ item: job }: { item: EmployerJobCardItem }) => {
    const cta = getPrimaryCTAForJob(job);
    const canEditOrCancel =
      (job.status === 'published' || job.status === 'has_applications') &&
      job.selected_worker_id === null;

    return (
      <SaharaCard
        testID={`job-card-${job.id}`}
        variant="lowest"
        accentColor={
          job.status === 'assigned' ||
          job.status === 'arrival_registered' ||
          job.status === 'in_progress'
            ? SaharaColors.primaryAccessible
            : job.status === 'completion_requested' ||
                job.status === 'in_claim'
              ? SaharaColors.tertiary
              : undefined
        }
        style={{ gap: 12 }}>
        {/* Header: Folio, Title & Status Badge */}
        <View style={styles.cardHeaderRow}>
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={styles.folioText}>
              FOLIO {formatFolio(job.id, 'SLZ')}
            </Text>
            <Text style={styles.jobTitleText}>{job.title}</Text>
          </View>
          <JobStatusBadge status={job.status} />
        </View>

        {/* Poka-Yoke Next Step Callout (PY-02-2: Zero guesswork on what to do next) */}
        <View style={styles.nextStepBanner}>
          <SaharaIcon
            name="info"
            size={15}
            color={SaharaColors.primaryAccessible}
          />
          <Text style={styles.nextStepText}>
            <Text style={{ fontWeight: '700' }}>Qué sigue: </Text>
            {cta.nextStepHint}
          </Text>
        </View>

        {/* Meta Grid */}
        <View style={styles.metaGrid}>
          <View style={styles.metaItem}>
            <SaharaIcon
              name={JOB_CATEGORY_ICONS[job.category]}
              size={14}
              color={SaharaColors.primaryAccessible}
            />
            <Text style={styles.metaText}>
              {JOB_CATEGORY_LABELS[job.category]}
            </Text>
          </View>
          <View style={styles.metaItem}>
            <SaharaIcon
              name="calendar_today"
              size={14}
              color={SaharaColors.secondary}
            />
            <Text style={styles.metaText}>
              {formatSpanishDate(job.job_date)}
            </Text>
          </View>
          <View style={styles.metaItem}>
            <SaharaIcon
              name="schedule"
              size={14}
              color={SaharaColors.secondary}
            />
            <Text style={styles.metaText}>
              {formatTimeRange(job.start_time, job.end_time)}
            </Text>
          </View>
          <View style={styles.metaItem}>
            <SaharaIcon
              name="location_on"
              size={14}
              color={SaharaColors.secondary}
            />
            <Text style={styles.metaText} numberOfLines={1}>
              {job.neighborhood}
            </Text>
          </View>
        </View>

        {/* Worker / Applicants Snapshot */}
        {job.selected_worker_name ? (
          <View style={styles.workerBanner}>
            <View style={styles.workerInitialsCircle}>
              <Text style={styles.workerInitialsText}>
                {job.selected_worker_name.slice(0, 2).toUpperCase()}
              </Text>
            </View>
            <View style={{ flex: 1 }}>
              <View style={styles.workerNameRow}>
                <Text style={styles.workerNameText}>
                  {job.selected_worker_name}
                </Text>
                <Text style={styles.workerRatingText}>
                  Calif. {(job.selected_worker_rating ?? 4.9).toFixed(1)}
                </Text>
              </View>
              <Text style={styles.workerSubText}>
                {job.status === 'assigned'
                  ? 'Plazo de 24 horas para confirmar'
                  : job.status === 'arrival_registered'
                    ? 'Ya está en tu domicilio • Tienes 30 min para pagar'
                    : 'Trabajador elegido'}
              </Text>
            </View>
          </View>
        ) : (
          <View style={styles.applicantsBanner}>
            <SaharaIcon
              name="group"
              size={15}
              color={SaharaColors.primaryAccessible}
            />
            <Text style={styles.applicantsCountText}>
              {job.pending_applicant_count > 0
                ? `${job.pending_applicant_count} personas quieren hacer este trabajo`
                : 'Aún no hay candidatos postulados'}
            </Text>
          </View>
        )}

        {/* Financial Summary & Primary Action Button */}
        <View style={styles.cardFooterRow}>
          <View>
            <Text style={styles.amountSuper}>Pago al trabajador</Text>
            <Text style={styles.amountMain}>
              {formatCurrencyMXN(job.fixed_payment_mxn)}{' '}
              <Text style={styles.amountFeeSub}>
                (+{formatCurrencyMXN(job.platform_fee_mxn)} comisión)
              </Text>
            </Text>
          </View>
        </View>

        <SaharaButton
          label={cta.label}
          icon={cta.icon}
          size="md"
          onPress={() => navigateForJob(job)}
        />

        {/* Pre-selection Quick Edit / Cancel Actions (48dp touch targets) */}
        {canEditOrCancel ? (
          <View style={styles.preSelectionRow}>
            <Pressable
              testID={`cancel-job-btn-${job.id}`}
              accessibilityRole="button"
              accessibilityLabel={`Cancelar anuncio ${job.title}`}
              onPress={() => setCancelTargetJob(job)}
              style={styles.cancelActionBtn}>
              <Text style={styles.cancelLinkText}>Cancelar anuncio</Text>
            </Pressable>
            <Pressable
              testID={`edit-job-btn-${job.id}`}
              accessibilityRole="button"
              accessibilityLabel={`Modificar anuncio ${job.title}`}
              onPress={() =>
                router.push(
                  `/(main)/post-job?editJobId=${job.id}` as never,
                )
              }
              style={styles.editInlineBtn}>
              <SaharaIcon
                name="edit"
                size={13}
                color={SaharaColors.primaryAccessible}
              />
              <Text style={styles.editInlineText}>Modificar Anuncio</Text>
            </Pressable>
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
          title="Solidez MX"
          subtitle="Empleador"
          badgeText="Pago Protegido"
          rightAction={
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Pressable
                testID="header-notifications-btn"
                accessibilityRole="button"
                accessibilityLabel={`Avisos, ${unreadNotifCount} sin leer`}
                onPress={() => router.push('/(main)/notifications')}
                style={styles.notifBtn}>
                <SaharaIcon
                  name="notifications"
                  size={18}
                  color={SaharaColors.onSurface}
                />
                {unreadNotifCount > 0 ? (
                  <View style={styles.notifBadgeDot}>
                    <Text style={styles.notifBadgeText}>{unreadNotifCount}</Text>
                  </View>
                ) : null}
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Ir a mi perfil"
                onPress={() => router.push('/(main)/profile')}
                style={styles.avatarCircle}>
                <SaharaIcon
                  name="person"
                  size={16}
                  color={SaharaColors.onPrimary}
                />
              </Pressable>
            </View>
          }
        />
      }
      footer={<EmployerBottomNav />}>
      {isLoading ? (
        <View style={{ padding: Spacing.md }}>
          <LoadingSkeleton message="Cargando tus trabajos publicados..." />
        </View>
      ) : errorMsg ? (
        <View style={{ padding: Spacing.md }}>
          <ErrorState message={errorMsg} onRetry={() => void loadJobs()} />
        </View>
      ) : (
        <FlatList
          data={filteredJobs}
          keyExtractor={(item) => item.id}
          renderItem={renderJobCard}
          ListHeaderComponent={renderHeaderSection}
          ListEmptyComponent={
            <EmptyState
              icon="folder_shared"
              title="No hay trabajos en esta sección"
              description="Toca el botón de abajo para publicar un nuevo trabajo o elige otro filtro arriba."
              actionLabel="Publicar Nuevo Trabajo"
              onAction={() => router.push('/(main)/post-job')}
            />
          }
          contentContainerStyle={styles.flatListContent}
          showsVerticalScrollIndicator={false}
        />
      )}

      {/* Two-step Cancellation Modal (Poka-Yoke) */}
      <ConfirmationModal
        visible={cancelTargetJob !== null}
        title="¿Cancelar este anuncio?"
        description="El anuncio se cerrará y avisaremos a los candidatos. Como aún no has elegido a ningún trabajador, cancelar no tiene ningún costo."
        highlightText={
          cancelTargetJob
            ? `${formatFolio(cancelTargetJob.id)} · ${cancelTargetJob.title}`
            : undefined
        }
        confirmLabel="Sí, cancelar anuncio"
        cancelLabel="No, conservar"
        variant="danger"
        loading={isCancelling}
        onConfirm={() => void handleConfirmCancel()}
        onCancel={() => setCancelTargetJob(null)}
      />
    </SaharaScreenShell>
  );
}

const styles = StyleSheet.create({
  flatListContent: {
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.md,
    paddingBottom: 100,
    gap: Spacing.md,
  },
  listHeaderWrapper: {
    gap: Spacing.md,
    marginBottom: 4,
  },
  notifBtn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: SaharaColors.surfaceContainerLow,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  notifBadgeDot: {
    position: 'absolute',
    top: 6,
    right: 6,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: SaharaColors.primaryAccessible,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  notifBadgeText: {
    color: SaharaColors.onPrimary,
    fontSize: 9.5,
    fontWeight: '700',
  },
  avatarCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: SaharaColors.primaryAccessible,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sectionSuper: {
    fontFamily: Fonts.label,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1,
    color: SaharaColors.secondary,
  },
  sectionHeading: {
    fontFamily: Fonts.headline,
    fontSize: 26,
    fontWeight: '600',
    color: SaharaColors.onSurface,
  },
  escrowMetricsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  escrowLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  escrowLabelText: {
    fontFamily: Fonts.label,
    fontSize: 12,
    color: SaharaColors.secondary,
  },
  escrowAmountText: {
    fontFamily: Fonts.headline,
    fontSize: 24,
    fontWeight: '700',
    color: SaharaColors.onSurface,
    marginTop: 2,
  },
  escrowStatsRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  statColumn: {
    alignItems: 'flex-end',
  },
  statLabel: {
    fontFamily: Fonts.label,
    fontSize: 10.5,
    color: SaharaColors.secondary,
  },
  statValue: {
    fontFamily: Fonts.headline,
    fontSize: 19,
    fontWeight: '700',
    color: SaharaColors.onSurface,
  },
  statDivider: {
    width: 1,
    height: 28,
    backgroundColor: SaharaColors.outlineVariant,
  },
  escrowFooterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: SaharaColors.borderDefault,
  },
  escrowFooterNote: {
    fontFamily: Fonts.body,
    fontSize: 11.5,
    color: SaharaColors.secondary,
    flex: 1,
  },
  escrowDetailsBtn: {
    minHeight: 48,
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  escrowDetailsLink: {
    fontFamily: Fonts.label,
    fontSize: 12.5,
    fontWeight: '700',
    color: SaharaColors.primaryAccessible,
  },
  filterPillsRow: {
    gap: 8,
    paddingVertical: 4,
  },
  filterPill: {
    minHeight: 48,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: Radius.full,
    backgroundColor: SaharaColors.surfaceContainer,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterPillActive: {
    backgroundColor: SaharaColors.primaryAccessible,
  },
  filterPillText: {
    fontFamily: Fonts.label,
    fontSize: 12.5,
    fontWeight: '600',
    color: SaharaColors.onSurface,
  },
  filterPillTextActive: {
    color: SaharaColors.onPrimary,
    fontWeight: '700',
  },
  toggleAllFiltersBtn: {
    minHeight: 48,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: Radius.full,
    borderWidth: 1,
    borderColor: SaharaColors.borderDefault,
    alignItems: 'center',
    justifyContent: 'center',
  },
  toggleAllFiltersText: {
    fontFamily: Fonts.label,
    fontSize: 12,
    fontWeight: '700',
    color: SaharaColors.primaryAccessible,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 10,
  },
  folioText: {
    fontFamily: Fonts.label,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.7,
    color: SaharaColors.secondary,
  },
  jobTitleText: {
    fontFamily: Fonts.headline,
    fontSize: 18,
    fontWeight: '600',
    color: SaharaColors.onSurface,
    lineHeight: 23,
  },
  nextStepBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: SaharaColors.primaryFixed,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: Radius.md,
  },
  nextStepText: {
    flex: 1,
    fontFamily: Fonts.body,
    fontSize: 12.5,
    color: SaharaColors.onPrimaryFixed,
    lineHeight: 17,
  },
  metaGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    backgroundColor: SaharaColors.surfaceContainerLow,
    borderRadius: Radius.md,
    padding: 10,
    rowGap: 6,
    columnGap: 14,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    minWidth: '45%',
  },
  metaText: {
    fontFamily: Fonts.body,
    fontSize: 12,
    color: SaharaColors.onSurfaceVariant,
  },
  workerBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: SaharaColors.surfaceContainer,
    padding: 10,
    borderRadius: Radius.md,
  },
  workerInitialsCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: SaharaColors.primaryFixed,
    alignItems: 'center',
    justifyContent: 'center',
  },
  workerInitialsText: {
    fontFamily: Fonts.label,
    fontSize: 12,
    fontWeight: '700',
    color: SaharaColors.onPrimaryFixedVariant,
  },
  workerNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  workerNameText: {
    fontFamily: Fonts.label,
    fontSize: 12.5,
    fontWeight: '700',
    color: SaharaColors.onSurface,
  },
  workerRatingText: {
    fontFamily: Fonts.label,
    fontSize: 12,
    fontWeight: '700',
    color: SaharaColors.primaryAccessible,
  },
  workerSubText: {
    fontFamily: Fonts.body,
    fontSize: 11.5,
    color: SaharaColors.secondary,
  },
  applicantsBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: SaharaColors.surfaceContainerLow,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: Radius.md,
  },
  applicantsCountText: {
    fontFamily: Fonts.label,
    fontSize: 12,
    fontWeight: '600',
    color: SaharaColors.onSurface,
  },
  cardFooterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    paddingTop: 2,
  },
  amountSuper: {
    fontFamily: Fonts.label,
    fontSize: 11,
    color: SaharaColors.secondary,
  },
  amountMain: {
    fontFamily: Fonts.body,
    fontSize: 15,
    fontWeight: '700',
    color: SaharaColors.onSurface,
  },
  amountFeeSub: {
    fontSize: 11.5,
    fontWeight: '500',
    color: SaharaColors.secondary,
  },
  preSelectionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: SaharaColors.borderDefault,
    gap: 8,
  },
  cancelActionBtn: {
    minHeight: 48,
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  cancelLinkText: {
    fontFamily: Fonts.label,
    fontSize: 12.5,
    fontWeight: '600',
    color: SaharaColors.error,
  },
  editInlineBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 48,
    gap: 6,
    backgroundColor: SaharaColors.surfaceContainer,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: Radius.sm,
  },
  editInlineText: {
    fontFamily: Fonts.label,
    fontSize: 12.5,
    fontWeight: '700',
    color: SaharaColors.primaryAccessible,
  },
});

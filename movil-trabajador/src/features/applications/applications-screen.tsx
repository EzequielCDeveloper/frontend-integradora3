/**
 * MÓDULO 6: POSTULACIONES
 * - Consulta por pestañas de estado: Pendiente, Aceptada, Rechazada, Retirada, Expirada
 * - Retiro de postulación pendiente con confirmación previa
 * - Acciones siguientes cuando una postulación es aceptada
 * - Acceso al detalle y opción de reportar postulación
 */
import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Fonts, Radius, SaharaColors, Spacing } from '@/constants/theme';
import {
  ApplicationStatusBadge,
  ConfirmationModal,
  EmptyState,
  FeedbackBanner,
  FilterPill,
  ReportContentModal,
  SaharaButton,
  SaharaCard,
  SaharaHeader,
  SaharaIcon,
  SaharaScreenShell,
  WorkerBottomNav,
} from '@/components/ui';
import { useWorkerStore, workerStore } from '@/services/worker-store';
import { mapDomainErrorToMessage } from '@/shared/utils/error-mapper';
import {
  APPLICATION_STATUS_LABELS,
  formatCurrencyMXN,
  formatSpanishDate,
  formatTimeRange,
  JOB_CATEGORY_LABELS,
} from '@/shared/utils/formatters';
import type { ApplicationStatus, WorkerApplicationItem } from '@/types/database';

const STATUS_TABS: (ApplicationStatus | 'all')[] = [
  'all',
  'pending',
  'accepted',
  'rejected',
  'withdrawn',
  'expired',
];

export function ApplicationsScreen() {
  const router = useRouter();
  const version = useWorkerStore((s) => s.version);

  const [activeTab, setActiveTab] = useState<ApplicationStatus | 'all'>('all');
  const [withdrawTarget, setWithdrawTarget] =
    useState<WorkerApplicationItem | null>(null);
  const [reportTarget, setReportTarget] =
    useState<WorkerApplicationItem | null>(null);
  const [feedback, setFeedback] = useState<{
    tone: 'success' | 'error';
    text: string;
  } | null>(null);

  const applications = useMemo(() => {
    void version;
    return workerStore.listMyApplications();
  }, [version]);

  const counts = useMemo(() => {
    const map: Record<string, number> = { all: applications.length };
    STATUS_TABS.forEach((st) => {
      if (st !== 'all') {
        map[st] = applications.filter((a) => a.status === st).length;
      }
    });
    return map;
  }, [applications]);

  const filtered = useMemo(() => {
    if (activeTab === 'all') return applications;
    return applications.filter((a) => a.status === activeTab);
  }, [applications, activeTab]);

  const handleConfirmWithdraw = () => {
    if (!withdrawTarget) return;
    setFeedback(null);
    try {
      workerStore.withdrawApplication(withdrawTarget.id);
      setWithdrawTarget(null);
      setFeedback({
        tone: 'success',
        text: 'Tu postulación pendiente fue retirada correctamente.',
      });
    } catch (err) {
      setWithdrawTarget(null);
      setFeedback({ tone: 'error', text: mapDomainErrorToMessage(err) });
    }
  };

  const handleReportApplication = (reason: string) => {
    if (!reportTarget) return;
    try {
      workerStore.createCase({
        case_type: 'report',
        target_type: 'application',
        target_id: reportTarget.id,
        job_id: reportTarget.job_id,
        description: reason,
      });
      setFeedback({
        tone: 'success',
        text: 'Reporte sobre la postulación enviado al equipo de soporte.',
      });
    } catch (err) {
      setFeedback({ tone: 'error', text: mapDomainErrorToMessage(err) });
    }
  };

  return (
    <SaharaScreenShell
      header={
        <SaharaHeader
          title="Mis postulaciones"
          subtitle="Seguimiento de solicitudes"
          onBack={() => router.back()}
          badgeText={`${applications.length} total`}
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

      {/* Filtros por estado */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.tabsRow}>
        {STATUS_TABS.map((tab) => (
          <FilterPill
            key={tab}
            label={tab === 'all' ? 'Todas' : APPLICATION_STATUS_LABELS[tab]}
            count={counts[tab] ?? 0}
            active={activeTab === tab}
            onPress={() => setActiveTab(tab)}
          />
        ))}
      </ScrollView>

      {filtered.length === 0 ? (
        <EmptyState
          icon="assignment"
          title="Sin postulaciones en este estado"
          description="Explora las oportunidades cercanas y postúlate a las que mejor se ajusten a tu disponibilidad."
          actionLabel="Explorar trabajos"
          onAction={() => router.push('/(main)/explore' as never)}
        />
      ) : (
        <View style={{ gap: 12 }}>
          {filtered.map((app) => (
            <SaharaCard
              key={app.id}
              variant="lowest"
              accentColor={
                app.status === 'accepted'
                  ? SaharaColors.success
                  : app.status === 'pending'
                    ? SaharaColors.warning
                    : SaharaColors.outlineVariant
              }
              style={{ gap: 10 }}>
              <View style={styles.cardTop}>
                <ApplicationStatusBadge status={app.status} />
                <Text style={styles.appliedDate}>
                  Postulado el {formatSpanishDate(app.created_at)}
                </Text>
              </View>

              <View style={styles.titleRow}>
                <View style={{ flex: 1, gap: 2 }}>
                  <Text style={styles.categoryOverline}>
                    {JOB_CATEGORY_LABELS[app.job_category]} · {app.employer_name}
                  </Text>
                  <Text style={styles.jobTitle}>{app.job_title}</Text>
                </View>
                <Text style={styles.priceText}>
                  {formatCurrencyMXN(app.fixed_payment_mxn)}
                </Text>
              </View>

              <View style={styles.metaRow}>
                <View style={styles.metaItem}>
                  <SaharaIcon
                    name="calendar_today"
                    size={12}
                    color={SaharaColors.secondary}
                  />
                  <Text style={styles.metaText}>
                    {formatSpanishDate(app.job_date)} ·{' '}
                    {formatTimeRange(app.start_time, app.end_time)}
                  </Text>
                </View>
                <View style={styles.metaItem}>
                  <SaharaIcon
                    name="location_on"
                    size={12}
                    color={SaharaColors.primaryAccessible}
                  />
                  <Text style={styles.metaText}>
                    {app.neighborhood} ({app.distance_range})
                  </Text>
                </View>
              </View>

              {/* Guía de siguientes pasos para postulaciones aceptadas */}
              {app.status === 'accepted' ? (
                <View style={styles.acceptedBanner}>
                  <SaharaIcon
                    name="check_circle"
                    size={15}
                    color={SaharaColors.onSuccessContainer}
                  />
                  <Text style={styles.acceptedText}>
                    Fuiste seleccionado. Revisa la dirección exacta, acepta las condiciones y verifica tu cuenta conectada para continuar.
                  </Text>
                </View>
              ) : null}

              {/* Acciones */}
              <View style={styles.actionsRow}>
                {app.status === 'accepted' && app.is_selected_worker ? (
                  <View style={{ flex: 1 }}>
                    <SaharaButton
                      label="Continuar contratación"
                      icon="arrow_forward"
                      size="sm"
                      onPress={() =>
                        router.push(`/(main)/job/${app.job_id}` as never)
                      }
                    />
                  </View>
                ) : (
                  <View style={{ flex: 1 }}>
                    <SaharaButton
                      label="Ver detalle"
                      variant="outline"
                      size="sm"
                      onPress={() =>
                        router.push(`/(main)/opportunity/${app.job_id}` as never)
                      }
                    />
                  </View>
                )}

                {app.status === 'pending' ? (
                  <View style={{ flex: 1 }}>
                    <SaharaButton
                      label="Retirar"
                      variant="danger"
                      size="sm"
                      onPress={() => setWithdrawTarget(app)}
                    />
                  </View>
                ) : null}
              </View>

              <Pressable
                onPress={() => setReportTarget(app)}
                style={styles.reportFooter}>
                <SaharaIcon name="flag" size={11} color={SaharaColors.tertiary} />
                <Text style={styles.reportFooterText}>Reportar postulación</Text>
              </Pressable>
            </SaharaCard>
          ))}
        </View>
      )}

      <ConfirmationModal
        visible={Boolean(withdrawTarget)}
        title="Confirmar retiro de postulación"
        description="Si retiras esta postulación, dejará de estar activa ante el empleador y no podrás volver a postularte al mismo trabajo."
        highlightText={withdrawTarget?.job_title}
        confirmLabel="Sí, retirar solicitud"
        variant="danger"
        onConfirm={handleConfirmWithdraw}
        onCancel={() => setWithdrawTarget(null)}
      />

      {reportTarget ? (
        <ReportContentModal
          visible={Boolean(reportTarget)}
          targetType="application"
          targetLabel={reportTarget.job_title}
          onClose={() => setReportTarget(null)}
          onSubmit={handleReportApplication}
        />
      ) : null}
    </SaharaScreenShell>
  );
}

const styles = StyleSheet.create({
  tabsRow: {
    gap: 8,
    paddingVertical: 2,
  },
  cardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  appliedDate: {
    fontFamily: Fonts.body,
    fontSize: 11.5,
    color: SaharaColors.onSurfaceVariant,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 10,
  },
  categoryOverline: {
    fontFamily: Fonts.label,
    fontSize: 11,
    fontWeight: '700',
    color: SaharaColors.secondary,
  },
  jobTitle: {
    fontFamily: Fonts.headline,
    fontSize: 18,
    fontWeight: '600',
    color: SaharaColors.onSurface,
    lineHeight: 23,
  },
  priceText: {
    fontFamily: Fonts.headline,
    fontSize: 16,
    fontWeight: '700',
    color: SaharaColors.primaryAccessible,
  },
  metaRow: {
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
  acceptedBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: SaharaColors.successContainer,
    padding: 10,
    borderRadius: Radius.md,
  },
  acceptedText: {
    flex: 1,
    fontFamily: Fonts.label,
    fontSize: 12,
    color: SaharaColors.onSuccessContainer,
    lineHeight: 17,
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  reportFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-end',
    gap: 4,
    paddingTop: 2,
  },
  reportFooterText: {
    fontFamily: Fonts.label,
    fontSize: 11,
    fontWeight: '600',
    color: SaharaColors.tertiary,
  },
});

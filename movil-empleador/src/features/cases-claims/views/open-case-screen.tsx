/**
 * UI-EMP-10: Formulario de Apertura de Casos / Reclamación
 * Source of Truth: Especificacion_de_Arquitectura_de_Software_v2.md (Section 3.2 UI-EMP-10, RF-13, RF-25..RF-28, D-03)
 * Rules enforced:
 * - Creation of `claim` (Reclamación de Pago Escrow) or `ticket` (Ticket de Soporte)
 * - Official `ticket_category` enum selector: `'account' | 'publication' | 'application' | 'job' | 'payment' | 'technical'`
 * - Linked job selector (required for `claim`, optional for `ticket`)
 * - Description input initialized empty (1..4000 chars)
 * - Evidence uploader for up to 5 files (JPG/PNG/PDF <= 10 MB)
 */
import React, { useCallback, useState } from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  Fonts,
  Radius,
  SaharaColors,
} from '@/constants/theme';
import {
  AttachmentPicker,
  ErrorState,
  LoadingSkeleton,
  SaharaButton,
  SaharaCard,
  SaharaHeader,
  SaharaIcon,
  SaharaInput,
  SaharaScreenShell,
  type AttachmentDraft,
} from '@/components/ui/sahara-primitives';
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
  TICKET_CATEGORY_LABELS,
} from '@/shared/utils/formatters';
import {
  VALID_TICKET_CATEGORIES,
  validateOpenCaseForm,
  type FieldErrors,
  type OpenCaseFormInput,
} from '@/shared/utils/validators';
import type {
  CaseType,
  EmployerJobCardItem,
  TicketCategory,
} from '@/types/database';

export function OpenCaseScreenView() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    jobId?: string;
    type?: CaseType;
    category?: TicketCategory;
  }>();
  const storeVersion = useMockBackendStore((s) => s.version);

  const [jobs, setJobs] = useState<EmployerJobCardItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [serviceError, setServiceError] = useState<string | null>(null);

  // Create form initialized empty per Poka-Yoke rule 5.2
  const [form, setForm] = useState<OpenCaseFormInput>({
    case_type: params.type === 'ticket' ? 'ticket' : 'claim',
    job_id: params.jobId ?? null,
    ticket_category: params.category ?? 'job',
    description: '',
  });
  const [evidences, setEvidences] = useState<AttachmentDraft[]>([]);
  const [fieldErrors, setFieldErrors] = useState<
    FieldErrors<keyof OpenCaseFormInput>
  >({});
  const [attachmentError, setAttachmentError] = useState<string | null>(null);

  const validateSingleField = (field: keyof OpenCaseFormInput) => {
    const errs = validateOpenCaseForm(form);
    setFieldErrors((prev) => ({
      ...prev,
      [field]: errs[field],
    }));
  };

  const loadEmployerJobs = useCallback(async () => {
    setIsLoading(true);
    setServiceError(null);
    try {
      const list = await employerRepository.listEmployerJobs('all');
      setJobs(list);
      if (!form.job_id && list.length > 0) {
        const defaultJob =
          list.find((j) => j.id === params.jobId) ??
          list.find(
            (j) =>
              j.status === 'in_progress' ||
              j.status === 'completion_requested' ||
              j.status === 'assigned',
          ) ??
          list[0];
        setForm((prev) => ({ ...prev, job_id: defaultJob.id }));
      }
    } catch (err) {
      const mapped = mapDomainErrorToUI(err);
      setServiceError(mapped.message);
    } finally {
      setIsLoading(false);
    }
  }, [form.job_id, params.jobId]);

  useAsyncLoad(loadEmployerJobs, storeVersion);

  const linkedJob = jobs.find((j) => j.id === form.job_id) ?? null;

  const { execute: handleSubmitCase, isPending: isSubmitting } =
    useIdempotentAction(async () => {
      setServiceError(null);
      const errors = validateOpenCaseForm(form);
      if (Object.keys(errors).length > 0) {
        setFieldErrors(errors);
        return;
      }
      setFieldErrors({});

      try {
        await employerRepository.open_case({
          case_type: form.case_type,
          job_id: form.job_id,
          ticket_category: form.ticket_category,
          description: form.description,
          evidences: evidences.map((ev) => ({
            file_name: ev.file_name,
            mime_type: ev.mime_type,
            size_bytes: ev.size_bytes,
          })),
        });
        router.replace('/(main)/cases');
      } catch (err) {
        const mapped = mapDomainErrorToUI(err);
        setServiceError(mapped.message);
      }
    });

  return (
    <SaharaScreenShell
      header={
        <SaharaHeader
          title="Pedir Ayuda"
          subtitle="Cuéntanos qué pasó"
          badgeText="Ayuda"
          onBack={() => router.back()}
        />
      }>
      {isLoading ? (
        <LoadingSkeleton message="Preparando formulario de caso y trabajos vinculados..." />
      ) : (
        <>
          {serviceError ? (
            <ErrorState
              message={serviceError}
              onRetry={() => setServiceError(null)}
            />
          ) : null}

          {/* 1. Linked Job Context Selector (All jobs displayed without slice truncation) */}
          <SaharaCard variant="low" style={{ gap: 10 }}>
            <View style={styles.sectionHeaderRow}>
              <Text style={styles.sectionSuper}>TRABAJO VINCULADO</Text>
              <Text style={styles.escrowTag}>Pago protegido</Text>
            </View>

            {linkedJob ? (
              <View style={styles.linkedJobRow}>
                <View style={styles.linkedJobIcon}>
                  <SaharaIcon
                    name="work"
                    size={18}
                    color={SaharaColors.primary}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.linkedJobTitle} numberOfLines={1}>
                    {formatFolio(linkedJob.id)} · {linkedJob.title}
                  </Text>
                  <Text style={styles.linkedJobSub}>
                    Trabajador:{' '}
                    {linkedJob.selected_worker_name ?? 'Sin asignar'}
                  </Text>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={styles.linkedJobAmount}>
                    {formatCurrencyMXN(linkedJob.total_charged_mxn)}
                  </Text>
                </View>
              </View>
            ) : null}

            {/* Job Picker Chips (48dp touch targets + radio semantics + non-color [OK] prefix) */}
            <View
              style={styles.jobSelectorRow}
              accessibilityRole="radiogroup"
              accessibilityLabel="Seleccionar trabajo vinculado al caso">
              {jobs.map((j) => {
                const selected = form.job_id === j.id;
                const folioText = `${formatFolio(j.id)} · ${j.title.slice(0, 22)}`;
                return (
                  <Pressable
                    key={j.id}
                    testID={`case-job-pill-${j.id}`}
                    accessibilityRole="radio"
                    accessibilityLabel={`Trabajo ${folioText}: ${j.title}`}
                    accessibilityState={{ checked: selected }}
                    onPress={() =>
                      setForm((prev) => ({ ...prev, job_id: j.id }))
                    }
                    style={[
                      styles.jobChip,
                      selected ? styles.jobChipActive : undefined,
                    ]}>
                    <Text
                      style={[
                        styles.jobChipText,
                        selected ? styles.jobChipTextActive : undefined,
                      ]}>
                      {selected ? `[OK] ${folioText}` : folioText}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
            {fieldErrors.job_id ? (
              <Text style={styles.errText}>{fieldErrors.job_id}</Text>
            ) : null}
          </SaharaCard>

          {/* 2. Selector de Tipo de Caso (`claim` vs `ticket`) */}
          <View
            style={{ gap: 8 }}
            accessibilityRole="radiogroup"
            accessibilityLabel="Seleccionar tipo de caso">
            <Text style={styles.headingTitle}>Tipo de caso</Text>

            <Pressable
              testID="select-case-type-claim"
              accessibilityRole="radio"
              accessibilityLabel="Problema con un trabajo o pago"
              accessibilityState={{ checked: form.case_type === 'claim' }}
              onPress={() =>
                setForm((prev) => ({ ...prev, case_type: 'claim' }))
              }
              style={[
                styles.typeCard,
                form.case_type === 'claim' ? styles.typeCardActive : undefined,
              ]}>
              <View
                style={[
                  styles.typeIconBox,
                  form.case_type === 'claim'
                    ? { backgroundColor: SaharaColors.primaryAccessible }
                    : undefined,
                ]}>
                <SaharaIcon
                  name="account_balance_wallet"
                  size={18}
                  color={
                    form.case_type === 'claim'
                      ? SaharaColors.onPrimary
                      : SaharaColors.onSurfaceVariant
                  }
                />
              </View>
              <View style={{ flex: 1, gap: 2 }}>
                <View style={styles.typeTitleRow}>
                  <Text style={styles.typeTitle}>
                    Problema con un trabajo o pago
                  </Text>
                  <SaharaIcon
                    name={
                      form.case_type === 'claim'
                        ? 'check_circle'
                        : 'radio_button_unchecked'
                    }
                    size={18}
                    color={
                      form.case_type === 'claim'
                        ? SaharaColors.primaryAccessible
                        : SaharaColors.outline
                    }
                  />
                </View>
                <Text style={styles.typeDesc}>
                  Si el trabajador no llegó, no cumplió o necesitas cancelar.
                  Tu dinero queda protegido mientras lo revisamos.
                </Text>
              </View>
            </Pressable>

            <Pressable
              testID="select-case-type-ticket"
              accessibilityRole="radio"
              accessibilityLabel="Duda o problema con la aplicación"
              accessibilityState={{ checked: form.case_type === 'ticket' }}
              onPress={() =>
                setForm((prev) => ({ ...prev, case_type: 'ticket' }))
              }
              style={[
                styles.typeCard,
                form.case_type === 'ticket' ? styles.typeCardActive : undefined,
              ]}>
              <View
                style={[
                  styles.typeIconBox,
                  form.case_type === 'ticket'
                    ? { backgroundColor: SaharaColors.primaryAccessible }
                    : undefined,
                ]}>
                <SaharaIcon
                  name="support_agent"
                  size={18}
                  color={
                    form.case_type === 'ticket'
                      ? SaharaColors.onPrimary
                      : SaharaColors.onSurfaceVariant
                  }
                />
              </View>
              <View style={{ flex: 1, gap: 2 }}>
                <View style={styles.typeTitleRow}>
                  <Text style={styles.typeTitle}>
                    Duda o problema con la app
                  </Text>
                  <SaharaIcon
                    name={
                      form.case_type === 'ticket'
                        ? 'check_circle'
                        : 'radio_button_unchecked'
                    }
                    size={18}
                    color={
                      form.case_type === 'ticket'
                        ? SaharaColors.primaryAccessible
                        : SaharaColors.outline
                    }
                  />
                </View>
                <Text style={styles.typeDesc}>
                  Para fallas, dudas de cuenta o de cómo usar la aplicación.
                </Text>
              </View>
            </Pressable>
          </View>

          {/* 3. Categoría del Caso (`ticket_category` enum) */}
          <View style={{ gap: 8 }}>
            <Text style={styles.headingTitle}>Categoría del caso</Text>
            <View
              style={styles.categoryWrap}
              accessibilityRole="radiogroup"
              accessibilityLabel="Seleccionar categoría del caso">
              {VALID_TICKET_CATEGORIES.map((cat) => {
                const selected = form.ticket_category === cat;
                const label = TICKET_CATEGORY_LABELS[cat];
                return (
                  <Pressable
                    key={cat}
                    testID={`case-cat-chip-${cat}`}
                    accessibilityRole="radio"
                    accessibilityLabel={`Categoría ${label}`}
                    accessibilityState={{ checked: selected }}
                    onPress={() =>
                      setForm((prev) => ({ ...prev, ticket_category: cat }))
                    }
                    style={[
                      styles.catChip,
                      selected ? styles.catChipActive : undefined,
                    ]}>
                    <Text
                      style={[
                        styles.catChipText,
                        selected ? styles.catChipTextActive : undefined,
                      ]}>
                      {selected ? `[OK] ${label}` : label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
            {fieldErrors.ticket_category ? (
              <Text style={styles.errText}>{fieldErrors.ticket_category}</Text>
            ) : null}
          </View>

          {/* 4. Descripción Detallada */}
          <SaharaCard variant="lowest" style={{ gap: 8 }}>
            <SaharaInput
              testID="case-description-input"
              label="¿Qué pasó?"
              rightBadge={`${form.description.length} / 4000`}
              placeholder="Cuéntanos con tus palabras qué pasó, qué día y a qué hora..."
              multiline
              value={form.description}
              onChangeText={(v) =>
                setForm((prev) => ({ ...prev, description: v }))
              }
              onBlur={() => validateSingleField('description')}
              errorText={fieldErrors.description}
            />
          </SaharaCard>

          {/* 5. Evidencias y Adjuntos (hasta 5 archivos JPG/PNG/PDF <= 10MB) */}
          <SaharaCard variant="lowest">
            <AttachmentPicker
              kind="case_evidence"
              items={evidences}
              errorText={attachmentError}
              onValidationError={(msg) => setAttachmentError(msg)}
              onAdd={(file) => {
                setAttachmentError(null);
                setEvidences((prev) => [...prev, file]);
              }}
              onRemove={(id) => {
                setAttachmentError(null);
                setEvidences((prev) => prev.filter((item) => item.id !== id));
              }}
            />
          </SaharaCard>

          {/* 6. Aviso de Protección Fiduciaria */}
          <SaharaCard variant="default" style={styles.protectionRow}>
            <SaharaIcon
              name="verified_user"
              size={18}
              color={SaharaColors.primary}
            />
            <View style={{ flex: 1 }}>
              <Text style={styles.protectionTitle}>
                Tu dinero sigue protegido
              </Text>
              <Text style={styles.protectionBody}>
                Si pides revisión por un trabajo, el pago queda congelado hasta
                que Solidez MX responda. Tendrás 7 días para contestar.
              </Text>
            </View>
          </SaharaCard>

          {/* 7. Submit Button */}
          <SaharaButton
            testID="submit-case-btn"
            label="Enviar Caso a Revisión"
            trailingIcon="arrow_forward"
            size="lg"
            loading={isSubmitting}
            onPress={() => void handleSubmitCase()}
          />
        </>
      )}
    </SaharaScreenShell>
  );
}

const styles = StyleSheet.create({
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sectionSuper: {
    fontFamily: Fonts.label,
    fontSize: 10.5,
    fontWeight: '700',
    letterSpacing: 0.8,
    color: SaharaColors.onSurfaceVariant,
  },
  escrowTag: {
    fontFamily: Fonts.label,
    fontSize: 10.5,
    fontWeight: '700',
    color: SaharaColors.onTertiaryFixed,
    backgroundColor: SaharaColors.tertiaryFixed,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: Radius.full,
  },
  linkedJobRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  linkedJobIcon: {
    width: 38,
    height: 38,
    borderRadius: Radius.md,
    backgroundColor: SaharaColors.primaryFixed,
    alignItems: 'center',
    justifyContent: 'center',
  },
  linkedJobTitle: {
    fontFamily: Fonts.label,
    fontSize: 13.5,
    fontWeight: '700',
    color: SaharaColors.onSurface,
  },
  linkedJobSub: {
    fontFamily: Fonts.body,
    fontSize: 11.5,
    color: SaharaColors.onSurfaceVariant,
  },
  linkedJobAmount: {
    fontFamily: Fonts.headline,
    fontSize: 16,
    fontWeight: '700',
    color: SaharaColors.primary,
  },
  jobSelectorRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  jobChip: {
    backgroundColor: SaharaColors.surfaceContainer,
    paddingHorizontal: 14,
    paddingVertical: 10,
    minHeight: 48,
    minWidth: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: Radius.full,
    borderWidth: 1,
    borderColor: SaharaColors.borderSubtle,
  },
  jobChipActive: {
    backgroundColor: SaharaColors.primaryAccessible,
    borderColor: SaharaColors.primaryAccessible,
  },
  jobChipText: {
    fontFamily: Fonts.label,
    fontSize: 12,
    fontWeight: '600',
    color: SaharaColors.onSurfaceVariant,
  },
  jobChipTextActive: {
    color: SaharaColors.onPrimary,
    fontWeight: '700',
  },
  headingTitle: {
    fontFamily: Fonts.headline,
    fontSize: 19,
    fontWeight: '700',
    color: SaharaColors.onSurface,
  },
  typeCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    backgroundColor: SaharaColors.surfaceContainerLow,
    padding: 14,
    minHeight: 48,
    borderRadius: Radius.xl,
    borderWidth: 1,
    borderColor: SaharaColors.borderDefault,
  },
  typeCardActive: {
    backgroundColor: SaharaColors.primaryFixed,
    borderColor: SaharaColors.primaryAccessible,
  },
  typeIconBox: {
    width: 38,
    height: 38,
    borderRadius: Radius.md,
    backgroundColor: SaharaColors.surfaceContainerHigh,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  typeTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  typeTitle: {
    fontFamily: Fonts.label,
    fontSize: 13.5,
    fontWeight: '700',
    color: SaharaColors.onSurface,
  },
  typeDesc: {
    fontFamily: Fonts.body,
    fontSize: 12,
    color: SaharaColors.onSurfaceVariant,
    lineHeight: 17,
  },
  categoryWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  catChip: {
    backgroundColor: SaharaColors.surfaceContainer,
    paddingHorizontal: 14,
    paddingVertical: 10,
    minHeight: 48,
    minWidth: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: Radius.full,
    borderWidth: 1,
    borderColor: SaharaColors.borderSubtle,
  },
  catChipActive: {
    backgroundColor: SaharaColors.primaryAccessible,
    borderColor: SaharaColors.primaryAccessible,
  },
  catChipText: {
    fontFamily: Fonts.label,
    fontSize: 12.5,
    fontWeight: '600',
    color: SaharaColors.onSurfaceVariant,
  },
  catChipTextActive: {
    color: SaharaColors.onPrimary,
    fontWeight: '700',
  },
  errText: {
    fontFamily: Fonts.label,
    fontSize: 11.5,
    color: SaharaColors.error,
  },
  protectionRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  protectionTitle: {
    fontFamily: Fonts.label,
    fontSize: 12.5,
    fontWeight: '700',
    color: SaharaColors.onSurface,
  },
  protectionBody: {
    fontFamily: Fonts.body,
    fontSize: 12,
    color: SaharaColors.onSurfaceVariant,
    lineHeight: 17,
  },
});

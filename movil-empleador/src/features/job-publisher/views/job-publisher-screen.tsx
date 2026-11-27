/**
 * UI-EMP-03: Formulario de Publicación / Edición de Trabajo (Poka-Yoke Guided & Low Cognitive Load)
 * Source of Truth: Especificacion_de_Arquitectura_de_Software_v2.md (Section 3.2 UI-EMP-03, RF-05, RF-06)
 * Poka-Yoke & Audit Fixes Applied:
 * - PY-03-1 & PY-SYS-02: 1-tap quick date pills ("Mañana", "Pasado mañana", "En 3 días") + 1-tap schedule presets ("08:00 a 13:00", "09:00 a 14:00", etc.) + auto-formatting masks (`formatDateInputMask`, `formatTimeInputMask`, `normalizeTimeOnBlur`) + separated field errors for `job_date`, `start_time`, and `end_time`
 * - PY-03-2: 1-tap payment amount presets ("$500", "$850", "$1,200", "$1,500") + `formatCurrencyInputMask` + plain Spanish breakdown
 * - PY-03-3 & PY-SYS-01: Removed internal table names (`job_private`, `RNF-06`, `RF-05`) and raw GPS decimals from labels
 * - PY-SYS-06: Unsaved changes confirmation modal when tapping Back if form is dirty
 * - UI-EMP-03-1..03: 48dp touch targets, radio semantics, zero emojis
 */
import React, { useCallback, useMemo, useState } from 'react';
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
  ConfirmationModal,
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
import { EmployerBottomNav } from '@/components/ui/employer-bottom-nav';
import { employerRepository } from '@/services/mocks/mock-employer-repository';
import { useAsyncLoad } from '@/shared/hooks/use-async-load';
import { useIdempotentAction } from '@/shared/hooks/use-idempotent-action';
import { mapDomainErrorToUI } from '@/shared/utils/error-mapper';
import {
  calculatePlatformFeeMXN,
  calculateTotalChargedMXN,
  formatCurrencyInputMask,
  formatCurrencyMXN,
  formatDateInputMask,
  formatSpanishDate,
  formatTimeInputMask,
  getFutureDateYMD,
  JOB_CATEGORY_ICONS,
  JOB_CATEGORY_LABELS,
  normalizeTimeOnBlur,
} from '@/shared/utils/formatters';
import {
  VALID_JOB_CATEGORIES,
  validateJobForm,
  type FieldErrors,
  type JobFormInput,
} from '@/shared/utils/validators';
import type { JobCategory } from '@/types/database';

const PRESET_COORDINATES = [
  { label: 'Roma Norte / Cuauhtémoc', lat: 19.4194, lng: -99.162 },
  { label: 'Del Valle / Benito Juárez', lat: 19.3834, lng: -99.1645 },
  { label: 'Polanco / Miguel Hidalgo', lat: 19.4338, lng: -99.1945 },
  { label: 'Coyoacán Centro', lat: 19.3467, lng: -99.1617 },
];

const QUICK_AMOUNT_PRESETS = ['500', '850', '1200', '1500'];

const QUICK_SCHEDULE_PRESETS = [
  { label: 'Mañana (08:00 a 13:00)', start: '08:00', end: '13:00' },
  { label: 'Medio día (09:00 a 14:00)', start: '09:00', end: '14:00' },
  { label: 'Tarde (14:00 a 19:00)', start: '14:00', end: '19:00' },
  { label: 'Jornada (09:00 a 17:00)', start: '09:00', end: '17:00' },
];

export function JobPublisherScreenView() {
  const router = useRouter();
  const params = useLocalSearchParams<{ editJobId?: string }>();
  const editJobId = params.editJobId;
  const isEditMode = Boolean(editJobId);

  // Create form MUST initialize empty per Poka-Yoke rule 5.2
  const [form, setForm] = useState<JobFormInput>({
    title: '',
    description: '',
    category: '' as unknown as JobCategory,
    fixed_payment_mxn: '',
    job_date: '',
    start_time: '',
    end_time: '',
    conditions: '',
    neighborhood: '',
    exact_address: '',
    exact_latitude: 19.4194,
    exact_longitude: -99.162,
  });

  const [photos, setPhotos] = useState<AttachmentDraft[]>([]);
  const [fieldErrors, setFieldErrors] = useState<
    FieldErrors<keyof JobFormInput>
  >({});
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [isLoadingEdit, setIsLoadingEdit] = useState(isEditMode);
  const [serviceError, setServiceError] = useState<string | null>(null);
  const [successBanner, setSuccessBanner] = useState<string | null>(null);
  const [showExitConfirmModal, setShowExitConfirmModal] = useState(false);

  const quickDateOptions = useMemo(
    () => [
      { label: 'Mañana', ymd: getFutureDateYMD(1) },
      { label: 'Pasado mañana', ymd: getFutureDateYMD(2) },
      { label: 'En 3 días', ymd: getFutureDateYMD(3) },
      { label: 'En 7 días', ymd: getFutureDateYMD(7) },
    ],
    [],
  );

  const isFormDirty = Boolean(
    form.title.trim() ||
      form.description.trim() ||
      form.fixed_payment_mxn.trim() ||
      form.job_date.trim() ||
      form.exact_address.trim(),
  );

  const handleBackPress = () => {
    if (isFormDirty && !isEditMode) {
      setShowExitConfirmModal(true);
      return;
    }
    router.back();
  };

  const loadJobForEdit = useCallback(async () => {
    if (!editJobId) return;
    setIsLoadingEdit(true);
    setServiceError(null);
    try {
      const detail = await employerRepository.getEmployerJobDetail(editJobId);
      setForm({
        title: detail.title,
        description: detail.description,
        category: detail.category,
        fixed_payment_mxn: String(detail.fixed_payment_mxn),
        job_date: detail.job_date,
        start_time: detail.start_time,
        end_time: detail.end_time,
        conditions: detail.conditions ?? '',
        neighborhood: detail.neighborhood,
        exact_address: detail.private_data.exact_address,
        exact_latitude: detail.private_data.exact_latitude,
        exact_longitude: detail.private_data.exact_longitude,
      });
      setPhotos(
        detail.photos.map((p) => ({
          id: p.id,
          file_name: p.file_name,
          mime_type: p.mime_type as 'image/jpeg' | 'image/png',
          size_bytes: p.size_bytes,
        })),
      );
    } catch (err) {
      const mapped = mapDomainErrorToUI(err);
      setServiceError(mapped.message);
    } finally {
      setIsLoadingEdit(false);
    }
  }, [editJobId]);

  const loadIfEditing = useCallback(() => {
    if (isEditMode) {
      void loadJobForEdit();
    }
  }, [isEditMode, loadJobForEdit]);
  useAsyncLoad(loadIfEditing);

  const validateSingleFieldOnBlur = (field: keyof JobFormInput, nextForm = form) => {
    const allErrs = validateJobForm(nextForm);
    setFieldErrors((prev) => ({
      ...prev,
      [field]: allErrs[field],
    }));
  };

  const numericAmount = Number(form.fixed_payment_mxn);
  const validAmount =
    Number.isFinite(numericAmount) && numericAmount >= 10 ? numericAmount : 0;
  const computedFee = calculatePlatformFeeMXN(validAmount);
  const computedTotal = calculateTotalChargedMXN(validAmount);

  const selectedZoneName =
    PRESET_COORDINATES.find(
      (p) => Math.abs(form.exact_latitude - p.lat) < 0.001,
    )?.label ?? 'Roma Norte / Cuauhtémoc';

  const { execute: handleSubmit, isPending: isSubmitting } =
    useIdempotentAction(async () => {
      setServiceError(null);
      setSuccessBanner(null);

      const normalizedForm: JobFormInput = {
        ...form,
        job_date: formatDateInputMask(form.job_date),
        start_time: normalizeTimeOnBlur(form.start_time),
        end_time: normalizeTimeOnBlur(form.end_time),
      };
      setForm(normalizedForm);

      const errors = validateJobForm(normalizedForm);
      if (Object.keys(errors).length > 0) {
        setFieldErrors(errors);
        return;
      }
      setFieldErrors({});

      try {
        if (isEditMode && editJobId) {
          await employerRepository.update_job({
            job_id: editJobId,
            title: normalizedForm.title,
            description: normalizedForm.description,
            category: normalizedForm.category,
            fixed_payment_mxn: Number(normalizedForm.fixed_payment_mxn),
            job_date: normalizedForm.job_date,
            start_time: normalizedForm.start_time,
            end_time: normalizedForm.end_time,
            conditions: normalizedForm.conditions,
            neighborhood: normalizedForm.neighborhood,
            exact_address: normalizedForm.exact_address,
            exact_latitude: normalizedForm.exact_latitude,
            exact_longitude: normalizedForm.exact_longitude,
          });
          setSuccessBanner('¡Tu anuncio fue actualizado!');
          router.replace(`/(main)/job/${editJobId}` as never);
        } else {
          const newJobId = await employerRepository.create_job({
            title: normalizedForm.title,
            description: normalizedForm.description,
            category: normalizedForm.category,
            fixed_payment_mxn: Number(normalizedForm.fixed_payment_mxn),
            job_date: normalizedForm.job_date,
            start_time: normalizedForm.start_time,
            end_time: normalizedForm.end_time,
            conditions: normalizedForm.conditions,
            neighborhood: normalizedForm.neighborhood,
            exact_address: normalizedForm.exact_address,
            exact_latitude: normalizedForm.exact_latitude,
            exact_longitude: normalizedForm.exact_longitude,
            photos: photos.map((p) => ({
              file_name: p.file_name,
              mime_type:
                p.mime_type === 'image/png' ? 'image/png' : 'image/jpeg',
              size_bytes: p.size_bytes,
            })),
          });
          setSuccessBanner(
            '¡Trabajo publicado! Ya pueden verlo los trabajadores cercanos.',
          );
          router.replace(`/(main)/job/${newJobId}` as never);
        }
      } catch (err) {
        const mapped = mapDomainErrorToUI(err);
        setServiceError(mapped.message);
      }
    });

  return (
    <SaharaScreenShell
      header={
        <SaharaHeader
          title={isEditMode ? 'Modificar Anuncio' : 'Publicar Trabajo'}
          subtitle="Paso a paso"
          onBack={handleBackPress}
        />
      }
      footer={<EmployerBottomNav />}>
      {isLoadingEdit ? (
        <LoadingSkeleton message="Cargando los datos de tu anuncio..." />
      ) : (
        <>
          {/* Short Plain Spanish Trust Banner */}
          <SaharaCard variant="primaryFixed" style={styles.trustBannerRow}>
            <View style={styles.trustIconCircle}>
              <SaharaIcon
                name="verified_user"
                size={18}
                color={SaharaColors.onPrimary}
              />
            </View>
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={styles.trustTitle}>Publicar es gratis</Text>
              <Text style={styles.trustBody}>
                Solo pagas cuando el trabajador elegido llegue a tu domicilio.
              </Text>
            </View>
          </SaharaCard>

          {serviceError ? (
            <ErrorState
              message={serviceError}
              onRetry={() => setServiceError(null)}
            />
          ) : null}

          {successBanner ? (
            <SaharaCard variant="primaryFixed">
              <Text style={styles.successBannerText}>{successBanner}</Text>
            </SaharaCard>
          ) : null}

          {/* Paso 1: ¿Qué trabajo necesitas? */}
          <SaharaCard variant="lowest" style={{ gap: 14 }}>
            <View style={styles.cardHeaderRow}>
              <Text style={styles.cardSectionTitle}>1. ¿Qué necesitas hacer?</Text>
              <View style={styles.stepPill}>
                <Text style={styles.stepPillText}>Paso 1 de 4</Text>
              </View>
            </View>

            {/* Category Selector (6 Official Categories — 48dp height & radio semantics) */}
            <View style={{ gap: 8 }}>
              <Text style={styles.fieldLabel}>Elige el tipo de trabajo</Text>
              <View
                accessibilityRole="radiogroup"
                accessibilityLabel="Tipo de trabajo"
                style={styles.categoryGrid}>
                {VALID_JOB_CATEGORIES.map((cat: JobCategory) => {
                  const selected = form.category === cat;
                  return (
                    <Pressable
                      key={cat}
                      testID={`job-cat-pill-${cat}`}
                      accessibilityRole="radio"
                      accessibilityLabel={`Categoría ${JOB_CATEGORY_LABELS[cat]}`}
                      accessibilityState={{ checked: selected }}
                      onPress={() =>
                        setForm((prev) => ({ ...prev, category: cat }))
                      }
                      style={[
                        styles.categoryChip,
                        selected ? styles.categoryChipActive : undefined,
                      ]}>
                      <SaharaIcon
                        name={JOB_CATEGORY_ICONS[cat]}
                        size={14}
                        color={
                          selected
                            ? SaharaColors.onPrimary
                            : SaharaColors.primaryAccessible
                        }
                      />
                      <Text
                        style={[
                          styles.categoryChipText,
                          selected ? styles.categoryChipTextActive : undefined,
                        ]}>
                        {selected ? '✓ ' : ''}
                        {JOB_CATEGORY_LABELS[cat]}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
              {fieldErrors.category ? (
                <Text style={styles.errText}>{fieldErrors.category}</Text>
              ) : null}
            </View>

            <SaharaInput
              testID="job-title-input"
              label="Título corto del anuncio"
              placeholder="Ej. Pintura de sala o limpieza de patio"
              value={form.title}
              onChangeText={(v) => setForm((prev) => ({ ...prev, title: v }))}
              onBlur={() => validateSingleFieldOnBlur('title')}
              errorText={fieldErrors.title}
            />

            <SaharaInput
              testID="job-description-input"
              label="Explica qué se va a realizar"
              placeholder="Escribe con tus palabras qué tareas debe hacer la persona..."
              multiline
              value={form.description}
              onChangeText={(v) =>
                setForm((prev) => ({ ...prev, description: v }))
              }
              onBlur={() => validateSingleFieldOnBlur('description')}
              errorText={fieldErrors.description}
            />
          </SaharaCard>

          {/* Paso 2: ¿Cuánto vas a pagar? (Guided Presets + Auto-Cleaned Input) */}
          <SaharaCard variant="lowest" style={{ gap: 12 }}>
            <View style={styles.cardHeaderRow}>
              <Text style={styles.cardSectionTitle}>2. ¿Cuánto vas a pagar?</Text>
              <View style={styles.stepPill}>
                <Text style={styles.stepPillText}>Paso 2 de 4</Text>
              </View>
            </View>

            {/* Quick Amount Buttons (PY-03-2: 1-tap selection) */}
            <View style={{ gap: 6 }}>
              <Text style={styles.quickHelperLabel}>
                Toca un monto común o escribe otra cantidad:
              </Text>
              <View style={styles.quickPillsWrap}>
                {QUICK_AMOUNT_PRESETS.map((amt) => {
                  const active = form.fixed_payment_mxn === amt;
                  return (
                    <Pressable
                      key={amt}
                      accessibilityRole="button"
                      accessibilityLabel={`Elegir pago de ${amt} pesos`}
                      onPress={() => {
                        const next = { ...form, fixed_payment_mxn: amt };
                        setForm(next);
                        validateSingleFieldOnBlur('fixed_payment_mxn', next);
                      }}
                      style={[
                        styles.quickPresetPill,
                        active ? styles.quickPresetPillActive : undefined,
                      ]}>
                      <Text
                        style={[
                          styles.quickPresetText,
                          active ? styles.quickPresetTextActive : undefined,
                        ]}>
                        {active ? `✓ $${amt}` : `$${amt} MXN`}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>

            <SaharaInput
              testID="job-payment-input"
              label="Pago para el trabajador (en pesos)"
              prefixText="$"
              placeholder="850.00"
              keyboardType="decimal-pad"
              helperText="Mínimo $10.00 y máximo $100,000.00 MXN."
              value={form.fixed_payment_mxn}
              onChangeText={(v) =>
                setForm((prev) => ({
                  ...prev,
                  fixed_payment_mxn: formatCurrencyInputMask(v),
                }))
              }
              onBlur={() => validateSingleFieldOnBlur('fixed_payment_mxn')}
              errorText={fieldErrors.fixed_payment_mxn}
            />

            {/* Plain Spanish Financial Breakdown Preview */}
            <View style={styles.feePreviewBox}>
              <View style={styles.feeRow}>
                <Text style={styles.feeLabel}>Recibe el trabajador:</Text>
                <Text style={styles.feeValue}>
                  {formatCurrencyMXN(validAmount)}
                </Text>
              </View>
              <View style={styles.feeRow}>
                <Text style={styles.feeLabel}>
                  Comisión de la aplicación (10%):
                </Text>
                <Text style={styles.feeValue}>
                  {formatCurrencyMXN(computedFee)}
                </Text>
              </View>
              <View style={[styles.feeRow, styles.feeTotalRow]}>
                <Text style={styles.feeTotalLabel}>Total que pagarás:</Text>
                <Text style={styles.feeTotalValue}>
                  {formatCurrencyMXN(computedTotal)}
                </Text>
              </View>
            </View>
          </SaharaCard>

          {/* Paso 3: ¿Cuándo y a qué hora? (1-Tap Quick Pills + Auto-Masked Inputs) */}
          <SaharaCard variant="lowest" style={{ gap: 14 }}>
            <View style={styles.cardHeaderRow}>
              <Text style={styles.cardSectionTitle}>3. ¿Qué día y a qué hora?</Text>
              <View style={styles.stepPill}>
                <Text style={styles.stepPillText}>Paso 3 de 4</Text>
              </View>
            </View>

            {/* Quick Date Buttons (PY-03-1: No need to type YYYY-MM-DD manually) */}
            <View style={{ gap: 6 }}>
              <Text style={styles.quickHelperLabel}>
                Elige rápido el día con un toque:
              </Text>
              <View style={styles.quickPillsWrap}>
                {quickDateOptions.map((opt) => {
                  const active = form.job_date === opt.ymd;
                  return (
                    <Pressable
                      key={opt.ymd}
                      accessibilityRole="button"
                      accessibilityLabel={`Elegir fecha ${opt.label}, ${formatSpanishDate(opt.ymd)}`}
                      onPress={() => {
                        const next = { ...form, job_date: opt.ymd };
                        setForm(next);
                        validateSingleFieldOnBlur('job_date', next);
                      }}
                      style={[
                        styles.quickPresetPill,
                        active ? styles.quickPresetPillActive : undefined,
                      ]}>
                      <Text
                        style={[
                          styles.quickPresetText,
                          active ? styles.quickPresetTextActive : undefined,
                        ]}>
                        {active ? '✓ ' : ''}
                        {opt.label} ({formatSpanishDate(opt.ymd)})
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>

            <SaharaInput
              testID="job-date-input"
              label="Fecha seleccionada (Año-Mes-Día)"
              placeholder="2026-12-15"
              icon="calendar_today"
              keyboardType="number-pad"
              maxLength={10}
              helperText="Puedes tocar un botón de arriba o escribir los números; los guiones se ponen solos."
              value={form.job_date}
              onChangeText={(v) =>
                setForm((prev) => ({
                  ...prev,
                  job_date: formatDateInputMask(v),
                }))
              }
              onBlur={() => validateSingleFieldOnBlur('job_date')}
              errorText={fieldErrors.job_date}
            />

            {/* Quick Schedule Presets (1-Tap Start + End Time) */}
            <View style={{ gap: 6 }}>
              <Text style={styles.quickHelperLabel}>
                Elige un horario frecuente o escríbelo abajo:
              </Text>
              <View style={styles.quickPillsWrap}>
                {QUICK_SCHEDULE_PRESETS.map((sched) => {
                  const active =
                    form.start_time === sched.start &&
                    form.end_time === sched.end;
                  return (
                    <Pressable
                      key={sched.label}
                      accessibilityRole="button"
                      accessibilityLabel={`Elegir horario ${sched.label}`}
                      onPress={() => {
                        const next = {
                          ...form,
                          start_time: sched.start,
                          end_time: sched.end,
                        };
                        setForm(next);
                        const errs = validateJobForm(next);
                        setFieldErrors((prev) => ({
                          ...prev,
                          start_time: errs.start_time,
                          end_time: errs.end_time,
                          job_date: errs.job_date,
                        }));
                      }}
                      style={[
                        styles.quickPresetPill,
                        active ? styles.quickPresetPillActive : undefined,
                      ]}>
                      <Text
                        style={[
                          styles.quickPresetText,
                          active ? styles.quickPresetTextActive : undefined,
                        ]}>
                        {active ? '✓ ' : ''}
                        {sched.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>

            <View style={{ flexDirection: 'row', gap: 10 }}>
              <View style={{ flex: 1 }}>
                <SaharaInput
                  testID="job-start-input"
                  label="Hora de entrada"
                  placeholder="09:00"
                  icon="schedule"
                  keyboardType="number-pad"
                  maxLength={5}
                  value={form.start_time}
                  onChangeText={(v) =>
                    setForm((prev) => ({
                      ...prev,
                      start_time: formatTimeInputMask(v),
                    }))
                  }
                  onBlur={() => {
                    const normalized = normalizeTimeOnBlur(form.start_time);
                    const next = { ...form, start_time: normalized };
                    setForm(next);
                    validateSingleFieldOnBlur('start_time', next);
                  }}
                  errorText={fieldErrors.start_time}
                />
              </View>
              <View style={{ flex: 1 }}>
                <SaharaInput
                  testID="job-end-input"
                  label="Hora de salida"
                  placeholder="14:00"
                  icon="schedule"
                  keyboardType="number-pad"
                  maxLength={5}
                  value={form.end_time}
                  onChangeText={(v) =>
                    setForm((prev) => ({
                      ...prev,
                      end_time: formatTimeInputMask(v),
                    }))
                  }
                  onBlur={() => {
                    const normalized = normalizeTimeOnBlur(form.end_time);
                    const next = { ...form, end_time: normalized };
                    setForm(next);
                    validateSingleFieldOnBlur('end_time', next);
                  }}
                  errorText={fieldErrors.end_time}
                />
              </View>
            </View>

            <SaharaInput
              testID="job-conditions-input"
              label="¿Qué debe llevar el trabajador? (Opcional)"
              placeholder="Ej. Traer identificación y herramienta básica..."
              multiline
              value={form.conditions}
              onChangeText={(v) =>
                setForm((prev) => ({ ...prev, conditions: v }))
              }
            />
          </SaharaCard>

          {/* Paso 4: ¿Dónde es el trabajo? (Zero SQL Jargon, No Raw GPS Decimals) */}
          <SaharaCard variant="lowest" style={{ gap: 14 }}>
            <View style={styles.cardHeaderRow}>
              <Text style={styles.cardSectionTitle}>4. ¿Dónde es el trabajo?</Text>
              <View style={styles.privateBadge}>
                <SaharaIcon
                  name="lock"
                  size={12}
                  color={SaharaColors.tertiary}
                />
                <Text style={styles.privateBadgeText}>Dirección protegida</Text>
              </View>
            </View>

            <SaharaInput
              testID="job-neighborhood-input"
              label="Colonia o zona (visible en el anuncio)"
              placeholder="Ej. Col. Roma Norte, Cuauhtémoc"
              icon="location_on"
              value={form.neighborhood}
              onChangeText={(v) =>
                setForm((prev) => ({ ...prev, neighborhood: v }))
              }
              onBlur={() => validateSingleFieldOnBlur('neighborhood')}
              errorText={fieldErrors.neighborhood}
            />

            <SaharaInput
              testID="job-exact-address-input"
              label="Calle, número y color de casa (Privado)"
              placeholder="Ej. Calle Reforma #42, portón negro"
              icon="lock"
              helperText="Nadie verá tu calle ni tu número hasta que tú elijas a quién contratar."
              value={form.exact_address}
              onChangeText={(v) =>
                setForm((prev) => ({ ...prev, exact_address: v }))
              }
              onBlur={() => validateSingleFieldOnBlur('exact_address')}
              errorText={fieldErrors.exact_address}
            />

            {/* Simplified Zone Selector in Simulated Map */}
            <View style={{ gap: 8 }}>
              <Text style={styles.fieldLabel}>
                Toca la zona más cercana para calcular la distancia:
              </Text>

              <View style={styles.mapCanvas}>
                <View style={styles.mapGridLines} />
                <View style={styles.mapPinPill}>
                  <SaharaIcon
                    name="push_pin"
                    size={14}
                    color={SaharaColors.onPrimary}
                  />
                  <Text style={styles.mapPinText}>
                    Zona elegida: {selectedZoneName}
                  </Text>
                </View>
                <Text style={styles.mapPrivacyCaption}>
                  Los candidatos solo verán a cuántos kilómetros aproximados
                  están de tu zona.
                </Text>
              </View>

              <View
                accessibilityRole="radiogroup"
                accessibilityLabel="Elige la zona en el mapa"
                style={styles.coordPresetsRow}>
                {PRESET_COORDINATES.map((preset) => {
                  const isActive =
                    Math.abs(form.exact_latitude - preset.lat) < 0.001;
                  return (
                    <Pressable
                      key={preset.label}
                      accessibilityRole="radio"
                      accessibilityLabel={`Zona ${preset.label}`}
                      accessibilityState={{ checked: isActive }}
                      onPress={() =>
                        setForm((prev) => ({
                          ...prev,
                          exact_latitude: preset.lat,
                          exact_longitude: preset.lng,
                        }))
                      }
                      style={[
                        styles.coordPresetBtn,
                        isActive ? styles.coordPresetBtnActive : undefined,
                      ]}>
                      <SaharaIcon
                        name="location_on"
                        size={13}
                        color={
                          isActive
                            ? SaharaColors.onPrimaryFixed
                            : SaharaColors.onSurfaceVariant
                        }
                      />
                      <Text
                        style={[
                          styles.coordPresetText,
                          isActive ? styles.coordPresetTextActive : undefined,
                        ]}>
                        {isActive ? `✓ ${preset.label}` : preset.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          </SaharaCard>

          {/* Paso 5 (Opcional): Fotos del lugar */}
          <SaharaCard variant="lowest">
            <AttachmentPicker
              kind="job_photo"
              items={photos}
              errorText={photoError}
              onValidationError={(msg) => setPhotoError(msg)}
              onAdd={(file) => {
                setPhotoError(null);
                setPhotos((prev) => [...prev, file]);
              }}
              onRemove={(id) => {
                setPhotoError(null);
                setPhotos((prev) => prev.filter((item) => item.id !== id));
              }}
            />
          </SaharaCard>

          {/* Primary Submit CTA */}
          <SaharaButton
            testID="publish-job-submit-btn"
            label={
              isEditMode
                ? 'Guardar Cambios del Anuncio'
                : 'Publicar Trabajo Ahora'
            }
            icon="publish"
            size="lg"
            loading={isSubmitting}
            onPress={() => void handleSubmit()}
          />
        </>
      )}

      {/* Poka-Yoke Guard Against Accidental Back Navigation (`PY-SYS-06`) */}
      <ConfirmationModal
        visible={showExitConfirmModal}
        title="¿Salir sin publicar?"
        description="Si sales ahora, se borrarán los datos que escribiste en este anuncio."
        confirmLabel="Sí, salir y borrar"
        cancelLabel="Seguir escribiendo"
        variant="danger"
        onConfirm={() => {
          setShowExitConfirmModal(false);
          router.back();
        }}
        onCancel={() => setShowExitConfirmModal(false)}
      />
    </SaharaScreenShell>
  );
}

const styles = StyleSheet.create({
  trustBannerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  trustIconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: SaharaColors.primaryAccessible,
    alignItems: 'center',
    justifyContent: 'center',
  },
  trustTitle: {
    fontFamily: Fonts.label,
    fontSize: 13.5,
    fontWeight: '700',
    color: SaharaColors.onPrimaryFixed,
  },
  trustBody: {
    fontFamily: Fonts.body,
    fontSize: 12.5,
    color: SaharaColors.onPrimaryFixedVariant,
    lineHeight: 17,
  },
  successBannerText: {
    fontFamily: Fonts.label,
    fontSize: 13,
    fontWeight: '700',
    color: SaharaColors.onPrimaryFixed,
    textAlign: 'center',
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  cardSectionTitle: {
    fontFamily: Fonts.headline,
    fontSize: 19,
    fontWeight: '700',
    color: SaharaColors.onSurface,
  },
  stepPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: SaharaColors.surfaceContainer,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: Radius.full,
  },
  stepPillText: {
    fontFamily: Fonts.label,
    fontSize: 11,
    fontWeight: '700',
    color: SaharaColors.onPrimaryFixedVariant,
  },
  fieldLabel: {
    fontFamily: Fonts.label,
    fontSize: 12.5,
    fontWeight: '700',
    color: SaharaColors.onSurface,
  },
  quickHelperLabel: {
    fontFamily: Fonts.label,
    fontSize: 12,
    fontWeight: '600',
    color: SaharaColors.onSurfaceVariant,
  },
  quickPillsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  quickPresetPill: {
    minHeight: 48,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: Radius.md,
    backgroundColor: SaharaColors.surfaceContainerLow,
    borderWidth: 1,
    borderColor: SaharaColors.borderDefault,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickPresetPillActive: {
    backgroundColor: SaharaColors.primaryFixed,
    borderColor: SaharaColors.primaryAccessible,
  },
  quickPresetText: {
    fontFamily: Fonts.label,
    fontSize: 12,
    fontWeight: '600',
    color: SaharaColors.onSurface,
  },
  quickPresetTextActive: {
    color: SaharaColors.onPrimaryFixed,
    fontWeight: '700',
  },
  categoryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  categoryChip: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 48,
    gap: 6,
    backgroundColor: SaharaColors.surfaceContainerLow,
    borderWidth: 1,
    borderColor: SaharaColors.outlineVariant,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: Radius.full,
  },
  categoryChipActive: {
    backgroundColor: SaharaColors.primaryAccessible,
    borderColor: SaharaColors.primaryAccessible,
  },
  categoryChipText: {
    fontFamily: Fonts.label,
    fontSize: 12.5,
    fontWeight: '600',
    color: SaharaColors.onSurface,
  },
  categoryChipTextActive: {
    color: SaharaColors.onPrimary,
    fontWeight: '700',
  },
  errText: {
    fontFamily: Fonts.label,
    fontSize: 12,
    color: SaharaColors.error,
  },
  feePreviewBox: {
    backgroundColor: SaharaColors.surfaceContainerLow,
    borderRadius: Radius.md,
    padding: 12,
    gap: 6,
    borderWidth: 1,
    borderColor: SaharaColors.borderDefault,
  },
  feeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  feeLabel: {
    fontFamily: Fonts.body,
    fontSize: 12.5,
    color: SaharaColors.onSurfaceVariant,
  },
  feeValue: {
    fontFamily: Fonts.label,
    fontSize: 13,
    fontWeight: '600',
    color: SaharaColors.onSurface,
  },
  feeTotalRow: {
    paddingTop: 6,
    marginTop: 2,
    borderTopWidth: 1,
    borderTopColor: SaharaColors.borderDefault,
  },
  feeTotalLabel: {
    fontFamily: Fonts.label,
    fontSize: 13,
    fontWeight: '700',
    color: SaharaColors.onSurface,
  },
  feeTotalValue: {
    fontFamily: Fonts.headline,
    fontSize: 18,
    fontWeight: '700',
    color: SaharaColors.primaryAccessible,
  },
  privateBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: SaharaColors.tertiaryFixed,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: Radius.full,
  },
  privateBadgeText: {
    fontFamily: Fonts.label,
    fontSize: 10.5,
    fontWeight: '700',
    color: SaharaColors.onTertiaryFixedVariant,
  },
  mapCanvas: {
    height: 120,
    borderRadius: Radius.lg,
    backgroundColor: SaharaColors.surfaceContainer,
    borderWidth: 1,
    borderColor: SaharaColors.outlineVariant,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    gap: 8,
  },
  mapGridLines: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    opacity: 0.15,
    borderWidth: 1,
    borderColor: SaharaColors.primaryAccessible,
  },
  mapPinPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: SaharaColors.primaryAccessible,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: Radius.full,
  },
  mapPinText: {
    fontFamily: Fonts.label,
    fontSize: 12,
    fontWeight: '700',
    color: SaharaColors.onPrimary,
  },
  mapPrivacyCaption: {
    fontFamily: Fonts.body,
    fontSize: 11.5,
    color: SaharaColors.secondary,
    textAlign: 'center',
  },
  coordPresetsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  coordPresetBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 48,
    gap: 6,
    backgroundColor: SaharaColors.surfaceContainerLow,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: SaharaColors.borderDefault,
  },
  coordPresetBtnActive: {
    backgroundColor: SaharaColors.primaryFixed,
    borderColor: SaharaColors.primaryAccessible,
  },
  coordPresetText: {
    fontFamily: Fonts.label,
    fontSize: 12,
    color: SaharaColors.onSurfaceVariant,
  },
  coordPresetTextActive: {
    color: SaharaColors.onPrimaryFixed,
    fontWeight: '700',
  },
});

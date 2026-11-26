/**
 * UI-EMP-13: Perfil y Ajustes de Empleador
 * Source of Truth: Especificacion_de_Arquitectura_de_Software_v2.md (Section 3.2 UI-EMP-13, RF-04, RF-33)
 * Rules enforced:
 * - Edits `full_name` (nombre o razón comercial), `phone`, `photo_path`
 * - Displays accepted Terms & Privacy records from `terms_acceptances`
 * - Logout button (`logout`) that wipes active session and redirects to `UI-EMP-01`
 */
import React, { useCallback, useState } from 'react';
import {
  Modal,
  Pressable,
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
  formatPhoneInputMask,
  formatSpanishDate,
} from '@/shared/utils/formatters';
import {
  validateFullName,
  validatePhone,
} from '@/shared/utils/validators';
import type { Profile, TermsAcceptance } from '@/types/database';

export function EmployerProfileScreenView() {
  const router = useRouter();
  const storeVersion = useMockBackendStore((s) => s.version);

  const [profile, setProfile] = useState<Profile | null>(null);
  const [terms, setTerms] = useState<TermsAcceptance[]>([]);
  const [activeJobsCount, setActiveJobsCount] = useState(0);

  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [photoPath, setPhotoPath] = useState<string | null>(null);

  const [fieldErrors, setFieldErrors] = useState<{
    full_name?: string;
    phone?: string;
  }>({});
  const [isLoading, setIsLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState<string | null>(null);
  const [legalDocModal, setLegalDocModal] = useState<
    'terms' | 'privacy' | null
  >(null);
  const [showLogoutModal, setShowLogoutModal] = useState(false);

  const hasChanges = Boolean(
    profile &&
      (fullName.trim() !== profile.full_name ||
        phone.trim() !== profile.phone ||
        photoPath !== profile.photo_path),
  );

  const loadProfile = useCallback(async () => {
    setIsLoading(true);
    setErrorMsg(null);
    try {
      const [session, jobsList] = await Promise.all([
        employerRepository.getCurrentSession(),
        employerRepository.listEmployerJobs('all'),
      ]);
      if (!session || !session.profile) {
        router.replace('/(auth)/login');
        return;
      }
      setProfile(session.profile);
      setTerms(session.terms_accepted);
      setFullName(session.profile.full_name);
      setPhone(session.profile.phone);
      setPhotoPath(session.profile.photo_path);
      setActiveJobsCount(
        jobsList.filter(
          (j) =>
            j.status !== 'completed' &&
            j.status !== 'cancelled' &&
            j.status !== 'expired',
        ).length,
      );
    } catch (err) {
      const mapped = mapDomainErrorToUI(err);
      setErrorMsg(mapped.message);
    } finally {
      setIsLoading(false);
    }
  }, [router]);

  useAsyncLoad(loadProfile, storeVersion);

  const { execute: handleSaveProfile, isPending: isSaving } =
    useIdempotentAction(async () => {
      setSaveSuccess(null);
      setErrorMsg(null);

      const nameErr = validateFullName(fullName);
      const phoneErr = validatePhone(phone);
      if (nameErr || phoneErr) {
        setFieldErrors({
          full_name: nameErr ?? undefined,
          phone: phoneErr ?? undefined,
        });
        return;
      }
      setFieldErrors({});

      try {
        const updated = await employerRepository.updateEmployerProfile({
          full_name: fullName,
          phone,
          photo_path: photoPath,
        });
        setProfile(updated);
        setSaveSuccess('¡Tus datos se guardaron!');
      } catch (err) {
        const mapped = mapDomainErrorToUI(err);
        setErrorMsg(mapped.message);
      }
    });

  const { execute: handleLogout, isPending: isLoggingOut } =
    useIdempotentAction(async () => {
      try {
        await employerRepository.logout();
        setShowLogoutModal(false);
        router.replace('/(auth)/login');
      } catch (err) {
        const mapped = mapDomainErrorToUI(err);
        setErrorMsg(mapped.message);
      }
    });

  return (
    <SaharaScreenShell
      header={
        <SaharaHeader
          title="Perfil y Ajustes"
          subtitle="Tus datos"
          badgeText="Sesión activa"
          rightAction={
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Ir al centro de notificaciones"
              onPress={() => router.push('/(main)/notifications')}
              style={styles.notifCircle}>
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
      {isLoading ? (
        <LoadingSkeleton message="Cargando tu perfil..." />
      ) : errorMsg || !profile ? (
        <ErrorState
          message={errorMsg ?? 'No se pudo cargar el perfil.'}
          onRetry={() => void loadProfile()}
        />
      ) : (
        <>
          {/* Profile Editorial Hero Card */}
          <SaharaCard variant="lowest" style={{ gap: 14 }}>
            <View style={styles.heroRow}>
              <Pressable
                testID="change-avatar-btn"
                accessibilityRole="button"
                accessibilityLabel="Actualizar foto de perfil"
                onPress={() =>
                  setPhotoPath(
                    `storage://profiles/emp-${Date.now()}.jpg`,
                  )
                }
                style={styles.avatarContainer}>
                <View style={styles.avatarCircle}>
                  <Text style={styles.avatarInitials}>
                    {profile.full_name.slice(0, 2).toUpperCase()}
                  </Text>
                </View>
                <View style={styles.cameraOverlayBtn}>
                  <SaharaIcon
                    name="photo_camera"
                    size={13}
                    color={SaharaColors.onPrimary}
                  />
                </View>
              </Pressable>

              <View style={{ flex: 1, gap: 4 }}>
                <View style={styles.verifiedBadge}>
                  <SaharaIcon
                    name="verified"
                    size={12}
                    color={SaharaColors.primary}
                  />
                  <Text style={styles.verifiedBadgeText}>
                    Empleador verificado
                  </Text>
                </View>
                <Text style={styles.heroName} numberOfLines={1}>
                  {profile.full_name}
                </Text>
                <Text style={styles.heroEmail}>{profile.email}</Text>
              </View>
            </View>

            <View style={styles.metricsBand}>
              <View style={styles.metricCol}>
                <Text style={styles.metricVal}>{activeJobsCount}</Text>
                <Text style={styles.metricLabel}>Obras Activas</Text>
              </View>
              <View style={styles.metricCol}>
                <Text style={styles.metricVal}>4.9 / 5</Text>
                <Text style={styles.metricLabel}>Reputación</Text>
              </View>
              <View style={styles.metricCol}>
                <Text
                  style={[styles.metricVal, { color: SaharaColors.success }]}>
                  100%
                </Text>
                <Text style={styles.metricLabel}>Pago protegido</Text>
              </View>
            </View>
          </SaharaCard>

          {saveSuccess ? (
            <SaharaCard variant="primaryFixed">
              <Text style={styles.saveSuccessText}>{saveSuccess}</Text>
            </SaharaCard>
          ) : null}

          {/* Section 1: Editable Employer Fields (RF-04) */}
          <SaharaCard variant="lowest" style={{ gap: 14 }}>
            <View style={styles.sectionHeaderRow}>
              <Text style={styles.sectionTitle}>Datos del Empleador</Text>
              <Text style={styles.sectionTag}>Editable</Text>
            </View>

            <SaharaInput
              testID="profile-fullname-input"
              label="Tu nombre o negocio"
              icon="domain"
              value={fullName}
              onChangeText={setFullName}
              onBlur={() =>
                setFieldErrors((prev) => ({
                  ...prev,
                  full_name: validateFullName(fullName) ?? undefined,
                }))
              }
              errorText={fieldErrors.full_name}
            />

            <SaharaInput
              testID="profile-phone-input"
              label="Tu teléfono (WhatsApp)"
              icon="phone_iphone"
              keyboardType="phone-pad"
              helperText="Solo lo verá el trabajador que elijas."
              value={phone}
              onChangeText={(v) => setPhone(formatPhoneInputMask(v))}
              onBlur={() =>
                setFieldErrors((prev) => ({
                  ...prev,
                  phone: validatePhone(phone) ?? undefined,
                }))
              }
              errorText={fieldErrors.phone}
            />

            <SaharaInput
              label="Tu correo (no se puede cambiar)"
              icon="mail"
              editable={false}
              value={profile.email}
            />

            {/* Avatar / Portfolio Photo Uploader Row */}
            <View style={styles.photoUploadRow}>
              <View style={styles.photoIconBox}>
                <SaharaIcon
                  name="image"
                  size={18}
                  color={SaharaColors.primary}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.photoTitle}>
                  Foto de perfil (JPG o PNG)
                </Text>
                <Text style={styles.photoSub} numberOfLines={1}>
                  {photoPath ? 'Foto lista para guardar' : 'Sin foto cargada'}
                </Text>
              </View>
              <SaharaButton
                label="Actualizar"
                size="sm"
                variant="secondary"
                fullWidth={false}
                onPress={() =>
                  setPhotoPath(
                    `storage://profiles/emp-photo-${Date.now()}.jpg`,
                  )
                }
              />
            </View>

            <SaharaButton
              testID="save-profile-btn"
              label={hasChanges ? 'Guardar Cambios' : 'Sin cambios por guardar'}
              icon="check"
              disabled={!hasChanges}
              loading={isSaving}
              onPress={() => void handleSaveProfile()}
            />
          </SaharaCard>

          {/* Section 2: Legal & Regulatory Framework (`terms_acceptances` RF-33, D-10) */}
          <SaharaCard variant="lowest" style={{ gap: 10 }}>
            <Text style={styles.sectionTitle}>
              Documentos legales
            </Text>

            {(['terms', 'privacy'] as const).map((docType) => {
              const record = terms.find((t) => t.document === docType);
              const titleText =
                docType === 'terms'
                  ? 'Términos y Condiciones del Empleador'
                  : 'Aviso de Privacidad Integral (LFPDPPP)';
              return (
                <Pressable
                  key={docType}
                  testID={`legal-doc-btn-${docType}`}
                  accessibilityRole="button"
                  accessibilityLabel={`Ver documento: ${titleText}`}
                  onPress={() => setLegalDocModal(docType)}
                  style={styles.legalItemRow}>
                  <SaharaIcon
                    name={docType === 'terms' ? 'gavel' : 'verified_user'}
                    size={18}
                    color={SaharaColors.primary}
                  />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.legalItemTitle}>{titleText}</Text>
                    <Text style={styles.legalItemSub}>
                      {record
                        ? `Versión ${record.version} · Aceptado el ${formatSpanishDate(record.accepted_at)}`
                        : 'Versión v1.4 vigente'}
                    </Text>
                  </View>
                  <SaharaIcon
                    name="chevron_right"
                    size={18}
                    color={SaharaColors.secondary}
                  />
                </Pressable>
              );
            })}
          </SaharaCard>

          {/* Section 3: Session & Security (Logout) */}
          <View style={{ gap: 10 }}>
            <SaharaButton
              testID="logout-btn"
              label="Cerrar Sesión"
              icon="logout"
              variant="danger"
              onPress={() => setShowLogoutModal(true)}
            />
            <Text style={styles.versionFootnote}>
              Solidez MX · Tus pagos y datos están protegidos
            </Text>
          </View>
        </>
      )}

      {/* Logout Confirmation Modal */}
      <ConfirmationModal
        visible={showLogoutModal}
        title="¿Cerrar sesión activa?"
        description="Se eliminarán las credenciales en memoria y regresarás a la pantalla de inicio de sesión."
        confirmLabel="Sí, Cerrar Sesión"
        cancelLabel="Cancelar"
        variant="danger"
        loading={isLoggingOut}
        onConfirm={() => void handleLogout()}
        onCancel={() => setShowLogoutModal(false)}
      />

      {/* Legal Doc Reader Modal */}
      <Modal
        visible={legalDocModal !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setLegalDocModal(null)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>
              {legalDocModal === 'terms'
                ? 'Términos de Uso del Empleador'
                : 'Aviso de Privacidad'}
            </Text>
            <Text style={styles.modalBody}>
              {legalDocModal === 'terms'
                ? 'Cada pago incluye una comisión de la aplicación del 10%. Tu dinero se guarda de forma segura y solo se entrega al trabajador cuando termina, con tu código de 6 números o tras una revisión de Solidez MX.'
                : 'Tu dirección exacta y tu teléfono están protegidos y solo se muestran al trabajador que tú elijas.'}
            </Text>
            <SaharaButton
              label="Cerrar Documento"
              onPress={() => setLegalDocModal(null)}
            />
          </View>
        </View>
      </Modal>
    </SaharaScreenShell>
  );
}

const styles = StyleSheet.create({
  notifCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: SaharaColors.surfaceContainerLow,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  avatarContainer: {
    position: 'relative',
    minWidth: 68,
    minHeight: 68,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarCircle: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: SaharaColors.primaryFixed,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitials: {
    fontFamily: Fonts.headline,
    fontSize: 24,
    fontWeight: '700',
    color: SaharaColors.primary,
  },
  cameraOverlayBtn: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: SaharaColors.primaryAccessible,
    alignItems: 'center',
    justifyContent: 'center',
  },
  verifiedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 4,
    backgroundColor: SaharaColors.surfaceContainer,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: Radius.full,
  },
  verifiedBadgeText: {
    fontFamily: Fonts.label,
    fontSize: 10.5,
    fontWeight: '700',
    color: SaharaColors.onSurfaceVariant,
  },
  heroName: {
    fontFamily: Fonts.headline,
    fontSize: 20,
    fontWeight: '700',
    color: SaharaColors.onSurface,
  },
  heroEmail: {
    fontFamily: Fonts.body,
    fontSize: 12,
    color: SaharaColors.onSurfaceVariant,
  },
  metricsBand: {
    flexDirection: 'row',
    backgroundColor: SaharaColors.surfaceContainerLow,
    borderRadius: Radius.lg,
    padding: 12,
    justifyContent: 'space-around',
  },
  metricCol: {
    alignItems: 'center',
    gap: 2,
  },
  metricVal: {
    fontFamily: Fonts.headline,
    fontSize: 18,
    fontWeight: '700',
    color: SaharaColors.onSurface,
  },
  metricLabel: {
    fontFamily: Fonts.label,
    fontSize: 10.5,
    color: SaharaColors.onSurfaceVariant,
  },
  saveSuccessText: {
    fontFamily: Fonts.label,
    fontSize: 12.5,
    fontWeight: '700',
    color: SaharaColors.onPrimaryFixed,
    textAlign: 'center',
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sectionTitle: {
    fontFamily: Fonts.headline,
    fontSize: 18,
    fontWeight: '700',
    color: SaharaColors.onSurface,
  },
  sectionTag: {
    fontFamily: Fonts.label,
    fontSize: 11,
    fontWeight: '700',
    color: SaharaColors.primary,
  },
  photoUploadRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: SaharaColors.surfaceContainerLow,
    padding: 10,
    borderRadius: Radius.md,
  },
  photoIconBox: {
    width: 36,
    height: 36,
    borderRadius: Radius.sm,
    backgroundColor: SaharaColors.primaryFixed,
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoTitle: {
    fontFamily: Fonts.label,
    fontSize: 12,
    fontWeight: '700',
    color: SaharaColors.onSurface,
  },
  photoSub: {
    fontFamily: Fonts.body,
    fontSize: 11,
    color: SaharaColors.secondary,
  },
  legalItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: SaharaColors.surfaceContainerLow,
    padding: 12,
    minHeight: 48,
    borderRadius: Radius.md,
  },
  legalItemTitle: {
    fontFamily: Fonts.label,
    fontSize: 12.5,
    fontWeight: '700',
    color: SaharaColors.onSurface,
  },
  legalItemSub: {
    fontFamily: Fonts.body,
    fontSize: 11,
    color: SaharaColors.secondary,
  },
  versionFootnote: {
    fontFamily: Fonts.label,
    fontSize: 11,
    color: SaharaColors.secondary,
    textAlign: 'center',
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
    gap: 12,
  },
  modalTitle: {
    fontFamily: Fonts.headline,
    fontSize: 19,
    fontWeight: '700',
    color: SaharaColors.onSurface,
  },
  modalBody: {
    fontFamily: Fonts.body,
    fontSize: 13,
    color: SaharaColors.onSurfaceVariant,
    lineHeight: 19,
  },
});

/**
 * MÓDULO 15: PERFIL Y CONFIGURACIÓN DEL TRABAJADOR
 * - Muestra: fotografía/avatar, nombre, correo, teléfono, fecha de nacimiento,
 *   habilidades, disponibilidad, evaluaciones recibidas e historial de trabajos.
 * - Permite editar: nombre, teléfono, fotografía/avatar, habilidades (<=300 chars) y disponibilidad (<=300 chars).
 * - Incluye: Aviso de privacidad, Términos de uso, configuración de cuenta, accesos a Pagos/Casos/Stripe Connect y Cerrar sesión.
 */
import React, { useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Fonts, Radius, SaharaColors, Spacing } from '@/constants/theme';
import {
  AvatarBadge,
  ConfirmationModal,
  FeedbackBanner,
  JobStatusBadge,
  RatingStars,
  SaharaButton,
  SaharaCard,
  SaharaHeader,
  SaharaIcon,
  SaharaInput,
  SaharaScreenShell,
  WorkerBottomNav,
} from '@/components/ui';
import { useWorkerStore, workerStore } from '@/services/worker-store';
import { mapDomainErrorToMessage } from '@/shared/utils/error-mapper';
import {
  formatCurrencyMXN,
  formatPhoneInputMask,
  formatSpanishDate,
  getInitials,
} from '@/shared/utils/formatters';

const AVATAR_TONES = [
  { label: 'Arena', hex: '#fbe8d8' },
  { label: 'Terracota', hex: '#f0a878' },
  { label: 'Oliva', hex: '#e2f4e8' },
  { label: 'Piedra', hex: '#eae2da' },
  { label: 'Rosa cálido', hex: '#fce0e0' },
];

export function WorkerProfileScreen() {
  const router = useRouter();
  const version = useWorkerStore((s) => s.version);
  const worker = useWorkerStore((s) =>
    s.db.profiles.find((p) => p.id === s.activeWorkerId),
  );

  const [isEditing, setIsEditing] = useState(false);
  const [fullName, setFullName] = useState(worker?.full_name ?? '');
  const [phone, setPhone] = useState(worker?.phone ?? '');
  const [skills, setSkills] = useState(worker?.skills ?? '');
  const [availability, setAvailability] = useState(worker?.availability ?? '');
  const [avatarTone, setAvatarTone] = useState(
    worker?.avatar_tone ?? '#fbe8d8',
  );
  const [photoLabel, setPhotoLabel] = useState<string | null>(
    worker?.photo_path ?? null,
  );
  const [feedback, setFeedback] = useState<{
    tone: 'success' | 'error';
    text: string;
  } | null>(null);
  const [legalDoc, setLegalDoc] = useState<'terms' | 'privacy' | null>(null);
  const [confirmLogout, setConfirmLogout] = useState(false);
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);

  const { receivedReviews, workHistory, averageRating } = useMemo(() => {
    void version;
    if (!worker) {
      return { receivedReviews: [], workHistory: [], averageRating: null };
    }
    const revs = workerStore.getWorkerReceivedReviews();
    const jobs = workerStore.listMyJobs();
    const avg =
      revs.length > 0
        ? revs.reduce((s, r) => s + r.rating, 0) / revs.length
        : null;
    return {
      receivedReviews: revs,
      workHistory: jobs,
      averageRating: avg,
    };
  }, [version, worker]);

  if (!worker) return null;

  const openEdit = () => {
    setFullName(worker.full_name);
    setPhone(worker.phone);
    setSkills(worker.skills ?? '');
    setAvailability(worker.availability ?? '');
    setAvatarTone(worker.avatar_tone ?? '#fbe8d8');
    setPhotoLabel(worker.photo_path);
    setFeedback(null);
    setIsEditing(true);
  };

  const handleSaveProfile = () => {
    setFeedback(null);
    try {
      workerStore.updateWorkerProfile({
        full_name: fullName,
        phone,
        skills,
        availability,
        avatar_tone: avatarTone,
        photo_path: photoLabel,
      });
      setIsEditing(false);
      setFeedback({
        tone: 'success',
        text: 'Los cambios en tu perfil fueron guardados correctamente.',
      });
    } catch (err) {
      setFeedback({ tone: 'error', text: mapDomainErrorToMessage(err) });
    }
  };

  const handleLogout = () => {
    setConfirmLogout(false);
    workerStore.logout();
    router.replace('/(auth)/login' as never);
  };

  return (
    <SaharaScreenShell
      header={
        <SaharaHeader
          title="Mi perfil"
          subtitle="Cuenta de trabajador"
          rightAction={
            !isEditing ? (
              <Pressable onPress={openEdit} style={styles.editPill}>
                <SaharaIcon name="edit" size={13} color={SaharaColors.onPrimaryFixed} />
                <Text style={styles.editPillText}>Editar</Text>
              </Pressable>
            ) : undefined
          }
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

      {/* Tarjeta principal de perfil */}
      <SaharaCard
        variant="lowest"
        accentColor={SaharaColors.primaryAccessible}
        style={{ gap: 14 }}>
        <View style={styles.profileHeader}>
          <AvatarBadge
            initials={worker.avatar_initials ?? getInitials(worker.full_name)}
            size={64}
            tone={worker.avatar_tone ?? SaharaColors.primaryFixed}
          />
          <View style={{ flex: 1, gap: 4 }}>
            <Text style={styles.name}>{worker.full_name}</Text>
            <Text style={styles.email}>{worker.email}</Text>
            {averageRating !== null ? (
              <View style={styles.ratingRow}>
                <RatingStars rating={averageRating} size={15} />
                <Text style={styles.ratingText}>
                  {averageRating.toFixed(1)} ({receivedReviews.length} reseñas)
                </Text>
              </View>
            ) : (
              <Text style={styles.mutedSmall}>Sin evaluaciones recibidas</Text>
            )}
          </View>
        </View>

        {!isEditing ? (
          <View style={styles.infoList}>
            <View style={styles.infoRow}>
              <Text style={styles.infoKey}>Teléfono</Text>
              <Text style={styles.infoVal}>{worker.phone}</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoKey}>Fecha de nacimiento</Text>
              <Text style={styles.infoVal}>
                {formatSpanishDate(worker.birth_date)}
              </Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoKey}>Fotografía de perfil</Text>
              <Text style={styles.infoVal}>
                {worker.photo_path ? worker.photo_path : 'Avatar con iniciales'}
              </Text>
            </View>
            <View style={styles.bioBlock}>
              <Text style={styles.bioTitle}>Habilidades</Text>
              <Text style={styles.bioText}>
                {worker.skills || 'Aún no registras tus habilidades.'}
              </Text>
            </View>
            <View style={styles.bioBlock}>
              <Text style={styles.bioTitle}>Disponibilidad</Text>
              <Text style={styles.bioText}>
                {worker.availability || 'Aún no registras tu disponibilidad.'}
              </Text>
            </View>
          </View>
        ) : (
          <View style={{ gap: 12 }}>
            <Text style={styles.editHeading}>Editar información personal</Text>

            <View style={{ gap: 6 }}>
              <Text style={styles.fieldLabel}>Fotografía y estilo de avatar</Text>
              <View style={styles.tonesRow}>
                {AVATAR_TONES.map((t) => (
                  <Pressable
                    key={t.hex}
                    onPress={() => setAvatarTone(t.hex)}
                    style={[
                      styles.toneChip,
                      { backgroundColor: t.hex },
                      avatarTone === t.hex ? styles.toneChipActive : undefined,
                    ]}>
                    <Text style={styles.toneChipText}>{t.label}</Text>
                  </Pressable>
                ))}
              </View>
              <SaharaButton
                label={
                  photoLabel
                    ? `Foto seleccionada: ${photoLabel}`
                    : 'Actualizar fotografía de perfil (JPG/PNG)'
                }
                variant="outline"
                size="sm"
                icon="photo_camera"
                onPress={() =>
                  setPhotoLabel(
                    photoLabel ? null : 'foto_perfil_trabajador.jpg',
                  )
                }
              />
            </View>

            <SaharaInput
              label="Nombre completo *"
              value={fullName}
              onChangeText={setFullName}
            />
            <SaharaInput
              label="Teléfono *"
              keyboardType="phone-pad"
              value={phone}
              onChangeText={(v) => setPhone(formatPhoneInputMask(v))}
            />
            <SaharaInput
              label="Habilidades (máximo 300 caracteres)"
              multiline
              maxLength={300}
              rightBadge={`${skills.length}/300`}
              value={skills}
              onChangeText={setSkills}
            />
            <SaharaInput
              label="Disponibilidad (máximo 300 caracteres)"
              multiline
              maxLength={300}
              rightBadge={`${availability.length}/300`}
              value={availability}
              onChangeText={setAvailability}
            />

            <View style={styles.editBtnsRow}>
              <View style={{ flex: 1 }}>
                <SaharaButton
                  label="Cancelar"
                  variant="outline"
                  onPress={() => setIsEditing(false)}
                />
              </View>
              <View style={{ flex: 1 }}>
                <SaharaButton
                  label="Guardar cambios"
                  icon="check_circle"
                  onPress={handleSaveProfile}
                />
              </View>
            </View>
          </View>
        )}
      </SaharaCard>

      {/* Accesos de gestión del trabajador */}
      <SaharaCard variant="lowest" style={{ gap: 8 }}>
        <Text style={styles.sectionTitle}>Gestión de cuenta</Text>

        {[
          {
            icon: 'payments',
            label: 'Pagos e ingresos',
            sub: 'Resumen de transferencias y movimientos MXN',
            route: '/(main)/payments',
          },
          {
            icon: 'account_balance',
            label: 'Cuenta conectada (Stripe Connect)',
            sub: worker.stripe_onboarding_complete
              ? 'Alta verificada y activa'
              : 'Completar alta para recibir pagos',
            route: '/(main)/stripe-connect',
          },
          {
            icon: 'support_agent',
            label: 'Casos, reclamaciones y soporte',
            sub: 'Tickets, reportes y seguimiento',
            route: '/(main)/cases',
          },
          {
            icon: 'location_on',
            label: 'Ubicación de referencia y radio',
            sub: 'Ajustar punto manual y alcance',
            route: '/(main)/location',
          },
        ].map((row) => (
          <Pressable
            key={row.label}
            onPress={() => router.push(row.route as never)}
            style={styles.menuRow}>
            <View style={styles.menuIconBox}>
              <SaharaIcon
                name={row.icon}
                size={15}
                color={SaharaColors.onPrimaryFixedVariant}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.menuTitle}>{row.label}</Text>
              <Text style={styles.menuSub}>{row.sub}</Text>
            </View>
            <SaharaIcon
              name="chevron_right"
              size={16}
              color={SaharaColors.secondary}
            />
          </Pressable>
        ))}

        {/* Preferencia de alertas */}
        <Pressable
          onPress={() => setNotificationsEnabled((v) => !v)}
          style={styles.menuRow}>
          <View style={styles.menuIconBox}>
            <SaharaIcon
              name="notifications"
              size={15}
              color={SaharaColors.onPrimaryFixedVariant}
            />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.menuTitle}>Alertas de actividad</Text>
            <Text style={styles.menuSub}>
              {notificationsEnabled
                ? 'Activadas para selecciones, mensajes y pagos'
                : 'Pausadas temporalmente'}
            </Text>
          </View>
          <View
            style={[
              styles.togglePill,
              notificationsEnabled ? styles.togglePillOn : undefined,
            ]}>
            <Text
              style={[
                styles.toggleText,
                notificationsEnabled ? styles.toggleTextOn : undefined,
              ]}>
              {notificationsEnabled ? 'Activas' : 'Pausadas'}
            </Text>
          </View>
        </Pressable>
      </SaharaCard>

      {/* Evaluaciones recibidas */}
      <SaharaCard variant="lowest" style={{ gap: 10 }}>
        <Text style={styles.sectionTitle}>
          Evaluaciones recibidas ({receivedReviews.length})
        </Text>
        {receivedReviews.length === 0 ? (
          <Text style={styles.mutedSmall}>
            Aún no has recibido evaluaciones de empleadores.
          </Text>
        ) : (
          receivedReviews.map((rev) => (
            <View key={rev.id} style={styles.reviewItem}>
              <View style={styles.reviewTop}>
                <Text style={styles.reviewAuthor}>{rev.reviewer_name}</Text>
                <RatingStars rating={rev.rating} size={14} />
              </View>
              <Text style={styles.reviewJob}>{rev.job_title}</Text>
              {rev.comment ? (
                <Text style={styles.bioText}>{rev.comment}</Text>
              ) : null}
              <Text style={styles.mutedSmall}>
                {formatSpanishDate(rev.created_at)}
              </Text>
            </View>
          ))
        )}
      </SaharaCard>

      {/* Historial de trabajos */}
      <SaharaCard variant="lowest" style={{ gap: 10 }}>
        <Text style={styles.sectionTitle}>
          Historial de trabajos ({workHistory.length})
        </Text>
        {workHistory.slice(0, 5).map((item) => (
          <Pressable
            key={item.job.id}
            onPress={() => router.push(`/(main)/job/${item.job.id}` as never)}
            style={styles.historyRow}>
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={styles.menuTitle} numberOfLines={1}>
                {item.job.title}
              </Text>
              <Text style={styles.menuSub}>
                {item.employer_name} · {formatSpanishDate(item.job.job_date)} ·{' '}
                {formatCurrencyMXN(item.job.fixed_payment_mxn)}
              </Text>
            </View>
            <JobStatusBadge status={item.job.status} />
          </Pressable>
        ))}
      </SaharaCard>

      {/* Documentos legales y cierre de sesión */}
      <SaharaCard variant="low" style={{ gap: 8 }}>
        <Text style={styles.sectionTitle}>Información legal y sesión</Text>
        <View style={styles.legalBtns}>
          <View style={{ flex: 1 }}>
            <SaharaButton
              label="Términos de uso"
              variant="outline"
              size="sm"
              onPress={() => setLegalDoc('terms')}
            />
          </View>
          <View style={{ flex: 1 }}>
            <SaharaButton
              label="Aviso de privacidad"
              variant="outline"
              size="sm"
              onPress={() => setLegalDoc('privacy')}
            />
          </View>
        </View>
        <SaharaButton
          label="Cerrar sesión"
          variant="danger"
          icon="logout"
          onPress={() => setConfirmLogout(true)}
        />
      </SaharaCard>

      {/* Modal legal */}
      <Modal
        visible={legalDoc !== null}
        transparent
        animationType="slide"
        onRequestClose={() => setLegalDoc(null)}>
        <View style={styles.legalBackdrop}>
          <View style={styles.legalCard}>
            <Text style={styles.sectionTitle}>
              {legalDoc === 'terms' ? 'Términos de Uso' : 'Aviso de Privacidad'}
            </Text>
            <ScrollView style={{ maxHeight: 340 }}>
              <Text style={styles.bioText}>
                {legalDoc === 'terms'
                  ? 'Al utilizar Solidez MX como trabajador, confirmas ser mayor de 18 años y proporcionar información verídica. Las condiciones de cada oportunidad se confirman de forma explícita tras la selección y el cierre se valida mediante código de 6 dígitos o solicitud con evidencias.'
                  : 'Solidez MX protege tus datos personales conforme a la legislación vigente en México. Tu ubicación de referencia se define de forma manual sin solicitar permisos GPS y los datos de cobro se gestionan mediante cuentas conectadas sin almacenar datos bancarios en la aplicación.'}
              </Text>
            </ScrollView>
            <SaharaButton label="Cerrar" onPress={() => setLegalDoc(null)} />
          </View>
        </View>
      </Modal>

      <ConfirmationModal
        visible={confirmLogout}
        title="¿Cerrar sesión?"
        description="Saldrás de tu cuenta de trabajador en este dispositivo y volverás a la pantalla de inicio de sesión."
        confirmLabel="Sí, cerrar sesión"
        variant="danger"
        onConfirm={handleLogout}
        onCancel={() => setConfirmLogout(false)}
      />
    </SaharaScreenShell>
  );
}

const styles = StyleSheet.create({
  editPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: SaharaColors.primaryFixed,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: Radius.full,
  },
  editPillText: {
    fontFamily: Fonts.label,
    fontSize: 12,
    fontWeight: '700',
    color: SaharaColors.onPrimaryFixed,
  },
  profileHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  name: {
    fontFamily: Fonts.headline,
    fontSize: 21,
    fontWeight: '600',
    color: SaharaColors.onSurface,
  },
  email: {
    fontFamily: Fonts.body,
    fontSize: 12.5,
    color: SaharaColors.onSurfaceVariant,
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  ratingText: {
    fontFamily: Fonts.label,
    fontSize: 12,
    fontWeight: '700',
    color: SaharaColors.onSurface,
  },
  mutedSmall: {
    fontFamily: Fonts.body,
    fontSize: 11.5,
    color: SaharaColors.secondary,
  },
  infoList: {
    gap: 10,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: SaharaColors.borderSubtle,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
  },
  infoKey: {
    fontFamily: Fonts.body,
    fontSize: 12.5,
    color: SaharaColors.onSurfaceVariant,
  },
  infoVal: {
    fontFamily: Fonts.label,
    fontSize: 12.5,
    fontWeight: '600',
    color: SaharaColors.onSurface,
  },
  bioBlock: {
    backgroundColor: SaharaColors.surfaceContainerLow,
    padding: 12,
    borderRadius: Radius.lg,
    gap: 4,
  },
  bioTitle: {
    fontFamily: Fonts.label,
    fontSize: 12,
    fontWeight: '700',
    color: SaharaColors.secondary,
    textTransform: 'uppercase',
  },
  bioText: {
    fontFamily: Fonts.body,
    fontSize: 13,
    color: SaharaColors.onSurface,
    lineHeight: 19,
  },
  editHeading: {
    fontFamily: Fonts.headline,
    fontSize: 18,
    fontWeight: '600',
    color: SaharaColors.onSurface,
  },
  fieldLabel: {
    fontFamily: Fonts.label,
    fontSize: 12.5,
    fontWeight: '700',
    color: SaharaColors.onSurface,
  },
  tonesRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  toneChip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: Radius.full,
    borderWidth: 1,
    borderColor: SaharaColors.borderSubtle,
  },
  toneChipActive: {
    borderWidth: 2,
    borderColor: SaharaColors.primaryAccessible,
  },
  toneChipText: {
    fontFamily: Fonts.label,
    fontSize: 11.5,
    fontWeight: '700',
    color: SaharaColors.onSurface,
  },
  editBtnsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  sectionTitle: {
    fontFamily: Fonts.headline,
    fontSize: 18,
    fontWeight: '600',
    color: SaharaColors.onSurface,
  },
  menuRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: SaharaColors.borderSubtle,
  },
  menuIconBox: {
    width: 36,
    height: 36,
    borderRadius: Radius.md,
    backgroundColor: SaharaColors.primaryFixed,
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuTitle: {
    fontFamily: Fonts.label,
    fontSize: 13.5,
    fontWeight: '700',
    color: SaharaColors.onSurface,
  },
  menuSub: {
    fontFamily: Fonts.body,
    fontSize: 11.5,
    color: SaharaColors.onSurfaceVariant,
  },
  togglePill: {
    backgroundColor: SaharaColors.surfaceContainerHigh,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: Radius.full,
  },
  togglePillOn: {
    backgroundColor: SaharaColors.successContainer,
  },
  toggleText: {
    fontFamily: Fonts.label,
    fontSize: 11,
    fontWeight: '700',
    color: SaharaColors.onSurfaceVariant,
  },
  toggleTextOn: {
    color: SaharaColors.onSuccessContainer,
  },
  reviewItem: {
    backgroundColor: SaharaColors.surfaceContainerLow,
    padding: 12,
    borderRadius: Radius.lg,
    gap: 4,
  },
  reviewTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
  },
  reviewAuthor: {
    fontFamily: Fonts.label,
    fontSize: 12.5,
    fontWeight: '700',
    color: SaharaColors.onSurface,
  },
  reviewJob: {
    fontFamily: Fonts.label,
    fontSize: 11.5,
    color: SaharaColors.primaryAccessible,
  },
  historyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: SaharaColors.borderSubtle,
  },
  legalBtns: {
    flexDirection: 'row',
    gap: 10,
  },
  legalBackdrop: {
    flex: 1,
    backgroundColor: SaharaColors.backdropOverlay,
    justifyContent: 'center',
    padding: Spacing.md,
  },
  legalCard: {
    backgroundColor: SaharaColors.surfaceContainerLowest,
    borderRadius: Radius.xxl,
    padding: Spacing.lg,
    gap: Spacing.md,
  },
});

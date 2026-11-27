/**
 * MÓDULO 1: AUTENTICACIÓN DEL TRABAJADOR
 * - Inicio de sesión
 * - Registro de trabajador (nombre, correo, contraseña >=8 + mayús + minús + núm, teléfono, fecha nacimiento >=18)
 * - Formulario de información personal inicial (habilidades y disponibilidad opcionales)
 * - Aceptación de Términos de Uso y Aviso de Privacidad (con visor legal)
 * - Recuperación de contraseña
 * Exclusivo para trabajadores (sin registro de empleadores ni administradores).
 */
import React, { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Fonts, Radius, SaharaColors, Spacing } from '@/constants/theme';
import {
  FeedbackBanner,
  SaharaButton,
  SaharaCard,
  SaharaIcon,
  SaharaInput,
  SaharaScreenShell,
} from '@/components/ui';
import { workerStore } from '@/services/worker-store';
import { mapDomainErrorToMessage } from '@/shared/utils/error-mapper';
import {
  calculateAgeYears,
  formatDateInputMask,
  formatPhoneInputMask,
} from '@/shared/utils/formatters';
import {
  getPasswordChecklist,
  getPasswordStrength,
  validateBirthDateAdult,
  validateEmail,
  validateFullName,
  validatePassword,
  validatePhone,
  validateRegisterForm,
  validateWorkerBioField,
  type FieldErrors,
  type RegisterFormInput,
} from '@/shared/utils/validators';

type AuthStep = 'login' | 'register_account' | 'register_personal' | 'recovery';

export function WorkerAuthScreen() {
  const router = useRouter();
  const [step, setStep] = useState<AuthStep>('login');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [infoMsg, setInfoMsg] = useState<string | null>(null);

  // Login — Preconfigurado en Modo Demostración Bypass (de solo lectura)
  const [loginEmail] = useState('carlos.mendoza@correo.mx');
  const [loginPassword] = useState('Solidez2026');
  const [showLoginPass, setShowLoginPass] = useState(false);

  // Registro + información personal inicial
  const [regForm, setRegForm] = useState<RegisterFormInput>({
    full_name: '',
    email: '',
    phone: '',
    birth_date: '',
    password: '',
    accept_terms: false,
    accept_privacy: false,
  });
  const [skills, setSkills] = useState('');
  const [availability, setAvailability] = useState('');
  const [showRegPass, setShowRegPass] = useState(false);
  const [regErrors, setRegErrors] = useState<
    FieldErrors<keyof RegisterFormInput | 'skills' | 'availability'>
  >({});

  // Recuperación de contraseña
  const [recoveryEmail, setRecoveryEmail] = useState('');

  // Modal legal
  const [legalDoc, setLegalDoc] = useState<'terms' | 'privacy' | null>(null);

  const passCheck = getPasswordChecklist(regForm.password);
  const passStrength = getPasswordStrength(regForm.password);
  const computedAge = calculateAgeYears(regForm.birth_date);

  const handleLogin = () => {
    setErrorMsg(null);
    setInfoMsg(null);
    try {
      workerStore.login('carlos.mendoza@correo.mx', 'Solidez2026');
      router.replace('/(main)/home');
    } catch (err) {
      setErrorMsg(mapDomainErrorToMessage(err));
    }
  };

  const handleNextRegisterStep = () => {
    setErrorMsg(null);
    const normalized: RegisterFormInput = {
      ...regForm,
      birth_date: formatDateInputMask(regForm.birth_date),
    };
    const errors: FieldErrors<keyof RegisterFormInput> = {};
    const nameErr = validateFullName(normalized.full_name);
    if (nameErr) errors.full_name = nameErr;
    const emailErr = validateEmail(normalized.email);
    if (emailErr) errors.email = emailErr;
    const phoneErr = validatePhone(normalized.phone);
    if (phoneErr) errors.phone = phoneErr;
    const dobErr = validateBirthDateAdult(normalized.birth_date);
    if (dobErr) errors.birth_date = dobErr;
    const passErr = validatePassword(normalized.password);
    if (passErr) errors.password = passErr;

    if (Object.keys(errors).length > 0) {
      setRegErrors(errors);
      setErrorMsg('Revisa los campos marcados antes de continuar.');
      return;
    }

    setRegForm(normalized);
    setRegErrors({});
    setStep('register_personal');
  };

  const handleCompleteRegistration = () => {
    setErrorMsg(null);
    const normalized: RegisterFormInput = {
      ...regForm,
      birth_date: formatDateInputMask(regForm.birth_date),
    };
    const errors: FieldErrors<
      keyof RegisterFormInput | 'skills' | 'availability'
    > = validateRegisterForm(normalized);

    const skillsErr = validateWorkerBioField(skills, 'Habilidades');
    if (skillsErr) errors.skills = skillsErr;
    const availErr = validateWorkerBioField(availability, 'Disponibilidad');
    if (availErr) errors.availability = availErr;

    if (Object.keys(errors).length > 0) {
      setRegErrors(errors);
      setErrorMsg(
        errors.accept_terms ?? 'Completa los requisitos antes de crear tu cuenta.',
      );
      return;
    }

    try {
      workerStore.registerWorker({
        ...normalized,
        skills,
        availability,
      });
      router.replace('/(main)/home');
    } catch (err) {
      setErrorMsg(mapDomainErrorToMessage(err));
    }
  };

  const handleRecovery = () => {
    setErrorMsg(null);
    setInfoMsg(null);
    try {
      const msg = workerStore.requestPasswordRecovery(recoveryEmail);
      setInfoMsg(msg);
    } catch (err) {
      setErrorMsg(mapDomainErrorToMessage(err));
    }
  };

  return (
    <SaharaScreenShell contentContainerStyle={styles.container}>
      {/* Cabecera de marca */}
      <View style={styles.brandHeader}>
        <View style={styles.brandMark}>
          <Text style={styles.brandLetter}>S</Text>
        </View>
        <Text style={styles.brandName}>Solidez MX</Text>
        <Text style={styles.brandTagline}>
          Plataforma de trabajos temporales para trabajadores
        </Text>
      </View>

      {/* Selector entre Entrar y Crear cuenta */}
      {step === 'login' || step === 'register_account' ? (
        <View style={styles.tabRow}>
          <Pressable
            onPress={() => {
              setStep('login');
              setErrorMsg(null);
              setInfoMsg(null);
            }}
            style={[
              styles.tabBtn,
              step === 'login' ? styles.tabBtnActive : undefined,
            ]}>
            <Text
              style={[
                styles.tabText,
                step === 'login' ? styles.tabTextActive : undefined,
              ]}>
              Iniciar sesión
            </Text>
          </Pressable>
          <Pressable
            onPress={() => {
              setStep('register_account');
              setErrorMsg(null);
              setInfoMsg(null);
            }}
            style={[
              styles.tabBtn,
              step === 'register_account' ? styles.tabBtnActive : undefined,
            ]}>
            <Text
              style={[
                styles.tabText,
                step === 'register_account' ? styles.tabTextActive : undefined,
              ]}>
              Registrarme
            </Text>
          </Pressable>
        </View>
      ) : null}

      {errorMsg ? (
        <FeedbackBanner
          tone="error"
          message={errorMsg}
          onDismiss={() => setErrorMsg(null)}
        />
      ) : null}

      {infoMsg ? (
        <FeedbackBanner
          tone="success"
          message={infoMsg}
          onDismiss={() => setInfoMsg(null)}
        />
      ) : null}

      {/* VISTA 1: INICIO DE SESIÓN (Modo Demostración Bypass) */}
      {step === 'login' ? (
        <SaharaCard variant="lowest" style={styles.formCard}>
          <Text style={styles.cardTitle}>Accede a tu cuenta de trabajador</Text>
          <Text style={styles.cardSubtitle}>
            Consulta oportunidades cercanas, administra tus postulaciones y lleva el control de tus trabajos.
          </Text>

          <SaharaInput
            label="Correo electrónico"
            icon="mail"
            editable={false}
            value={loginEmail}
            helperText="Modo demostración: cuenta verificada activa."
          />

          <SaharaInput
            label="Contraseña"
            icon="lock"
            secureTextEntry={!showLoginPass}
            editable={false}
            value="••••••••••••"
            helperText="Contraseña preconfigurada para acceso rápido."
          />

          <SaharaButton
            label="Iniciar sesión"
            sublabel="Entrar como Carlos Mendoza (Trabajador verificado)"
            icon="arrow_forward"
            onPress={handleLogin}
          />
        </SaharaCard>
      ) : null}

      {/* VISTA 2: REGISTRO DE TRABAJADOR (Paso 1 de 2) */}
      {step === 'register_account' ? (
        <SaharaCard variant="lowest" style={styles.formCard}>
          <View style={styles.stepPill}>
            <Text style={styles.stepPillText}>Paso 1 de 2 · Datos de acceso</Text>
          </View>
          <Text style={styles.cardTitle}>Registro de trabajador</Text>
          <Text style={styles.cardSubtitle}>
            Esta aplicación es exclusiva para personas que buscan trabajos temporales.
          </Text>

          <SaharaInput
            label="Nombre completo *"
            icon="person"
            placeholder="Ej. Andrea López Ramírez"
            value={regForm.full_name}
            onChangeText={(v) => setRegForm((p) => ({ ...p, full_name: v }))}
            errorText={regErrors.full_name}
          />

          <SaharaInput
            label="Correo electrónico *"
            icon="mail"
            keyboardType="email-address"
            autoCapitalize="none"
            placeholder="nombre@correo.mx"
            value={regForm.email}
            onChangeText={(v) => setRegForm((p) => ({ ...p, email: v }))}
            errorText={regErrors.email}
          />

          <SaharaInput
            label="Número de teléfono *"
            icon="call"
            keyboardType="phone-pad"
            placeholder="+52 55 1234 5678"
            value={regForm.phone}
            onChangeText={(v) =>
              setRegForm((p) => ({ ...p, phone: formatPhoneInputMask(v) }))
            }
            errorText={regErrors.phone}
          />

          <SaharaInput
            label="Fecha de nacimiento (AAAA-MM-DD) *"
            icon="calendar_today"
            placeholder="1996-08-20"
            rightBadge={
              computedAge >= 18
                ? `${computedAge} años`
                : computedAge >= 0
                  ? 'Menor de 18'
                  : 'Mayor de 18 años'
            }
            value={regForm.birth_date}
            onChangeText={(v) =>
              setRegForm((p) => ({
                ...p,
                birth_date: formatDateInputMask(v),
              }))
            }
            helperText="Debes tener al menos 18 años para registrarte."
            errorText={regErrors.birth_date}
          />

          <View style={{ gap: 8 }}>
            <SaharaInput
              label="Contraseña *"
              icon="lock"
              secureTextEntry={!showRegPass}
              placeholder="Mínimo 8 caracteres"
              rightBadge={passStrength.label}
              value={regForm.password}
              onChangeText={(v) => setRegForm((p) => ({ ...p, password: v }))}
              errorText={regErrors.password}
            />
            <Pressable onPress={() => setShowRegPass((v) => !v)}>
              <Text style={styles.subtleLink}>
                {showRegPass ? 'Ocultar contraseña' : 'Mostrar contraseña'}
              </Text>
            </Pressable>

            <View style={styles.checklistGrid}>
              {[
                { ok: passCheck.minLength, label: 'Mínimo 8 caracteres' },
                { ok: passCheck.hasUpper, label: 'Una mayúscula' },
                { ok: passCheck.hasLower, label: 'Una minúscula' },
                { ok: passCheck.hasNumber, label: 'Un número' },
              ].map((item) => (
                <View
                  key={item.label}
                  style={[
                    styles.checkBadge,
                    item.ok ? styles.checkBadgeOk : undefined,
                  ]}>
                  <Text
                    style={[
                      styles.checkBadgeText,
                      item.ok ? styles.checkBadgeTextOk : undefined,
                    ]}>
                    {item.ok ? '✓' : '·'} {item.label}
                  </Text>
                </View>
              ))}
            </View>
          </View>

          <SaharaButton
            label="Continuar a perfil inicial"
            trailingIcon="arrow_forward"
            onPress={handleNextRegisterStep}
          />
        </SaharaCard>
      ) : null}

      {/* VISTA 3: INFORMACIÓN PERSONAL INICIAL + TÉRMINOS Y PRIVACIDAD (Paso 2 de 2) */}
      {step === 'register_personal' ? (
        <SaharaCard variant="lowest" style={styles.formCard}>
          <View style={styles.stepPill}>
            <Text style={styles.stepPillText}>
              Paso 2 de 2 · Información inicial y acuerdos
            </Text>
          </View>
          <Text style={styles.cardTitle}>Completa tu perfil de trabajador</Text>
          <Text style={styles.cardSubtitle}>
            Cuéntale a los empleadores en qué actividades tienes experiencia y tu horario habitual.
          </Text>

          <SaharaInput
            label="Habilidades principales"
            multiline
            maxLength={300}
            rightBadge={`${skills.length}/300`}
            placeholder="Ej. Limpieza residencial, pintura de interiores, apoyo en mudanzas y jardinería."
            value={skills}
            onChangeText={setSkills}
            errorText={regErrors.skills}
          />

          <SaharaInput
            label="Disponibilidad de horarios"
            multiline
            maxLength={300}
            rightBadge={`${availability.length}/300`}
            placeholder="Ej. Lunes a viernes por las mañanas y fines de semana completos."
            value={availability}
            onChangeText={setAvailability}
            errorText={regErrors.availability}
          />

          {/* Aceptación obligatoria de Términos y Aviso de Privacidad */}
          <View style={styles.legalSection}>
            <Pressable
              accessibilityRole="checkbox"
              accessibilityState={{ checked: regForm.accept_terms }}
              onPress={() =>
                setRegForm((p) => ({ ...p, accept_terms: !p.accept_terms }))
              }
              style={styles.checkboxRow}>
              <View
                style={[
                  styles.checkboxBox,
                  regForm.accept_terms ? styles.checkboxBoxChecked : undefined,
                ]}>
                {regForm.accept_terms ? (
                  <SaharaIcon name="check" size={12} color={SaharaColors.onPrimary} />
                ) : null}
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.checkboxLabel}>
                  He leído y acepto los Términos de Uso de la plataforma.
                </Text>
                <Pressable onPress={() => setLegalDoc('terms')}>
                  <Text style={styles.primaryLink}>Leer Términos de Uso</Text>
                </Pressable>
              </View>
            </Pressable>

            <Pressable
              accessibilityRole="checkbox"
              accessibilityState={{ checked: regForm.accept_privacy }}
              onPress={() =>
                setRegForm((p) => ({
                  ...p,
                  accept_privacy: !p.accept_privacy,
                }))
              }
              style={styles.checkboxRow}>
              <View
                style={[
                  styles.checkboxBox,
                  regForm.accept_privacy ? styles.checkboxBoxChecked : undefined,
                ]}>
                {regForm.accept_privacy ? (
                  <SaharaIcon name="check" size={12} color={SaharaColors.onPrimary} />
                ) : null}
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.checkboxLabel}>
                  He leído y acepto el Aviso de Privacidad y tratamiento de datos.
                </Text>
                <Pressable onPress={() => setLegalDoc('privacy')}>
                  <Text style={styles.primaryLink}>Leer Aviso de Privacidad</Text>
                </Pressable>
              </View>
            </Pressable>
          </View>

          <View style={styles.rowActions}>
            <View style={{ flex: 1 }}>
              <SaharaButton
                label="Atrás"
                variant="outline"
                onPress={() => setStep('register_account')}
              />
            </View>
            <View style={{ flex: 1.5 }}>
              <SaharaButton
                label="Crear mi cuenta"
                icon="check_circle"
                onPress={handleCompleteRegistration}
              />
            </View>
          </View>
        </SaharaCard>
      ) : null}

      {/* VISTA 4: RECUPERACIÓN DE CONTRASEÑA */}
      {step === 'recovery' ? (
        <SaharaCard variant="lowest" style={styles.formCard}>
          <Text style={styles.cardTitle}>Recuperar contraseña</Text>
          <Text style={styles.cardSubtitle}>
            Ingresa el correo electrónico con el que te registraste y te enviaremos instrucciones para restablecer tu acceso.
          </Text>

          <SaharaInput
            label="Correo electrónico"
            icon="mail"
            keyboardType="email-address"
            autoCapitalize="none"
            placeholder="nombre@correo.mx"
            value={recoveryEmail}
            onChangeText={setRecoveryEmail}
          />

          <SaharaButton
            label="Enviar enlace de recuperación"
            icon="send"
            onPress={handleRecovery}
          />

          <SaharaButton
            label="Volver a iniciar sesión"
            variant="ghost"
            onPress={() => {
              setErrorMsg(null);
              setInfoMsg(null);
              setStep('login');
            }}
          />
        </SaharaCard>
      ) : null}

      {/* Modal de documentos legales */}
      <Modal
        visible={legalDoc !== null}
        transparent
        animationType="slide"
        onRequestClose={() => setLegalDoc(null)}>
        <View style={styles.legalBackdrop}>
          <View style={styles.legalModalCard}>
            <Text style={styles.cardTitle}>
              {legalDoc === 'terms' ? 'Términos de Uso' : 'Aviso de Privacidad'}
            </Text>
            <ScrollView style={{ maxHeight: 340 }}>
              <Text style={styles.legalBody}>
                {legalDoc === 'terms'
                  ? '1. Uso de la plataforma: Solidez MX conecta a personas mayores de 18 años con empleadores que publican trabajos temporales en México.\n\n2. Postulaciones y asignaciones: Al ser seleccionado para un trabajo, ambas partes confirman las condiciones acordadas. La dirección exacta se habilita únicamente después de la selección.\n\n3. Finalización y protección: El cierre del trabajo se realiza mediante código de 6 dígitos o solicitud con evidencias sujeta a confirmación en 24 horas. En caso de desacuerdo, puedes abrir una reclamación en la sección de Casos.'
                  : '1. Datos recabados: Solidez MX resguarda tu nombre, correo, teléfono, fecha de nacimiento, habilidades, disponibilidad y punto de referencia manual.\n\n2. Privacidad de ubicación: Nunca solicitamos acceso al GPS de tu dispositivo. Tu punto de referencia se utiliza exclusivamente para ordenar oportunidades cercanas.\n\n3. Seguridad financiera: No almacenamos información bancaria ni datos de tarjetas en la aplicación. La vinculación de cobros se gestiona mediante cuentas conectadas.'}
              </Text>
            </ScrollView>
            <SaharaButton label="Entendido" onPress={() => setLegalDoc(null)} />
          </View>
        </View>
      </Modal>
    </SaharaScreenShell>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingTop: Spacing.lg,
    gap: Spacing.md,
  },
  brandHeader: {
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  brandMark: {
    width: 54,
    height: 54,
    borderRadius: Radius.xl,
    backgroundColor: SaharaColors.primaryAccessible,
    alignItems: 'center',
    justifyContent: 'center',
  },
  brandLetter: {
    fontFamily: Fonts.headline,
    fontSize: 28,
    fontWeight: '700',
    color: SaharaColors.onPrimary,
  },
  brandName: {
    fontFamily: Fonts.headline,
    fontSize: 28,
    fontWeight: '700',
    color: SaharaColors.onSurface,
  },
  brandTagline: {
    fontFamily: Fonts.body,
    fontSize: 13,
    color: SaharaColors.onSurfaceVariant,
    textAlign: 'center',
  },
  tabRow: {
    flexDirection: 'row',
    backgroundColor: SaharaColors.surfaceContainerHigh,
    borderRadius: Radius.xl,
    padding: 4,
    gap: 4,
  },
  tabBtn: {
    flex: 1,
    paddingVertical: 11,
    borderRadius: Radius.lg,
    alignItems: 'center',
  },
  tabBtnActive: {
    backgroundColor: SaharaColors.surfaceContainerLowest,
  },
  tabText: {
    fontFamily: Fonts.label,
    fontSize: 13,
    fontWeight: '600',
    color: SaharaColors.onSurfaceVariant,
  },
  tabTextActive: {
    color: SaharaColors.primaryAccessible,
    fontWeight: '700',
  },
  formCard: {
    gap: Spacing.md,
    padding: Spacing.lg,
  },
  stepPill: {
    alignSelf: 'flex-start',
    backgroundColor: SaharaColors.primaryFixed,
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
  cardTitle: {
    fontFamily: Fonts.headline,
    fontSize: 22,
    fontWeight: '600',
    color: SaharaColors.onSurface,
  },
  cardSubtitle: {
    fontFamily: Fonts.body,
    fontSize: 13,
    color: SaharaColors.onSurfaceVariant,
    lineHeight: 19,
  },
  inlineLinkRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
  },
  subtleLink: {
    fontFamily: Fonts.label,
    fontSize: 12,
    fontWeight: '600',
    color: SaharaColors.secondary,
  },
  primaryLink: {
    fontFamily: Fonts.label,
    fontSize: 12.5,
    fontWeight: '700',
    color: SaharaColors.primaryAccessible,
  },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: SaharaColors.borderSubtle,
  },
  dividerText: {
    fontFamily: Fonts.body,
    fontSize: 11.5,
    color: SaharaColors.onSurfaceVariant,
  },
  checklistGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  checkBadge: {
    backgroundColor: SaharaColors.surfaceContainerLow,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: Radius.full,
    borderWidth: 1,
    borderColor: SaharaColors.borderSubtle,
  },
  checkBadgeOk: {
    backgroundColor: SaharaColors.successContainer,
    borderColor: SaharaColors.success,
  },
  checkBadgeText: {
    fontFamily: Fonts.label,
    fontSize: 11,
    color: SaharaColors.onSurfaceVariant,
  },
  checkBadgeTextOk: {
    color: SaharaColors.onSuccessContainer,
    fontWeight: '700',
  },
  legalSection: {
    gap: 12,
    backgroundColor: SaharaColors.surfaceContainerLow,
    padding: Spacing.md,
    borderRadius: Radius.lg,
  },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  checkboxBox: {
    width: 24,
    height: 24,
    borderRadius: Radius.sm,
    borderWidth: 1.5,
    borderColor: SaharaColors.outline,
    backgroundColor: SaharaColors.surfaceContainerLowest,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  checkboxBoxChecked: {
    backgroundColor: SaharaColors.primaryAccessible,
    borderColor: SaharaColors.primaryAccessible,
  },
  checkboxLabel: {
    fontFamily: Fonts.body,
    fontSize: 12.5,
    color: SaharaColors.onSurface,
    lineHeight: 18,
  },
  rowActions: {
    flexDirection: 'row',
    gap: 10,
  },
  legalBackdrop: {
    flex: 1,
    backgroundColor: SaharaColors.backdropOverlay,
    justifyContent: 'center',
    padding: Spacing.md,
  },
  legalModalCard: {
    backgroundColor: SaharaColors.surfaceContainerLowest,
    borderRadius: Radius.xxl,
    padding: Spacing.lg,
    gap: Spacing.md,
  },
  legalBody: {
    fontFamily: Fonts.body,
    fontSize: 13.5,
    color: SaharaColors.onSurfaceVariant,
    lineHeight: 21,
  },
});

/**
 * UI-EMP-01: Auth & Onboarding Empleador (Poka-Yoke Guided & Low Cognitive Load)
 * Source of Truth: Especificacion_de_Arquitectura_de_Software_v2.md (Section 3.2 UI-EMP-01, D-09, D-10, RF-01..RF-03, RF-33)
 * Poka-Yoke & Audit Fixes Applied:
 * - PY-SYS-01: Zero internal spec codes or SQL table names exposed in UI copy
 * - PY-SYS-02 & PY-01-1: Auto-masking on birth_date (`formatDateInputMask`) and phone (`formatPhoneInputMask`)
 * - PY-01-2: Live 4-item Password Checklist (`[OK] 8+ letras`, `[OK] Mayúscula`, `[OK] Minúscula`, `[OK] Número`) so the user never guesses
 * - PY-01-3: Short, plain Spanish headlines and helpers (< 90 chars)
 * - UI-EMP-01-1..04: 48dp touch targets, separated legal reader buttons, zero emojis
 */
import React, { useState } from 'react';
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
  ErrorState,
  LoadingSkeleton,
  SaharaButton,
  SaharaCard,
  SaharaIcon,
  SaharaInput,
  SaharaScreenShell,
} from '@/components/ui/sahara-primitives';
import { employerRepository, useMockBackendStore } from '@/services/mocks/mock-employer-repository';
import { useIdempotentAction } from '@/shared/hooks/use-idempotent-action';
import { mapDomainErrorToUI } from '@/shared/utils/error-mapper';
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
  type FieldErrors,
  type RegisterFormInput,
} from '@/shared/utils/validators';

type AuthMode = 'login' | 'register' | 'reset_password' | 'check_email';

export function AuthOnboardingScreenView() {
  const router = useRouter();
  const pendingEmailInStore = useMockBackendStore(
    (s) => s.pendingVerificationEmail,
  );

  const [mode, setMode] = useState<AuthMode>(
    pendingEmailInStore ? 'check_email' : 'login',
  );

  // Login state — Pre-configured in Demo Bypass mode (read-only per user requirements)
  const [loginEmail] = useState('valeria.montes@solidez.mx');

  // Register state — strictly initialized EMPTY per Poka-Yoke rule 5.2
  const [regForm, setRegForm] = useState<RegisterFormInput>({
    full_name: '',
    email: '',
    phone: '',
    birth_date: '',
    password: '',
    accept_terms: false,
    accept_privacy: false,
  });
  const [regErrors, setRegErrors] = useState<
    FieldErrors<keyof RegisterFormInput>
  >({});
  const [showPassword, setShowPassword] = useState(false);

  // Reset password state
  const [resetEmail, setResetEmail] = useState('');
  const [resetFeedback, setResetFeedback] = useState<string | null>(null);

  // Verification code state ("Revisa tu correo")
  const [verificationEmail, setVerificationEmail] = useState(
    pendingEmailInStore ?? '',
  );
  const [verificationCode, setVerificationCode] = useState('');

  // Legal document preview modal
  const [legalModalDoc, setLegalModalDoc] = useState<'terms' | 'privacy' | null>(
    null,
  );

  // Global error / loading state
  const [serviceError, setServiceError] = useState<string | null>(null);
  const [isInitialLoading] = useState(false);

  const computedAge = calculateAgeYears(regForm.birth_date);
  const passStrength = getPasswordStrength(regForm.password);
  const passCheck = getPasswordChecklist(regForm.password);

  // Idempotent 1-click Login Bypass
  const { execute: handleLogin, isPending: isLoggingIn } = useIdempotentAction(
    async () => {
      setServiceError(null);
      try {
        await employerRepository.login(
          'valeria.montes@solidez.mx',
          'Password123',
        );
        router.replace('/(main)/feed');
      } catch (err) {
        const mapped = mapDomainErrorToUI(err);
        setServiceError(mapped.message);
      }
    },
  );

  // Idempotent Registration
  const { execute: handleRegister, isPending: isRegistering } =
    useIdempotentAction(async () => {
      setServiceError(null);
      const normalizedForm: RegisterFormInput = {
        ...regForm,
        birth_date: formatDateInputMask(regForm.birth_date),
      };
      setRegForm(normalizedForm);
      const errors = validateRegisterForm(normalizedForm);
      if (Object.keys(errors).length > 0) {
        setRegErrors(errors);
        return;
      }
      setRegErrors({});
      try {
        const res = await employerRepository.register(normalizedForm);
        setVerificationEmail(res.pending_verification_email);
        setVerificationCode(res.verification_code_hint);
        setMode('check_email');
      } catch (err) {
        const mapped = mapDomainErrorToUI(err);
        setServiceError(mapped.message);
      }
    });

  // Idempotent Email Verification
  const { execute: handleVerifyEmail, isPending: isVerifying } =
    useIdempotentAction(async () => {
      setServiceError(null);
      try {
        await employerRepository.verifyEmailCode(
          verificationEmail,
          verificationCode || '202611',
        );
        router.replace('/(main)/feed');
      } catch (err) {
        const mapped = mapDomainErrorToUI(err);
        setServiceError(mapped.message);
      }
    });

  // Idempotent Password Reset
  const { execute: handleResetPassword, isPending: isResetting } =
    useIdempotentAction(async () => {
      setServiceError(null);
      setResetFeedback(null);
      const emailErr = validateEmail(resetEmail);
      if (emailErr) {
        setServiceError(emailErr);
        return;
      }
      try {
        const res = await employerRepository.resetPassword(resetEmail);
        setResetFeedback(res.message);
      } catch (err) {
        const mapped = mapDomainErrorToUI(err);
        setServiceError(mapped.message);
      }
    });

  if (isInitialLoading) {
    return (
      <SaharaScreenShell>
        <LoadingSkeleton message="Revisando tus datos de acceso..." />
      </SaharaScreenShell>
    );
  }

  return (
    <SaharaScreenShell>
      {/* Top Brand Trust Emblem */}
      <View style={styles.topBrandRow}>
        <View style={styles.brandEmblemPill}>
          <View style={styles.brandLogoSquare}>
            <Text style={styles.brandLogoLetter}>S</Text>
          </View>
          <Text style={styles.brandEmblemText}>SOLIDEZ MX • EMPLEADOR</Text>
          <View style={styles.brandPulseDot} />
        </View>
        <View style={styles.trustRight}>
          <SaharaIcon
            name="verified_user"
            size={14}
            color={SaharaColors.primaryAccessible}
          />
          <Text style={styles.trustRightText}>Pago Protegido</Text>
        </View>
      </View>

      {/* Short Plain Spanish Headline */}
      <View style={styles.headlineSection}>
        <Text accessibilityRole="header" style={styles.headlineTitle}>
          {mode === 'register'
            ? 'Crea tu cuenta gratis'
            : mode === 'login'
              ? 'Bienvenido a Solidez MX'
              : mode === 'reset_password'
                ? 'Recupera tu contraseña'
                : 'Confirma tu correo'}
        </Text>
        <Text style={styles.headlineSub}>
          Publica trabajos por día y paga solo cuando el servicio esté terminado.
        </Text>
      </View>

      {/* Auth Mode Segment Control (Entrar vs Crear cuenta) — 48dp height & tab semantics */}
      {mode === 'login' || mode === 'register' ? (
        <View
          accessibilityRole="tablist"
          style={styles.segmentContainer}>
          <Pressable
            testID="tab-login-btn"
            accessibilityRole="tab"
            accessibilityLabel="Pestaña Iniciar sesión"
            accessibilityState={{ selected: mode === 'login' }}
            onPress={() => {
              setServiceError(null);
              setMode('login');
            }}
            style={[
              styles.segmentBtn,
              mode === 'login' ? styles.segmentBtnActive : undefined,
            ]}>
            <Text
              style={[
                styles.segmentBtnText,
                mode === 'login' ? styles.segmentBtnTextActive : undefined,
              ]}>
              Iniciar sesión
            </Text>
          </Pressable>
          <Pressable
            testID="tab-register-btn"
            accessibilityRole="tab"
            accessibilityLabel="Pestaña Crear cuenta nueva"
            accessibilityState={{ selected: mode === 'register' }}
            onPress={() => {
              setServiceError(null);
              setMode('register');
            }}
            style={[
              styles.segmentBtn,
              mode === 'register' ? styles.segmentBtnActive : undefined,
            ]}>
            <Text
              style={[
                styles.segmentBtnText,
                mode === 'register' ? styles.segmentBtnTextActive : undefined,
              ]}>
              Crear cuenta
            </Text>
          </Pressable>
        </View>
      ) : null}

      {/* Error State Banner */}
      {serviceError ? (
        <ErrorState
          message={serviceError}
          onRetry={() => setServiceError(null)}
        />
      ) : null}

      {/* MODE 1: LOGIN (Demo Bypass Mode: Fields Read-Only, 1-Click Access) */}
      {mode === 'login' ? (
        <View style={{ gap: Spacing.md }}>
          <SaharaCard variant="lowest" style={{ gap: 14 }}>
            <SaharaInput
              testID="login-email-input"
              label="Correo electrónico"
              icon="mail"
              editable={false}
              value={loginEmail}
              helperText="Modo demostración: cuenta verificada activa."
            />

            <SaharaInput
              testID="login-password-input"
              label="Contraseña"
              icon="key"
              secureTextEntry={!showPassword}
              editable={false}
              value="••••••••••••"
              helperText="Contraseña preconfigurada para acceso rápido."
            />

            <SaharaButton
              testID="login-submit-btn"
              label="Iniciar Sesión"
              sublabel="Entrar como Valeria Montes (Empleador verificado)"
              trailingIcon="arrow_forward"
              loading={isLoggingIn}
              onPress={() => void handleLogin()}
            />
          </SaharaCard>
        </View>
      ) : null}

      {/* MODE 2: REGISTER (Guided Poka-Yoke Inputs) */}
      {mode === 'register' ? (
        <View style={{ gap: Spacing.md }}>
          <SaharaCard variant="lowest" style={{ gap: 14 }}>
            <SaharaInput
              testID="reg-fullname-input"
              label="Tu nombre completo o negocio"
              placeholder="Ej. María López / Taller López"
              icon="person"
              value={regForm.full_name}
              onChangeText={(v) =>
                setRegForm((prev) => ({ ...prev, full_name: v }))
              }
              onBlur={() =>
                setRegErrors((prev) => ({
                  ...prev,
                  full_name: validateFullName(regForm.full_name) ?? undefined,
                }))
              }
              errorText={regErrors.full_name}
            />

            <SaharaInput
              testID="reg-email-input"
              label="Tu correo electrónico"
              placeholder="ejemplo@correo.com"
              icon="mail"
              keyboardType="email-address"
              autoCapitalize="none"
              helperText="Te enviaremos un código corto a este correo para activar tu cuenta."
              value={regForm.email}
              onChangeText={(v) => setRegForm((prev) => ({ ...prev, email: v }))}
              onBlur={() =>
                setRegErrors((prev) => ({
                  ...prev,
                  email: validateEmail(regForm.email) ?? undefined,
                }))
              }
              errorText={regErrors.email}
            />

            <SaharaInput
              testID="reg-phone-input"
              label="Tu teléfono celular (WhatsApp)"
              placeholder="662 123 4567"
              icon="phone_iphone"
              keyboardType="phone-pad"
              helperText="Nadie verá tu número hasta que elijas a un trabajador."
              value={regForm.phone}
              onChangeText={(v) =>
                setRegForm((prev) => ({
                  ...prev,
                  phone: formatPhoneInputMask(v),
                }))
              }
              onBlur={() =>
                setRegErrors((prev) => ({
                  ...prev,
                  phone: validatePhone(regForm.phone) ?? undefined,
                }))
              }
              errorText={regErrors.phone}
            />

            <SaharaInput
              testID="reg-birthdate-input"
              label="Tu fecha de nacimiento (Año-Mes-Día)"
              placeholder="1988-08-14"
              icon="calendar_today"
              keyboardType="number-pad"
              maxLength={10}
              rightBadge={
                computedAge >= 18
                  ? `${computedAge} años (Mayor de edad)`
                  : '18+ años'
              }
              helperText="Escribe solo los números (ej. 19880814); los guiones se ponen solos."
              value={regForm.birth_date}
              onChangeText={(v) =>
                setRegForm((prev) => ({
                  ...prev,
                  birth_date: formatDateInputMask(v),
                }))
              }
              onBlur={() =>
                setRegErrors((prev) => ({
                  ...prev,
                  birth_date:
                    validateBirthDateAdult(regForm.birth_date) ?? undefined,
                }))
              }
              errorText={regErrors.birth_date}
            />

            <View style={{ gap: 8 }}>
              <SaharaInput
                testID="reg-password-input"
                label="Crea una contraseña"
                placeholder="Mínimo 8 letras y números"
                icon="key"
                secureTextEntry={!showPassword}
                value={regForm.password}
                onChangeText={(v) =>
                  setRegForm((prev) => ({ ...prev, password: v }))
                }
                onBlur={() =>
                  setRegErrors((prev) => ({
                    ...prev,
                    password: validatePassword(regForm.password) ?? undefined,
                  }))
                }
                errorText={regErrors.password}
              />

              {/* Poka-Yoke Live Password Checklist (PY-01-2: No guessing what is missing) */}
              <View style={styles.strengthMeterContainer}>
                <View style={styles.strengthBarsRow}>
                  {[1, 2, 3, 4].map((step) => (
                    <View
                      key={step}
                      style={[
                        styles.strengthBarSegment,
                        {
                          backgroundColor:
                            passStrength.level >= step
                              ? SaharaColors.primaryAccessible
                              : SaharaColors.surfaceContainerHigh,
                        },
                      ]}
                    />
                  ))}
                </View>

                <View style={styles.checklistGrid}>
                  <Text
                    style={[
                      styles.checkItemText,
                      passCheck.minLength ? styles.checkItemDone : undefined,
                    ]}>
                    {passCheck.minLength ? '[OK]' : '[  ]'} 8 o más caracteres
                  </Text>
                  <Text
                    style={[
                      styles.checkItemText,
                      passCheck.hasUpper ? styles.checkItemDone : undefined,
                    ]}>
                    {passCheck.hasUpper ? '[OK]' : '[  ]'} 1 letra mayúscula
                  </Text>
                  <Text
                    style={[
                      styles.checkItemText,
                      passCheck.hasLower ? styles.checkItemDone : undefined,
                    ]}>
                    {passCheck.hasLower ? '[OK]' : '[  ]'} 1 letra minúscula
                  </Text>
                  <Text
                    style={[
                      styles.checkItemText,
                      passCheck.hasNumber ? styles.checkItemDone : undefined,
                    ]}>
                    {passCheck.hasNumber ? '[OK]' : '[  ]'} 1 número (0-9)
                  </Text>
                </View>

                <View style={styles.strengthLabelsRow}>
                  <Text style={styles.strengthStatusText}>
                    {passStrength.label}
                  </Text>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={
                      showPassword ? 'Ocultar contraseña' : 'Ver contraseña escrita'
                    }
                    onPress={() => setShowPassword((s) => !s)}
                    style={styles.touchTargetAction}>
                    <Text style={styles.linkTextSecondary}>
                      {showPassword ? 'Ocultar' : 'Ver contraseña'}
                    </Text>
                  </Pressable>
                </View>
              </View>
            </View>

            {/* Mandatory Terms & Privacy Checkboxes — Separated from legal document links & minHeight 48dp */}
            <View style={styles.checkboxGroup}>
              <View style={styles.checkboxContainerCard}>
                <Pressable
                  testID="reg-terms-checkbox"
                  accessibilityRole="checkbox"
                  accessibilityLabel="Acepto las reglas de uso y pago protegido"
                  accessibilityState={{ checked: regForm.accept_terms }}
                  onPress={() =>
                    setRegForm((prev) => ({
                      ...prev,
                      accept_terms: !prev.accept_terms,
                    }))
                  }
                  style={styles.checkboxRow}>
                  <View
                    style={[
                      styles.checkboxSquare,
                      regForm.accept_terms
                        ? styles.checkboxSquareChecked
                        : undefined,
                    ]}>
                    {regForm.accept_terms ? (
                      <Text style={styles.checkboxTick}>OK</Text>
                    ) : null}
                  </View>
                  <Text style={styles.checkboxLabel}>
                    Acepto los Términos de Uso y las reglas de Pago Protegido.
                  </Text>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Leer Términos de Uso"
                  onPress={() => setLegalModalDoc('terms')}
                  style={styles.readLegalBtn}>
                  <Text style={styles.legalLink}>Leer Términos de Uso</Text>
                </Pressable>
              </View>

              <View style={styles.checkboxContainerCard}>
                <Pressable
                  testID="reg-privacy-checkbox"
                  accessibilityRole="checkbox"
                  accessibilityLabel="Acepto el Aviso de Privacidad"
                  accessibilityState={{ checked: regForm.accept_privacy }}
                  onPress={() =>
                    setRegForm((prev) => ({
                      ...prev,
                      accept_privacy: !prev.accept_privacy,
                    }))
                  }
                  style={styles.checkboxRow}>
                  <View
                    style={[
                      styles.checkboxSquare,
                      regForm.accept_privacy
                        ? styles.checkboxSquareChecked
                        : undefined,
                    ]}>
                    {regForm.accept_privacy ? (
                      <Text style={styles.checkboxTick}>OK</Text>
                    ) : null}
                  </View>
                  <Text style={styles.checkboxLabel}>
                    Acepto el Aviso de Privacidad y protección de mis datos.
                  </Text>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Leer Aviso de Privacidad"
                  onPress={() => setLegalModalDoc('privacy')}
                  style={styles.readLegalBtn}>
                  <Text style={styles.legalLink}>Leer Aviso de Privacidad</Text>
                </Pressable>
              </View>

              {regErrors.accept_terms ? (
                <Text style={styles.checkboxError}>
                  {regErrors.accept_terms}
                </Text>
              ) : null}
            </View>

            <SaharaButton
              testID="register-submit-btn"
              label="Crear mi Cuenta"
              trailingIcon="arrow_forward"
              loading={isRegistering}
              onPress={() => void handleRegister()}
            />
          </SaharaCard>
        </View>
      ) : null}

      {/* MODE 3: CHECK YOUR EMAIL ("Revisa tu correo") */}
      {mode === 'check_email' ? (
        <SaharaCard variant="lowest" style={{ gap: 16 }}>
          <View style={styles.checkEmailHeader}>
            <View style={styles.checkEmailIconCircle}>
              <SaharaIcon
                name="mark_email_unread"
                size={24}
                color={SaharaColors.onPrimaryFixedVariant}
              />
            </View>
            <Text style={styles.checkEmailTitle}>
              Revisa tu correo electrónico
            </Text>
            <Text style={styles.checkEmailSub}>
              Te enviamos un código de 6 números a{' '}
              <Text style={{ fontWeight: '700', color: SaharaColors.onSurface }}>
                {verificationEmail || 'tu correo'}
              </Text>
              . Escríbelo abajo para entrar.
            </Text>
          </View>

          <SaharaInput
            testID="verify-email-code-input"
            label="Código de 6 números"
            placeholder="202611"
            icon="verified_user"
            keyboardType="number-pad"
            maxLength={6}
            value={verificationCode}
            onChangeText={(v) => setVerificationCode(v.replace(/\D/g, ''))}
            helperText="Para probar ahora mismo, usa el código 202611."
          />

          <SaharaButton
            testID="verify-email-submit-btn"
            label="Confirmar Código y Entrar"
            icon="check_circle"
            loading={isVerifying}
            onPress={() => void handleVerifyEmail()}
          />

          <SaharaButton
            label="Volver a Iniciar Sesión"
            variant="ghost"
            onPress={() => setMode('login')}
          />
        </SaharaCard>
      ) : null}

      {/* MODE 4: RESET PASSWORD */}
      {mode === 'reset_password' ? (
        <SaharaCard variant="lowest" style={{ gap: 14 }}>
          <Text style={styles.resetIntro}>
            Escribe tu correo electrónico y te enviaremos un mensaje para crear
            una contraseña nueva.
          </Text>

          <SaharaInput
            testID="reset-email-input"
            label="Tu correo registrado"
            placeholder="ejemplo@correo.com"
            icon="mail"
            keyboardType="email-address"
            autoCapitalize="none"
            value={resetEmail}
            onChangeText={setResetEmail}
          />

          {resetFeedback ? (
            <View style={styles.resetSuccessBox}>
              <SaharaIcon
                name="check_circle"
                size={16}
                color={SaharaColors.onPrimaryFixed}
              />
              <Text style={styles.resetSuccessText}>{resetFeedback}</Text>
            </View>
          ) : null}

          <SaharaButton
            testID="reset-submit-btn"
            label="Enviar correo de recuperación"
            loading={isResetting}
            onPress={() => void handleResetPassword()}
          />

          <SaharaButton
            label="Regresar a Iniciar Sesión"
            variant="ghost"
            onPress={() => {
              setResetFeedback(null);
              setMode('login');
            }}
          />
        </SaharaCard>
      ) : null}

      {/* Security Footer */}
      <View style={styles.securityFooter}>
        <SaharaIcon name="shield" size={13} color={SaharaColors.secondary} />
        <Text style={styles.securityFooterText}>
          Conexión segura • Tus pagos están protegidos por Solidez MX
        </Text>
      </View>

      {/* Legal Document Modal */}
      <Modal
        visible={legalModalDoc !== null}
        transparent
        animationType="slide"
        onRequestClose={() => setLegalModalDoc(null)}>
        <View style={styles.legalModalBackdrop}>
          <View style={styles.legalModalCard}>
            <Text style={styles.legalModalTitle}>
              {legalModalDoc === 'terms'
                ? 'Términos de Uso del Empleador'
                : 'Aviso de Privacidad'}
            </Text>
            <Text style={styles.legalModalBody}>
              {legalModalDoc === 'terms'
                ? '1. Pago Protegido: Cuando el trabajador llega a tu domicilio, tienes 30 minutos para realizar el pago del servicio más el 10% de comisión de la plataforma.\n\n2. Entrega del dinero: Tu dinero se guarda de forma segura y solo se entrega al trabajador cuando termina y te pide tu código de 6 números (o envía fotos del trabajo terminado). Si hay algún problema, puedes pedir una revisión y tendrás 7 días para responder.'
                : 'En Solidez MX cuidamos tus datos personales. Tu dirección exacta y tu número de teléfono permanecen ocultos en tu anuncio y únicamente se muestran a la persona que tú elijas contratar.'}
            </Text>
            <SaharaButton
              label="Entendido, cerrar"
              onPress={() => setLegalModalDoc(null)}
            />
          </View>
        </View>
      </Modal>
    </SaharaScreenShell>
  );
}

const styles = StyleSheet.create({
  topBrandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  brandEmblemPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: SaharaColors.surfaceContainerLow,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: Radius.full,
  },
  brandLogoSquare: {
    width: 24,
    height: 24,
    borderRadius: 5,
    backgroundColor: SaharaColors.primaryAccessible,
    alignItems: 'center',
    justifyContent: 'center',
  },
  brandLogoLetter: {
    fontFamily: Fonts.headline,
    color: SaharaColors.onPrimary,
    fontSize: 13,
    fontWeight: '700',
  },
  brandEmblemText: {
    fontFamily: Fonts.label,
    fontSize: 11,
    fontWeight: '700',
    color: SaharaColors.onSurface,
    letterSpacing: 0.7,
  },
  brandPulseDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: SaharaColors.primaryAccessible,
  },
  trustRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  trustRightText: {
    fontFamily: Fonts.label,
    fontSize: 11,
    fontWeight: '600',
    color: SaharaColors.secondary,
  },
  headlineSection: {
    gap: 6,
  },
  headlineTitle: {
    fontFamily: Fonts.headline,
    fontSize: 28,
    fontWeight: '600',
    color: SaharaColors.onSurface,
    lineHeight: 34,
  },
  headlineSub: {
    fontFamily: Fonts.body,
    fontSize: 13,
    color: SaharaColors.onSurfaceVariant,
    lineHeight: 19,
  },
  segmentContainer: {
    flexDirection: 'row',
    backgroundColor: SaharaColors.surfaceContainerLow,
    padding: 4,
    borderRadius: Radius.lg,
    gap: 8,
  },
  segmentBtn: {
    flex: 1,
    minHeight: 48,
    paddingVertical: 12,
    borderRadius: Radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  segmentBtnActive: {
    backgroundColor: SaharaColors.primaryAccessible,
  },
  segmentBtnText: {
    fontFamily: Fonts.label,
    fontSize: 13,
    fontWeight: '600',
    color: SaharaColors.secondary,
  },
  segmentBtnTextActive: {
    color: SaharaColors.onPrimary,
    fontWeight: '700',
  },
  forgotPassRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  touchTargetAction: {
    minHeight: 48,
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  linkTextPrimary: {
    fontFamily: Fonts.label,
    fontSize: 12.5,
    fontWeight: '700',
    color: SaharaColors.primaryAccessible,
    textDecorationLine: 'underline',
  },
  linkTextSecondary: {
    fontFamily: Fonts.label,
    fontSize: 12.5,
    fontWeight: '600',
    color: SaharaColors.secondary,
  },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginVertical: 2,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: SaharaColors.outlineVariant,
  },
  dividerLabel: {
    fontFamily: Fonts.label,
    fontSize: 11,
    color: SaharaColors.secondary,
  },
  strengthMeterContainer: {
    gap: 6,
    marginTop: 2,
  },
  strengthBarsRow: {
    flexDirection: 'row',
    gap: 6,
    height: 6,
  },
  strengthBarSegment: {
    flex: 1,
    borderRadius: 3,
  },
  checklistGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    backgroundColor: SaharaColors.surfaceContainerLow,
    padding: 10,
    borderRadius: Radius.md,
  },
  checkItemText: {
    width: '47%',
    fontFamily: Fonts.label,
    fontSize: 11.5,
    color: SaharaColors.secondary,
  },
  checkItemDone: {
    color: SaharaColors.success,
    fontWeight: '700',
  },
  strengthLabelsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  strengthStatusText: {
    fontFamily: Fonts.label,
    fontSize: 12,
    fontWeight: '700',
    color: SaharaColors.primaryAccessible,
  },
  checkboxGroup: {
    gap: 10,
    paddingTop: 4,
  },
  checkboxContainerCard: {
    backgroundColor: SaharaColors.surfaceContainerLow,
    borderRadius: Radius.md,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: SaharaColors.borderSubtle,
  },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 48,
    gap: 12,
  },
  checkboxSquare: {
    width: 28,
    height: 28,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: SaharaColors.outline,
    backgroundColor: SaharaColors.surfaceContainerLowest,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxSquareChecked: {
    backgroundColor: SaharaColors.primaryAccessible,
    borderColor: SaharaColors.primaryAccessible,
  },
  checkboxTick: {
    color: SaharaColors.onPrimary,
    fontSize: 10,
    fontWeight: '700',
  },
  checkboxLabel: {
    flex: 1,
    fontFamily: Fonts.body,
    fontSize: 12.5,
    color: SaharaColors.onSurface,
    lineHeight: 17,
  },
  readLegalBtn: {
    minHeight: 48,
    justifyContent: 'center',
    alignSelf: 'flex-start',
    paddingLeft: 40,
  },
  legalLink: {
    fontFamily: Fonts.label,
    fontSize: 12.5,
    fontWeight: '700',
    color: SaharaColors.primaryAccessible,
    textDecorationLine: 'underline',
  },
  checkboxError: {
    fontFamily: Fonts.label,
    fontSize: 12,
    fontWeight: '600',
    color: SaharaColors.error,
  },
  checkEmailHeader: {
    alignItems: 'center',
    gap: 8,
  },
  checkEmailIconCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: SaharaColors.primaryFixed,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkEmailTitle: {
    fontFamily: Fonts.headline,
    fontSize: 22,
    fontWeight: '700',
    color: SaharaColors.onSurface,
    textAlign: 'center',
  },
  checkEmailSub: {
    fontFamily: Fonts.body,
    fontSize: 13,
    color: SaharaColors.onSurfaceVariant,
    textAlign: 'center',
    lineHeight: 19,
  },
  resetIntro: {
    fontFamily: Fonts.body,
    fontSize: 13,
    color: SaharaColors.onSurfaceVariant,
    lineHeight: 19,
  },
  resetSuccessBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: SaharaColors.primaryFixed,
    padding: 12,
    borderRadius: Radius.md,
  },
  resetSuccessText: {
    flex: 1,
    fontFamily: Fonts.label,
    fontSize: 12,
    fontWeight: '600',
    color: SaharaColors.onPrimaryFixed,
  },
  securityFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: SaharaColors.surfaceContainer,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: Radius.full,
    alignSelf: 'center',
    marginTop: 8,
  },
  securityFooterText: {
    fontFamily: Fonts.label,
    fontSize: 11,
    color: SaharaColors.secondary,
  },
  legalModalBackdrop: {
    flex: 1,
    backgroundColor: SaharaColors.backdropOverlay,
    justifyContent: 'center',
    padding: Spacing.md,
  },
  legalModalCard: {
    backgroundColor: SaharaColors.surfaceContainerLowest,
    borderRadius: Radius.xl,
    padding: Spacing.lg,
    gap: 14,
  },
  legalModalTitle: {
    fontFamily: Fonts.headline,
    fontSize: 20,
    fontWeight: '700',
    color: SaharaColors.onSurface,
  },
  legalModalBody: {
    fontFamily: Fonts.body,
    fontSize: 13.5,
    color: SaharaColors.onSurfaceVariant,
    lineHeight: 20,
  },
});

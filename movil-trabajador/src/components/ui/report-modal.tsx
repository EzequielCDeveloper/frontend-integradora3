/**
 * Modal reutilizable para reportar publicaciones, postulaciones, cuentas, mensajes o reseñas.
 */
import React, { useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { Fonts, Radius, SaharaColors, Spacing } from '@/constants/theme';
import { SaharaButton, SaharaIcon, SaharaInput } from './sahara-primitives';
import { REPORT_TARGET_LABELS } from '@/shared/utils/formatters';
import type { ReportTarget } from '@/types/database';

const QUICK_REASONS = [
  'Información engañosa o incompleta',
  'Trato irrespetuoso o lenguaje inapropiado',
  'Condiciones fuera de las normas de la plataforma',
  'Actividad sospechosa o solicitud irregular',
];

export function ReportContentModal({
  visible,
  targetType,
  targetLabel,
  onClose,
  onSubmit,
}: {
  visible: boolean;
  targetType: ReportTarget;
  targetLabel: string;
  onClose: () => void;
  onSubmit: (reason: string) => void;
}) {
  const [selectedReason, setSelectedReason] = useState(QUICK_REASONS[0]);
  const [details, setDetails] = useState('');
  const [error, setError] = useState<string | null>(null);

  const handleConfirm = () => {
    const fullText = details.trim()
      ? `${selectedReason}. ${details.trim()}`
      : selectedReason;
    if (fullText.trim().length < 10) {
      setError('Describe brevemente el motivo del reporte.');
      return;
    }
    setError(null);
    onSubmit(fullText);
    setDetails('');
    onClose();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <View style={styles.header}>
            <View style={styles.iconCircle}>
              <SaharaIcon name="flag" size={18} color={SaharaColors.tertiary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.title}>
                Reportar {REPORT_TARGET_LABELS[targetType].toLowerCase()}
              </Text>
              <Text style={styles.subtitle} numberOfLines={1}>
                {targetLabel}
              </Text>
            </View>
          </View>

          <View style={styles.reasonsList}>
            {QUICK_REASONS.map((reason) => {
              const active = selectedReason === reason;
              return (
                <Pressable
                  key={reason}
                  onPress={() => setSelectedReason(reason)}
                  style={[
                    styles.reasonItem,
                    active ? styles.reasonItemActive : undefined,
                  ]}>
                  <Text
                    style={[
                      styles.reasonText,
                      active ? styles.reasonTextActive : undefined,
                    ]}>
                    {reason}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <SaharaInput
            label="Detalles adicionales (opcional)"
            placeholder="Explica brevemente lo ocurrido..."
            multiline
            value={details}
            onChangeText={setDetails}
            errorText={error}
          />

          <View style={styles.actions}>
            <View style={{ flex: 1 }}>
              <SaharaButton label="Cancelar" variant="outline" onPress={onClose} />
            </View>
            <View style={{ flex: 1 }}>
              <SaharaButton
                label="Enviar reporte"
                variant="danger"
                onPress={handleConfirm}
              />
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: SaharaColors.backdropOverlay,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.md,
  },
  card: {
    width: '100%',
    maxWidth: 440,
    backgroundColor: SaharaColors.surfaceContainerLowest,
    borderRadius: Radius.xxl,
    padding: Spacing.lg,
    gap: Spacing.md,
    borderWidth: 1,
    borderColor: SaharaColors.borderDefault,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  iconCircle: {
    width: 42,
    height: 42,
    borderRadius: Radius.full,
    backgroundColor: SaharaColors.tertiaryFixed,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontFamily: Fonts.headline,
    fontSize: 19,
    fontWeight: '700',
    color: SaharaColors.onSurface,
  },
  subtitle: {
    fontFamily: Fonts.body,
    fontSize: 12,
    color: SaharaColors.onSurfaceVariant,
  },
  reasonsList: {
    gap: 8,
  },
  reasonItem: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: SaharaColors.borderSubtle,
    backgroundColor: SaharaColors.surfaceContainerLow,
  },
  reasonItemActive: {
    borderColor: SaharaColors.primaryAccessible,
    backgroundColor: SaharaColors.primaryFixed,
  },
  reasonText: {
    fontFamily: Fonts.label,
    fontSize: 12.5,
    color: SaharaColors.onSurface,
  },
  reasonTextActive: {
    color: SaharaColors.onPrimaryFixed,
    fontWeight: '700',
  },
  actions: {
    flexDirection: 'row',
    gap: 10,
  },
});

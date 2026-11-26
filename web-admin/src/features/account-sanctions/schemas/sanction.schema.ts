import { z } from 'zod'

export const applySanctionSchema = z.object({
  sanction: z.enum([
    'warning',
    'suspension_1d',
    'suspension_7d',
    'suspension_30d',
    'permanent_block',
    'soft_delete',
  ]),
  reason: z
    .string()
    .trim()
    .min(
      10,
      'El motivo es obligatorio para registrar la sanción (mínimo 10 caracteres).',
    )
    .max(2000, 'El motivo no puede superar los 2000 caracteres.'),
})

export type ApplySanctionFormValues = z.infer<typeof applySanctionSchema>

export const revokeSanctionSchema = z.object({
  reason: z
    .string()
    .trim()
    .min(8, 'Indica el fundamento de la revocación por apelación.'),
})

export type RevokeSanctionFormValues = z.infer<typeof revokeSanctionSchema>

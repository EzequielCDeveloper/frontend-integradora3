import { z } from 'zod'

export const moderationDecisionSchema = z.object({
  reason: z
    .string()
    .trim()
    .min(8, 'El motivo de moderación es obligatorio (mínimo 8 caracteres).')
    .max(1500, 'El motivo no puede exceder 1500 caracteres.'),
})

export type ModerationDecisionFormValues = z.infer<
  typeof moderationDecisionSchema
>

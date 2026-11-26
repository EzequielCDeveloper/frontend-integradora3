import { z } from 'zod'

export const createCaseSchema = z.object({
  case_type: z.enum(['ticket', 'report']),
  ticket_category: z
    .enum(['account', 'publication', 'application', 'job', 'payment', 'technical'])
    .optional(),
  subject: z
    .string()
    .trim()
    .min(5, 'El asunto debe tener al menos 5 caracteres.')
    .max(160, 'El asunto no puede exceder 160 caracteres.'),
  description: z
    .string()
    .trim()
    .min(10, 'Describe el caso con al menos 10 caracteres.')
    .max(4000, 'La descripción no puede exceder 4000 caracteres.'),
})

export type CreateCaseFormValues = z.infer<typeof createCaseSchema>

export const quickResolveSchema = z.object({
  resolution_notes: z
    .string()
    .trim()
    .min(8, 'Documenta la nota de resolución (mínimo 8 caracteres).')
    .max(2000, 'La nota no puede exceder 2000 caracteres.'),
})

export type QuickResolveFormValues = z.infer<typeof quickResolveSchema>

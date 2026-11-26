import { z } from 'zod'

export const resolveClaimSchema = z.object({
  decision: z.enum(['transfer_full', 'refund_full', 'partial']),
  approved_transfer_amount: z.number().min(0, 'El monto no puede ser negativo.'),
  approved_refund_amount: z.number().min(0, 'El monto no puede ser negativo.'),
  resolution_notes: z
    .string()
    .trim()
    .min(10, 'Redacta un fundamento detallado de al menos 10 caracteres.')
    .max(3000, 'Las notas no pueden exceder 3000 caracteres.'),
})

export type ResolveClaimFormValues = z.infer<typeof resolveClaimSchema>

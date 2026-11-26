import { z } from 'zod'

export const ticketReplySchema = z.object({
  body: z
    .string()
    .trim()
    .min(2, 'Escribe una respuesta antes de enviar.')
    .max(4000, 'El mensaje no puede superar los 4000 caracteres.'),
  is_internal: z.boolean(),
  next_status: z.enum(['', 'open', 'in_review', 'resolved', 'closed']),
})

export type TicketReplyFormValues = z.infer<typeof ticketReplySchema>

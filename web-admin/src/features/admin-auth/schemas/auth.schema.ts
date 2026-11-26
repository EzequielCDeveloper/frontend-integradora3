import { z } from 'zod'

export const adminLoginSchema = z.object({
  email: z
    .string()
    .trim()
    .min(1, 'El correo corporativo es obligatorio.')
    .email('Ingresa un correo electrónico válido.'),
  password: z
    .string()
    .min(8, 'La contraseña debe tener al menos 8 caracteres.')
    .regex(/[A-Z]/, 'Debe incluir al menos una letra mayúscula.')
    .regex(/[a-z]/, 'Debe incluir al menos una letra minúscula.')
    .regex(/[0-9]/, 'Debe incluir al menos un número.'),
})

export type AdminLoginFormValues = z.infer<typeof adminLoginSchema>

export const passwordResetSchema = z.object({
  email: z
    .string()
    .trim()
    .min(1, 'El correo corporativo es obligatorio.')
    .email('Ingresa un correo electrónico válido.'),
})

export type PasswordResetFormValues = z.infer<typeof passwordResetSchema>

import { DomainError } from './error-mapper'

export const ALLOWED_ATTACHMENT_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'application/pdf',
] as const

export const ALLOWED_ATTACHMENT_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.pdf'] as const
export const MAX_ATTACHMENT_BYTES = 10_485_760 // 10 MB exact SQL limit
export const MAX_CASE_ATTACHMENTS = 5

const DANGEROUS_NAME_PATTERN = /(?:^|[/\\])\.\.(?:[/\\]|$)|[<>:"|?*]/

function hasControlCharacter(value: string): boolean {
  for (let i = 0; i < value.length; i += 1) {
    if (value.charCodeAt(i) < 32) return true
  }
  return false
}

export interface FileValidationResult {
  valid: boolean
  errorCode?: 'ERR_ATTACHMENT_INVALID' | 'ERR_ATTACHMENT_LIMIT'
  message?: string
}

export function validateAttachmentFile(
  file: Pick<File, 'name' | 'type' | 'size'>,
  existingCount = 0,
): FileValidationResult {
  if (existingCount >= MAX_CASE_ATTACHMENTS) {
    return {
      valid: false,
      errorCode: 'ERR_ATTACHMENT_LIMIT',
      message: `Solo se permiten hasta ${MAX_CASE_ATTACHMENTS} archivos adjuntos por caso.`,
    }
  }

  const trimmedName = file.name.trim()
  if (
    !trimmedName ||
    DANGEROUS_NAME_PATTERN.test(trimmedName) ||
    hasControlCharacter(trimmedName)
  ) {
    return {
      valid: false,
      errorCode: 'ERR_ATTACHMENT_INVALID',
      message: 'El nombre del archivo contiene caracteres o rutas no permitidas.',
    }
  }

  const lowerName = trimmedName.toLowerCase()
  const hasAllowedExtension = ALLOWED_ATTACHMENT_EXTENSIONS.some((ext) =>
    lowerName.endsWith(ext),
  )
  const hasAllowedMime = (
    ALLOWED_ATTACHMENT_MIME_TYPES as readonly string[]
  ).includes(file.type)

  if (!hasAllowedExtension || !hasAllowedMime) {
    return {
      valid: false,
      errorCode: 'ERR_ATTACHMENT_INVALID',
      message: 'Formato no permitido. Solo se aceptan imágenes JPG, PNG o documentos PDF.',
    }
  }

  if (file.size <= 0 || file.size > MAX_ATTACHMENT_BYTES) {
    return {
      valid: false,
      errorCode: 'ERR_ATTACHMENT_INVALID',
      message: 'El archivo debe pesar más de 0 bytes y máximo 10 MB.',
    }
  }

  return { valid: true }
}

export function assertValidAttachment(
  file: Pick<File, 'name' | 'type' | 'size'>,
  existingCount = 0,
): void {
  const result = validateAttachmentFile(file, existingCount)
  if (!result.valid) {
    throw new DomainError(
      result.errorCode ?? 'ERR_ATTACHMENT_INVALID',
      result.message,
    )
  }
}

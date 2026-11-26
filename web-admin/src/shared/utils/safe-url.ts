/**
 * OWASP safe URL validator: rejects javascript:, data:text/html, vbscript:, etc.
 * Allows only https:// URLs or safe data:image/(png|jpeg) preview URLs.
 */
export function isSafeExternalUrl(url: string): boolean {
  const trimmed = url.trim()
  if (!trimmed) return false

  if (
    trimmed.startsWith('data:image/png;base64,') ||
    trimmed.startsWith('data:image/jpeg;base64,')
  ) {
    return true
  }

  try {
    const parsed = new URL(trimmed)
    return parsed.protocol === 'https:'
  } catch {
    return false
  }
}

export function openSafeExternalUrl(url: string): boolean {
  if (!isSafeExternalUrl(url)) {
    return false
  }
  window.open(url, '_blank', 'noopener,noreferrer')
  return true
}

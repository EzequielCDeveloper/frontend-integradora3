import { DomainError, type DomainErrorCode } from '@/shared/utils/error-mapper'

export interface HttpRequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE'
  body?: unknown
  accessToken?: string | null
  idempotencyKey?: string
  signal?: AbortSignal
}

function mapHttpStatusToErrorCode(status: number): DomainErrorCode {
  if (status === 401) return 'ERR_NOT_AUTHENTICATED'
  if (status === 403) return 'ERR_FORBIDDEN'
  if (status === 404) return 'ERR_NOT_FOUND'
  if (status === 409) return 'ERR_CONFLICT'
  if (status === 422 || status === 400) return 'ERR_VALIDATION'
  return 'ERR_UNKNOWN'
}

export function getApiBaseUrl(): string {
  const configured = import.meta.env.VITE_API_BASE_URL
  return (configured && configured.trim()) || 'https://api.example.com/v1'
}

export function isMockApiEnabled(): boolean {
  const flag = import.meta.env.VITE_USE_MOCK_API
  if (flag === 'false') return false
  return true
}

/**
 * Typed HTTP client prepared for future backend / Edge Function integration.
 * Uses VITE_API_BASE_URL and never stores secret keys in frontend code.
 */
export async function httpRequest<TResponse>(
  path: string,
  options: HttpRequestOptions = {},
): Promise<TResponse> {
  const baseUrl = getApiBaseUrl().replace(/\/+$/, '')
  const normalizedPath = path.startsWith('/') ? path : `/${path}`
  const url = `${baseUrl}${normalizedPath}`

  const headers: Record<string, string> = {
    Accept: 'application/json',
  }

  if (options.body !== undefined) {
    headers['Content-Type'] = 'application/json'
  }
  if (options.accessToken) {
    headers.Authorization = `Bearer ${options.accessToken}`
  }
  if (options.idempotencyKey) {
    headers['Idempotency-Key'] = options.idempotencyKey
  }

  let response: Response
  try {
    response = await fetch(url, {
      method: options.method ?? 'GET',
      headers,
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
      signal: options.signal,
    })
  } catch {
    throw new DomainError('ERR_NETWORK')
  }

  if (!response.ok) {
    let serverMessage: string | undefined
    try {
      const payload = (await response.json()) as { message?: string }
      serverMessage = payload.message
    } catch {
      serverMessage = undefined
    }
    throw new DomainError(mapHttpStatusToErrorCode(response.status), serverMessage)
  }

  return (await response.json()) as TResponse
}

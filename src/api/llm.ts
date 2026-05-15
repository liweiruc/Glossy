import { firebaseAuth } from '../firebase'

export type GlossyErrorCode = 'timeout' | 'server' | 'parse' | 'network' | 'unauthenticated'

export class GlossyError extends Error {
  readonly code: GlossyErrorCode
  constructor(message: string, code: GlossyErrorCode) {
    super(message)
    this.name = 'GlossyError'
    this.code = code
  }
}

const USER_MESSAGES: Record<GlossyErrorCode, string> = {
  timeout: '网络连接超时，请检查网络后重试',
  server: 'AI 模型服务暂时不可用，请稍后重试',
  parse: 'AI 模型返回格式异常，请稍后重试',
  network: '当前无网络连接，无法获取新内容',
  unauthenticated: '请先登录后再使用',
}

export function getErrorMessage(err: unknown): string {
  if (err instanceof GlossyError) return USER_MESSAGES[err.code]
  return '发生未知错误，请稍后重试'
}

function stripMarkdown(text: string): string {
  return text
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/```\s*$/i, '')
    .trim()
}

function parseJSON<T>(text: string): T {
  return JSON.parse(stripMarkdown(text)) as T
}

async function fetchViaProxy(
  prompt: string,
  model: string,
  signal?: AbortSignal,
  onStream?: () => void,
): Promise<string> {
  const currentUser = firebaseAuth.currentUser
  if (!currentUser) throw new GlossyError('Not authenticated', 'unauthenticated')

  const idToken = await currentUser.getIdToken()
  const proxyUrl = import.meta.env.VITE_PROXY_URL

  let response: Response
  try {
    response = await fetch(proxyUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${idToken}`,
      },
      body: JSON.stringify({ prompt, model }),
      signal: signal
        ? AbortSignal.any([AbortSignal.timeout(60_000), signal])
        : AbortSignal.timeout(60_000),
    })
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') throw err
    if (err instanceof DOMException && err.name === 'TimeoutError') {
      throw new GlossyError('Request timed out', 'timeout')
    }
    if (!navigator.onLine) throw new GlossyError('No network', 'network')
    throw new GlossyError('Network error', 'network')
  }

  if (!response.ok) {
    if (response.status >= 500) throw new GlossyError('Server error', 'server')
    throw new GlossyError(`HTTP ${response.status}`, 'server')
  }

  // Streaming response (new worker returns text/plain)
  const contentType = response.headers.get('Content-Type') ?? ''
  if (contentType.includes('text/plain') && response.body) {
    const reader = response.body.getReader()
    const decoder = new TextDecoder()
    let text = ''
    let streamFired = false
    try {
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        text += decoder.decode(value, { stream: true })
        if (!streamFired) {
          streamFired = true
          onStream?.()
        }
      }
    } finally {
      reader.releaseLock()
    }
    return text
  }

  // Legacy JSON fallback (old worker)
  const data = await response.json() as { text: string }
  return data.text
}

export async function callLLM<T>(
  prompt: string,
  model: string,
  signal?: AbortSignal,
  onStream?: () => void,
): Promise<T> {
  let lastText: string | undefined

  for (let attempt = 0; attempt < 2; attempt++) {
    const text = await fetchViaProxy(prompt, model, signal, attempt === 0 ? onStream : undefined)
    lastText = text
    try {
      return parseJSON<T>(text)
    } catch {
      if (attempt === 0) continue
    }
  }

  throw new GlossyError(`Failed to parse: ${lastText}`, 'parse')
}

// Kept for call-site compatibility
export async function callLLMStream<T>(
  prompt: string,
  model: string,
  signal?: AbortSignal,
  onStream?: () => void,
): Promise<T> {
  return callLLM<T>(prompt, model, signal, onStream)
}

export function getModel(_type: 'lookup' | 'translate'): Promise<string> {
  return Promise.resolve('deepseek-chat')
}

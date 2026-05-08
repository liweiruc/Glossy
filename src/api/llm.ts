import { db } from '../db'

export type GlossyErrorCode = 'auth' | 'balance' | 'model' | 'timeout' | 'server' | 'parse' | 'no_config' | 'network'

export class GlossyError extends Error {
  readonly code: GlossyErrorCode
  constructor(message: string, code: GlossyErrorCode) {
    super(message)
    this.name = 'GlossyError'
    this.code = code
  }
}

const USER_MESSAGES: Record<GlossyErrorCode, string> = {
  auth: 'API key 似乎不正确，请到设置页检查',
  balance: '您的账户余额不足，请到 AI 模型提供商充值',
  model: '模型名称似乎不正确，请到设置页检查',
  timeout: '网络连接超时，请检查网络后重试',
  server: 'AI 模型服务暂时不可用，请稍后重试',
  parse: 'AI 模型返回格式异常，请稍后重试',
  no_config: '请先到设置页配置 API Key',
  network: '当前无网络连接，无法获取新内容',
}

export function getErrorMessage(err: unknown): string {
  if (err instanceof GlossyError) return USER_MESSAGES[err.code]
  return '发生未知错误，请稍后重试'
}

function mapHttpError(status: number): GlossyError {
  if (status === 401 || status === 403) return new GlossyError('Unauthorized', 'auth')
  if (status === 402) return new GlossyError('Payment required', 'balance')
  if (status === 404) return new GlossyError('Model not found', 'model')
  if (status >= 500) return new GlossyError('Server error', 'server')
  return new GlossyError(`HTTP ${status}`, 'server')
}

function stripMarkdown(text: string): string {
  return text
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/```\s*$/i, '')
    .trim()
}

function parseJSON<T>(text: string): T {
  const cleaned = stripMarkdown(text)
  return JSON.parse(cleaned) as T
}

async function getSettings() {
  const base = await db.settings.get('api_base_url')
  const key = await db.settings.get('api_key')
  if (!key?.value) throw new GlossyError('No API key configured', 'no_config')
  return {
    api_base_url: base?.value ?? 'https://api.deepseek.com/v1',
    api_key: key.value,
  }
}

async function fetchOnce(prompt: string, model: string): Promise<string> {
  const settings = await getSettings()

  let response: Response
  try {
    response = await fetch(`${settings.api_base_url}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${settings.api_key}`,
      },
      body: JSON.stringify({
        model,
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.3,
      }),
      signal: AbortSignal.timeout(30_000),
    })
  } catch (err) {
    if (err instanceof DOMException && err.name === 'TimeoutError') {
      throw new GlossyError('Request timed out', 'timeout')
    }
    if (!navigator.onLine) throw new GlossyError('No network', 'network')
    throw new GlossyError('Network error', 'network')
  }

  if (!response.ok) throw mapHttpError(response.status)

  const data = await response.json()
  return data.choices[0].message.content as string
}

export async function callLLM<T>(prompt: string, model: string): Promise<T> {
  let lastText: string | undefined

  for (let attempt = 0; attempt < 2; attempt++) {
    const text = await fetchOnce(prompt, model)
    lastText = text
    try {
      return parseJSON<T>(text)
    } catch {
      if (attempt === 0) continue
    }
  }

  throw new GlossyError(`Failed to parse: ${lastText}`, 'parse')
}

async function streamOnce(prompt: string, model: string, signal?: AbortSignal): Promise<string> {
  const settings = await getSettings()

  const fetchSignal = signal
    ? AbortSignal.any([AbortSignal.timeout(30_000), signal])
    : AbortSignal.timeout(30_000)

  let response: Response
  try {
    response = await fetch(`${settings.api_base_url}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${settings.api_key}`,
      },
      body: JSON.stringify({
        model,
        messages: [{ role: 'user', content: prompt }],
        stream: true,
        temperature: 0.3,
      }),
      signal: fetchSignal,
    })
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') throw err
    if (err instanceof DOMException && err.name === 'TimeoutError') {
      throw new GlossyError('Request timed out', 'timeout')
    }
    if (!navigator.onLine) throw new GlossyError('No network', 'network')
    throw new GlossyError('Network error', 'network')
  }

  if (!response.ok) throw mapHttpError(response.status)

  const reader = response.body!.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  let streamFinished = false

  while (!streamFinished) {
    const { done, value } = await reader.read()
    if (done) break

    const chunk = decoder.decode(value, { stream: true })
    const lines = chunk.split('\n')

    for (const line of lines) {
      if (!line.startsWith('data: ')) continue
      const data = line.slice(6).trim()
      if (data === '[DONE]') {
        streamFinished = true
        break
      }

      try {
        const parsed = JSON.parse(data)
        const delta = parsed.choices?.[0]?.delta?.content
        if (delta) buffer += delta
      } catch {
        // skip malformed SSE line
      }
    }
  }

  return buffer
}

export async function callLLMStream<T>(prompt: string, model: string, signal?: AbortSignal): Promise<T> {
  let lastBuffer: string | undefined
  for (let attempt = 0; attempt < 2; attempt++) {
    const buffer = await streamOnce(prompt, model, signal)
    lastBuffer = buffer
    try {
      return parseJSON<T>(buffer)
    } catch {
      if (attempt === 0) continue
    }
  }
  throw new GlossyError(`Failed to parse: ${lastBuffer}`, 'parse')
}

export async function getModel(type: 'lookup' | 'translate'): Promise<string> {
  const key = type === 'lookup' ? 'model_lookup' : 'model_translate'
  const setting = await db.settings.get(key)
  return setting?.value ?? 'deepseek-chat'
}

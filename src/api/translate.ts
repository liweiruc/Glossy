import { db } from '../db'
import type { TranslationCache, Span } from '../db'
import { hashText } from '../utils/hash'
import { callLLMStream, getModel } from './llm'
import { buildTranslatePrompt } from '../prompts/translate'

interface LLMTranslateResponse {
  source: string
  casual: string
  formal: string
  idiomatic: string
  idiomatic_note: string | null
  spans: Span[]
}

export async function translateText(
  text: string,
  onProgress?: (status: 'loading' | 'done') => void,
  signal?: AbortSignal,
): Promise<TranslationCache> {
  const trimmed = text.trim()
  const source_hash = await hashText(trimmed)

  const cached = await db.translation_cache.get(source_hash)

  let result: TranslationCache

  if (cached) {
    result = cached
  } else {
    onProgress?.('loading')
    const model = await getModel('translate')
    const prompt = buildTranslatePrompt(trimmed)
    const llmData = await callLLMStream<LLMTranslateResponse>(prompt, model, signal)
    onProgress?.('done')

    result = {
      source_hash,
      source_text: trimmed,
      casual_en: llmData.casual ?? '',
      formal_en: llmData.formal ?? '',
      idiomatic_en: llmData.idiomatic ?? '',
      idiomatic_note: llmData.idiomatic_note ?? null,
      spans: llmData.spans ?? [],
      created_at: Date.now(),
    }

    await db.translation_cache.put(result)
  }

  await db.history.add({
    id: crypto.randomUUID(),
    type: 'translation',
    ref_key: source_hash,
    display_text: trimmed.slice(0, 30),
    queried_at: Date.now(),
  })

  return result
}

import { db } from '../db'
import type { TranslationCache, Span } from '../db'
import { firebaseAuth } from '../firebase'
import { hashText } from '../utils/hash'
import { callLLMStream, getModel } from './llm'
import { buildTranslatePrompt } from '../prompts/translate'
import {
  getTranslationFromFirestore,
  putTranslationToFirestore,
  pushHistoryItem,
} from '../db/firestore-sync'

interface LLMTranslateResponse {
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
  onStream?: () => void,
): Promise<TranslationCache> {
  const trimmed = text.trim()
  const source_hash = await hashText(trimmed)

  // 1. Local IndexedDB cache
  const cached = await db.translation_cache.get(source_hash)

  let result: TranslationCache

  if (cached) {
    result = cached
  } else {
    // 2. Shared Firestore cache
    const firestoreCached = await getTranslationFromFirestore(source_hash).catch(() => null)
    if (firestoreCached) {
      await db.translation_cache.put(firestoreCached)
      result = firestoreCached
    } else {
      // 3. LLM via proxy
      onProgress?.('loading')
      const model = await getModel('translate')
      const prompt = buildTranslatePrompt(trimmed)
      const llmData = await callLLMStream<LLMTranslateResponse>(prompt, model, signal, onStream)
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
      putTranslationToFirestore(result).catch(e => console.error('[Firestore sync]', e))
    }
  }

  const historyItem = {
    id: crypto.randomUUID(),
    type: 'translation' as const,
    ref_key: source_hash,
    display_text: trimmed.slice(0, 30),
    queried_at: Date.now(),
  }
  await db.history.add(historyItem)

  const uid = firebaseAuth.currentUser?.uid
  if (uid) pushHistoryItem(uid, historyItem).catch(e => console.error('[Firestore sync]', e))

  return result
}

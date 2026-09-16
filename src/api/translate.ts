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

// The cache tiers alone, keyed by source hash — see getCachedWord for why screens
// opened from History or the review book need the shared tier too.
export async function getCachedTranslation(source_hash: string): Promise<TranslationCache | null> {
  const local = await db.translation_cache.get(source_hash)
  if (local) return local

  const shared = await getTranslationFromFirestore(source_hash)
  if (shared) await db.translation_cache.put(shared)
  return shared
}

// Always calls the LLM, then overwrites both caches — the shared one included, so every
// user sees the new result. Refresh must come here: translateText would find the old
// result in the shared cache and never regenerate.
export async function generateTranslation(
  text: string,
  signal?: AbortSignal,
  onStream?: () => void,
): Promise<TranslationCache> {
  const trimmed = text.trim()
  const model = await getModel('translate')
  const prompt = buildTranslatePrompt(trimmed)
  const llmData = await callLLMStream<LLMTranslateResponse>(prompt, model, signal, onStream)

  const result: TranslationCache = {
    source_hash: await hashText(trimmed),
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
  return result
}

export async function translateText(
  text: string,
  onProgress?: (status: 'loading' | 'done') => void,
  signal?: AbortSignal,
  onStream?: () => void,
): Promise<TranslationCache> {
  const trimmed = text.trim()
  const source_hash = await hashText(trimmed)

  // 1–2. Local IndexedDB, then the shared Firestore cache. An unreachable shared
  // cache isn't fatal here: the LLM can still answer.
  let result = await getCachedTranslation(source_hash).catch(() => null)

  if (!result) {
    // 3. LLM via proxy
    onProgress?.('loading')
    result = await generateTranslation(trimmed, signal, onStream)
    onProgress?.('done')
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

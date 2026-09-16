import { db } from '../db'
import type { WordCache, Definition } from '../db'
import { firebaseAuth } from '../firebase'
import { lemmatize } from '../utils/lemmatize'
import { callLLMStream, getModel } from './llm'
import { buildLookupPrompt } from '../prompts/lookup'
import { getWordFromFirestore, putWordToFirestore, pushHistoryItem } from '../db/firestore-sync'

interface LLMWordResponse {
  phonetic_uk: string
  phonetic_us: string
  definitions: Definition[]
}

// The cache tiers alone: local IndexedDB, then the shared Firestore cache. Never calls
// the LLM and never records history. Screens opened from History or the review book
// must not stop at IndexedDB — it is empty on any device that didn't run the lookup
// itself, while the synced history and review rows still point at the word.
export async function getCachedWord(lemma: string): Promise<WordCache | null> {
  const local = await db.word_cache.get(lemma)
  if (local) return local

  const shared = await getWordFromFirestore(lemma)
  if (shared) await db.word_cache.put(shared)
  return shared
}

export async function lookupWord(
  rawInput: string,
  onProgress?: (status: 'loading' | 'done') => void,
  signal?: AbortSignal,
  onStream?: () => void,
): Promise<WordCache> {
  const queried = rawInput.toLowerCase().trim()
  const lemma = lemmatize(queried)

  // 1–2. Local IndexedDB, then the shared Firestore cache. An unreachable shared
  // cache isn't fatal here: the LLM can still answer.
  let result = await getCachedWord(lemma).catch(() => null)

  if (!result) {
    // 3. LLM via proxy
    onProgress?.('loading')
    const model = await getModel('lookup')
    const prompt = buildLookupPrompt(lemma)
    const llmData = await callLLMStream<LLMWordResponse>(prompt, model, signal, onStream)
    onProgress?.('done')

    result = {
      lemma,
      queried_form: queried,
      phonetic_uk: llmData.phonetic_uk ?? '',
      phonetic_us: llmData.phonetic_us ?? '',
      definitions: llmData.definitions ?? [],
      created_at: Date.now(),
    }

    await db.word_cache.put(result)
    putWordToFirestore(result).catch(e => console.error('[Firestore sync]', e))
  }

  const historyItem = {
    id: crypto.randomUUID(),
    type: 'word' as const,
    ref_key: result.lemma,
    display_text: result.lemma,
    queried_at: Date.now(),
  }
  await db.history.add(historyItem)

  const uid = firebaseAuth.currentUser?.uid
  if (uid) pushHistoryItem(uid, historyItem).catch(e => console.error('[Firestore sync]', e))

  return result
}

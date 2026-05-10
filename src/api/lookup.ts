import { db } from '../db'
import type { WordCache, Definition } from '../db'
import { firebaseAuth } from '../firebase'
import { lemmatize } from '../utils/lemmatize'
import { callLLMStream, getModel } from './llm'
import { buildLookupPrompt } from '../prompts/lookup'
import { getWordFromFirestore, putWordToFirestore, pushHistoryItem } from '../db/firestore-sync'

interface LLMWordResponse {
  word: string
  phonetic_uk: string
  phonetic_us: string
  definitions: Definition[]
}

export async function lookupWord(
  rawInput: string,
  onProgress?: (status: 'loading' | 'done') => void,
  signal?: AbortSignal,
): Promise<WordCache> {
  const queried = rawInput.toLowerCase().trim()
  const lemma = lemmatize(queried)

  // 1. Local IndexedDB cache
  const cached = await db.word_cache.get(lemma)

  let result: WordCache

  if (cached) {
    result = cached
  } else {
    // 2. Shared Firestore cache
    const firestoreCached = await getWordFromFirestore(lemma).catch(() => null)
    if (firestoreCached) {
      await db.word_cache.put(firestoreCached)
      result = firestoreCached
    } else {
      // 3. LLM via proxy
      onProgress?.('loading')
      const model = await getModel('lookup')
      const prompt = buildLookupPrompt(lemma)
      const llmData = await callLLMStream<LLMWordResponse>(prompt, model, signal)
      onProgress?.('done')

      result = {
        lemma: (llmData.word || lemma).toLowerCase().trim(),
        queried_form: queried,
        phonetic_uk: llmData.phonetic_uk ?? '',
        phonetic_us: llmData.phonetic_us ?? '',
        definitions: llmData.definitions ?? [],
        created_at: Date.now(),
      }

      await db.word_cache.put(result)
      putWordToFirestore(result).catch(e => console.error('[Firestore sync]', e))
    }
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

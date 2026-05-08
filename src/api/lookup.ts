import { db } from '../db'
import type { WordCache, Definition } from '../db'
import { lemmatize } from '../utils/lemmatize'
import { callLLMStream, getModel } from './llm'
import { buildLookupPrompt } from '../prompts/lookup'

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

  const cached = await db.word_cache.get(lemma)

  let result: WordCache

  if (cached) {
    result = cached
  } else {
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
  }

  await db.history.add({
    id: crypto.randomUUID(),
    type: 'word',
    ref_key: result.lemma,
    display_text: result.lemma,
    queried_at: Date.now(),
  })

  return result
}

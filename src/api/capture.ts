import type { Definition } from '../db'
import { callLLMStream, getModel } from './llm'
import { buildChunksPrompt, buildSensePrompt } from '../prompts/capture'

interface LLMChunksResponse {
  chunks?: { text?: string }[]
}

interface LLMSenseResponse {
  lemma?: string
  pos?: string
  en?: string
  cn?: string
  register?: string
  target?: string
}

export interface ContextSense {
  lemma: string
  target: string
  sense: Definition
}

// The expressions in a passage that have to be tapped whole. Only spans the model copied
// verbatim survive: a chunk the app cannot find in the text would silently never render.
export async function findChunks(text: string, signal?: AbortSignal): Promise<string[]> {
  const model = await getModel('lookup')
  const data = await callLLMStream<LLMChunksResponse>(buildChunksPrompt(text), model, signal)

  const seen = new Set<string>()
  const lower = text.toLowerCase()
  for (const chunk of data.chunks ?? []) {
    const value = chunk?.text?.trim()
    if (!value || !value.includes(' ')) continue
    if (!lower.includes(value.toLowerCase())) continue
    seen.add(value)
  }
  return [...seen]
}

// What one expression means in ONE sentence — the sense that fits here, not the five a
// dictionary would list. Deliberately uncached: the answer depends on the sentence.
export async function explainInContext(
  phrase: string,
  sentence: string,
  signal?: AbortSignal,
): Promise<ContextSense> {
  const model = await getModel('lookup')
  const data = await callLLMStream<LLMSenseResponse>(
    buildSensePrompt(phrase, sentence), model, signal,
  )

  const sense: Definition = {
    pos: data.pos?.trim() || '',
    en: data.en?.trim() || '',
    cn: data.cn?.trim() || '',
    register: data.register?.trim() || undefined,
    // No examples: the sentence the learner met this in is the card's context, kept in
    // the snapshot's `contexts`, and duplicating it here would show it twice.
    examples: [],
  }

  return {
    lemma: (data.lemma?.trim() || phrase).toLowerCase(),
    target: data.target?.trim() || phrase,
    sense,
  }
}

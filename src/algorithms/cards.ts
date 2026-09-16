import { snapshotSenses } from '../db'
import type { Definition, Example, ReviewItem, WordSnapshot } from '../db'
import { markTarget } from '../utils/highlight'

export type CardMode = 'context' | 'cloze' | 'fresh' | 'bare'

export interface WordCard {
  mode: CardMode
  senses: Definition[]
  sense: Definition | null
  example: Example | null
}

const CLOZE_FROM = 1
const FRESH_FROM = 3

// How a word card asks its question, by how well the word is already known:
//
//   context — the sentence it was saved from, word marked: "what does it mean here?"
//   cloze   — that same sentence with the word blanked: produce it from the meaning
//   fresh   — a sentence this card has not used yet: tests the word, not the line
//   bare    — the word alone, only when the sense carries no usable example
//
// A word is never tested naked while a sentence is available. Recalling a word with
// nothing around it is the vocabulary-list habit this app exists to replace.
export function pickWordCard(item: Pick<ReviewItem, 'snapshot' | 'repetitions'>): WordCard {
  const snap = item.snapshot as WordSnapshot
  const senses = snapshotSenses(snap)
  const sense = senses[0] ?? null
  const examples = sense?.examples ?? []

  if (!sense || examples.length === 0) {
    return { mode: 'bare', senses, sense, example: null }
  }

  // Mature cards leave the saved sentence behind, cycling through whatever else the
  // sense offers, so the word is met in more than one situation.
  if (item.repetitions >= FRESH_FROM && examples.length > 1) {
    const index = 1 + ((item.repetitions - FRESH_FROM) % (examples.length - 1))
    return { mode: 'fresh', senses, sense, example: examples[index] }
  }

  const example = examples[0]
  // Blanking a word requires finding it: an example cached before the prompt returned
  // "target" may not be locatable in its own sentence.
  const locatable = markTarget(example.en, example.target, snap.lemma).some(part => part.target)
  const mode: CardMode = item.repetitions >= CLOZE_FROM && locatable ? 'cloze' : 'context'
  return { mode, senses, sense, example }
}

export function cardPrompt(mode: CardMode, target: string | undefined): string {
  if (mode === 'cloze') {
    return target && target.includes(' ') ? 'fill in the missing words' : 'fill in the missing word'
  }
  if (mode === 'fresh') return 'a sentence you have not seen before'
  if (mode === 'context') return 'from your saved sentence'
  return 'recall the meaning'
}

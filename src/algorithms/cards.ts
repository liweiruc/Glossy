import { snapshotSenses } from '../db'
import type { Definition, Example, ReviewItem, WordSnapshot } from '../db'
import { markTarget } from '../utils/highlight'

export type CardMode = 'cloze' | 'fresh' | 'bare'

export interface WordCard {
  mode: CardMode
  senses: Definition[]
  sense: Definition | null
  example: Example | null
  answer: string | null   // the words the blank hides, exactly as the sentence has them
}

const FRESH_FROM = 3

// How a word card asks its question:
//
//   cloze — the sentence it was saved from, the word blanked and its meaning given as the
//           hint: the learner produces the word, in the form the sentence needs
//   fresh — the same, in a sentence this card has not used yet: tests the word, not the line
//   bare  — the word alone, only when no sentence can carry the question
//
// A sentence never asks "what does it mean here?". Recognising a meaning feels like
// knowing it, so a learner grading themselves overrates it; a blank has one right answer,
// down to "ran" or "running", and whether it came to mind is plain.
//
// A word is never tested naked while a sentence is available. Recalling a word with
// nothing around it is the vocabulary-list habit this app exists to replace.
export function pickWordCard(item: Pick<ReviewItem, 'snapshot' | 'repetitions'>): WordCard {
  const snap = item.snapshot as WordSnapshot
  const senses = snapshotSenses(snap)
  const sense = senses[0] ?? null
  // The learner's own sentences come first. Meeting the word where they actually met it
  // beats a sentence written for a dictionary, so that is what a card opens with; the
  // dictionary examples then serve as the unseen sentences a mature card moves on to.
  //
  // Only a sentence the word can be found in can ask about it, since the card blanks it
  // out: an example cached before the prompt returned "target" may not hold it findably.
  const usable = [
    ...(snap.contexts ?? []).map(c => ({ en: c.en, cn: '', target: c.target })),
    ...(sense?.examples ?? []),
  ].flatMap(example => {
    const answer = markTarget(example.en, example.target, snap.lemma).find(part => part.target)?.text
    return answer ? [{ example, answer }] : []
  })

  if (!sense || usable.length === 0) {
    return { mode: 'bare', senses, sense, example: null, answer: null }
  }

  // Mature cards leave the saved sentence behind, cycling through whatever else the
  // sense offers, so the word is met in more than one situation.
  if (item.repetitions >= FRESH_FROM && usable.length > 1) {
    const { example, answer } = usable[1 + ((item.repetitions - FRESH_FROM) % (usable.length - 1))]
    return { mode: 'fresh', senses, sense, example, answer }
  }

  const { example, answer } = usable[0]
  return { mode: 'cloze', senses, sense, example, answer }
}

// The line above the question.
export function cardPrompt(card: Pick<WordCard, 'mode' | 'answer'>): string {
  if (card.mode === 'bare') return 'recall the meaning'
  return card.answer && /\s/.test(card.answer.trim()) ? 'fill in the missing words' : 'fill in the missing word'
}

// The line above the sentence once the answer is showing: where that sentence came from.
export function sentenceSource(mode: CardMode): string {
  return mode === 'fresh' ? 'a sentence you have not seen before' : 'from your saved sentence'
}

import { snapshotSenses } from '../db'
import type { Definition, Example, ReviewItem, WordSnapshot } from '../db'
import { markTarget } from '../utils/highlight'
import { isMature } from './fsrs'

export type CardMode = 'cloze' | 'fresh' | 'bare'

export interface WordCard {
  mode: CardMode
  senses: Definition[]
  sense: Definition | null
  example: Example | null
  answer: string | null   // the words the blank hides, exactly as the sentence has them
}

// How a word card asks its question:
//
//   cloze — the sentence it was saved from, the word blanked and its meaning given as the
//           hint: the learner produces the word, in the form the sentence needs
//   fresh — the same, in a sentence this card has not used yet: tests the word, not the line
//   bare  — no sentence can carry the question, so the meaning alone asks for the word
//
// Every mode is answered by typing the word, so whether it came to mind is never a matter
// of the learner's own generosity.
//
// A sentence never asks "what does it mean here?". Recognising a meaning feels like
// knowing it, so a learner grading themselves overrates it; a blank has one right answer,
// down to "ran" or "running", and whether it came to mind is plain.
//
// A word is never tested naked while a sentence is available. Recalling a word with
// nothing around it is the vocabulary-list habit this app exists to replace.
export function pickWordCard(
  item: Pick<ReviewItem, 'snapshot' | 'state' | 'stability' | 'reps'>,
): WordCard {
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
  // sense offers, so the word is met in more than one situation. A card forgotten since
  // goes back to its own sentence while it is relearned.
  if (isMature(item) && usable.length > 1) {
    const { example, answer } = usable[1 + (item.reps % (usable.length - 1))]
    return { mode: 'fresh', senses, sense, example, answer }
  }

  const { example, answer } = usable[0]
  return { mode: 'cloze', senses, sense, example, answer }
}

// What the learner has to type: the words the blank hides, or the word itself when there
// is no blank.
export function cardAnswer(card: Pick<WordCard, 'answer'>, lemma: string): string {
  return card.answer ?? lemma
}

// The line above the question.
export function cardPrompt(card: Pick<WordCard, 'mode' | 'answer'>, lemma: string): string {
  const words = cardAnswer(card, lemma).trim().split(/\s+/).length
  if (card.mode === 'bare') return words > 1 ? `type the ${words} words` : 'type the word'
  return words > 1 ? `fill in ${words} words` : 'fill in the missing word'
}

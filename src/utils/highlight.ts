import { lemmatize } from './lemmatize'

// One English word, keeping contractions and hyphenated compounds whole.
export const WORD_RE = /[A-Za-z]+(?:['’-][A-Za-z]+)*/g

export interface Part {
  text: string
  target: boolean
}

function split(sentence: string, start: number, length: number): Part[] {
  const parts: Part[] = []
  if (start > 0) parts.push({ text: sentence.slice(0, start), target: false })
  parts.push({ text: sentence.slice(start, start + length), target: true })
  if (start + length < sentence.length) {
    parts.push({ text: sentence.slice(start + length), target: false })
  }
  return parts
}

const LETTER = /\p{L}/u

// The first place `needle` stands as whole words, not inside a longer one: "ran" must not
// be found in "Fran", nor "art" in "start". Review cards blank whatever is found, and half
// a word would leave the rest of it on screen ("I'm ___ning late").
function findWhole(haystack: string, needle: string): number {
  for (let at = haystack.indexOf(needle); at >= 0; at = haystack.indexOf(needle, at + 1)) {
    const before = haystack[at - 1]
    const after = haystack[at + needle.length]
    if (!(before && LETTER.test(before)) && !(after && LETTER.test(after))) return at
  }
  return -1
}

// Splits an example sentence so the word being taught can be marked inside it.
//
// Prefers the exact `target` the model returned. Entries cached before the prompt
// started returning one still need marking — word_cache is shared and never expires —
// so fall back to the lemma itself (phrases like "pull off" appear verbatim) and then
// to the first token that lemmatizes back to it ("ran" in a sentence about "run").
export function markTarget(sentence: string, target: string | undefined, lemma: string): Part[] {
  const lower = sentence.toLowerCase()

  for (const candidate of [target?.trim(), lemma.trim()]) {
    if (!candidate) continue
    const at = findWhole(lower, candidate.toLowerCase())
    if (at >= 0) return split(sentence, at, candidate.length)
  }

  for (const match of sentence.matchAll(WORD_RE)) {
    if (lemmatize(match[0]) === lemma.toLowerCase()) {
      return split(sentence, match.index ?? 0, match[0].length)
    }
  }

  return [{ text: sentence, target: false }]
}

const BOUNDARY = /[.!?…]["'”’)\]]*\s/g

// The sentence containing `index`, which is what a learner actually met the word in —
// sending the whole passage instead would let the model explain the wrong occurrence.
// Abbreviations ("Dr. Who") split early; a slightly short sentence still carries the
// meaning, so that is a fair trade against a parser.
export function sentenceAt(text: string, index: number): string {
  let start = 0
  BOUNDARY.lastIndex = 0

  for (const match of text.matchAll(BOUNDARY)) {
    const end = (match.index ?? 0) + match[0].length
    if (end > index) return text.slice(start, end).trim()
    start = end
  }

  return text.slice(start).trim()
}

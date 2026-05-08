import nlp from 'compromise'

export function lemmatize(word: string): string {
  const w = word.toLowerCase().trim()
  if (!w) return w

  const doc = nlp(w)

  // Verb infinitive: running→run, ran→run, better(v)→better
  const verbs = doc.verbs()
  if (verbs.length > 0) {
    const inf = verbs.toInfinitive().text().trim()
    if (inf && inf !== w) return inf
  }

  // Adjective positive: handles some comparatives/superlatives
  const adjs = doc.adjectives()
  if (adjs.length > 0) {
    // toPositive is available in compromise v14
    const pos = (adjs as any).toPositive?.().text().trim()
    if (pos && pos !== w) return pos
  }

  // Noun singular: children→child, mice→mouse
  const nouns = doc.nouns()
  if (nouns.length > 0) {
    const singular = nouns.toSingular().text().trim()
    if (singular && singular !== w) return singular
  }

  return w
}

import { lemmatize } from '../utils/lemmatize'
import type { Rating } from './fsrs'

// What came of one card. `known` is "I know this" on a new card's intro: rated without
// being asked.
export type Outcome = 'correct' | 'typo' | 'wrong_form' | 'wrong' | 'gave_up' | 'known'

export function normalizeAnswer(text: string): string {
  return text
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[‘’ʼ`´]/g, "'")
    .replace(/[‐‑‒–—―]/g, '-')
    .trim()
    .replace(/[.!?,;:"]+$/, '')
    .replace(/\s+/g, ' ')
    .trim()
}

// Optimal-string-alignment distance: insertions, deletions, substitutions and swaps of two
// neighbouring letters each cost one, so "recieve" is one step from "receive".
export function editDistance(a: string, b: string): number {
  const d: number[][] = Array.from({ length: a.length + 1 }, (_, i) =>
    Array.from({ length: b.length + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0))
  )
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + cost)
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1)
      }
    }
  }
  return d[a.length][b.length]
}

// Hyphens and spaces are interchangeable in an answer: "self esteem" for "self-esteem".
function sameText(a: string, b: string): boolean {
  return a === b || a.replace(/[\s-]/g, '') === b.replace(/[\s-]/g, '')
}

function sameLemmas(a: string, b: string): boolean {
  const ta = a.split(' ')
  const tb = b.split(' ')
  return ta.length === tb.length && ta.every((t, i) => t === tb[i] || lemmatize(t) === lemmatize(tb[i]))
}

// Judges what the learner typed. A blank asks for the word in the form its sentence needs,
// so "strike" where the sentence has "struck" is the right word in the wrong form — a
// different miss from not knowing the word at all.
export function judgeAnswer(input: string, expected: string, lemma: string): Exclude<Outcome, 'gave_up' | 'known'> {
  const given = normalizeAnswer(input)
  const want = normalizeAnswer(expected)
  if (!given) return 'wrong'
  if (sameText(given, want)) return 'correct'
  if (sameLemmas(given, want) || sameText(given, normalizeAnswer(lemma))) return 'wrong_form'

  const limit = want.length >= 8 ? 2 : 1
  if (want.length >= 4 && editDistance(given, want) <= limit) return 'typo'
  return 'wrong'
}

// The rating offered by default; the learner can always pick another one.
export function suggestRating(outcome: Outcome, hintsUsed: number): Rating {
  switch (outcome) {
    case 'correct':
      return hintsUsed > 0 ? 'hard' : 'good'
    case 'typo':
    case 'wrong_form':
      return 'hard'
    case 'known':
      return 'easy'
    default:
      return 'again'
  }
}

// "w _ _ _ _ _" per word: the first letter and the length, nothing more.
export function letterHint(answer: string): string {
  return answer
    .trim()
    .split(/\s+/)
    .map(word => [...word].map((ch, i) => (i === 0 || !/[A-Za-z]/.test(ch) ? ch : '_')).join(' '))
    .join('   ')
}

export interface DiffChar {
  ch: string
  ok: boolean
}

// Character alignment between what was typed and what was expected (case-insensitive), so a
// near miss can show exactly which letters were wrong or missing.
export function diffChars(given: string, expected: string): { given: DiffChar[]; expected: DiffChar[] } {
  // Compared by code point, the same units the marks are made of.
  const marksA = [...given].map(ch => ({ ch, ok: true }))
  const marksB = [...expected].map(ch => ({ ch, ok: true }))
  const a = marksA.map(m => m.ch.toLowerCase())
  const b = marksB.map(m => m.ch.toLowerCase())
  const d: number[][] = Array.from({ length: a.length + 1 }, (_, i) =>
    Array.from({ length: b.length + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0))
  )
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1))
    }
  }

  let i = a.length
  let j = b.length
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && d[i][j] === d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)) {
      if (a[i - 1] !== b[j - 1]) {
        marksA[i - 1].ok = false
        marksB[j - 1].ok = false
      }
      i--
      j--
    } else if (i > 0 && d[i][j] === d[i - 1][j] + 1) {
      marksA[i - 1].ok = false
      i--
    } else {
      marksB[j - 1].ok = false
      j--
    }
  }
  return { given: marksA, expected: marksB }
}

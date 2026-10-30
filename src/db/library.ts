import { db, snapshotSenses } from './index'
import type { HistoryItem, ReviewItem, SentenceSnapshot, TranslationCache, WordCache, WordSnapshot } from './index'
import { isMature, withSchedule } from '../algorithms/fsrs'
import { cardKind } from '../algorithms/queue'
import { hashText } from '../utils/hash'

// Where a word or sentence stands. Each entry has exactly one, so the filter's counts add up.
export type EntryStatus = 'unadded' | 'new' | 'learning' | 'review' | 'mastered'

// How far one card has come: its bar in the row's progress meter.
export type CardLevel = 'new' | 'young' | 'mature'

export type LibrarySort = 'recent' | 'alpha' | 'due'

// A word, or a translated sentence, with everything the learner has done with it: every
// lookup and every card. A word looked up five times and saved with two meanings is one
// entry, not seven rows.
export interface LibraryEntry {
  key: string // what its result page opens: the lemma, or the source text's hash
  text: string
  meaning: string | null
  at: number // when it was last met: looked up, or added
  status: EntryStatus
  levels: CardLevel[] // one per card, furthest along first
  nextDue: number | null // the soonest any card already studied comes up
  historyIds: string[]
  cardIds: string[]
  haystack: string // what search looks through, lower-cased
}

export interface PassageEntry {
  id: string
  text: string
  source: string | null
  at: number
  saved: number // cards holding a sentence from this passage
  haystack: string
}

export interface LibraryData {
  words: LibraryEntry[]
  sentences: LibraryEntry[]
  passages: PassageEntry[]
}

// A word being drilled again counts as learning even when its other meanings are long
// known; one with some meanings studied and others not yet counts as reviewing.
export function entryStatus(cards: ReviewItem[]): EntryStatus {
  if (cards.length === 0) return 'unadded'
  const kinds = cards.map(cardKind)
  if (kinds.includes('learning')) return 'learning'
  if (kinds.every(kind => kind === 'new')) return 'new'
  return cards.every(isMature) ? 'mastered' : 'review'
}

function cardLevel(card: ReviewItem): CardLevel {
  if (cardKind(card) === 'new') return 'new'
  return isMature(card) ? 'mature' : 'young'
}

const LEVELS: CardLevel[] = ['mature', 'young', 'new']

interface Group {
  key: string
  history: HistoryItem[]
  cards: ReviewItem[]
}

function groupFor(groups: Map<string, Group>, id: string, key: string): Group {
  let group = groups.get(id)
  if (!group) {
    group = { key, history: [], cards: [] }
    groups.set(id, group)
  }
  return group
}

// What words and sentences share. `cards` are newest first.
function entryOf(group: Group, cards: ReviewItem[]) {
  const studied = cards.filter(card => cardKind(card) !== 'new')
  return {
    key: group.key,
    at: Math.max(...group.history.map(h => h.queried_at), ...cards.map(card => card.added_at)),
    status: entryStatus(cards),
    levels: cards.map(cardLevel).sort((a, b) => LEVELS.indexOf(a) - LEVELS.indexOf(b)),
    nextDue: studied.length ? Math.min(...studied.map(card => card.due_at)) : null,
    historyIds: group.history.map(h => h.id),
    cardIds: cards.map(card => card.id),
  }
}

// The meaning shown is the cards' own senses; one only looked up shows its first
// definition, when this device has the entry cached. Search reaches every meaning known.
function wordEntry(group: Group, cache: WordCache | undefined): LibraryEntry {
  const cards = [...group.cards].sort((a, b) => b.added_at - a.added_at)
  const senses = cards.flatMap(card => snapshotSenses(card.snapshot as WordSnapshot))
  const known = [...senses, ...(cache?.definitions ?? [])]
  return {
    ...entryOf(group, cards),
    text: group.key,
    meaning: senses.length ? senses.map(sense => sense.en).join('; ') : cache?.definitions[0]?.en ?? null,
    haystack: [group.key, ...known.flatMap(sense => [sense.en, sense.cn])].join('\n').toLowerCase(),
  }
}

// The translate page can save each English version as its own card, so a sentence may
// have several. A history row holds only the first 30 characters of the source.
function sentenceEntry(group: Group, cache: TranslationCache | undefined): LibraryEntry {
  const cards = [...group.cards].sort((a, b) => b.added_at - a.added_at)
  const snaps = cards.map(card => card.snapshot as SentenceSnapshot)
  const source = snaps[0]?.source_text ?? cache?.source_text ?? group.history[0]?.display_text ?? ''
  const english = [...new Set(
    [...snaps, ...(cache ? [cache] : [])]
      .flatMap(s => [s.casual_en, s.formal_en, s.idiomatic_en])
      .filter(Boolean),
  )]
  return {
    ...entryOf(group, cards),
    text: source,
    meaning: english[0] ?? null,
    haystack: [source, ...english].join('\n').toLowerCase(),
  }
}

// Everything the learner has met, gathered by what it is: lookups and cards of the same
// word together, likewise for sentences, and passages from the Read tab on their own.
export async function loadLibrary(): Promise<LibraryData> {
  const [history, items, captures] = await Promise.all([
    db.history.toArray(),
    db.review_items.toArray(),
    db.captures.toArray(),
  ])
  const cards = items.map(withSchedule)

  // History first, so an entry opens with the key its lookup recorded — the cache's own.
  const words = new Map<string, Group>()
  const sentences = new Map<string, Group>()
  for (const item of history) {
    if (item.type === 'word') groupFor(words, item.ref_key.toLowerCase(), item.ref_key).history.push(item)
    else groupFor(sentences, item.ref_key, item.ref_key).history.push(item)
  }
  // A sentence card holds its text and a lookup its hash, so each card's text is hashed to
  // meet its lookups. Resolving the hashes through translation_cache instead would miss on
  // a device that never ran the translation.
  for (const card of cards) {
    if (card.type !== 'word') continue
    const lemma = (card.snapshot as WordSnapshot).lemma
    groupFor(words, lemma.toLowerCase(), lemma).cards.push(card)
  }
  await Promise.all(cards.filter(card => card.type === 'sentence').map(async card => {
    const hash = await hashText((card.snapshot as SentenceSnapshot).source_text)
    groupFor(sentences, hash, hash).cards.push(card)
  }))

  const wordGroups = [...words.values()]
  const sentenceGroups = [...sentences.values()]
  const [wordCaches, translationCaches] = await Promise.all([
    db.word_cache.bulkGet(wordGroups.map(group => group.key)),
    db.translation_cache.bulkGet(sentenceGroups.map(group => group.key)),
  ])

  const saved = new Map<string, number>()
  for (const card of cards) {
    if (card.type !== 'word') continue
    const ids = new Set(((card.snapshot as WordSnapshot).contexts ?? []).map(context => context.capture_id))
    for (const id of ids) if (id) saved.set(id, (saved.get(id) ?? 0) + 1)
  }

  return {
    words: wordGroups.map((group, i) => wordEntry(group, wordCaches[i])),
    sentences: sentenceGroups.map((group, i) => sentenceEntry(group, translationCaches[i])),
    passages: captures.map(capture => ({
      id: capture.id,
      text: capture.text,
      source: capture.source ?? null,
      at: capture.created_at,
      saved: saved.get(capture.id) ?? 0,
      haystack: [capture.text, capture.source ?? ''].join('\n').toLowerCase(),
    })),
  }
}

export function matches(haystack: string, query: string): boolean {
  const q = query.trim().toLowerCase()
  return !q || haystack.includes(q)
}

const collator = new Intl.Collator('en', { sensitivity: 'base', numeric: true })

// Recent: last met first. A–Z: by text. Next review: the soonest due first; entries with
// nothing studied yet go last, alphabetically.
export function sortEntries<T extends { text: string; at: number; nextDue?: number | null }>(
  entries: T[],
  sort: LibrarySort,
): T[] {
  const byText = (a: T, b: T) => collator.compare(a.text, b.text)
  const compare = sort === 'alpha' ? byText
    : sort === 'due' ? (a: T, b: T) => (a.nextDue ?? Infinity) - (b.nextDue ?? Infinity) || byText(a, b)
    : (a: T, b: T) => b.at - a.at
  return [...entries].sort(compare)
}

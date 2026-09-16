import Dexie, { type Table } from 'dexie'

// Bumped when the lookup prompt starts producing fields the UI relies on. Entries
// cached before a bump keep working — every v2 field is optional and has a fallback —
// so nothing is regenerated wholesale: word_cache is shared by every user and each
// regeneration is a paid call.
export const WORD_CACHE_SCHEMA = 2

export interface WordCache {
  lemma: string
  queried_form: string
  phonetic_uk: string
  phonetic_us: string
  audio_url_uk?: string
  audio_url_us?: string
  definitions: Definition[]
  created_at: number
  schema_version?: number
}

export interface Definition {
  pos: string
  en: string
  cn: string
  register?: string // neutral | formal | informal | slang — absent before schema 2
  examples: Example[]
}

export interface Example {
  en: string
  cn: string
  target?: string // the word as it appears in this sentence — absent before schema 2
}

export interface TranslationCache {
  source_hash: string
  source_text: string
  casual_en: string
  formal_en: string
  idiomatic_en: string
  idiomatic_note: string | null
  spans: Span[]
  created_at: number
}

export interface Span {
  text: string
  category: 'phrasal_verb' | 'idiom' | 'useful_word'
  version: 'casual' | 'formal' | 'idiomatic'
  note?: string // one line of simple English — absent on translations cached earlier
}

export interface HistoryItem {
  id: string
  type: 'word' | 'translation'
  ref_key: string
  display_text: string
  queried_at: number
}

export interface ReviewItem {
  id: string
  type: 'word' | 'sentence'
  snapshot: WordSnapshot | SentenceSnapshot
  ease_factor: number
  interval_days: number
  repetitions: number
  due_at: number
  added_at: number
  last_reviewed_at: number | null
}

// A sentence the learner actually met the word in, kept with the card. This is the
// strongest hook there is at review time, which is why it travels with the snapshot
// rather than being looked up again later.
export interface WordContext {
  en: string
  target?: string
  source?: string
  capture_id?: string
}

// A card teaches ONE sense, so "run" can sit in the review book several times — once per
// meaning the learner actually met. `definitions` is the shape cards had before that
// split; those keep rendering as they were rather than being migrated, since picking one
// of their senses on the learner's behalf would silently drop the others.
export interface WordSnapshot {
  lemma: string
  phonetic_uk: string
  phonetic_us: string
  sense?: Definition
  definitions?: Definition[]
  contexts?: WordContext[]
}

// A passage the learner pasted or shared in, kept so its cards can point back at where
// they came from — and so the passage can be reopened and mined again later.
export interface Capture {
  id: string
  text: string
  source?: string
  chunks?: string[]
  created_at: number
}

export function snapshotSenses(snap: WordSnapshot): Definition[] {
  return snap.sense ? [snap.sense] : snap.definitions ?? []
}

export interface SentenceSnapshot {
  source_text: string
  casual_en: string
  formal_en: string
  idiomatic_en: string
}

export interface ReviewLog {
  id: string
  item_id: string
  rating: 'again' | 'hard' | 'good' | 'easy'
  prev_interval: number
  new_interval: number
  reviewed_at: number
}

export interface Setting {
  key: string
  value: string
}

class GlossyDB extends Dexie {
  word_cache!: Table<WordCache, string>
  translation_cache!: Table<TranslationCache, string>
  history!: Table<HistoryItem, string>
  review_items!: Table<ReviewItem, string>
  review_logs!: Table<ReviewLog, string>
  settings!: Table<Setting, string>
  captures!: Table<Capture, string>

  constructor() {
    super('lexi')
    // v1 stays exactly as it shipped. Editing it in place would not trigger an upgrade,
    // so existing installs would never get the new store.
    this.version(1).stores({
      word_cache: 'lemma, created_at',
      translation_cache: 'source_hash, created_at',
      history: 'id, queried_at, type, ref_key',
      review_items: 'id, due_at, type, added_at',
      review_logs: 'id, item_id, reviewed_at',
      settings: 'key',
    })
    // v2 adds `captures` — passages read in the Read tab. Nothing else changes, and no
    // upgrade function is needed: existing rows are untouched by a new store.
    this.version(2).stores({
      word_cache: 'lemma, created_at',
      translation_cache: 'source_hash, created_at',
      history: 'id, queried_at, type, ref_key',
      review_items: 'id, due_at, type, added_at',
      review_logs: 'id, item_id, reviewed_at',
      settings: 'key',
      captures: 'id, created_at',
    })
  }
}

export const db = new GlossyDB()

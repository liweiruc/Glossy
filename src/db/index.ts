import Dexie, { type Table } from 'dexie'

export interface WordCache {
  lemma: string
  queried_form: string
  phonetic_uk: string
  phonetic_us: string
  audio_url_uk?: string
  audio_url_us?: string
  definitions: Definition[]
  created_at: number
}

export interface Definition {
  pos: string
  en: string
  cn: string
  examples: Example[]
}

export interface Example {
  en: string
  cn: string
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

export interface WordSnapshot {
  lemma: string
  phonetic_uk: string
  phonetic_us: string
  definitions: Definition[]
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

  constructor() {
    super('lexi')
    this.version(1).stores({
      word_cache: 'lemma, created_at',
      translation_cache: 'source_hash, created_at',
      history: 'id, queried_at, type, ref_key',
      review_items: 'id, due_at, type, added_at',
      review_logs: 'id, item_id, reviewed_at',
      settings: 'key',
    })
  }
}

export const db = new GlossyDB()

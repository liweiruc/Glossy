import { db, snapshotSenses } from './index'
import type {
  ReviewItem, ReviewLog, HistoryItem, WordSnapshot, SentenceSnapshot, Definition, WordCache,
} from './index'
import type { SM2Result } from '../algorithms/sm2'
import { firebaseAuth } from '../firebase'
import { startOfTomorrow } from '../utils/time'
import {
  pushReviewItem,
  updateReviewItemInFirestore,
  pushReviewLog,
  deleteReviewItemFromFirestore,
  deleteHistoryItemFromFirestore,
} from './firestore-sync'

function uid(): string | null {
  return firebaseAuth.currentUser?.uid ?? null
}

export async function getDueItems(): Promise<ReviewItem[]> {
  return db.review_items.where('due_at').below(startOfTomorrow()).toArray()
}

export async function getDueCount(): Promise<number> {
  return db.review_items.where('due_at').below(startOfTomorrow()).count()
}

export async function getReviewItems(): Promise<ReviewItem[]> {
  return db.review_items.orderBy('added_at').reverse().toArray()
}

export async function updateItemAfterRating(id: string, result: SM2Result): Promise<void> {
  const update = {
    ease_factor: result.ease_factor,
    interval_days: result.interval_days,
    repetitions: result.repetitions,
    due_at: result.due_at,
    last_reviewed_at: result.last_reviewed_at,
  }
  await db.review_items.update(id, update)
  const u = uid()
  if (u) updateReviewItemInFirestore(u, id, update).catch(e => console.error('[Firestore sync]', e))
}

export async function addReviewLog(log: Omit<ReviewLog, 'id'>): Promise<void> {
  const full: ReviewLog = { id: crypto.randomUUID(), ...log }
  await db.review_logs.add(full)
  const u = uid()
  if (u) pushReviewLog(u, full).catch(e => console.error('[Firestore sync]', e))
}

export async function addReviewItem(item: ReviewItem): Promise<void> {
  await db.review_items.add(item)
  const u = uid()
  if (u) pushReviewItem(u, item).catch(e => console.error('[Firestore sync]', e))
}

// A card is one sense of one word, so identity is the word plus that sense's wording.
// Regenerating an entry rewords its senses, and a reworded sense counts as a new card —
// the existing one keeps the wording the learner actually studied.
export function senseKey(lemma: string, def: Pick<Definition, 'pos' | 'en'>): string {
  return `${lemma}::${def.pos}::${def.en}`
}

// Which senses of this word are already in the review book. A card from before the
// per-sense split covers every sense it holds, so it contributes one key per definition.
export async function getAddedSenseKeys(lemma: string): Promise<Set<string>> {
  const items = await db.review_items
    .filter(r => r.type === 'word' && (r.snapshot as WordSnapshot).lemma === lemma)
    .toArray()

  const keys = new Set<string>()
  for (const item of items) {
    for (const def of snapshotSenses(item.snapshot as WordSnapshot)) {
      keys.add(senseKey(lemma, def))
    }
  }
  return keys
}

// Adds one sense as its own card. Returns the id so the caller can offer an undo.
export async function addWordSense(
  word: Pick<WordCache, 'lemma' | 'phonetic_uk' | 'phonetic_us'>,
  sense: Definition,
): Promise<string> {
  const now = Date.now()
  const id = crypto.randomUUID()
  await addReviewItem({
    id,
    type: 'word',
    snapshot: {
      lemma: word.lemma,
      phonetic_uk: word.phonetic_uk,
      phonetic_us: word.phonetic_us,
      sense,
    },
    ease_factor: 2.5,
    interval_days: 0,
    repetitions: 0,
    due_at: now,
    added_at: now,
    last_reviewed_at: null,
  })
  return id
}

export async function deleteReviewItem(id: string): Promise<void> {
  await db.review_items.delete(id)
  const u = uid()
  if (u) deleteReviewItemFromFirestore(u, id).catch(e => console.error('[Firestore sync]', e))
}

// Removes the history row and nothing else: the cached lookup (shared with all
// users) and any review_item built from it both survive.
export async function deleteHistoryItem(id: string): Promise<void> {
  await db.history.delete(id)
  const u = uid()
  if (u) deleteHistoryItemFromFirestore(u, id).catch(e => console.error('[Firestore sync]', e))
}

export async function getHistory(): Promise<HistoryItem[]> {
  return db.history.orderBy('queried_at').reverse().toArray()
}

export async function isInReviewBook(refKey: string): Promise<boolean> {
  const wordMatch = await db.review_items
    .filter(r => r.type === 'word' && (r.snapshot as WordSnapshot).lemma === refKey)
    .first()
  if (wordMatch) return true

  const cache = await db.translation_cache.get(refKey)
  if (!cache) return false
  const sentenceMatch = await db.review_items
    .filter(r => r.type === 'sentence' && (r.snapshot as SentenceSnapshot).source_text === cache.source_text)
    .first()
  return !!sentenceMatch
}

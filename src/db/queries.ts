import { db } from './index'
import type { ReviewItem, ReviewLog, HistoryItem, WordSnapshot, SentenceSnapshot } from './index'
import type { SM2Result } from '../algorithms/sm2'
import { firebaseAuth } from '../firebase'
import {
  pushReviewItem,
  updateReviewItemInFirestore,
  pushReviewLog,
} from './firestore-sync'

function uid(): string | null {
  return firebaseAuth.currentUser?.uid ?? null
}

export async function getDueItems(): Promise<ReviewItem[]> {
  return db.review_items.where('due_at').belowOrEqual(Date.now()).toArray()
}

export async function getDueCount(): Promise<number> {
  return db.review_items.where('due_at').belowOrEqual(Date.now()).count()
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

import {
  doc, getDoc, setDoc, collection, getDocs, writeBatch,
  type WriteBatch,
} from 'firebase/firestore'
import { firestore } from '../firebase'
import { db } from './index'
import type { WordCache, TranslationCache, HistoryItem, ReviewItem, ReviewLog } from './index'

// ── Shared caches ────────────────────────────────────────────────────────────

export async function getWordFromFirestore(lemma: string): Promise<WordCache | null> {
  const snap = await getDoc(doc(firestore, 'word_cache', lemma))
  return snap.exists() ? (snap.data() as WordCache) : null
}

export async function putWordToFirestore(word: WordCache): Promise<void> {
  await setDoc(doc(firestore, 'word_cache', word.lemma), word)
}

export async function getTranslationFromFirestore(hash: string): Promise<TranslationCache | null> {
  const snap = await getDoc(doc(firestore, 'translation_cache', hash))
  return snap.exists() ? (snap.data() as TranslationCache) : null
}

export async function putTranslationToFirestore(t: TranslationCache): Promise<void> {
  await setDoc(doc(firestore, 'translation_cache', t.source_hash), t)
}

// ── Per-user data ─────────────────────────────────────────────────────────────

function userCol(uid: string, name: string) {
  return collection(firestore, 'users', uid, name)
}

export async function syncUserDataFromFirestore(uid: string): Promise<void> {
  const [historySnap, itemsSnap, logsSnap] = await Promise.all([
    getDocs(userCol(uid, 'history')),
    getDocs(userCol(uid, 'review_items')),
    getDocs(userCol(uid, 'review_logs')),
  ])

  const history = historySnap.docs.map(d => d.data() as HistoryItem)
  const items = itemsSnap.docs.map(d => d.data() as ReviewItem)
  const logs = logsSnap.docs.map(d => d.data() as ReviewLog)

  await Promise.all([
    db.history.bulkPut(history),
    db.review_items.bulkPut(items),
    db.review_logs.bulkPut(logs),
  ])
}

export async function pushHistoryItem(uid: string, item: HistoryItem): Promise<void> {
  await setDoc(doc(userCol(uid, 'history'), item.id), item)
}

export async function pushReviewItem(uid: string, item: ReviewItem): Promise<void> {
  await setDoc(doc(userCol(uid, 'review_items'), item.id), item)
}

export async function updateReviewItemInFirestore(
  uid: string,
  id: string,
  data: Partial<ReviewItem>,
): Promise<void> {
  const batch = writeBatch(firestore)
  batch.update(doc(userCol(uid, 'review_items'), id), data as Record<string, unknown>)
  await batch.commit()
}

export async function pushReviewLog(uid: string, log: ReviewLog): Promise<void> {
  await setDoc(doc(userCol(uid, 'review_logs'), log.id), log)
}

// Upload all local IndexedDB data to Firestore (idempotent, used on login as safety net).
// Chunks writes to respect Firestore's 500-operations-per-batch limit.
export async function uploadLocalDataToFirestore(uid: string): Promise<void> {
  const [history, items, logs] = await Promise.all([
    db.history.toArray(),
    db.review_items.toArray(),
    db.review_logs.toArray(),
  ])

  type Op = (b: WriteBatch) => void
  const ops: Op[] = [
    ...history.map(h => (b: WriteBatch) => b.set(doc(userCol(uid, 'history'), h.id), h as Record<string, unknown>)),
    ...items.map(i => (b: WriteBatch) => b.set(doc(userCol(uid, 'review_items'), i.id), i as Record<string, unknown>)),
    ...logs.map(l => (b: WriteBatch) => b.set(doc(userCol(uid, 'review_logs'), l.id), l as Record<string, unknown>)),
  ]

  if (ops.length === 0) return

  const CHUNK = 400
  for (let i = 0; i < ops.length; i += CHUNK) {
    const b = writeBatch(firestore)
    ops.slice(i, i + CHUNK).forEach(op => op(b))
    await b.commit()
  }
}

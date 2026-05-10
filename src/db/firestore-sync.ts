import {
  doc, getDoc, setDoc, deleteDoc, collection, getDocs, writeBatch,
  onSnapshot,
  type WriteBatch, type Unsubscribe,
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

export async function pushHistoryItem(uid: string, item: HistoryItem): Promise<void> {
  console.log('[sync] push history', item.id)
  await setDoc(doc(userCol(uid, 'history'), item.id), item)
}

export async function pushReviewItem(uid: string, item: ReviewItem): Promise<void> {
  console.log('[sync] push review_item', item.id)
  await setDoc(doc(userCol(uid, 'review_items'), item.id), item)
}

export async function updateReviewItemInFirestore(
  uid: string,
  id: string,
  data: Partial<ReviewItem>,
): Promise<void> {
  console.log('[sync] update review_item', id)
  await setDoc(doc(userCol(uid, 'review_items'), id), data, { merge: true })
}

export async function pushReviewLog(uid: string, log: ReviewLog): Promise<void> {
  console.log('[sync] push review_log', log.id)
  await setDoc(doc(userCol(uid, 'review_logs'), log.id), log)
}

export async function deleteReviewItemFromFirestore(uid: string, id: string): Promise<void> {
  console.log('[sync] delete review_item', id)
  await deleteDoc(doc(userCol(uid, 'review_items'), id))
}

// Server-roundtrip health check. setDoc+persistentLocalCache resolves on local write
// and silently swallows server rejections — this explicit getDocs hits the server and
// will throw "permission-denied" if the rules aren't deployed.
export async function verifyFirestoreAccess(uid: string): Promise<boolean> {
  try {
    await getDocs(userCol(uid, 'history'))
    console.log('[sync] ✓ Firestore access OK')
    return true
  } catch (e) {
    console.error(
      '[sync] ✗ Firestore access FAILED — most likely Firestore security rules are not deployed.',
      'Deploy with: firebase deploy --only firestore:rules',
      'Original error:', e,
    )
    return false
  }
}

// Push only items that are missing from the remote — non-destructive.
// The previous version used setDoc on every local item, which clobbered newer
// remote state with stale local copies whenever Device B logged in.
export async function pushLocalOnlyItems(uid: string): Promise<void> {
  const [remoteHistory, remoteItems, remoteLogs, localHistory, localItems, localLogs] =
    await Promise.all([
      getDocs(userCol(uid, 'history')),
      getDocs(userCol(uid, 'review_items')),
      getDocs(userCol(uid, 'review_logs')),
      db.history.toArray(),
      db.review_items.toArray(),
      db.review_logs.toArray(),
    ])

  const remoteHistoryIds = new Set(remoteHistory.docs.map(d => d.id))
  const remoteItemIds = new Set(remoteItems.docs.map(d => d.id))
  const remoteLogIds = new Set(remoteLogs.docs.map(d => d.id))

  const newHistory = localHistory.filter(h => !remoteHistoryIds.has(h.id))
  const newItems = localItems.filter(i => !remoteItemIds.has(i.id))
  const newLogs = localLogs.filter(l => !remoteLogIds.has(l.id))

  console.log('[sync] uploading local-only items', {
    history: newHistory.length,
    review_items: newItems.length,
    review_logs: newLogs.length,
  })

  type Op = (b: WriteBatch) => void
  const ops: Op[] = [
    ...newHistory.map(h => (b: WriteBatch) => { b.set(doc(userCol(uid, 'history'), h.id), h) }),
    ...newItems.map(i => (b: WriteBatch) => { b.set(doc(userCol(uid, 'review_items'), i.id), i) }),
    ...newLogs.map(l => (b: WriteBatch) => { b.set(doc(userCol(uid, 'review_logs'), l.id), l) }),
  ]

  if (ops.length === 0) return

  const CHUNK = 400
  for (let i = 0; i < ops.length; i += CHUNK) {
    const b = writeBatch(firestore)
    ops.slice(i, i + CHUNK).forEach(op => op(b))
    await b.commit()
  }
}

// Real-time subscription. First snapshot delivers current state; subsequent fires
// are server-pushed deltas. Logs metadata so cross-device sync issues are visible
// in the browser console (fromCache=true means we're not connected to the server).
export function subscribeToUserData(uid: string): Unsubscribe {
  const onError = (e: unknown) => console.error('[sync listener]', e)

  console.log('[sync] subscribing for user', uid)

  const unsubHistory = onSnapshot(
    userCol(uid, 'history'),
    snap => {
      const puts: HistoryItem[] = []
      const deletes: string[] = []
      for (const change of snap.docChanges()) {
        if (change.type === 'removed') deletes.push(change.doc.id)
        else puts.push(change.doc.data() as HistoryItem)
      }
      console.log(
        `[sync history] fromCache=${snap.metadata.fromCache} pending=${snap.metadata.hasPendingWrites}`,
        `+${puts.length} -${deletes.length}`,
      )
      Promise.all([
        puts.length ? db.history.bulkPut(puts) : Promise.resolve(),
        deletes.length ? db.history.bulkDelete(deletes) : Promise.resolve(),
      ]).catch(onError)
    },
    onError,
  )

  const unsubItems = onSnapshot(
    userCol(uid, 'review_items'),
    snap => {
      const puts: ReviewItem[] = []
      const deletes: string[] = []
      for (const change of snap.docChanges()) {
        if (change.type === 'removed') deletes.push(change.doc.id)
        else puts.push(change.doc.data() as ReviewItem)
      }
      console.log(
        `[sync review_items] fromCache=${snap.metadata.fromCache} pending=${snap.metadata.hasPendingWrites}`,
        `+${puts.length} -${deletes.length}`,
      )
      Promise.all([
        puts.length ? db.review_items.bulkPut(puts) : Promise.resolve(),
        deletes.length ? db.review_items.bulkDelete(deletes) : Promise.resolve(),
      ]).catch(onError)
    },
    onError,
  )

  const unsubLogs = onSnapshot(
    userCol(uid, 'review_logs'),
    snap => {
      const puts: ReviewLog[] = []
      const deletes: string[] = []
      for (const change of snap.docChanges()) {
        if (change.type === 'removed') deletes.push(change.doc.id)
        else puts.push(change.doc.data() as ReviewLog)
      }
      console.log(
        `[sync review_logs] fromCache=${snap.metadata.fromCache} pending=${snap.metadata.hasPendingWrites}`,
        `+${puts.length} -${deletes.length}`,
      )
      Promise.all([
        puts.length ? db.review_logs.bulkPut(puts) : Promise.resolve(),
        deletes.length ? db.review_logs.bulkDelete(deletes) : Promise.resolve(),
      ]).catch(onError)
    },
    onError,
  )

  return () => {
    console.log('[sync] unsubscribing for user', uid)
    unsubHistory()
    unsubItems()
    unsubLogs()
  }
}

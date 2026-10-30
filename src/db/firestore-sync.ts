import {
  doc, getDoc, setDoc, deleteDoc, collection, getDocs, getDocsFromServer, writeBatch,
  onSnapshot, deleteField, waitForPendingWrites,
  type WriteBatch, type Unsubscribe,
} from 'firebase/firestore'
import type { Table } from 'dexie'
import { firestore } from '../firebase'
import { db } from './index'
import type { WordCache, TranslationCache, HistoryItem, ReviewItem, ReviewLog, Capture } from './index'
import type { ReviewSettings } from './settings'
import { needsReset, newSchedule } from '../algorithms/fsrs'
import type { Schedule } from '../algorithms/fsrs'

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

// The fields cards had under SM-2. Every write of an FSRS schedule deletes them.
const DROP_SM2 = {
  ease_factor: deleteField(),
  interval_days: deleteField(),
  repetitions: deleteField(),
}

export async function updateReviewScheduleInFirestore(
  uid: string,
  id: string,
  schedule: Schedule,
): Promise<void> {
  console.log('[sync] update review_item', id)
  await setDoc(doc(userCol(uid, 'review_items'), id), { ...schedule, ...DROP_SM2 }, { merge: true })
}

export async function pushCapture(uid: string, capture: Capture): Promise<void> {
  console.log('[sync] push capture', capture.id)
  await setDoc(doc(userCol(uid, 'captures'), capture.id), capture)
}

export async function updateCaptureInFirestore(
  uid: string,
  id: string,
  data: Partial<Capture>,
): Promise<void> {
  console.log('[sync] update capture', id)
  await setDoc(doc(userCol(uid, 'captures'), id), data, { merge: true })
}

export async function deleteCaptureFromFirestore(uid: string, id: string): Promise<void> {
  console.log('[sync] delete capture', id)
  await deleteDoc(doc(userCol(uid, 'captures'), id))
}

export async function pushReviewLog(uid: string, log: ReviewLog): Promise<void> {
  console.log('[sync] push review_log', log.id)
  await setDoc(doc(userCol(uid, 'review_logs'), log.id), log)
}

export async function deleteReviewLogFromFirestore(uid: string, id: string): Promise<void> {
  console.log('[sync] delete review_log', id)
  await deleteDoc(doc(userCol(uid, 'review_logs'), id))
}

export async function deleteReviewItemFromFirestore(uid: string, id: string): Promise<void> {
  console.log('[sync] delete review_item', id)
  await deleteDoc(doc(userCol(uid, 'review_items'), id))
}

// The learner's review settings are one document, mirrored into `settings` under this key
// so they are read like the rest of the data. The key carries the user: another account
// signed in on this device must not inherit them.
export const reviewSettingsKey = (uid: string) => `review_settings:${uid}`

function reviewSettingsDoc(uid: string) {
  return doc(firestore, 'users', uid, 'prefs', 'review')
}

export async function pushReviewSettings(uid: string, settings: ReviewSettings): Promise<void> {
  console.log('[sync] push review settings')
  await setDoc(reviewSettingsDoc(uid), settings)
}

// Until the learner changes something there is no document, and the defaults apply.
function subscribeReviewSettings(uid: string): Unsubscribe {
  const onError = (e: unknown) => console.error('[sync prefs]', e)
  return onSnapshot(
    reviewSettingsDoc(uid),
    snap => {
      if (!snap.exists()) return
      db.settings.put({ key: reviewSettingsKey(uid), value: JSON.stringify(snap.data()) }).catch(onError)
    },
    onError,
  )
}

// Deletes the history record only. Never touches word_cache/translation_cache —
// those are shared across every user (see firestore.rules), so cascading a delete
// there would wipe another user's cached lookup.
export async function deleteHistoryItemFromFirestore(uid: string, id: string): Promise<void> {
  console.log('[sync] delete history', id)
  await deleteDoc(doc(userCol(uid, 'history'), id))
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

// Marks that this device has completed its one-time upload of pre-existing local
// data for this user. Stored in IndexedDB (not localStorage) so it can never be
// cleared independently of the data it guards.
const bootstrapKey = (uid: string) => `bootstrapped:${uid}`

async function isBootstrapped(uid: string): Promise<boolean> {
  return !!(await db.settings.get(bootstrapKey(uid)))
}

// One-time migration of data created before this device logged in. NOT the offline
// mechanism — persistentLocalCache already queues and retries writes from
// pushHistoryItem/pushReviewItem, so ongoing sync does not depend on this.
//
// It runs only once per device+user: re-running it would resurrect items deleted on
// another device, because a local row absent from the remote is indistinguishable
// from a row that was never uploaded.
export async function pushLocalOnlyItems(uid: string): Promise<void> {
  if (await isBootstrapped(uid)) {
    console.log('[sync] device already bootstrapped — skipping local-only push')
    return
  }

  const [
    remoteHistory, remoteItems, remoteLogs, remoteCaptures,
    localHistory, localItems, localLogs, localCaptures,
  ] = await Promise.all([
    getDocs(userCol(uid, 'history')),
    getDocs(userCol(uid, 'review_items')),
    getDocs(userCol(uid, 'review_logs')),
    getDocs(userCol(uid, 'captures')),
    db.history.toArray(),
    db.review_items.toArray(),
    db.review_logs.toArray(),
    db.captures.toArray(),
  ])

  const remoteHistoryIds = new Set(remoteHistory.docs.map(d => d.id))
  const remoteItemIds = new Set(remoteItems.docs.map(d => d.id))
  const remoteLogIds = new Set(remoteLogs.docs.map(d => d.id))
  const remoteCaptureIds = new Set(remoteCaptures.docs.map(d => d.id))

  const newHistory = localHistory.filter(h => !remoteHistoryIds.has(h.id))
  const newItems = localItems.filter(i => !remoteItemIds.has(i.id))
  const newLogs = localLogs.filter(l => !remoteLogIds.has(l.id))
  const newCaptures = localCaptures.filter(c => !remoteCaptureIds.has(c.id))

  console.log('[sync] uploading local-only items', {
    history: newHistory.length,
    review_items: newItems.length,
    review_logs: newLogs.length,
    captures: newCaptures.length,
  })

  await commitInBatches([
    ...newHistory.map(h => (b: WriteBatch) => { b.set(doc(userCol(uid, 'history'), h.id), h) }),
    ...newItems.map(i => (b: WriteBatch) => { b.set(doc(userCol(uid, 'review_items'), i.id), i) }),
    ...newLogs.map(l => (b: WriteBatch) => { b.set(doc(userCol(uid, 'review_logs'), l.id), l) }),
    ...newCaptures.map(c => (b: WriteBatch) => { b.set(doc(userCol(uid, 'captures'), c.id), c) }),
  ])

  // Only after every batch has been acknowledged — a throw above leaves the device
  // un-bootstrapped so the upload is retried on the next login.
  await db.settings.put({ key: bootstrapKey(uid), value: String(Date.now()) })
}

type Op = (b: WriteBatch) => void

async function commitInBatches(ops: Op[]): Promise<void> {
  const CHUNK = 400
  for (let i = 0; i < ops.length; i += CHUNK) {
    const b = writeBatch(firestore)
    ops.slice(i, i + CHUNK).forEach(op => op(b))
    await b.commit()
  }
}

const fsrsResetKey = (uid: string) => `fsrs_reset:${uid}`

// The switch from SM-2 to FSRS started every card over: each becomes new again, and every
// SM-2 review log is deleted. Cards keep their words, senses and sentences.
//
// Works on the server's copy, so it reaches what this device has never synced; the
// snapshot listener carries the result into IndexedDB. Only what still has the SM-2 shape
// is touched, so running on every device is harmless — and needed: a device that was
// offline, or still had an SM-2 build open, can write SM-2 ratings after another device
// has reset, and only that device can wait for its own queued writes.
//
// Runs after pushLocalOnlyItems, so whatever that uploads is reset too. A throw leaves the
// flag unset, and the reset is tried again on the next login.
export async function resetSchedulesForFsrs(uid: string): Promise<void> {
  if (await db.settings.get(fsrsResetKey(uid))) return

  // Ratings an SM-2 build queued while offline go first; otherwise they would land after
  // the reset and bring SM-2 schedules and logs back.
  await waitForPendingWrites(firestore)
  const [items, logs] = await Promise.all([
    getDocsFromServer(userCol(uid, 'review_items')),
    getDocsFromServer(userCol(uid, 'review_logs')),
  ])

  const cards = items.docs.filter(d => needsReset(d.data()))
  const oldLogs = logs.docs.filter(d => typeof d.data().state !== 'number')
  console.log('[sync] FSRS reset', { review_items: cards.length, review_logs: oldLogs.length })
  await commitInBatches([
    // update(), not a merge: a card deleted in the meantime fails the batch rather than
    // coming back as a schedule with no snapshot.
    ...cards.map(d => (b: WriteBatch) => {
      const added = d.data().added_at
      b.update(d.ref, { ...newSchedule(typeof added === 'number' ? added : Date.now()), ...DROP_SM2 })
    }),
    ...oldLogs.map(d => (b: WriteBatch) => { b.delete(d.ref) }),
  ])

  await db.settings.put({ key: fsrsResetKey(uid), value: String(Date.now()) })
}

// Mirrors one Firestore user collection into its local Dexie table.
function subscribeCollection<T extends { id: string }>(
  uid: string,
  name: string,
  table: Table<T, string>,
): Unsubscribe {
  const onError = (e: unknown) => console.error(`[sync ${name}]`, e)
  let reconciled = false

  return onSnapshot(
    userCol(uid, name),
    snap => {
      const puts: T[] = []
      const deletes: string[] = []
      for (const change of snap.docChanges()) {
        if (change.type === 'removed') deletes.push(change.doc.id)
        else puts.push(change.doc.data() as T)
      }

      const apply = async () => {
        // On the first server-authoritative snapshot of the session the remote set is
        // the truth, so drop local rows missing from it. Without this, an item deleted
        // on another device while this one was closed would linger forever: a fresh
        // listener reports only what currently exists, so no 'removed' change ever
        // fires for it.
        //
        // Both guards are load-bearing:
        //  - fromCache — an offline snapshot is served from Firestore's local cache
        //    and must never be mistaken for an empty remote.
        //  - isBootstrapped — before the one-time upload finishes, local rows are
        //    pending upload rather than remotely deleted; reconciling then would
        //    destroy exactly the data pushLocalOnlyItems is about to send.
        if (!reconciled && !snap.metadata.fromCache && await isBootstrapped(uid)) {
          reconciled = true
          const remoteIds = new Set(snap.docs.map(d => d.id))
          const stale = (await table.toCollection().primaryKeys())
            .filter(id => !remoteIds.has(id))
          if (stale.length) {
            console.log(`[sync ${name}] reconcile — dropping ${stale.length} local rows absent from server`)
            deletes.push(...stale)
          }
        }

        console.log(
          `[sync ${name}] fromCache=${snap.metadata.fromCache} pending=${snap.metadata.hasPendingWrites}`,
          `+${puts.length} -${deletes.length}`,
        )

        if (puts.length) await table.bulkPut(puts)
        if (deletes.length) await table.bulkDelete(deletes)
      }

      apply().catch(onError)
    },
    onError,
  )
}

// Real-time subscription. First snapshot delivers current state; subsequent fires
// are server-pushed deltas. Logs metadata so cross-device sync issues are visible
// in the browser console (fromCache=true means we're not connected to the server).
export function subscribeToUserData(uid: string): Unsubscribe {
  console.log('[sync] subscribing for user', uid)

  const unsubs = [
    subscribeCollection<HistoryItem>(uid, 'history', db.history),
    subscribeCollection<ReviewItem>(uid, 'review_items', db.review_items),
    subscribeCollection<ReviewLog>(uid, 'review_logs', db.review_logs),
    subscribeCollection<Capture>(uid, 'captures', db.captures),
    subscribeReviewSettings(uid),
  ]

  return () => {
    console.log('[sync] unsubscribing for user', uid)
    unsubs.forEach(u => u())
  }
}

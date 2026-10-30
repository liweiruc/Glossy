import { db, snapshotSenses } from './index'
import type {
  ReviewItem, ReviewLog, HistoryItem, WordSnapshot, SentenceSnapshot, Definition, WordCache,
  Capture, WordContext, TranslationCache,
} from './index'
import { newSchedule, scheduleOf, State, withSchedule } from '../algorithms/fsrs'
import type { Rating, Schedule } from '../algorithms/fsrs'
import { buildDailyQueue, cardKind, studyKey } from '../algorithms/queue'
import type { DailyQueue, QueueSettings, StudiedToday } from '../algorithms/queue'
import { firebaseAuth } from '../firebase'
import { startOfToday, startOfTomorrow } from '../utils/time'
import {
  pushReviewItem,
  updateReviewItemInFirestore,
  updateReviewScheduleInFirestore,
  pushReviewLog,
  deleteReviewLogFromFirestore,
  deleteReviewItemFromFirestore,
  deleteHistoryItemFromFirestore,
  pushCapture,
  updateCaptureInFirestore,
  deleteCaptureFromFirestore,
} from './firestore-sync'

function uid(): string | null {
  return firebaseAuth.currentUser?.uid ?? null
}

// Cards rated for the first time today: their logs say they were new when rated. A card
// deleted since still counts — it was learned today all the same.
function newDoneToday(todayLogs: ReviewLog[]): number {
  return new Set(todayLogs.filter(log => log.state === State.New).map(log => log.item_id)).size
}

// Which words (and sentence cards) have been asked today. Logs name their card, so each is
// looked up in `items`; a log whose card has since been deleted touches nothing.
function studiedToday(items: ReviewItem[], todayLogs: ReviewLog[]): StudiedToday {
  const byId = new Map(items.map(item => [item.id, item]))
  const touched = new Set<string>()
  for (const log of todayLogs) {
    const item = byId.get(log.item_id)
    if (item) touched.add(studyKey(item))
  }
  return {
    touched,
    newDone: newDoneToday(todayLogs),
    reviewsDone: todayLogs.filter(log => log.state === State.Review).length,
  }
}

// `cards` have been through withSchedule().
function todayQueue(cards: ReviewItem[], todayLogs: ReviewLog[], settings: QueueSettings): DailyQueue {
  const now = Date.now()
  const tomorrow = startOfTomorrow(now)
  return buildDailyQueue(
    cards.filter(item => item.due_at < tomorrow),
    studiedToday(cards, todayLogs),
    now,
    settings,
  )
}

function getTodayLogs(): Promise<ReviewLog[]> {
  return db.review_logs.where('reviewed_at').aboveOrEqual(startOfToday()).sortBy('reviewed_at')
}

export interface TodayQueue extends DailyQueue {
  studiedWords: Set<string> // lemmas that already have a card rated at least once
}

export async function getTodayQueue(settings: QueueSettings): Promise<TodayQueue> {
  const [items, todayLogs] = await Promise.all([db.review_items.toArray(), getTodayLogs()])
  const cards = items.map(withSchedule)
  const studiedWords = new Set(
    cards
      .filter(item => item.type === 'word' && item.last_reviewed_at != null)
      .map(item => (item.snapshot as WordSnapshot).lemma)
  )
  return { ...todayQueue(cards, todayLogs, settings), studiedWords }
}

export interface ReviewOverview {
  queue: DailyQueue
  reviewedToday: number
  learnedToday: number // cards rated for the first time today
  recalledToday: number | null // share of today's first answers not rated Again
  // Cards already studied that come up tomorrow, counting those held back today and the
  // reviews today's limit left out. New cards are left out: how many of those come is the
  // daily limit's call, not the calendar's.
  dueTomorrow: number
  streak: number
}

const DAY_MS = 86_400_000

// The Review tab's numbers, worked out from the cards the caller already holds plus the
// logs. Read-only: nothing here writes. A caller that has read every log already (the
// Stats tab) passes them in, oldest first, and they are not read again: with a year of
// reviews, that read is most of the time this takes.
export async function getReviewOverview(
  items: ReviewItem[],
  settings: QueueSettings,
  allLogs?: ReviewLog[],
): Promise<ReviewOverview> {
  const today = startOfToday()
  const [todayLogs, reviewTimes] = allLogs
    ? [
        allLogs.filter(log => log.reviewed_at >= today),
        allLogs.filter(log => log.reviewed_at > today - 400 * DAY_MS).map(log => log.reviewed_at),
      ]
    : await Promise.all([
        getTodayLogs(),
        db.review_logs.where('reviewed_at').above(today - 400 * DAY_MS).keys(),
      ])

  // A card's first answer of the day is the honest one: any later try comes right after
  // the answer was shown.
  const firsts = new Map<string, ReviewLog>()
  for (const log of todayLogs) if (!firsts.has(log.item_id)) firsts.set(log.item_id, log)

  const cards = items.map(withSchedule)
  const queue = todayQueue(cards, todayLogs, settings)
  // Whatever is in today's queue is assumed done today.
  const queued = new Set(queue.entries.map(entry => entry.item.id))
  const dayAfter = new Date(startOfTomorrow())
  dayAfter.setDate(dayAfter.getDate() + 1)

  return {
    queue,
    reviewedToday: todayLogs.length,
    learnedToday: newDoneToday(todayLogs),
    recalledToday: firsts.size
      ? [...firsts.values()].filter(log => log.rating !== 'again').length / firsts.size
      : null,
    dueTomorrow: cards.filter(item =>
      cardKind(item) !== 'new' && item.due_at < dayAfter.getTime() && !queued.has(item.id)
    ).length,
    streak: streakDays(reviewTimes as number[]),
  }
}

function dayKey(ts: number): string {
  const d = new Date(ts)
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`
}

// Days in a row with at least one review, counting back from today. Nothing yet today
// does not break the streak until the day is over.
function streakDays(reviewTimes: number[]): number {
  const days = new Set(reviewTimes.map(dayKey))
  const d = new Date()
  if (!days.has(dayKey(d.getTime()))) d.setDate(d.getDate() - 1)
  let streak = 0
  while (days.has(dayKey(d.getTime()))) {
    streak++
    d.setDate(d.getDate() - 1)
  }
  return streak
}

export async function getDueCount(): Promise<number> {
  return db.review_items.where('due_at').below(startOfTomorrow()).count()
}

export async function getReviewItems(): Promise<ReviewItem[]> {
  return db.review_items.orderBy('added_at').reverse().toArray()
}

const SM2_FIELDS = ['ease_factor', 'interval_days', 'repetitions']

// Writes a card's whole FSRS schedule, here and in Firestore, and drops the SM-2 fields a
// card not yet reset still carries: a card with both would read as needing the reset, and
// count as new again.
async function writeSchedule(id: string, schedule: Schedule): Promise<void> {
  await db.review_items.update(id, card => {
    Object.assign(card, schedule)
    for (const field of SM2_FIELDS) Reflect.deleteProperty(card, field)
  })
  const u = uid()
  if (u) updateReviewScheduleInFirestore(u, id, schedule).catch(e => console.error('[Firestore sync]', e))
}

export async function addReviewLog(log: Omit<ReviewLog, 'id'>): Promise<string> {
  const full: ReviewLog = { id: crypto.randomUUID(), ...log }
  await db.review_logs.add(full)
  const u = uid()
  if (u) pushReviewLog(u, full).catch(e => console.error('[Firestore sync]', e))
  return full.id
}

// One rating: the card's new schedule plus a log line, both synced. Returns the log's id
// so the session can take the rating back — or null if the card has been deleted on
// another device since the session began. Writing anyway would merge a bare schedule into
// Firestore and bring the card back without its snapshot.
export async function saveRating(item: ReviewItem, after: Schedule, rating: Rating): Promise<string | null> {
  if (!(await db.review_items.get(item.id))) return null
  await writeSchedule(item.id, after)
  return addReviewLog({
    item_id: item.id,
    rating,
    state: scheduleOf(item).state,
    reviewed_at: after.last_reviewed_at ?? Date.now(),
  })
}

// Takes a rating back: the card gets exactly the schedule it had before, and the log
// line goes, so neither its next due date nor today's numbers remember the rating.
export async function undoRating(before: ReviewItem, logId: string): Promise<void> {
  // Same reason as saveRating: never merge a schedule into a card deleted elsewhere.
  if (await db.review_items.get(before.id)) await writeSchedule(before.id, scheduleOf(before))
  await db.review_logs.delete(logId)
  const u = uid()
  if (u) deleteReviewLogFromFirestore(u, logId).catch(e => console.error('[Firestore sync]', e))
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

export async function addCapture(capture: Capture): Promise<void> {
  await db.captures.add(capture)
  const u = uid()
  if (u) pushCapture(u, capture).catch(e => console.error('[Firestore sync]', e))
}

export async function updateCapture(id: string, patch: Partial<Capture>): Promise<void> {
  await db.captures.update(id, patch)
  const u = uid()
  if (u) updateCaptureInFirestore(u, id, patch).catch(e => console.error('[Firestore sync]', e))
}

// Removes the passage only. Cards saved from it keep their sentence — the snapshot holds
// its own copy, exactly so a card never depends on anything outliving it.
export async function deleteCapture(id: string): Promise<void> {
  await db.captures.delete(id)
  const u = uid()
  if (u) deleteCaptureFromFirestore(u, id).catch(e => console.error('[Firestore sync]', e))
}

// A card built from a sentence the learner met, rather than from a dictionary entry.
// Meeting the same meaning again adds the new sentence to the existing card instead of
// making a second one: it is the same thing to learn, in one more situation.
export async function addContextCard(
  lemma: string,
  sense: Definition,
  context: WordContext,
): Promise<string> {
  const key = senseKey(lemma, sense)
  const cards = await db.review_items
    .filter(r => r.type === 'word' && (r.snapshot as WordSnapshot).lemma === lemma)
    .toArray()
  const existing = cards.find(card =>
    snapshotSenses(card.snapshot as WordSnapshot).some(def => senseKey(lemma, def) === key)
  )

  if (existing) {
    const snap = existing.snapshot as WordSnapshot
    const snapshot: WordSnapshot = { ...snap, contexts: [...(snap.contexts ?? []), context] }
    await db.review_items.update(existing.id, { snapshot })
    const u = uid()
    if (u) {
      updateReviewItemInFirestore(u, existing.id, { snapshot })
        .catch(e => console.error('[Firestore sync]', e))
    }
    return existing.id
  }

  const now = Date.now()
  const id = crypto.randomUUID()
  await addReviewItem({
    id,
    type: 'word',
    snapshot: { lemma, phonetic_uk: '', phonetic_us: '', sense, contexts: [context] },
    ...newSchedule(now),
    added_at: now,
  })
  return id
}

function newWordCard(
  word: Pick<WordCache, 'lemma' | 'phonetic_uk' | 'phonetic_us'>,
  sense: Definition,
  addedAt: number,
): ReviewItem {
  return {
    id: crypto.randomUUID(),
    type: 'word',
    snapshot: {
      lemma: word.lemma,
      phonetic_uk: word.phonetic_uk,
      phonetic_us: word.phonetic_us,
      sense,
    },
    ...newSchedule(addedAt),
    added_at: addedAt,
  }
}

// Adds one sense as its own card. Returns the id so the caller can offer an undo.
export async function addWordSense(
  word: Pick<WordCache, 'lemma' | 'phonetic_uk' | 'phonetic_us'>,
  sense: Definition,
): Promise<string> {
  const item = newWordCard(word, sense, Date.now())
  await addReviewItem(item)
  return item.id
}

export interface AddedSense {
  id: string
  sense: Definition
}

// "Add all": every sense not already in the review book, still one card each — the cards
// tapping each + would have made, not a way back to whole-word cards. Checks the book
// itself rather than the caller's view of it: a card can sync in from another device
// after a page loads, and a duplicate would be reviewed twice.
// Returns only what it added, so an undo takes back exactly this batch.
export async function addWordSenses(
  word: Pick<WordCache, 'lemma' | 'phonetic_uk' | 'phonetic_us'>,
  senses: Definition[],
): Promise<AddedSense[]> {
  const have = await getAddedSenseKeys(word.lemma)
  const fresh = senses.filter(sense => {
    const key = senseKey(word.lemma, sense)
    if (have.has(key)) return false
    have.add(key)
    return true
  })

  // A millisecond apart, so newest-first lists keep the entry's order.
  const now = Date.now()
  const items = fresh.map((sense, i) => newWordCard(word, sense, now - i))
  await db.review_items.bulkAdd(items)
  const u = uid()
  if (u) {
    for (const item of items) pushReviewItem(u, item).catch(e => console.error('[Firestore sync]', e))
  }
  return items.map((item, i) => ({ id: item.id, sense: fresh[i] }))
}

// A translation as a sentence card, with all three English versions on it. Returns false,
// adding nothing, when the sentence is already in the review book — it may have synced in
// from another device since the caller last looked.
export async function addTranslationCard(
  cache: Pick<TranslationCache, 'source_text' | 'casual_en' | 'formal_en' | 'idiomatic_en'>,
): Promise<boolean> {
  const existing = await db.review_items
    .filter(r => r.type === 'sentence' && (r.snapshot as SentenceSnapshot).source_text === cache.source_text)
    .first()
  if (existing) return false

  const now = Date.now()
  const snapshot: SentenceSnapshot = {
    source_text: cache.source_text,
    casual_en: cache.casual_en,
    formal_en: cache.formal_en,
    idiomatic_en: cache.idiomatic_en,
  }
  await addReviewItem({ id: crypto.randomUUID(), type: 'sentence', snapshot, ...newSchedule(now), added_at: now })
  return true
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

// Takes a word or a sentence out of the library: every lookup of it and every card made
// from it. Review logs stay, as they do for any deleted card — today's numbers still count
// them. The cached entry stays too: it is shared with every user.
export async function deleteLibraryEntry(historyIds: string[], cardIds: string[]): Promise<void> {
  await Promise.all([...historyIds.map(deleteHistoryItem), ...cardIds.map(deleteReviewItem)])
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

import type { ReviewItem, WordSnapshot } from '../db'
import { retrievability, State } from './fsrs'

export type CardKind = 'new' | 'learning' | 'review'

// Where a card stands in FSRS. Learning covers both a new card's first steps and the step
// a forgotten card goes back through. A card from the SM-2 days has no state, and counts
// as new until the reset gives it one.
export function cardKind(item: Pick<ReviewItem, 'state'>): CardKind {
  if (item.state === State.Learning || item.state === State.Relearning) return 'learning'
  return item.state === State.Review ? 'review' : 'new'
}

export type NewCardOrder = 'newest' | 'oldest'

// What the learner can tune about a day's cards in Settings → Review.
export interface QueueSettings {
  newPerDay: number
  reviewsPerDay: number
  newOrder: NewCardOrder
}

// 20 new cards a day: after the switch to FSRS every card started over as new, so without
// a cap the whole collection would be due on the same morning. 200 reviews is wordloom's.
export const DEFAULT_QUEUE: QueueSettings = { newPerDay: 20, reviewsPerDay: 200, newOrder: 'newest' }

// What a card asks the learner to recall. A word's senses are separate cards but one
// answer: once "strike" has filled one blank, every other blank for it reads "strike" too.
export function studyKey(item: Pick<ReviewItem, 'id' | 'type' | 'snapshot'>): string {
  return item.type === 'word'
    ? `word:${(item.snapshot as WordSnapshot).lemma.toLowerCase()}`
    : `card:${item.id}`
}

export interface QueueEntry {
  item: ReviewItem
  kind: CardKind
}

export interface DailyQueue {
  entries: QueueEntry[]
  learning: number
  reviews: number
  fresh: number
  // Due today, but held for tomorrow because another sense of the same word comes first.
  held: number
  // New cards left over once today's newPerDay have been introduced.
  newWaiting: number
  // Due reviews left over once today's reviewsPerDay have been asked.
  reviewsWaiting: number
}

export interface StudiedToday {
  touched: Set<string> // studyKey of every card rated today
  newDone: number // cards rated for the first time today
  reviewsDone: number // ratings of cards that were in review: what the review limit counts
}

// Spreads new cards evenly between reviews instead of saving them all for the end.
export function interleave<T>(reviews: T[], fresh: T[]): T[] {
  if (fresh.length === 0) return [...reviews]
  if (reviews.length === 0) return [...fresh]
  const out: T[] = []
  const every = reviews.length / (fresh.length + 1)
  let r = 0
  fresh.forEach((card, k) => {
    const upto = Math.round((k + 1) * every)
    while (r < upto) out.push(reviews[r++])
    out.push(card)
  })
  while (r < reviews.length) out.push(reviews[r++])
  return out
}

// Newest first: a word just looked up is the one wanted now, and "Add all" stamps a word's
// first sense latest, so its main sense leads. Oldest first works through the backlog in
// the order it was added, word by word — and within a word the sort is stable, so the main
// sense still leads.
function newCardOrder(cards: ReviewItem[], order: NewCardOrder): ReviewItem[] {
  const newest = [...cards].sort((a, b) => b.added_at - a.added_at)
  if (order === 'newest') return newest
  const firstAdded = new Map<string, number>()
  for (const card of cards) {
    const key = studyKey(card)
    firstAdded.set(key, Math.min(firstAdded.get(key) ?? Infinity, card.added_at))
  }
  return newest.sort((a, b) => firstAdded.get(studyKey(a))! - firstAdded.get(studyKey(b))!)
}

// Today's cards, in the order they come up. A word gets at most one card a day: the first
// sense asked gives the answer away for the rest, so they wait until tomorrow — except
// cards in their learning steps, which have to be seen again today. Nothing about a held
// card changes; it is simply not asked yet.
//
// `due` is every card due before tomorrow, read through withSchedule().
export function buildDailyQueue(
  due: ReviewItem[],
  today: StudiedToday,
  now: number,
  settings: QueueSettings,
): DailyQueue {
  const taken = new Set(today.touched)
  let held = 0

  const learning = due.filter(item => cardKind(item) === 'learning').sort((a, b) => a.due_at - b.due_at)
  for (const item of learning) taken.add(studyKey(item))

  // One card per word, up to `limit`. `over` counts the cards the limit left out.
  const firstPerWord = (items: ReviewItem[], limit: number) => {
    const picked: ReviewItem[] = []
    let over = 0
    for (const item of items) {
      const key = studyKey(item)
      if (taken.has(key)) held++
      else if (picked.length >= limit) over++
      else {
        taken.add(key)
        picked.push(item)
      }
    }
    return { picked, over }
  }
  // Reviews most forgotten first: FSRS knows which of today's cards is closest to slipping,
  // so the review limit leaves out the ones that can best afford to wait.
  const reviews = firstPerWord(
    due
      .filter(item => cardKind(item) === 'review')
      .map(item => ({ item, r: retrievability(item, now) }))
      .sort((a, b) => a.r - b.r)
      .map(({ item }) => item),
    Math.max(0, settings.reviewsPerDay - today.reviewsDone),
  )
  const fresh = firstPerWord(
    newCardOrder(due.filter(item => cardKind(item) === 'new'), settings.newOrder),
    Math.max(0, settings.newPerDay - today.newDone),
  )

  const as = (kind: CardKind) => (item: ReviewItem): QueueEntry => ({ item, kind })
  return {
    entries: [
      ...learning.map(as('learning')),
      ...interleave(reviews.picked.map(as('review')), fresh.picked.map(as('new'))),
    ],
    learning: learning.length,
    reviews: reviews.picked.length,
    fresh: fresh.picked.length,
    held,
    newWaiting: fresh.over,
    reviewsWaiting: reviews.over,
  }
}

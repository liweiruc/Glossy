import { db, snapshotSenses } from './index'
import type { ReviewItem, WordSnapshot } from './index'
import { getReviewOverview } from './queries'
import { getReviewSettings } from './settings'
import { entryStatus } from './library'
import { isMature, retrievability, State, withSchedule } from '../algorithms/fsrs'
import { cardKind } from '../algorithms/queue'
import { addDays, startOfDay, startOfWeek } from '../utils/time'

// How far back the activity charts reach. The 30-day view is the tail of these.
export const ACTIVITY_DAYS = 90
export const FORECAST_DAYS = 30
export const CALENDAR_WEEKS = 26

// A card forgotten this often is stubborn: more of the same reviews are unlikely to fix it.
const STUBBORN_LAPSES = 8
const HARDEST = 10

export interface DayActivity {
  day: number // local midnight
  due: number // answers to cards in review
  learning: number // answers to new cards and to cards in their learning or relearning steps
  fresh: number // of those, how many were a new card's first answer
  cards: number // cards answered that day
  recalled: number // of those, how many were not rated Again the first time
}

export interface CardCounts {
  new: number
  learning: number
  reviewing: number
  mastered: number
}

export interface StabilityBucket {
  name: string
  count: number
}

export interface HardWord {
  lemma: string
  meaning: string
  lapses: number // times a learned card of this word was forgotten
  reviews: number
  recalled: number // answers not rated Again
  stubborn: boolean
}

export interface Stats {
  wordsStudied: number
  wordsMastered: number
  streak: number
  longestStreak: number
  recallNow: number | null // the average chance of recall right now, over cards in review
  recallCards: number
  totalReviews: number
  daysStudied: number
  cards: CardCounts
  retention: { target: number; reviews: number; recalled: number }
  days: DayActivity[] // the last ACTIVITY_DAYS days, oldest first, today last
  calendar: { day: number; count: number }[] // from a Monday CALENDAR_WEEKS - 1 weeks back to today
  forecast: { day: number; count: number }[] // today first
  stability: StabilityBucket[]
  hardest: HardWord[]
}

// Stability is how long a card takes to fall from certain recall to 90%.
const STABILITY = [
  { name: 'Under a day', below: 1 },
  { name: '1–7 days', below: 7 },
  { name: '1–3 weeks', below: 21 },
  { name: '3 weeks – 3 months', below: 90 },
  { name: '3 months – 1 year', below: 365 },
  { name: 'Over a year', below: Infinity },
]

function emptyDay(day: number): DayActivity {
  return { day, due: 0, learning: 0, fresh: 0, cards: 0, recalled: 0 }
}

// The most days in a row with at least one answer.
function longestRun(days: number[]): number {
  let longest = 0
  let run = 0
  let previous = 0
  for (const day of [...days].sort((a, b) => a - b)) {
    run = run > 0 && addDays(previous, 1) === day ? run + 1 : 1
    longest = Math.max(longest, run)
    previous = day
  }
  return longest
}

interface Tally {
  reviews: number
  recalled: number
}

function hardWord(cards: ReviewItem[], answers: Map<string, Tally>): HardWord {
  const newest = [...cards].sort((a, b) => b.added_at - a.added_at)
  let reviews = 0
  let recalled = 0
  for (const card of cards) {
    reviews += answers.get(card.id)?.reviews ?? 0
    recalled += answers.get(card.id)?.recalled ?? 0
  }
  return {
    lemma: (newest[0].snapshot as WordSnapshot).lemma,
    meaning: newest.flatMap(card => snapshotSenses(card.snapshot as WordSnapshot)).map(sense => sense.en).join('; '),
    lapses: cards.reduce((sum, card) => sum + card.lapses, 0),
    reviews,
    recalled,
    stubborn: cards.some(card => card.lapses >= STUBBORN_LAPSES),
  }
}

// Every number on the Stats page, worked out from the cards and logs on this device.
// Read-only, like the Review tab's.
export async function loadStats(): Promise<Stats> {
  const [items, logs, settings] = await Promise.all([
    db.review_items.toArray(),
    // In key order and sorted here: walking the reviewed_at index takes twice as long.
    db.review_logs.toArray(),
    getReviewSettings(),
  ])
  logs.sort((a, b) => a.reviewed_at - b.reviewed_at)
  // Today's round, tomorrow's count and the streak, worked out exactly as the Review tab
  // does them.
  const overview = await getReviewOverview(items, settings, logs)
  const now = Date.now()
  const today = startOfDay(now)
  const cards = items.map(withSchedule)

  // Logs of cards deleted since still count, as they do on the Review tab.
  const byDay = new Map<number, DayActivity>()
  const answered = new Set<string>()
  const answers = new Map<string, Tally>()
  for (const log of logs) {
    const day = startOfDay(log.reviewed_at)
    const tally = byDay.get(day) ?? emptyDay(day)
    byDay.set(day, tally)
    if (log.state === State.Review) tally.due++
    else tally.learning++
    if (log.state === State.New) tally.fresh++
    // A card's first answer of the day is the honest one: any later try comes right after
    // the answer was shown.
    const key = `${day}:${log.item_id}`
    if (!answered.has(key)) {
      answered.add(key)
      tally.cards++
      if (log.rating !== 'again') tally.recalled++
    }

    const card = answers.get(log.item_id) ?? { reviews: 0, recalled: 0 }
    answers.set(log.item_id, card)
    card.reviews++
    if (log.rating !== 'again') card.recalled++
  }
  const dayOf = (day: number) => byDay.get(day) ?? emptyDay(day)

  const days = Array.from({ length: ACTIVITY_DAYS }, (_, i) => dayOf(addDays(today, i - ACTIVITY_DAYS + 1)))

  // Whole weeks, Monday first, ending with this one.
  const calendar: Stats['calendar'] = []
  for (let day = addDays(startOfWeek(today), -7 * (CALENDAR_WEEKS - 1)); day <= today; day = addDays(day, 1)) {
    const tally = dayOf(day)
    calendar.push({ day, count: tally.due + tally.learning })
  }

  // Whether a card was still remembered when it came due — what the target retention aims at.
  const monthAgo = addDays(today, -29)
  const reviewed = logs.filter(log => log.state === State.Review && log.reviewed_at >= monthAgo)

  const counts: CardCounts = { new: 0, learning: 0, reviewing: 0, mastered: 0 }
  const stability = STABILITY.map(({ name }) => ({ name, count: 0 }))
  let recallSum = 0
  let recallCards = 0
  for (const card of cards) {
    const kind = cardKind(card)
    if (kind === 'new') counts.new++
    else if (kind === 'learning') counts.learning++
    else if (isMature(card)) counts.mastered++
    else counts.reviewing++
    // Cards with a forgetting curve of their own: in review, or relearning after a lapse.
    if (card.state === State.Review || card.state === State.Relearning) {
      const bucket = stability[STABILITY.findIndex(b => card.stability < b.below)]
      if (bucket) bucket.count++
      recallSum += retrievability(card, now)
      recallCards++
    }
  }

  // Words gathered as the Library gathers them, so these counts match its filters.
  const words = new Map<string, ReviewItem[]>()
  for (const card of cards) {
    if (card.type !== 'word') continue
    const key = (card.snapshot as WordSnapshot).lemma.toLowerCase()
    words.set(key, [...(words.get(key) ?? []), card])
  }
  const statuses = [...words.values()].map(entryStatus)

  // Forgotten most, then remembered least. Three answers at least, so one slip on a new
  // word does not make the list, and one Again at least, so a word never missed stays off.
  const hardest = [...words.values()]
    .map(group => hardWord(group, answers))
    .filter(word => word.reviews >= 3 && word.recalled < word.reviews)
    .sort((a, b) =>
      b.lapses - a.lapses || a.recalled / a.reviews - b.recalled / b.reviews || b.reviews - a.reviews)
    .slice(0, HARDEST)

  // Today is what is left of today's round and tomorrow is the Review tab's own count,
  // which takes in cards held back today; from then on, the calendar. New cards are left
  // out: when they come is the daily limit's call.
  const forecast = Array.from({ length: FORECAST_DAYS }, (_, i) => ({ day: addDays(today, i), count: 0 }))
  forecast[0].count = overview.queue.learning + overview.queue.reviews
  forecast[1].count = overview.dueTomorrow
  const slot = new Map(forecast.map((d, i) => [d.day, i]))
  for (const card of cards) {
    const i = slot.get(startOfDay(card.due_at))
    if (i !== undefined && i >= 2 && cardKind(card) !== 'new') forecast[i].count++
  }

  return {
    wordsStudied: statuses.filter(status => status !== 'new').length,
    wordsMastered: statuses.filter(status => status === 'mastered').length,
    streak: overview.streak,
    longestStreak: longestRun([...byDay.keys()]),
    recallNow: recallCards ? recallSum / recallCards : null,
    recallCards,
    totalReviews: logs.length,
    daysStudied: byDay.size,
    cards: counts,
    retention: {
      target: settings.retention,
      reviews: reviewed.length,
      recalled: reviewed.filter(log => log.rating !== 'again').length,
    },
    days,
    calendar,
    forecast,
    stability,
    hardest,
  }
}

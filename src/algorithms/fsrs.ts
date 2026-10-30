import { createEmptyCard, fsrs, generatorParameters, Rating as Grade, State } from 'ts-fsrs'
import type { Card, FSRS, StepUnit } from 'ts-fsrs'
import type { ReviewItem } from '../db'

export { State }

export type Rating = 'again' | 'hard' | 'good' | 'easy'

const GRADES = { again: Grade.Again, hard: Grade.Hard, good: Grade.Good, easy: Grade.Easy } as const

// The scheduling the learner can tune in Settings → Review.
export interface SchedulerSettings {
  retention: number // the chance of recall a card is due at
  maxIntervalDays: number
  learningSteps: string[] // when a new card comes back on the day it is learned: "1m", "10m"
  relearningSteps: string[] // the same for a card that has been forgotten
}

// The same settings wordloom uses: 90% recall at review time, two learning steps for a new
// card and one for a forgotten one.
export const DEFAULT_SCHEDULER: SchedulerSettings = {
  retention: 0.9,
  maxIntervalDays: 36500,
  learningSteps: ['1m', '10m'],
  relearningSteps: ['10m'],
}

// Whole minutes, hours or days. ts-fsrs reads a step's number with parseInt, so "1.5h"
// would quietly be an hour.
const STEP = /^[1-9]\d*[mhd]$/

// A step list as typed in Settings ("1m 10m"), or null when any part of it is not a step.
// An empty list is a real choice: FSRS then schedules a card in days from its first answer.
export function parseSteps(text: string): string[] | null {
  const steps = text.split(/[\s,，]+/).filter(Boolean)
  return steps.every(step => STEP.test(step)) ? steps : null
}

let current: { key: string; scheduler: FSRS } | null = null

// Fuzz keeps cards learned together from all falling due on the same day.
function schedulerFor(s: SchedulerSettings): FSRS {
  const key = JSON.stringify([s.retention, s.maxIntervalDays, s.learningSteps, s.relearningSteps])
  if (current?.key !== key) {
    current = {
      key,
      scheduler: fsrs(generatorParameters({
        request_retention: s.retention,
        maximum_interval: s.maxIntervalDays,
        enable_fuzz: true,
        enable_short_term: true,
        learning_steps: s.learningSteps as StepUnit[],
        relearning_steps: s.relearningSteps as StepUnit[],
      })),
    }
  }
  return current.scheduler
}

// How likely recall is depends on the card and the model's weights alone — nothing in
// Settings changes it — so one scheduler serves every learner.
const curve = fsrs()

// A card's FSRS state as stored on it: ts-fsrs's Card, with its two dates as epoch ms.
export type Schedule = Pick<
  ReviewItem,
  | 'state' | 'stability' | 'difficulty' | 'elapsed_days' | 'scheduled_days'
  | 'learning_steps' | 'reps' | 'lapses' | 'due_at' | 'last_reviewed_at'
>

function toCard(s: Schedule): Card {
  return {
    due: new Date(s.due_at),
    stability: s.stability,
    difficulty: s.difficulty,
    elapsed_days: s.elapsed_days,
    scheduled_days: s.scheduled_days,
    learning_steps: s.learning_steps,
    reps: s.reps,
    lapses: s.lapses,
    state: s.state,
    last_review: s.last_reviewed_at == null ? undefined : new Date(s.last_reviewed_at),
  }
}

function fromCard(card: Card): Schedule {
  return {
    state: card.state,
    stability: card.stability,
    difficulty: card.difficulty,
    elapsed_days: card.elapsed_days,
    scheduled_days: card.scheduled_days,
    learning_steps: card.learning_steps,
    reps: card.reps,
    lapses: card.lapses,
    due_at: card.due.getTime(),
    last_reviewed_at: card.last_review ? card.last_review.getTime() : null,
  }
}

// A card that has never been rated. It is due from the moment it is added.
export function newSchedule(addedAt: number): Schedule {
  return fromCard(createEmptyCard(addedAt))
}

// Whether a stored card has to start over: it is from the SM-2 days and has no FSRS state,
// or an SM-2 build has since written its own fields over one (an old tab still open on
// another device). The one-time reset (resetSchedulesForFsrs) starts these cards over.
export function needsReset(card: { state?: unknown; due_at?: unknown }): boolean {
  return typeof card.state !== 'number' || 'ease_factor' in card || !Number.isFinite(card.due_at)
}

// The card as the scheduler sees it. Until the reset reaches a card that needs it, it
// counts as new — which is what the reset is about to make it. The SM-2 fields are left
// behind, or the copy would still need a reset after it has been rated.
export function withSchedule(item: ReviewItem): ReviewItem {
  if (!needsReset(item)) return item
  const { id, type, snapshot, added_at } = item
  return { id, type, snapshot, added_at, ...newSchedule(added_at) }
}

export function scheduleOf(item: ReviewItem): Schedule {
  const s = withSchedule(item)
  return {
    state: s.state,
    stability: s.stability,
    difficulty: s.difficulty,
    elapsed_days: s.elapsed_days,
    scheduled_days: s.scheduled_days,
    learning_steps: s.learning_steps,
    reps: s.reps,
    lapses: s.lapses,
    due_at: s.due_at,
    last_reviewed_at: s.last_reviewed_at,
  }
}

export type Preview = Record<Rating, Schedule>

// What each rating would make of the card at `now`.
export function previewRatings(item: ReviewItem, now: number, settings: SchedulerSettings): Preview {
  const record = schedulerFor(settings).repeat(toCard(scheduleOf(item)), now)
  return {
    again: fromCard(record[GRADES.again].card),
    hard: fromCard(record[GRADES.hard].card),
    good: fromCard(record[GRADES.good].card),
    easy: fromCard(record[GRADES.easy].card),
  }
}

// The chance the learner would recall the card at `now`, from its own forgetting curve.
// A card never reviewed has no curve yet.
export function retrievability(item: ReviewItem, now: number): number {
  const s = scheduleOf(item)
  if (s.state === State.New || s.last_reviewed_at == null || s.stability <= 0) return 0
  return curve.get_retrievability(toCard(s), now, false)
}

// A card is mature once FSRS expects it to hold for three weeks.
const MATURE_DAYS = 21

export function isMature(item: Pick<ReviewItem, 'state' | 'stability'>): boolean {
  return item.state === State.Review && item.stability >= MATURE_DAYS
}

// "<1m", "10m", "5h", "3d", "1.5mo", "2.1y"
export function formatInterval(ms: number): string {
  const minutes = ms / 60_000
  if (minutes < 1) return '<1m'
  if (minutes < 60) return `${Math.round(minutes)}m`
  const hours = minutes / 60
  if (hours < 24) return `${Math.round(hours)}h`
  const days = hours / 24
  if (days < 30) return `${Math.round(days)}d`
  if (days < 365) return `${Math.round((days / 30) * 10) / 10}mo`
  return `${Math.round((days / 365) * 10) / 10}y`
}

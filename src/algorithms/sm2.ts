import type { ReviewItem } from '../db'

export type Rating = 'again' | 'hard' | 'good' | 'easy'

export interface SM2Result {
  repetitions: number
  interval_days: number
  ease_factor: number
  due_at: number
  last_reviewed_at: number
}

function addDays(date: Date, days: number): Date {
  const result = new Date(date)
  result.setDate(result.getDate() + days)
  return result
}

export function applyRating(item: Pick<ReviewItem, 'repetitions' | 'interval_days' | 'ease_factor'>, rating: Rating): SM2Result {
  let { repetitions, interval_days: i, ease_factor: ef } = item

  if (rating === 'again') {
    repetitions = 0
    i = 0
    ef = Math.max(1.30, ef - 0.20)
  } else if (rating === 'hard') {
    repetitions += 1
    i = Math.max(1, Math.round(i * 1.2))
    ef = Math.max(1.30, ef - 0.15)
  } else if (rating === 'good') {
    repetitions += 1
    if (repetitions === 1) i = 1
    else if (repetitions === 2) i = 6
    else i = Math.round(i * ef)
  } else if (rating === 'easy') {
    repetitions += 1
    if (repetitions === 1) i = 1
    else if (repetitions === 2) i = 6
    else i = Math.round(i * ef)
    i = Math.round(i * 1.3)
    ef = ef + 0.15
  }

  const now = new Date()
  return {
    repetitions,
    interval_days: i,
    ease_factor: ef,
    due_at: addDays(now, i).getTime(),
    last_reviewed_at: now.getTime(),
  }
}

export function previewInterval(item: Pick<ReviewItem, 'repetitions' | 'interval_days' | 'ease_factor'>, rating: Rating): string {
  const result = applyRating(item, rating)
  const days = result.interval_days
  if (days === 0) return '<1m'
  if (days === 1) return '1d'
  if (days < 30) return `${days}d`
  const weeks = Math.round(days / 7)
  if (weeks < 8) return `${weeks}w`
  const months = Math.round(days / 30)
  return `${months}mo`
}

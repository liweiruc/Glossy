import { useLiveQuery } from 'dexie-react-hooks'
import { db } from './index'
import { firebaseAuth } from '../firebase'
import { pushReviewSettings, reviewSettingsKey } from './firestore-sync'
import { DEFAULT_SCHEDULER, parseSteps } from '../algorithms/fsrs'
import type { SchedulerSettings } from '../algorithms/fsrs'
import { DEFAULT_QUEUE } from '../algorithms/queue'
import type { QueueSettings } from '../algorithms/queue'

export type ChineseDisplay = 'always' | 'tap' | 'never'

const CHINESE_DISPLAY_KEY = 'chinese_display'
const DEFAULT_CHINESE_DISPLAY: ChineseDisplay = 'tap'

// English first is the whole point of the app, so Chinese waits behind a tap unless the
// learner asks otherwise. Lives in `settings`, which is local to this device and not
// synced — a display preference, not learning data.
export async function getChineseDisplay(): Promise<ChineseDisplay> {
  const row = await db.settings.get(CHINESE_DISPLAY_KEY)
  return row?.value === 'always' || row?.value === 'never' ? row.value : DEFAULT_CHINESE_DISPLAY
}

export async function setChineseDisplay(value: ChineseDisplay): Promise<void> {
  await db.settings.put({ key: CHINESE_DISPLAY_KEY, value })
}

export function useChineseDisplay(): ChineseDisplay {
  return useLiveQuery(getChineseDisplay, [], DEFAULT_CHINESE_DISPLAY)
}

// How review works, from Settings → Review. Unlike the Chinese display these are learning
// settings, so they belong to the account: every device builds the same day's cards and
// schedules them the same way. Firestore holds them (users/{uid}/prefs/review) and the
// listener mirrors them into `settings`.
export interface ReviewSettings extends SchedulerSettings, QueueSettings {
  autoSpeak: boolean // say the word on a new card's intro and when the answer is revealed
}

export const DEFAULT_REVIEW_SETTINGS: ReviewSettings = {
  ...DEFAULT_SCHEDULER,
  ...DEFAULT_QUEUE,
  autoSpeak: false,
}

// What Settings lets each number be.
export const REVIEW_LIMITS = {
  newPerDay: { min: 0, max: 500 },
  reviewsPerDay: { min: 0, max: 5000 },
  retention: { min: 0.8, max: 0.97 },
  maxIntervalDays: { min: 1, max: 36500 },
}

function clamp(value: unknown, { min, max }: { min: number; max: number }, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? Math.min(max, Math.max(min, value)) : fallback
}

function steps(value: unknown, fallback: string[]): string[] {
  if (!Array.isArray(value) || !value.every(step => typeof step === 'string')) return fallback
  return parseSteps(value.join(' ')) ?? fallback
}

// Whatever is stored is checked again on the way out: the document is written by whichever
// build each device runs, and one bad value must not stall the queue or the scheduler.
function normalizeReviewSettings(raw: unknown): ReviewSettings {
  const r: Record<string, unknown> = raw && typeof raw === 'object' ? { ...raw } : {}
  const d = DEFAULT_REVIEW_SETTINGS
  return {
    newPerDay: Math.round(clamp(r.newPerDay, REVIEW_LIMITS.newPerDay, d.newPerDay)),
    reviewsPerDay: Math.round(clamp(r.reviewsPerDay, REVIEW_LIMITS.reviewsPerDay, d.reviewsPerDay)),
    retention: Math.round(clamp(r.retention, REVIEW_LIMITS.retention, d.retention) * 100) / 100,
    maxIntervalDays: Math.round(clamp(r.maxIntervalDays, REVIEW_LIMITS.maxIntervalDays, d.maxIntervalDays)),
    learningSteps: steps(r.learningSteps, d.learningSteps),
    relearningSteps: steps(r.relearningSteps, d.relearningSteps),
    newOrder: r.newOrder === 'oldest' ? 'oldest' : 'newest',
    autoSpeak: typeof r.autoSpeak === 'boolean' ? r.autoSpeak : d.autoSpeak,
  }
}

function parseJson(text: string): unknown {
  try {
    return JSON.parse(text)
  } catch {
    return null
  }
}

async function readReviewSettings(uid: string | undefined): Promise<ReviewSettings> {
  const row = uid ? await db.settings.get(reviewSettingsKey(uid)) : undefined
  return normalizeReviewSettings(row ? parseJson(row.value) : null)
}

export function getReviewSettings(): Promise<ReviewSettings> {
  return readReviewSettings(firebaseAuth.currentUser?.uid)
}

// Applies on this device at once and reaches the others through Firestore. The whole set is
// written, already checked, so the document never holds a value a reader would discard.
// One transaction per change: two that land together — a number box left by tapping a
// switch — each build on the other instead of one undoing the other.
export async function setReviewSettings(patch: Partial<ReviewSettings>): Promise<void> {
  const uid = firebaseAuth.currentUser?.uid
  if (!uid) return
  const next = await db.transaction('rw', db.settings, async () => {
    const merged = normalizeReviewSettings({ ...(await readReviewSettings(uid)), ...patch })
    await db.settings.put({ key: reviewSettingsKey(uid), value: JSON.stringify(merged) })
    return merged
  })
  pushReviewSettings(uid, next).catch(e => console.error('[Firestore sync]', e))
}

// Undefined until the settings have been read.
export function useReviewSettings(): ReviewSettings | undefined {
  return useLiveQuery(getReviewSettings, [])
}

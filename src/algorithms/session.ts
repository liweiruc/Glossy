import type { ReviewItem, WordSnapshot } from '../db'
import { startOfTomorrow } from '../utils/time'
import { previewRatings } from './fsrs'
import type { Preview, Rating, Schedule, SchedulerSettings } from './fsrs'
import { cardKind } from './queue'
import type { CardKind, QueueEntry } from './queue'

export interface SessionDeps {
  // Writes one rating — the card's new schedule and a log line — and returns the log's id,
  // or null when the card no longer exists.
  save(item: ReviewItem, after: Schedule, rating: Rating): Promise<string | null>
  // Puts the card back exactly as `item` holds it and removes the log.
  restore(item: ReviewItem, logId: string): Promise<void>
  now(): number
}

interface SessionItem extends QueueEntry {
  // A new word card is shown whole first, and asked only after that.
  introduced: boolean
  // Not served again before this many cards have been served in total.
  holdUntil: number
}

interface UndoRecord {
  logId: string
  before: SessionItem
  recalled: boolean
  fresh: boolean
}

export interface StudyProgress {
  done: number
  newLeft: number
  reviewLeft: number
  learningLeft: number
}

export interface SessionSummary {
  reviewed: number
  recalled: number // rated anything but Again
  learned: number // new cards rated for the first time
  durationMs: number
  trouble: string[] // words rated Again this session
}

export type StudyStep =
  | { kind: 'intro' | 'ask'; item: ReviewItem; progress: StudyProgress; canUndo: boolean }
  | { kind: 'done'; summary: SessionSummary; canUndo: boolean }

// How long from now each rating would put the card off, in ms.
export type Intervals = Record<Rating, number>

// How many other cards come between a new card's intro and its first question — long
// enough that the answer is recalled, not echoed.
const INTRO_GAP = 3
// A learning card due within this window is shown early rather than ending the session.
const LEARN_AHEAD_MS = 20 * 60_000

// One sitting of review. The queue is fixed when the session starts; a card that lands in a
// learning step — a new card, or one just forgotten — goes back in and comes up again once
// the step is up. Every rating is written as it is made, and the undo stack can walk any
// number of them back, restoring each card as it was.
export class StudySession {
  private readonly queue: SessionItem[]
  private current: SessionItem | null = null
  // The schedules the answer side's buttons show, kept so a rating saves exactly those.
  private pending: { id: string; preview: Preview } | null = null
  private readonly undoStack: UndoRecord[] = []
  private served = 0
  private readonly startedAt: number
  private readonly dayEnd: number
  private readonly stats = { reviewed: 0, recalled: 0, learned: 0 }
  private readonly trouble = new Map<string, number>()
  private readonly deps: SessionDeps
  // The learner's scheduling, read once when the session starts.
  private readonly scheduling: SchedulerSettings

  constructor(deps: SessionDeps, entries: QueueEntry[], scheduling: SchedulerSettings) {
    this.deps = deps
    this.scheduling = scheduling
    this.queue = entries.map(e => ({
      ...e,
      introduced: e.kind !== 'new' || e.item.type !== 'word',
      holdUntil: 0,
    }))
    this.startedAt = deps.now()
    this.dayEnd = startOfTomorrow(this.startedAt)
  }

  step(): StudyStep {
    if (!this.current) this.current = this.takeNext()
    if (!this.current) return { kind: 'done', summary: this.summary(), canUndo: this.canUndo() }
    return {
      kind: this.current.introduced ? 'ask' : 'intro',
      item: this.current.item,
      progress: this.progress(),
      canUndo: this.canUndo(),
    }
  }

  // "Got it": the new card is asked once a few other cards have come between.
  continueIntro(): StudyStep {
    const entry = this.current
    if (!entry || entry.introduced) return this.step()
    entry.introduced = true
    entry.holdUntil = this.served + INTRO_GAP
    this.queue.splice(Math.min(INTRO_GAP, this.queue.length), 0, entry)
    this.current = null
    return this.step()
  }

  // The answer is on screen: works out what each rating would do, for the buttons to show.
  // rate() then saves exactly that — scheduling again on the tap would roll the fuzz anew,
  // and the card would not get the interval its button showed.
  reveal(): Intervals | null {
    const entry = this.current
    if (!entry) return null
    const now = this.deps.now()
    const preview = previewRatings(entry.item, now, this.scheduling)
    this.pending = { id: entry.item.id, preview }
    return {
      again: preview.again.due_at - now,
      hard: preview.hard.due_at - now,
      good: preview.good.due_at - now,
      easy: preview.easy.due_at - now,
    }
  }

  async rate(rating: Rating): Promise<StudyStep> {
    const entry = this.current
    if (!entry) return this.step()
    // "I know this" rates a new card from its intro, with no answer side shown.
    const preview = this.pending?.id === entry.item.id
      ? this.pending.preview
      : previewRatings(entry.item, this.deps.now(), this.scheduling)
    const after = preview[rating]
    const logId = await this.deps.save(entry.item, after, rating)
    this.pending = null
    this.current = null
    // Deleted on another device mid-session: nothing was written, so nothing to count.
    if (logId === null) return this.step()

    // Still in its steps and due again before the day is out: it comes back this session.
    if (cardKind(after) === 'learning' && after.due_at < this.dayEnd) {
      this.queue.push({
        item: { ...entry.item, ...after },
        kind: 'learning',
        introduced: true,
        holdUntil: 0,
      })
    }
    const recalled = rating !== 'again'
    const fresh = entry.kind === 'new'
    this.stats.reviewed++
    if (recalled) this.stats.recalled++
    else this.countTrouble(entry.item, 1)
    if (fresh) this.stats.learned++
    this.undoStack.push({ logId, before: { ...entry }, recalled, fresh })
    return this.step()
  }

  async undo(): Promise<StudyStep> {
    const record = this.undoStack.pop()
    if (!record) return this.step()
    await this.deps.restore(record.before.item, record.logId)

    // The rating may have put the card back in the queue for its next step, and that copy
    // may be waiting there or be on screen right now. The card is about to be asked as it
    // was before the rating, so the copy goes — otherwise it would come up twice.
    const id = record.before.item.id
    const copy = this.queue.findIndex(it => it.item.id === id)
    if (copy >= 0) this.queue.splice(copy, 1)
    if (this.current && this.current.item.id !== id) this.queue.unshift(this.current)
    this.current = record.before
    this.pending = null

    this.stats.reviewed--
    if (record.recalled) this.stats.recalled--
    else this.countTrouble(record.before.item, -1)
    if (record.fresh) this.stats.learned--
    return this.step()
  }

  private summary(): SessionSummary {
    return {
      ...this.stats,
      durationMs: this.deps.now() - this.startedAt,
      trouble: [...this.trouble.keys()],
    }
  }

  private canUndo(): boolean {
    return this.undoStack.length > 0
  }

  private progress(): StudyProgress {
    const items = this.current ? [this.current, ...this.queue] : this.queue
    const left = (kind: CardKind) => items.filter(it => it.kind === kind).length
    return {
      done: this.stats.reviewed,
      newLeft: left('new'),
      reviewLeft: left('review'),
      learningLeft: left('learning'),
    }
  }

  private takeNext(): SessionItem | null {
    const now = this.deps.now()
    // Reviews and new cards belong to the day, whatever hour FSRS put on them. Only a
    // learning step ("again in 10 minutes") waits for its time.
    const ready = (it: SessionItem) =>
      (it.kind !== 'learning' || it.item.due_at <= now) && it.holdUntil <= this.served
    const due = (i: number) => this.queue[i].item.due_at
    // A learning card that has come due goes before anything else: its step is timed.
    let index = -1
    this.queue.forEach((it, i) => {
      if (it.kind === 'learning' && ready(it) && (index < 0 || it.item.due_at < due(index))) index = i
    })
    if (index < 0) index = this.queue.findIndex(ready)
    // Nothing is ready: rather than end early, take whatever comes due soonest, as long as
    // that is soon.
    if (index < 0) {
      this.queue.forEach((it, i) => {
        if (it.item.due_at - now > LEARN_AHEAD_MS) return
        if (index < 0 || it.item.due_at < due(index)) index = i
      })
    }
    if (index < 0) return null
    const [entry] = this.queue.splice(index, 1)
    this.served++
    return entry
  }

  private countTrouble(item: ReviewItem, delta: number) {
    if (item.type !== 'word') return
    const lemma = (item.snapshot as WordSnapshot).lemma
    const count = (this.trouble.get(lemma) ?? 0) + delta
    if (count > 0) this.trouble.set(lemma, count)
    else this.trouble.delete(lemma)
  }
}

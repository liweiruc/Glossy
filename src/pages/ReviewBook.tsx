import { useNavigate } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { BookOpen, Flame, GraduationCap, PartyPopper } from 'lucide-react'
import { db } from '../db'
import { getReviewOverview } from '../db/queries'
import { getReviewSettings } from '../db/settings'
import { todayLabel } from '../utils/time'
import BottomNav from '../components/BottomNav'
import StatTile from '../components/StatTile'

function count(n: number, noun: string): string {
  return `${n} ${n === 1 ? noun : `${noun}s`}`
}

// Today's round and the day at a glance. The cards themselves are browsed in the Library.
export default function ReviewBook() {
  const navigate = useNavigate()

  const data = useLiveQuery(async () => {
    const [items, settings] = await Promise.all([db.review_items.toArray(), getReviewSettings()])
    return { items, settings, overview: await getReviewOverview(items, settings), today: todayLabel() }
  }, [])
  const items = data?.items ?? []
  const overview = data?.overview
  const queue = overview?.queue
  const settings = data?.settings

  const wordCount = items.filter(i => i.type === 'word').length
  const sentenceCount = items.filter(i => i.type === 'sentence').length
  const todo = queue?.entries.length ?? 0

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100dvh' }}>
      {/* AppBar */}
      <div style={{
        display: 'flex', alignItems: 'flex-end', gap: 10,
        padding: '12px 18px 10px', flexShrink: 0,
      }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14, color: 'var(--text-tertiary)', minHeight: 20 }}>{data?.today}</div>
          <div style={{ fontSize: 23, fontWeight: 500, color: 'var(--text-primary)' }}>Review</div>
        </div>
        {overview && overview.streak > 0 && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 5, flexShrink: 0,
            background: 'var(--amber-50)', color: 'var(--amber-700)',
            borderRadius: 8, padding: '5px 10px', fontSize: 14, fontWeight: 500,
          }}>
            <Flame size={15} />
            {overview.streak}-day streak
          </div>
        )}
      </div>

      {/* Body */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '0 18px', paddingBottom: 'calc(72px + env(safe-area-inset-bottom))' }}>
        {data && items.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '56px 12px' }}>
            <BookOpen size={36} color="var(--text-tertiary)" style={{ display: 'block', margin: '0 auto' }} />
            <div style={{ fontSize: 18, fontWeight: 500, color: 'var(--text-primary)', marginTop: 12 }}>
              Nothing to review yet
            </div>
            <div style={{ fontSize: 16, color: 'var(--text-secondary)', marginTop: 6, lineHeight: 1.5 }}>
              Look up a word and add a meaning — it shows up here, ready to practice.
            </div>
            <button
              onClick={() => navigate('/')}
              style={{
                marginTop: 18, background: 'var(--amber-600)', color: '#fff',
                border: 'none', borderRadius: 10, padding: '11px 22px',
                fontSize: 18, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit',
              }}
            >
              Look up a word
            </button>
          </div>
        ) : (
          <>
            {/* Today: what the next session holds */}
            <div style={{
              border: '0.5px solid var(--border-secondary)', borderRadius: 14,
              padding: 16, margin: '4px 0 12px',
            }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
                {([
                  ['Due', queue?.reviews],
                  ['New', queue?.fresh],
                  ['Learning', queue?.learning],
                ] as const).map(([label, n]) => (
                  <div key={label}>
                    <div style={{ fontSize: 14, color: 'var(--text-secondary)' }}>{label}</div>
                    <div style={{ fontSize: 36, fontWeight: 500, color: 'var(--text-primary)', lineHeight: 1.15, marginTop: 2 }}>
                      {n ?? '—'}
                    </div>
                  </div>
                ))}
              </div>

              {!queue ? (
                <div style={{ height: 46, marginTop: 16 }} />
              ) : todo > 0 ? (
                <button
                  onClick={() => navigate('/review/session')}
                  style={{
                    width: '100%', height: 46, marginTop: 16,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                    background: 'var(--amber-600)', color: '#fff',
                    border: 'none', borderRadius: 10,
                    fontSize: 18, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit',
                  }}
                >
                  <GraduationCap size={19} />
                  Start review
                </button>
              ) : (
                <div style={{
                  height: 46, marginTop: 16,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                  fontSize: 17, color: 'var(--text-secondary)',
                }}>
                  <PartyPopper size={18} color="var(--amber-600)" />
                  All done for today
                </div>
              )}

              {/* Cards that could be studied but are not in today's round, and why */}
              {queue && settings && (queue.held > 0 || queue.reviewsWaiting > 0 || queue.newWaiting > 0) && (
                <div style={{ fontSize: 14, color: 'var(--text-tertiary)', lineHeight: 1.45, marginTop: 10, textAlign: 'center' }}>
                  {queue.held > 0 && (
                    <div>
                      {queue.held === 1 ? '1 more meaning waits' : `${queue.held} more meanings wait`} for
                      tomorrow: one meaning per word a day
                    </div>
                  )}
                  {queue.reviewsWaiting > 0 && (
                    <div>
                      {queue.reviewsWaiting === 1 ? '1 more review waits' : `${queue.reviewsWaiting} more reviews wait`} for
                      tomorrow: {settings.reviewsPerDay} reviews a day
                    </div>
                  )}
                  {queue.newWaiting > 0 && (
                    <div>
                      {queue.newWaiting === 1 ? '1 more new card waits' : `${queue.newWaiting} more new cards wait`} for
                      later days: {settings.newPerDay} new a day
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* The day at a glance */}
            {overview && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 22 }}>
                <StatTile
                  label="Reviewed today"
                  value={overview.reviewedToday}
                  sub={`${overview.learnedToday} new`}
                />
                <StatTile
                  label="Recalled"
                  value={overview.recalledToday === null ? '—' : `${Math.round(overview.recalledToday * 100)}%`}
                  sub="first try today"
                />
                <StatTile
                  label="Tomorrow"
                  value={overview.dueTomorrow}
                  sub={overview.dueTomorrow === 1 ? 'card due' : 'cards due'}
                />
                <StatTile
                  label="Cards"
                  value={items.length}
                  sub={`${count(wordCount, 'word')} · ${count(sentenceCount, 'sentence')}`}
                />
              </div>
            )}
          </>
        )}
      </div>

      <BottomNav />
    </div>
  )
}

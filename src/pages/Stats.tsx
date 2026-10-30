import type { CSSProperties, ReactNode } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { ChartColumn } from 'lucide-react'
import { loadStats } from '../db/stats'
import type { CardCounts, DayActivity, HardWord, StabilityBucket, Stats as StatsData } from '../db/stats'
import { monthDay, shortDate, startOfWeek } from '../utils/time'
import BottomNav from '../components/BottomNav'
import StatTile from '../components/StatTile'
import { BarList, CalendarHeatmap, ColumnChart, LineChart, Meter, Panel, SegmentBar } from '../components/Charts'

type Range = 30 | 90

const RANGES: Range[] = [30, 90]

// Where a card stands, light to dark along the way it goes: one amber ramp, its steps
// checked to stay apart, colour-blind or not, and to show on white. A new card has not
// started yet, so it gets the empty track's grey. The same colours mark the same cards in
// every chart here.
const STATE_COLORS = {
  new: 'var(--border-secondary)',
  learning: 'var(--amber-400)',
  reviewing: 'var(--amber-700)',
  mastered: 'var(--amber-950)',
}

// A chart of one thing only needs the accent.
const ACCENT = 'var(--amber-600)'

const ONE_LINE: CSSProperties = { overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }

const SECTION: CSSProperties = {
  fontSize: 14, color: 'var(--text-tertiary)',
  textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: 500,
}

function plural(n: number, noun: string): string {
  return n === 1 ? noun : `${noun}s`
}

function count(n: number, noun: string): string {
  return `${n.toLocaleString('en-US')} ${plural(n, noun)}`
}

function percent(share: number): string {
  return `${Math.round(share * 100)}%`
}

// The figure a readout is about, set apart from the words around it.
function Strong({ children }: { children: ReactNode }) {
  return <span style={{ fontWeight: 500, color: 'var(--text-primary)' }}>{children}</span>
}

// A readout's second line: when, or out of what.
function Detail({ children }: { children: ReactNode }) {
  return <div style={{ color: 'var(--text-tertiary)' }}>{children}</div>
}

// Today at the right end, and a date every `every` days back from it.
function dayLabels(days: { day: number }[], every: number): string[] {
  const last = days.length - 1
  return days.map((d, i) => (i === last ? 'Today' : (last - i) % every === 0 ? monthDay(d.day) : ''))
}

interface RecallPoint {
  label: string // under the axis
  name: string // in the readout and the table
  cards: number
  recalled: number
}

function dailyRecall(days: DayActivity[]): RecallPoint[] {
  const labels = dayLabels(days, 7)
  return days.map((d, i) => ({ label: labels[i], name: shortDate(d.day), cards: d.cards, recalled: d.recalled }))
}

// Calendar weeks, Monday first. The range may cut the oldest short, and this one is not
// over yet.
function weeklyRecall(days: DayActivity[]): RecallPoint[] {
  const weeks: { first: number; last: number; cards: number; recalled: number }[] = []
  for (const d of days) {
    const week = weeks[weeks.length - 1]
    if (week && startOfWeek(d.day) === startOfWeek(week.first)) {
      week.last = d.day
      week.cards += d.cards
      week.recalled += d.recalled
    } else {
      weeks.push({ first: d.day, last: d.day, cards: d.cards, recalled: d.recalled })
    }
  }
  return weeks.map((week, i) => ({
    label: (weeks.length - 1 - i) % 4 === 0 ? monthDay(week.first) : '',
    name: week.first === week.last ? monthDay(week.first) : `${monthDay(week.first)} – ${monthDay(week.last)}`,
    cards: week.cards,
    recalled: week.recalled,
  }))
}

export default function Stats() {
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const range: Range = params.get('range') === '90' ? 90 : 30
  const stats = useLiveQuery(loadStats, [])

  // Kept in the URL, like the Library's filters, so coming back from a word finds it as it was.
  function setRange(days: Range) {
    setParams(prev => {
      const next = new URLSearchParams(prev)
      if (days === 30) next.delete('range')
      else next.set('range', String(days))
      return next
    }, { replace: true })
  }

  const nothing = stats && stats.totalReviews === 0 && Object.values(stats.cards).every(n => n === 0)
  const days = stats?.days.slice(-range) ?? []

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100dvh' }}>
      {/* AppBar */}
      <div style={{ height: 48, display: 'flex', alignItems: 'center', padding: '0 18px', flexShrink: 0 }}>
        <span style={{ fontSize: 23, fontWeight: 500, color: 'var(--text-primary)' }}>Stats</span>
      </div>

      {/* Body */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '0 18px', paddingBottom: 'calc(72px + env(safe-area-inset-bottom))' }}>
        {nothing ? (
          <Empty onLookUp={() => navigate('/')} />
        ) : stats && (
          <>
            <Tiles stats={stats} />
            <CardsPanel cards={stats.cards} />
            <RetentionPanel retention={stats.retention} />
            <CalendarPanel calendar={stats.calendar} />

            {/* The range covers these two charts and nothing past them */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', margin: '16px 0 12px' }}>
              <span style={SECTION}>Activity</span>
              <RangeToggle value={range} onChange={setRange} />
            </div>
            <DailyPanel days={days} range={range} />
            <RecallPanel days={days} range={range} target={stats.retention.target} />

            <div style={{ ...SECTION, margin: '16px 0 12px' }}>Memory</div>
            <ForecastPanel forecast={stats.forecast} />
            <StabilityPanel buckets={stats.stability} />
            <HardestPanel words={stats.hardest} onOpen={lemma => navigate('/lookup/' + lemma)} />
          </>
        )}
      </div>

      <BottomNav />
    </div>
  )
}

function Empty({ onLookUp }: { onLookUp: () => void }) {
  return (
    <div style={{ textAlign: 'center', padding: '56px 12px' }}>
      <ChartColumn size={36} color="var(--text-tertiary)" style={{ display: 'block', margin: '0 auto' }} />
      <div style={{ fontSize: 18, fontWeight: 500, color: 'var(--text-primary)', marginTop: 12 }}>
        No stats yet
      </div>
      <div style={{ fontSize: 16, color: 'var(--text-secondary)', marginTop: 6, lineHeight: 1.5 }}>
        Add a few words to review and study them — how it's going shows up here.
      </div>
      <button
        onClick={onLookUp}
        style={{
          marginTop: 18, background: 'var(--amber-600)', color: '#fff',
          border: 'none', borderRadius: 10, padding: '11px 22px',
          fontSize: 18, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit',
        }}
      >
        Look up a word
      </button>
    </div>
  )
}

function RangeToggle({ value, onChange }: { value: Range; onChange: (range: Range) => void }) {
  return (
    <div style={{ display: 'flex', gap: 3, background: 'var(--bg-secondary)', borderRadius: 10, padding: 3 }}>
      {RANGES.map(days => {
        const active = value === days
        return (
          <button
            key={days}
            onClick={() => onChange(days)}
            aria-pressed={active}
            style={{
              padding: '6px 12px', border: 'none', borderRadius: 8,
              background: active ? 'var(--amber-900)' : 'transparent',
              color: active ? '#fff' : 'var(--text-secondary)',
              fontSize: 14, fontWeight: active ? 500 : 400,
              cursor: 'pointer', fontFamily: 'inherit',
            }}
          >
            {days} days
          </button>
        )
      })}
    </div>
  )
}

function Tiles({ stats }: { stats: StatsData }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, margin: '4px 0 12px' }}>
      <StatTile
        label="Words studied"
        value={stats.wordsStudied.toLocaleString('en-US')}
        sub={`${stats.wordsMastered.toLocaleString('en-US')} mastered`}
      />
      <StatTile
        label="Streak"
        value={count(stats.streak, 'day')}
        sub={`best ${count(stats.longestStreak, 'day')}`}
      />
      <StatTile
        label="Recall now"
        value={stats.recallNow === null ? '—' : percent(stats.recallNow)}
        sub={stats.recallCards ? `predicted, ${count(stats.recallCards, 'card')}` : 'nothing in review yet'}
      />
      <StatTile
        label="Reviews"
        value={stats.totalReviews.toLocaleString('en-US')}
        sub={`on ${count(stats.daysStudied, 'day')}`}
      />
    </div>
  )
}

function CardsPanel({ cards }: { cards: CardCounts }) {
  const total = cards.new + cards.learning + cards.reviewing + cards.mastered
  return (
    <Panel
      title="Cards"
      note="Mastered once a card should stay remembered for three weeks"
      aside={<span style={{ fontSize: 14, color: 'var(--text-tertiary)', paddingTop: 2 }}>{count(total, 'card')}</span>}
    >
      <SegmentBar parts={[
        { label: 'New', value: cards.new, color: STATE_COLORS.new },
        { label: 'Learning', value: cards.learning, color: STATE_COLORS.learning },
        { label: 'Reviewing', value: cards.reviewing, color: STATE_COLORS.reviewing },
        { label: 'Mastered', value: cards.mastered, color: STATE_COLORS.mastered },
      ]} />
    </Panel>
  )
}

function RetentionPanel({ retention }: { retention: StatsData['retention'] }) {
  const { target, reviews, recalled } = retention
  const share = reviews ? recalled / reviews : 0
  return (
    <Panel title="Retention" note="How often a card was still remembered when it came due, last 30 days">
      {reviews === 0 ? (
        <div style={{ fontSize: 16, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
          Nothing has come due yet. Once a learned card comes back for review, how often you
          remember it shows here.
        </div>
      ) : (
        <>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
            <span style={{ fontSize: 36, fontWeight: 500, color: 'var(--text-primary)', lineHeight: 1.15 }}>
              {percent(share)}
            </span>
            <span style={{ fontSize: 14, color: 'var(--text-secondary)' }}>target {percent(target)}</span>
          </div>
          <div style={{ marginTop: 12 }}>
            <Meter value={share} target={target} label={`${percent(share)} remembered, target ${percent(target)}`} />
          </div>
          <div style={{ fontSize: 14, color: 'var(--text-secondary)', marginTop: 12, lineHeight: 1.45 }}>
            {recalled.toLocaleString('en-US')} of {count(reviews, 'review')} remembered.
            {/* More is coming due than is being kept: a lighter load is the first thing to try. */}
            {share < target - 0.05 && ' Well below your target — fewer new cards a day may help.'}
          </div>
        </>
      )}
    </Panel>
  )
}

function CalendarPanel({ calendar }: { calendar: StatsData['calendar'] }) {
  const studied = calendar.filter(d => d.count > 0).length
  const total = calendar.reduce((sum, d) => sum + d.count, 0)
  return (
    <Panel
      title="Calendar"
      note="Reviews each day, last six months"
      table={{
        columns: ['Day', 'Reviews'],
        rows: calendar.filter(d => d.count > 0).reverse().map(d => [shortDate(d.day), d.count]),
      }}
    >
      <CalendarHeatmap
        days={calendar}
        summary={<>
          <div>Studied on <Strong>{studied}</Strong> of the last {calendar.length} days</div>
          <Detail>{count(total, 'review')}</Detail>
        </>}
        describe={i => {
          const d = calendar[i]
          return <>
            <div>{d.count ? <><Strong>{d.count}</Strong> {plural(d.count, 'review')}</> : 'No reviews'}</div>
            <Detail>{shortDate(d.day)}</Detail>
          </>
        }}
        label="Reviews each day over the last six months"
      />
    </Panel>
  )
}

function DailyPanel({ days, range }: { days: DayActivity[]; range: Range }) {
  const total = days.reduce((sum, d) => sum + d.due + d.learning, 0)
  const studied = days.filter(d => d.due + d.learning > 0).length
  return (
    <Panel
      title="Reviews per day"
      note="Every answer counts. Learning includes new cards."
      table={{
        columns: ['Day', 'Due', 'Learning', 'New', 'Total'],
        rows: [...days].reverse().map(d => [shortDate(d.day), d.due, d.learning, d.fresh, d.due + d.learning]),
      }}
    >
      <ColumnChart
        key={range}
        series={[
          { label: 'Due', color: STATE_COLORS.reviewing, values: days.map(d => d.due) },
          { label: 'Learning', color: STATE_COLORS.learning, values: days.map(d => d.learning) },
        ]}
        labels={dayLabels(days, range === 30 ? 7 : 28)}
        summary={<>
          <div><Strong>{total.toLocaleString('en-US')}</Strong> {plural(total, 'review')} in the last {range} days</div>
          <Detail>studied on {count(studied, 'day')}</Detail>
        </>}
        describe={i => {
          const d = days[i]
          const reviews = d.due + d.learning
          return <>
            <div>
              {reviews ? <><Strong>{reviews}</Strong> {plural(reviews, 'review')} — {d.due} due · {d.learning} learning</> : 'No reviews'}
            </div>
            <Detail>{shortDate(d.day)}{d.fresh > 0 && ` · ${count(d.fresh, 'new card')}`}</Detail>
          </>
        }}
        label={`Reviews per day over the last ${range} days`}
      />
    </Panel>
  )
}

function RecallPanel({ days, range, target }: { days: DayActivity[]; range: Range; target: number }) {
  const points = range === 30 ? dailyRecall(days) : weeklyRecall(days)
  const cards = points.reduce((sum, p) => sum + p.cards, 0)
  const recalled = points.reduce((sum, p) => sum + p.recalled, 0)
  return (
    <Panel
      title="First-try recall"
      note={`Each card's first answer of the day${range === 90 ? ', week by week' : ''}`}
      table={{
        columns: [range === 30 ? 'Day' : 'Week', 'Cards', 'Remembered', 'Recall'],
        rows: [...points].reverse().map(p => [p.name, p.cards, p.recalled, p.cards ? percent(p.recalled / p.cards) : '—']),
      }}
    >
      <LineChart
        key={range}
        values={points.map(p => (p.cards ? p.recalled / p.cards : null))}
        labels={points.map(p => p.label)}
        target={target}
        summary={cards ? <>
          <div><Strong>{percent(recalled / cards)}</Strong> remembered — {recalled.toLocaleString('en-US')} of {count(cards, 'card')}</div>
          <Detail>last {range} days · target {percent(target)}</Detail>
        </> : <>
          <div>No reviews</div>
          <Detail>last {range} days</Detail>
        </>}
        describe={i => {
          const p = points[i]
          return <>
            <div>
              {p.cards ? <><Strong>{percent(p.recalled / p.cards)}</Strong> remembered — {p.recalled} of {count(p.cards, 'card')}</> : 'No reviews'}
            </div>
            <Detail>{p.name}</Detail>
          </>
        }}
        label={`Share of cards remembered on the first try over the last ${range} days`}
      />
    </Panel>
  )
}

function ForecastPanel({ forecast }: { forecast: StatsData['forecast'] }) {
  const week = forecast.slice(1, 8).reduce((sum, d) => sum + d.count, 0)
  const when = (i: number) => (i === 0 ? 'Today' : i === 1 ? 'Tomorrow' : shortDate(forecast[i].day))
  return (
    <Panel
      title="Coming up"
      note="Cards you've studied, by the day they're due. Today is what's left of today's round."
      table={{
        columns: ['Day', 'Due'],
        rows: forecast.map((d, i) => [when(i), d.count]),
      }}
    >
      <ColumnChart
        series={[{ label: 'Due', color: ACCENT, values: forecast.map(d => d.count) }]}
        labels={forecast.map((d, i) => (i === 0 ? 'Today' : i % 7 === 0 ? monthDay(d.day) : ''))}
        summary={<>
          <div><Strong>{forecast[1].count}</Strong> due tomorrow</div>
          <Detail>{count(week, 'card')} in the next 7 days</Detail>
        </>}
        describe={i => {
          const due = forecast[i].count
          return <>
            <div><Strong>{due}</Strong> {plural(due, 'card')} {i === 0 ? 'left' : 'due'}</div>
            <Detail>{when(i)}</Detail>
          </>
        }}
        label="Cards due each day over the next 30 days"
      />
    </Panel>
  )
}

function StabilityPanel({ buckets }: { buckets: StabilityBucket[] }) {
  const total = buckets.reduce((sum, b) => sum + b.count, 0)
  return (
    <Panel
      title="Memory strength"
      note="How long each card in review should stay remembered before recall falls to 90%"
      aside={<span style={{ fontSize: 14, color: 'var(--text-tertiary)', paddingTop: 2 }}>{count(total, 'card')}</span>}
    >
      {total === 0 ? (
        <div style={{ fontSize: 16, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
          Nothing in review yet. Cards move here once they're learned.
        </div>
      ) : (
        <BarList color={ACCENT} rows={buckets.map(b => ({ label: b.name, value: b.count }))} />
      )}
    </Panel>
  )
}

const WORD_ROW: CSSProperties = {
  display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 50px 58px 50px',
  alignItems: 'baseline', columnGap: 4,
}

const NUMBER: CSSProperties = { textAlign: 'right', fontVariantNumeric: 'tabular-nums' }

function HardestPanel({ words, onOpen }: { words: HardWord[]; onOpen: (lemma: string) => void }) {
  return (
    <Panel title="Hardest words" note="Forgotten most, of the words answered three times or more">
      {words.length === 0 ? (
        <div style={{ fontSize: 16, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
          None yet. Words you get wrong show up here.
        </div>
      ) : (
        <div>
          <div style={{ ...WORD_ROW, fontSize: 13, color: 'var(--text-tertiary)', paddingBottom: 6 }}>
            <span>Word</span>
            <span style={NUMBER}>Forgot</span>
            <span style={NUMBER}>Reviews</span>
            <span style={NUMBER}>Recall</span>
          </div>
          {words.map(word => (
            <div
              key={word.lemma}
              onClick={() => onOpen(word.lemma)}
              style={{ ...WORD_ROW, padding: '10px 0', borderTop: '0.5px solid var(--border-tertiary)', cursor: 'pointer' }}
            >
              <div style={{ minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
                  <span style={{ fontSize: 17, color: 'var(--text-primary)', ...ONE_LINE }}>{word.lemma}</span>
                  {/* Forgotten again and again: more of the same reviews are unlikely to help */}
                  {word.stubborn && <span style={{ fontSize: 13, color: '#dc2626', flexShrink: 0 }}>stubborn</span>}
                </div>
                {word.meaning && (
                  <div style={{ fontSize: 14, color: 'var(--text-secondary)', marginTop: 2, ...ONE_LINE }}>
                    {word.meaning}
                  </div>
                )}
              </div>
              <span style={{ ...NUMBER, fontSize: 16, color: 'var(--text-primary)' }}>{word.lapses}</span>
              <span style={{ ...NUMBER, fontSize: 16, color: 'var(--text-secondary)' }}>{word.reviews}</span>
              <span style={{ ...NUMBER, fontSize: 16, color: 'var(--text-secondary)' }}>
                {percent(word.recalled / word.reviews)}
              </span>
            </div>
          ))}
        </div>
      )}
    </Panel>
  )
}

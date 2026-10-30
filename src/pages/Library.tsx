import { useState } from 'react'
import type { CSSProperties, ReactNode } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { ArrowDownUp, ChevronDown, Library as LibraryIcon, ListFilter, Search, X } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { loadLibrary, matches, sortEntries } from '../db/library'
import type { CardLevel, EntryStatus, LibraryEntry, LibrarySort, PassageEntry } from '../db/library'
import { addTranslationCard, addWordSenses, deleteCapture, deleteLibraryEntry } from '../db/queries'
import { getCachedWord } from '../api/lookup'
import { getCachedTranslation } from '../api/translate'
import { getErrorMessage } from '../api/llm'
import { dayLabel, dueLabel, relativeTime } from '../utils/time'
import { lemmatize } from '../utils/lemmatize'
import { useToast } from '../components/Toast'
import BottomNav from '../components/BottomNav'
import SwipeToDelete from '../components/SwipeToDelete'

type Tab = 'words' | 'sentences' | 'passages'
type StatusFilter = 'all' | EntryStatus

const TABS: { value: Tab; label: string; search: string }[] = [
  { value: 'words', label: 'Words', search: 'Search words or meanings' },
  { value: 'sentences', label: 'Sentences', search: 'Search sentences' },
  { value: 'passages', label: 'Passages', search: 'Search passages' },
]

const STATUSES: { value: EntryStatus; label: string }[] = [
  { value: 'unadded', label: 'Not added' },
  { value: 'new', label: 'New' },
  { value: 'learning', label: 'Learning' },
  { value: 'review', label: 'Reviewing' },
  { value: 'mastered', label: 'Mastered' },
]

const STATUS_FILTERS: { value: StatusFilter; label: string }[] = [{ value: 'all', label: 'All statuses' }, ...STATUSES]

const SORTS: { value: LibrarySort; label: string }[] = [
  { value: 'recent', label: 'Recent' },
  { value: 'alpha', label: 'A–Z' },
  { value: 'due', label: 'Next review' },
]

// A card's bar: studied in a light accent, mature in the full one, not yet studied grey.
const LEVEL_COLORS: Record<CardLevel, string> = {
  mature: 'var(--amber-600)',
  young: 'rgba(186, 117, 23, 0.4)',
  new: 'var(--border-secondary)',
}

// A search the lookup page could take when the library has nothing for it.
const LOOKUPABLE = /^[A-Za-z][A-Za-z' .-]*$/

const ONE_LINE: CSSProperties = { overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }

function pick<T extends string>(value: string | null, options: readonly { value: T }[], fallback: T): T {
  return options.find(option => option.value === value)?.value ?? fallback
}

// Rows sorted newest first, cut where the day changes. Any other order is one plain list.
function byDay<T extends { at: number }>(rows: T[], grouped: boolean): { label: string | null; rows: T[] }[] {
  if (!grouped) return [{ label: null, rows }]
  const days: { label: string; rows: T[] }[] = []
  for (const row of rows) {
    const label = dayLabel(row.at)
    const last = days[days.length - 1]
    if (last?.label === label) last.rows.push(row)
    else days.push({ label, rows: [row] })
  }
  return days
}

export default function Library() {
  const navigate = useNavigate()
  const { showToast } = useToast()
  const [params, setParams] = useSearchParams()
  const [openId, setOpenId] = useState<string | null>(null)
  const [adding, setAdding] = useState<Set<string>>(new Set())
  // The box keeps its own copy: a URL update can land a render late, and a controlled input
  // fed from it would drop keystrokes.
  const [query, setQuery] = useState(() => params.get('q') ?? '')

  // Everything else lives in the URL, so coming back from a word finds the list as it was.
  const tab = pick(params.get('tab'), TABS, 'words')
  const status = pick<StatusFilter>(params.get('status'), STATUSES, 'all')
  const sorts = tab === 'passages' ? SORTS.filter(s => s.value !== 'due') : SORTS
  const sort = pick(params.get('sort'), sorts, 'recent')

  const library = useLiveQuery(loadLibrary, [])

  function setParam(key: string, value: string, fallback: string) {
    setParams(prev => {
      const next = new URLSearchParams(prev)
      if (value === fallback) next.delete(key)
      else next.set(key, value)
      return next
    }, { replace: true })
  }

  function search(text: string) {
    setQuery(text)
    setParam('q', text, '')
  }

  async function handleAdd(entry: LibraryEntry, kind: 'word' | 'sentence') {
    const id = `${kind}:${entry.key}`
    if (adding.has(id)) return
    setAdding(prev => new Set(prev).add(id))
    try {
      // A row carries no sense of its own, so a word gets its most common one. A different
      // meaning is one tap away: open the word and use the + on that sense.
      let added = false
      if (kind === 'word') {
        const word = await getCachedWord(entry.key)
        const sense = word?.definitions[0]
        if (!word || !sense) {
          showToast('Could not find this entry — look it up again')
          return
        }
        added = (await addWordSenses(word, [sense])).length > 0
      } else {
        const translation = await getCachedTranslation(entry.key)
        if (!translation) {
          showToast('Could not find this entry — look it up again')
          return
        }
        added = await addTranslationCard(translation)
      }
      showToast(added ? 'Added to review' : 'Already in review')
    } catch (err) {
      showToast(getErrorMessage(err))
    } finally {
      setAdding(prev => {
        const next = new Set(prev)
        next.delete(id)
        return next
      })
    }
  }

  async function handleDelete(entry: LibraryEntry) {
    await deleteLibraryEntry(entry.historyIds, entry.cardIds)
    setOpenId(null)
    showToast('Removed from library')
  }

  // Only the passage goes. Cards saved from it keep their own copy of the sentence.
  async function handleDeletePassage(id: string) {
    await deleteCapture(id)
    setOpenId(null)
    showToast('Removed from library')
  }

  function lookUp(text: string) {
    navigate('/lookup/' + lemmatize(text), { state: { queriedForm: text } })
  }

  let list: ReactNode = null
  if (library && tab === 'passages') {
    const shown = sortEntries(library.passages.filter(p => matches(p.haystack, query)), sort)
    list = library.passages.length === 0 ? (
      <Empty title="No passages yet">Paste English into Read on Home and it shows up here.</Empty>
    ) : shown.length === 0 ? (
      <Empty title="Nothing matches" />
    ) : (
      byDay(shown, sort === 'recent').map(({ label, rows }) => (
        <Section key={label ?? 'all'} label={label}>
          {rows.map((passage, i) => (
            <SwipeToDelete
              key={passage.id}
              open={openId === passage.id}
              onOpenChange={o => setOpenId(o ? passage.id : null)}
              onDelete={() => handleDeletePassage(passage.id)}
            >
              <PassageRow
                passage={passage}
                last={i === rows.length - 1}
                onOpen={() => navigate('/read/' + passage.id)}
              />
            </SwipeToDelete>
          ))}
        </Section>
      ))
    )
  } else if (library) {
    const kind = tab === 'words' ? 'word' : 'sentence'
    const entries = library[tab === 'words' ? 'words' : 'sentences']
    const shown = sortEntries(
      entries.filter(e => (status === 'all' || e.status === status) && matches(e.haystack, query)),
      sort,
    )
    const q = query.trim()
    list = entries.length === 0 ? (
      kind === 'word' ? (
        <Empty title="No words yet">
          Look up a word and it shows up here, ready to add to review.
          <button onClick={() => navigate('/')} style={PRIMARY}>Look up a word</button>
        </Empty>
      ) : (
        <Empty title="No sentences yet">Translate something on Home and it shows up here.</Empty>
      )
    ) : shown.length === 0 ? (
      <Empty title="Nothing matches">
        {kind === 'word' && LOOKUPABLE.test(q) && (
          <button onClick={() => lookUp(q)} style={PRIMARY}>Look up “{q}”</button>
        )}
      </Empty>
    ) : (
      byDay(shown, sort === 'recent').map(({ label, rows }) => (
        <Section key={label ?? 'all'} label={label}>
          {rows.map((entry, i) => {
            const rowId = `${kind}:${entry.key}`
            return (
              <SwipeToDelete
                key={rowId}
                open={openId === rowId}
                onOpenChange={o => setOpenId(o ? rowId : null)}
                onDelete={() => handleDelete(entry)}
              >
                <EntryRow
                  entry={entry}
                  kind={kind}
                  last={i === rows.length - 1}
                  adding={adding.has(rowId)}
                  onOpen={() => navigate((kind === 'word' ? '/lookup/' : '/translate/') + entry.key)}
                  onAdd={() => handleAdd(entry, kind)}
                />
              </SwipeToDelete>
            )
          })}
        </Section>
      ))
    )
  }

  // How many entries each status holds, search aside, for the filter's options.
  const counts = new Map<StatusFilter, number>()
  if (library && tab !== 'passages') {
    const entries = library[tab === 'words' ? 'words' : 'sentences']
    counts.set('all', entries.length)
    for (const entry of entries) counts.set(entry.status, (counts.get(entry.status) ?? 0) + 1)
  }
  const sizes: Record<Tab, number | undefined> = {
    words: library?.words.length,
    sentences: library?.sentences.length,
    passages: library?.passages.length,
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100dvh' }}>
      {/* AppBar */}
      <div style={{ height: 48, display: 'flex', alignItems: 'center', padding: '0 18px', flexShrink: 0 }}>
        <span style={{ fontSize: 23, fontWeight: 500, color: 'var(--text-primary)' }}>Library</span>
      </div>

      {/* Body */}
      <div
        style={{ flex: 1, overflowY: 'auto', padding: '0 18px', paddingBottom: 'calc(72px + env(safe-area-inset-bottom))' }}
        onClick={() => setOpenId(null)}
      >
        {/* Words / Sentences / Passages */}
        <div style={{ display: 'flex', gap: 8, marginTop: 2 }}>
          {TABS.map(t => {
            const active = tab === t.value
            return (
              <button
                key={t.value}
                onClick={() => {
                  setOpenId(null)
                  setParam('tab', t.value, 'words')
                }}
                style={{
                  background: active ? 'var(--amber-900)' : 'var(--bg-secondary)',
                  color: active ? '#fff' : 'var(--text-secondary)',
                  border: 'none', borderRadius: 14,
                  padding: '5px 14px', fontSize: 16,
                  cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap',
                }}
              >
                {t.label}{sizes[t.value] !== undefined && ` ${sizes[t.value]}`}
              </button>
            )
          })}
        </div>

        {/* Search */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8, height: 44, marginTop: 12,
          background: 'var(--bg-secondary)', borderRadius: 10, padding: '0 4px 0 12px',
        }}>
          <Search size={16} color="var(--text-tertiary)" style={{ flexShrink: 0 }} />
          <input
            value={query}
            onChange={e => search(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur() }}
            placeholder={TABS.find(t => t.value === tab)!.search}
            aria-label="Search the library"
            enterKeyHint="search"
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="off"
            spellCheck={false}
            style={{
              flex: 1, minWidth: 0, border: 'none', background: 'transparent',
              fontSize: 18, color: 'var(--text-primary)', outline: 'none', fontFamily: 'inherit',
            }}
          />
          {query && (
            <button
              onClick={() => search('')}
              aria-label="Clear search"
              style={{ background: 'none', border: 'none', padding: 8, cursor: 'pointer', display: 'flex' }}
            >
              <X size={16} color="var(--text-tertiary)" />
            </button>
          )}
        </div>

        {/* Status and sort */}
        <div style={{ display: 'flex', gap: 8, marginTop: 8, marginBottom: 6 }}>
          {tab !== 'passages' && (
            <Select
              icon={ListFilter}
              label="Status"
              value={status}
              options={STATUS_FILTERS.map(o => ({
                value: o.value,
                label: library ? `${o.label} (${counts.get(o.value) ?? 0})` : o.label,
              }))}
              onChange={value => setParam('status', value, 'all')}
            />
          )}
          <Select
            icon={ArrowDownUp}
            label="Sort"
            value={sort}
            options={sorts}
            onChange={value => setParam('sort', value, 'recent')}
          />
        </div>

        {list}
      </div>

      <BottomNav />
    </div>
  )
}

const PRIMARY: CSSProperties = {
  display: 'block', margin: '18px auto 0',
  background: 'var(--amber-600)', color: '#fff',
  border: 'none', borderRadius: 10, padding: '11px 22px',
  fontSize: 18, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit',
}

function Empty({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div style={{ textAlign: 'center', padding: '48px 12px' }}>
      <LibraryIcon size={36} color="var(--text-tertiary)" style={{ display: 'block', margin: '0 auto' }} />
      <div style={{ fontSize: 18, fontWeight: 500, color: 'var(--text-primary)', marginTop: 12 }}>{title}</div>
      {children && (
        <div style={{ fontSize: 16, color: 'var(--text-secondary)', marginTop: 6, lineHeight: 1.5 }}>
          {children}
        </div>
      )}
    </div>
  )
}

function Section({ label, children }: { label: string | null; children: ReactNode }) {
  return (
    <div>
      {label && (
        <div style={{ fontSize: 14, color: 'var(--text-tertiary)', padding: '10px 2px 4px' }}>{label}</div>
      )}
      {children}
    </div>
  )
}

function Select<T extends string>({ icon: Icon, label, value, options, onChange }: {
  icon: LucideIcon
  label: string
  value: T
  options: { value: T; label: string }[]
  onChange: (value: T) => void
}) {
  return (
    <div style={{ position: 'relative', flex: 1, minWidth: 0 }}>
      <Icon
        size={15}
        color="var(--text-tertiary)"
        style={{ position: 'absolute', left: 11, top: 12.5, pointerEvents: 'none' }}
      />
      <select
        value={value}
        onChange={e => onChange(e.target.value as T)}
        aria-label={label}
        style={{
          width: '100%', height: 40, appearance: 'none', WebkitAppearance: 'none',
          background: 'var(--bg-secondary)', border: 'none', borderRadius: 10,
          padding: '0 30px 0 33px', fontSize: 16, color: 'var(--text-primary)',
          fontFamily: 'inherit', cursor: 'pointer', outline: 'none',
        }}
      >
        {options.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
      </select>
      <ChevronDown
        size={16}
        color="var(--text-tertiary)"
        style={{ position: 'absolute', right: 10, top: 12, pointerEvents: 'none' }}
      />
    </div>
  )
}

const ROW: CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 12,
  padding: '10px 2px', cursor: 'pointer',
}

function EntryRow({ entry, kind, last, adding, onOpen, onAdd }: {
  entry: LibraryEntry
  kind: 'word' | 'sentence'
  last: boolean
  adding: boolean
  onOpen: () => void
  onAdd: () => void
}) {
  return (
    <div onClick={onOpen} style={{ ...ROW, borderBottom: last ? 'none' : '0.5px solid var(--border-tertiary)' }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: kind === 'word' ? 18 : 17, color: 'var(--text-primary)', ...ONE_LINE }}>
          {entry.text}
        </div>
        {entry.meaning && (
          <div style={{ fontSize: 14, color: 'var(--text-secondary)', marginTop: 2, ...ONE_LINE }}>
            {entry.meaning}
          </div>
        )}
      </div>

      {entry.status === 'unadded' ? (
        <button
          onClick={e => { e.stopPropagation(); onAdd() }}
          disabled={adding}
          style={{
            background: 'none', border: 'none', padding: '8px 0 8px 8px', flexShrink: 0,
            fontSize: 14, fontFamily: 'inherit',
            color: adding ? 'var(--text-tertiary)' : 'var(--amber-600)',
            cursor: adding ? 'default' : 'pointer',
          }}
        >
          + add
        </button>
      ) : (
        <Progress entry={entry} />
      )}
    </div>
  )
}

// One bar per card, furthest along first, over when the soonest one comes up again.
function Progress({ entry }: { entry: LibraryEntry }) {
  const due = entry.nextDue === null ? 'new' : dueLabel(entry.nextDue)
  const status = STATUSES.find(s => s.value === entry.status)!.label
  return (
    <div
      title={status}
      style={{ flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}
    >
      <div role="img" aria-label={status} style={{ display: 'flex', gap: 3 }}>
        {entry.levels.map((level, i) => (
          <span key={i} style={{ width: 14, height: 6, borderRadius: 2, background: LEVEL_COLORS[level] }} />
        ))}
      </div>
      <span style={{ fontSize: 14, color: due === 'overdue' ? '#dc2626' : 'var(--text-tertiary)' }}>{due}</span>
    </div>
  )
}

function PassageRow({ passage, last, onOpen }: { passage: PassageEntry; last: boolean; onOpen: () => void }) {
  return (
    <div onClick={onOpen} style={{ ...ROW, borderBottom: last ? 'none' : '0.5px solid var(--border-tertiary)' }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 17, color: 'var(--text-primary)', ...ONE_LINE }}>{passage.text}</div>
        <div style={{ fontSize: 14, color: 'var(--text-tertiary)', marginTop: 2, ...ONE_LINE }}>
          {passage.source ? `${passage.source} · ` : ''}{relativeTime(passage.at)}
        </div>
      </div>
      <span style={{ fontSize: 14, color: 'var(--text-tertiary)', flexShrink: 0 }}>{passage.saved} saved</span>
    </div>
  )
}

import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Clock } from 'lucide-react'
import { db } from '../db'
import type { HistoryItem, WordSnapshot, SentenceSnapshot } from '../db'
import { addReviewItem } from '../db/queries'
import { dayLabel } from '../utils/time'
import { useToast } from '../components/Toast'
import BottomNav from '../components/BottomNav'

function subTime(ts: number): string {
  const diff = Date.now() - ts
  const minutes = Math.floor(diff / 60_000)
  if (minutes < 1) return 'just now'
  if (minutes < 60) return `${minutes} min ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours} h ago`
  const days = Math.floor(hours / 24)
  if (days === 1) return 'yesterday'
  return new Date(ts).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

export default function History() {
  const navigate = useNavigate()
  const { showToast } = useToast()
  const [items, setItems] = useState<HistoryItem[]>([])
  const [addedIds, setAddedIds] = useState<Set<string>>(new Set())
  const [pendingIds, setPendingIds] = useState<Set<string>>(new Set())

  useEffect(() => {
    loadData()
  }, [])

  async function loadData() {
    const [histItems, reviewItems] = await Promise.all([
      db.history.orderBy('queried_at').reverse().toArray(),
      db.review_items.toArray(),
    ])

    const addedLemmas = new Set(
      reviewItems
        .filter(r => r.type === 'word')
        .map(r => (r.snapshot as WordSnapshot).lemma)
    )
    const addedSourceTexts = new Set(
      reviewItems
        .filter(r => r.type === 'sentence')
        .map(r => (r.snapshot as SentenceSnapshot).source_text)
    )

    const transHashes = histItems.filter(i => i.type === 'translation').map(i => i.ref_key)
    const transCaches = transHashes.length > 0
      ? await db.translation_cache.bulkGet(transHashes)
      : []

    const hashToText = new Map<string, string>()
    for (const c of transCaches) {
      if (c) hashToText.set(c.source_hash, c.source_text)
    }

    const added = new Set<string>()
    for (const item of histItems) {
      if (item.type === 'word') {
        if (addedLemmas.has(item.ref_key)) added.add(item.id)
      } else {
        const src = hashToText.get(item.ref_key)
        if (src && addedSourceTexts.has(src)) added.add(item.id)
      }
    }

    setItems(histItems)
    setAddedIds(added)
  }

  async function handleAdd(item: HistoryItem) {
    if (addedIds.has(item.id) || pendingIds.has(item.id)) return
    setPendingIds(prev => new Set([...prev, item.id]))
    try {
      const now = Date.now()
      if (item.type === 'word') {
        const wordCache = await db.word_cache.get(item.ref_key)
        if (!wordCache) return
        await addReviewItem({
          id: crypto.randomUUID(),
          type: 'word',
          snapshot: {
            lemma: wordCache.lemma,
            phonetic_uk: wordCache.phonetic_uk,
            phonetic_us: wordCache.phonetic_us,
            definitions: wordCache.definitions,
          } as WordSnapshot,
          ease_factor: 2.5,
          interval_days: 0,
          repetitions: 0,
          due_at: now,
          added_at: now,
          last_reviewed_at: null,
        })
      } else {
        const transCache = await db.translation_cache.get(item.ref_key)
        if (!transCache) return
        await addReviewItem({
          id: crypto.randomUUID(),
          type: 'sentence',
          snapshot: {
            source_text: transCache.source_text,
            casual_en: transCache.casual_en,
            formal_en: transCache.formal_en,
            idiomatic_en: transCache.idiomatic_en,
          } as SentenceSnapshot,
          ease_factor: 2.5,
          interval_days: 0,
          repetitions: 0,
          due_at: now,
          added_at: now,
          last_reviewed_at: null,
        })
      }
      setAddedIds(prev => new Set([...prev, item.id]))
      showToast('已加入复习本')
    } finally {
      setPendingIds(prev => {
        const next = new Set(prev)
        next.delete(item.id)
        return next
      })
    }
  }

  // Group items by calendar day, preserving newest-first order
  const groups = new Map<string, HistoryItem[]>()
  for (const item of items) {
    const label = dayLabel(item.queried_at)
    if (!groups.has(label)) groups.set(label, [])
    groups.get(label)!.push(item)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100dvh' }}>
      {/* AppBar */}
      <div style={{ height: 48, display: 'flex', alignItems: 'center', padding: '0 18px', flexShrink: 0 }}>
        <span style={{ fontSize: 18, fontWeight: 500, color: 'var(--text-primary)' }}>
          History
        </span>
      </div>

      {/* Body */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '0 18px', paddingBottom: 'calc(72px + env(safe-area-inset-bottom))' }}>

        {/* Empty state */}
        {items.length === 0 && (
          <div style={{
            display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center',
            marginTop: 80, gap: 12,
          }}>
            <Clock size={40} color="var(--text-tertiary)" />
            <div style={{ fontSize: 14, color: 'var(--text-secondary)' }}>还没有查询记录</div>
          </div>
        )}

        {/* Date-grouped list */}
        {[...groups.entries()].map(([label, dayItems]) => (
          <div key={label}>
            <div style={{
              fontSize: 11, color: 'var(--text-tertiary)',
              padding: '10px 2px 4px',
            }}>
              {label}
            </div>

            {dayItems.map((item, i) => {
              const isLast = i === dayItems.length - 1
              const isAdded = addedIds.has(item.id)
              const isPending = pendingIds.has(item.id)

              return (
                <div
                  key={item.id}
                  onClick={() => navigate(item.type === 'word' ? `/lookup/${item.ref_key}` : `/translate/${item.ref_key}`)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    padding: '10px 2px',
                    borderBottom: isLast ? 'none' : '0.5px solid var(--border-tertiary)',
                    cursor: 'pointer',
                  }}
                >
                  {/* TypeBadge */}
                  <div style={{
                    width: 28, height: 28, borderRadius: 6, flexShrink: 0,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    background: item.type === 'word' ? 'var(--bg-secondary)' : '#FAEEDA',
                    color: item.type === 'word' ? 'var(--text-secondary)' : '#854F0B',
                    fontSize: 14, fontWeight: 500,
                  }}>
                    {item.type === 'word' ? 'W' : 'T'}
                  </div>

                  {/* Middle */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{
                      fontSize: 13, color: 'var(--text-primary)',
                      whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                    }}>
                      {item.display_text}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 1 }}>
                      {subTime(item.queried_at)}
                    </div>
                  </div>

                  {/* Right */}
                  {isAdded ? (
                    <span style={{ fontSize: 11, color: 'var(--text-tertiary)', flexShrink: 0 }}>
                      added
                    </span>
                  ) : (
                    <button
                      onClick={e => { e.stopPropagation(); handleAdd(item) }}
                      disabled={isPending}
                      style={{
                        background: 'none', border: 'none', padding: 0,
                        fontSize: 11,
                        color: isPending ? 'var(--text-tertiary)' : 'var(--amber-600)',
                        cursor: isPending ? 'default' : 'pointer',
                        flexShrink: 0, fontFamily: 'inherit',
                      }}
                    >
                      + add
                    </button>
                  )}
                </div>
              )
            })}
          </div>
        ))}
      </div>

      <BottomNav />
    </div>
  )
}

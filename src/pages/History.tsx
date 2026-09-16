import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Clock } from 'lucide-react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db'
import type { HistoryItem, WordSnapshot, SentenceSnapshot } from '../db'
import { addReviewItem, addWordSense, deleteHistoryItem } from '../db/queries'
import { getCachedWord } from '../api/lookup'
import { getCachedTranslation } from '../api/translate'
import { getErrorMessage } from '../api/llm'
import { dayLabel } from '../utils/time'
import { hashText } from '../utils/hash'
import { useToast } from '../components/Toast'
import BottomNav from '../components/BottomNav'
import SwipeToDelete from '../components/SwipeToDelete'

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
  const [pendingIds, setPendingIds] = useState<Set<string>>(new Set())
  const [openId, setOpenId] = useState<string | null>(null)

  const data = useLiveQuery(async () => {
    const [histItems, reviewItems] = await Promise.all([
      db.history.orderBy('queried_at').reverse().toArray(),
      db.review_items.toArray(),
    ])

    const addedLemmas = new Set(
      reviewItems
        .filter(r => r.type === 'word')
        .map(r => (r.snapshot as WordSnapshot).lemma)
    )
    // Sentences are matched by hash, which is what history.ref_key holds. Resolving
    // hashes through translation_cache instead misses on a device that never ran the
    // translation, showing "+ add" for sentences already in the review book.
    const addedSourceHashes = new Set(await Promise.all(
      reviewItems
        .filter(r => r.type === 'sentence')
        .map(r => hashText((r.snapshot as SentenceSnapshot).source_text))
    ))

    const added = new Set<string>()
    for (const item of histItems) {
      const addedKeys = item.type === 'word' ? addedLemmas : addedSourceHashes
      if (addedKeys.has(item.ref_key)) added.add(item.id)
    }

    return { items: histItems, addedIds: added }
  }, [])

  const items = data?.items ?? []
  const addedIds = data?.addedIds ?? new Set<string>()

  async function handleAdd(item: HistoryItem) {
    if (addedIds.has(item.id) || pendingIds.has(item.id)) return
    setPendingIds(prev => new Set([...prev, item.id]))
    try {
      const now = Date.now()
      if (item.type === 'word') {
        const wordCache = await getCachedWord(item.ref_key)
        // A row carries no sense of its own, so it adds the most common one. Pick a
        // different meaning by opening the word and using the + on that sense.
        const sense = wordCache?.definitions[0]
        if (!wordCache || !sense) {
          showToast("Could not find this entry — look it up again")
          return
        }
        await addWordSense(wordCache, sense)
      } else {
        const transCache = await getCachedTranslation(item.ref_key)
        if (!transCache) {
          showToast("Could not find this entry — look it up again")
          return
        }
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
      showToast('Added to review')
    } catch (err) {
      showToast(getErrorMessage(err))
    } finally {
      setPendingIds(prev => {
        const next = new Set(prev)
        next.delete(item.id)
        return next
      })
    }
  }

  async function handleDelete(id: string) {
    await deleteHistoryItem(id)
    setOpenId(null)
    showToast('Removed from history')
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
        <span style={{ fontSize: 23, fontWeight: 500, color: 'var(--text-primary)' }}>
          History
        </span>
      </div>

      {/* Body */}
      <div
        style={{ flex: 1, overflowY: 'auto', padding: '0 18px', paddingBottom: 'calc(72px + env(safe-area-inset-bottom))' }}
        onClick={() => setOpenId(null)}
      >

        {/* Empty state */}
        {items.length === 0 && (
          <div style={{
            display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center',
            marginTop: 80, gap: 12,
          }}>
            <Clock size={40} color="var(--text-tertiary)" />
            <div style={{ fontSize: 18, color: 'var(--text-secondary)' }}>Nothing looked up yet</div>
          </div>
        )}

        {/* Date-grouped list */}
        {[...groups.entries()].map(([label, dayItems]) => (
          <div key={label}>
            <div style={{
              fontSize: 14, color: 'var(--text-tertiary)',
              padding: '10px 2px 4px',
            }}>
              {label}
            </div>

            {dayItems.map((item, i) => {
              const isLast = i === dayItems.length - 1
              const isAdded = addedIds.has(item.id)
              const isPending = pendingIds.has(item.id)

              return (
                <SwipeToDelete
                  key={item.id}
                  open={openId === item.id}
                  onOpenChange={o => setOpenId(o ? item.id : null)}
                  onDelete={() => handleDelete(item.id)}
                >
                  <div
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
                      fontSize: 18, fontWeight: 500,
                    }}>
                      {item.type === 'word' ? 'W' : 'T'}
                    </div>

                    {/* Middle */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{
                        fontSize: 17, color: 'var(--text-primary)',
                        whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                      }}>
                        {item.display_text}
                      </div>
                      <div style={{ fontSize: 14, color: 'var(--text-tertiary)', marginTop: 1 }}>
                        {subTime(item.queried_at)}
                      </div>
                    </div>

                    {/* Right */}
                    {isAdded ? (
                      <span style={{ fontSize: 14, color: 'var(--text-tertiary)', flexShrink: 0 }}>
                        added
                      </span>
                    ) : (
                      <button
                        onClick={e => { e.stopPropagation(); handleAdd(item) }}
                        disabled={isPending}
                        style={{
                          background: 'none', border: 'none', padding: 0,
                          fontSize: 14,
                          color: isPending ? 'var(--text-tertiary)' : 'var(--amber-600)',
                          cursor: isPending ? 'default' : 'pointer',
                          flexShrink: 0, fontFamily: 'inherit',
                        }}
                      >
                        + add
                      </button>
                    )}
                  </div>
                </SwipeToDelete>
              )
            })}
          </div>
        ))}
      </div>

      <BottomNav />
    </div>
  )
}

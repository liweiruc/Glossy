import { useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db'
import type { ReviewItem, WordSnapshot, SentenceSnapshot } from '../db'
import { deleteReviewItem } from '../db/queries'
import { dueLabel } from '../utils/time'
import { hashText } from '../utils/hash'
import { useToast } from '../components/Toast'
import BottomNav from '../components/BottomNav'

type SubTab = 'word' | 'sentence'

export default function ReviewBook() {
  const navigate = useNavigate()
  const { showToast } = useToast()
  const [subTab, setSubTab] = useState<SubTab>('word')
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null)
  const pressTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const items = useLiveQuery(
    () => db.review_items.orderBy('added_at').reverse().toArray(),
    [],
  ) ?? []
  const dueCount = items.filter(i => i.due_at <= Date.now()).length

  async function handleDelete(id: string) {
    await deleteReviewItem(id)
    setPendingDeleteId(null)
    showToast('已从复习本移除')
  }

  function startPress(id: string) {
    if (pressTimer.current) clearTimeout(pressTimer.current)
    pressTimer.current = setTimeout(() => setPendingDeleteId(id), 600)
  }

  function cancelPress() {
    if (pressTimer.current) {
      clearTimeout(pressTimer.current)
      pressTimer.current = null
    }
  }

  async function handleRowClick(e: React.MouseEvent, item: ReviewItem) {
    if (pendingDeleteId === item.id) {
      e.stopPropagation()
      return
    }
    setPendingDeleteId(null)
    if (item.type === 'word') {
      const lemma = (item.snapshot as WordSnapshot).lemma
      navigate('/lookup/' + lemma)
    } else {
      const sourceText = (item.snapshot as SentenceSnapshot).source_text
      const hash = await hashText(sourceText)
      navigate('/translate/' + hash)
    }
  }

  const wordCount = items.filter(i => i.type === 'word').length
  const sentenceCount = items.filter(i => i.type === 'sentence').length
  const filtered = items.filter(i => i.type === subTab)
  const canStart = dueCount > 0

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100dvh' }}>
      {/* AppBar */}
      <div style={{
        height: 48, display: 'flex', alignItems: 'center',
        padding: '0 18px', flexShrink: 0,
      }}>
        <span style={{ fontSize: 23, fontWeight: 500, color: 'var(--text-primary)', flex: 1 }}>
          Review
        </span>
      </div>

      {/* Body */}
      <div
        style={{ flex: 1, overflowY: 'auto', padding: '0 18px', paddingBottom: 'calc(72px + env(safe-area-inset-bottom))' }}
        onClick={() => setPendingDeleteId(null)}
      >
        {/* DueCard */}
        <div style={{
          background: 'var(--amber-50)', borderRadius: 14,
          padding: '18px 16px', margin: '6px 0 14px',
          textAlign: 'center',
        }}>
          <div style={{ fontSize: 36, fontWeight: 500, color: '#633806', lineHeight: 1 }}>
            {dueCount}
          </div>
          <div style={{ fontSize: 16, color: '#854F0B', marginTop: 4 }}>due today</div>
          <button
            onClick={() => canStart && navigate('/review/session')}
            disabled={!canStart}
            style={{
              marginTop: 12,
              background: canStart ? 'var(--amber-600)' : 'var(--bg-secondary)',
              color: canStart ? '#fff' : 'var(--text-secondary)',
              border: 'none', borderRadius: 8,
              padding: '9px 22px', fontSize: 17, fontWeight: 500,
              cursor: canStart ? 'pointer' : 'default',
              fontFamily: 'inherit',
            }}
          >
            {canStart ? 'Start review' : 'All caught up!'}
          </button>
        </div>

        {/* SubTabBar */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
          {(['word', 'sentence'] as SubTab[]).map(t => {
            const count = t === 'word' ? wordCount : sentenceCount
            const active = subTab === t
            return (
              <button
                key={t}
                onClick={e => { e.stopPropagation(); setSubTab(t) }}
                style={{
                  background: active ? '#412402' : 'var(--bg-secondary)',
                  color: active ? '#fff' : 'var(--text-secondary)',
                  border: 'none', borderRadius: 14,
                  padding: '5px 14px', fontSize: 16,
                  cursor: 'pointer', fontFamily: 'inherit',
                }}
              >
                {t === 'word' ? 'Words' : 'Sentences'} {count}
              </button>
            )
          })}
        </div>

        {/* ReviewItemList */}
        {filtered.length === 0 && (
          <div style={{
            textAlign: 'center', marginTop: 32,
            fontSize: 17, color: 'var(--text-tertiary)',
          }}>
            No {subTab === 'word' ? 'words' : 'sentences'} yet
          </div>
        )}
        {filtered.map((item, i) => {
          const isLast = i === filtered.length - 1
          const isPending = pendingDeleteId === item.id
          const label = item.type === 'word'
            ? (item.snapshot as WordSnapshot).lemma
            : (item.snapshot as SentenceSnapshot).source_text
          const lit = Math.min(item.repetitions, 5)
          const due = dueLabel(item.due_at)

          return (
            <div
              key={item.id}
              style={{
                display: 'flex', alignItems: 'center',
                padding: '10px 2px',
                borderBottom: isLast ? 'none' : '0.5px solid var(--border-tertiary)',
                WebkitTouchCallout: 'none',
                userSelect: 'none',
              }}
              onMouseDown={() => startPress(item.id)}
              onMouseUp={cancelPress}
              onMouseLeave={cancelPress}
              onTouchStart={e => { e.stopPropagation(); startPress(item.id) }}
              onTouchEnd={cancelPress}
              onClick={e => handleRowClick(e, item)}
            >
              {/* Left */}
              <div style={{ flex: 1, minWidth: 0, marginRight: 10 }}>
                <div style={{
                  fontSize: 18, color: 'var(--text-primary)',
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}>
                  {label}
                </div>
                <div style={{
                  fontSize: 14, marginTop: 2,
                  color: due === 'overdue' ? '#dc2626' : 'var(--text-tertiary)',
                }}>
                  {due}
                </div>
              </div>

              {/* Mastery dots */}
              {!isPending && (
                <div style={{ display: 'flex', gap: 3, flexShrink: 0 }}>
                  {Array.from({ length: 5 }).map((_, di) => (
                    <div
                      key={di}
                      style={{
                        width: 6, height: 6, borderRadius: '50%',
                        background: di < lit ? 'var(--amber-600)' : 'var(--border-tertiary)',
                      }}
                    />
                  ))}
                </div>
              )}

              {/* Delete button (long-press) */}
              {isPending && (
                <button
                  onClick={e => { e.stopPropagation(); handleDelete(item.id) }}
                  style={{
                    background: '#dc2626', color: '#fff',
                    border: 'none', borderRadius: 6,
                    padding: '5px 14px', fontSize: 16,
                    cursor: 'pointer', fontFamily: 'inherit',
                    flexShrink: 0,
                  }}
                >
                  Delete
                </button>
              )}
            </div>
          )
        })}
      </div>

      <BottomNav />
    </div>
  )
}

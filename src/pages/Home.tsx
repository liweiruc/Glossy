import { useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search, Settings as SettingsIcon, SendHorizontal } from 'lucide-react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db'
import type { HistoryItem } from '../db'
import { lemmatize } from '../utils/lemmatize'
import { hashText } from '../utils/hash'
import BottomNav from '../components/BottomNav'
import { relativeTime } from '../utils/time'

export default function Home() {
  const navigate = useNavigate()
  const [tab, setTab] = useState<'lookup' | 'translate'>('lookup')
  const [lookupQuery, setLookupQuery] = useState('')
  const [translateQuery, setTranslateQuery] = useState('')
  const [hashing, setHashing] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const lastInputTime = useRef(0)
  const lastSubmitTime = useRef(0)

  const allRecent = useLiveQuery(
    () => db.history.orderBy('queried_at').reverse().limit(40).toArray(),
    [],
  ) ?? []

  const recentType = tab === 'lookup' ? 'word' : 'translation'
  const recent = allRecent.filter(i => i.type === recentType).slice(0, 10)

  function handleSearch() {
    const now = Date.now()
    if (now - lastInputTime.current < 300) return
    if (now - lastSubmitTime.current < 300) return

    const word = lookupQuery.trim()
    if (!word) return
    lastSubmitTime.current = now

    const lemma = lemmatize(word)
    navigate('/lookup/' + lemma, { state: { queriedForm: word } })
  }

  async function handleTranslate() {
    const now = Date.now()
    if (now - lastInputTime.current < 300) return
    if (now - lastSubmitTime.current < 300) return

    const text = translateQuery.trim()
    if (!text || hashing) return
    lastSubmitTime.current = now
    setHashing(true)
    try {
      const hash = await hashText(text)
      navigate('/translate/' + hash, { state: { sourceText: text } })
    } finally {
      setHashing(false)
    }
  }

  function handleItemClick(item: HistoryItem) {
    if (item.type === 'word') navigate('/lookup/' + item.ref_key)
    else navigate('/translate/' + item.ref_key)
  }

  const canLookup = !!lookupQuery.trim()
  const canTranslate = !hashing && !!translateQuery.trim()

  const spinner = (
    <span style={{
      width: 16, height: 16, flexShrink: 0, display: 'inline-block',
      animation: 'spin 0.8s linear infinite', color: 'var(--text-tertiary)',
      lineHeight: 1,
    }}>
      ⟳
    </span>
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100dvh' }}>
      {/* AppBar */}
      <div style={{ height: 48, display: 'flex', alignItems: 'center', padding: '0 18px', flexShrink: 0 }}>
        <div style={{ flex: 1 }} />
        <span style={{ fontSize: 18, fontWeight: 500, color: 'var(--text-primary)' }}>Glossy</span>
        <div style={{ flex: 1, display: 'flex', justifyContent: 'flex-end' }}>
          <button
            onClick={() => navigate('/settings')}
            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, display: 'flex', alignItems: 'center' }}
          >
            <SettingsIcon size={20} color="var(--text-secondary)" />
          </button>
        </div>
      </div>

      {/* Body */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '0 18px', paddingBottom: 'calc(72px + env(safe-area-inset-bottom))' }}>
        {/* TabBar */}
        <div style={{ display: 'flex', borderBottom: '0.5px solid var(--border-tertiary)', marginBottom: 14 }}>
          {(['lookup', 'translate'] as const).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              style={{
                padding: '10px 16px 9px',
                background: 'none',
                border: 'none',
                borderBottom: tab === t ? '2px solid var(--amber-600)' : '2px solid transparent',
                fontSize: 14,
                fontWeight: tab === t ? 500 : 400,
                color: tab === t ? 'var(--text-primary)' : 'var(--text-secondary)',
                cursor: 'pointer',
                fontFamily: 'inherit',
              }}
            >
              {t === 'lookup' ? 'Lookup' : 'Translate'}
            </button>
          ))}
        </div>

        {/* SearchBar — lookup tab */}
        {tab === 'lookup' && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 8,
            background: 'var(--bg-secondary)', borderRadius: 10,
            padding: '10px 12px', marginBottom: 24,
          }}>
            <Search size={16} color="var(--text-tertiary)" style={{ flexShrink: 0 }} />
            <input
              ref={inputRef}
              type="text"
              value={lookupQuery}
              onChange={e => { setLookupQuery(e.target.value); lastInputTime.current = Date.now() }}
              onKeyDown={e => e.key === 'Enter' && handleSearch()}
              placeholder="Type an English word"
              style={{
                flex: 1, border: 'none', background: 'transparent',
                fontSize: 16, color: 'var(--text-primary)', outline: 'none',
                fontFamily: 'inherit',
              }}
            />
            {canLookup && (
              <button
                onClick={handleSearch}
                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 2, display: 'flex' }}
              >
                <Search size={16} color="var(--amber-600)" />
              </button>
            )}
          </div>
        )}

        {/* SearchBar — translate tab */}
        {tab === 'translate' && (
          <div style={{
            background: 'var(--bg-secondary)', borderRadius: 10,
            padding: '10px 12px', marginBottom: 24,
          }}>
            <textarea
              value={translateQuery}
              onChange={e => { setTranslateQuery(e.target.value); lastInputTime.current = Date.now() }}
              onKeyDown={e => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  handleTranslate()
                }
              }}
              placeholder="输入中文，获取地道英文翻译"
              rows={3}
              style={{
                width: '100%', border: 'none', background: 'transparent',
                fontSize: 16, color: 'var(--text-primary)', outline: 'none',
                fontFamily: 'inherit', resize: 'none', boxSizing: 'border-box',
                lineHeight: 1.5,
              }}
            />
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 4 }}>
              <button
                onClick={handleTranslate}
                disabled={!canTranslate}
                style={{
                  display: 'flex', alignItems: 'center', gap: 4,
                  background: canTranslate ? 'var(--amber-600)' : 'var(--border-tertiary)',
                  color: '#fff', border: 'none', borderRadius: 6,
                  padding: '5px 10px', fontSize: 12, cursor: canTranslate ? 'pointer' : 'default',
                  fontFamily: 'inherit',
                }}
              >
                {hashing ? spinner : <SendHorizontal size={13} />}
                Translate
              </button>
            </div>
          </div>
        )}

        {/* Recent list */}
        {recent.length > 0 && (
          <section>
            <div style={{
              fontSize: 11, color: 'var(--text-tertiary)',
              textTransform: 'uppercase', letterSpacing: '0.5px',
              marginBottom: 6,
            }}>
              Recent
            </div>
            {recent.map((item, i) => (
              <div
                key={item.id}
                onClick={() => handleItemClick(item)}
                style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  padding: '10px 0',
                  borderBottom: i < recent.length - 1 ? '0.5px solid var(--border-tertiary)' : 'none',
                  cursor: 'pointer',
                }}
              >
                <span style={{
                  fontSize: 14, color: 'var(--text-primary)',
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  maxWidth: '72%',
                }}>
                  {item.display_text}
                </span>
                <span style={{ fontSize: 11, color: 'var(--text-tertiary)', flexShrink: 0 }}>
                  {relativeTime(item.queried_at)}
                </span>
              </div>
            ))}
          </section>
        )}
      </div>

      <BottomNav />
    </div>
  )
}

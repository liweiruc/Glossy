import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { X, Volume2, Plus, Check } from 'lucide-react'
import { db } from '../db'
import type { WordCache, WordSnapshot, Definition } from '../db'
import { lookupWord } from '../api/lookup'
import { getErrorMessage } from '../api/llm'
import { useToast } from './Toast'

interface Props {
  word: string
  onClose: () => void
}

export default function WordPopup({ word, onClose }: Props) {
  const navigate = useNavigate()
  const { showToast } = useToast()
  const [wordData, setWordData] = useState<WordCache | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isAdded, setIsAdded] = useState(false)

  useEffect(() => {
    setLoading(true)
    setError(null)
    setWordData(null)

    lookupWord(word)
      .then(async data => {
        setWordData(data)
        const existing = await db.review_items
          .filter(item => item.type === 'word' && (item.snapshot as WordSnapshot).lemma === data.lemma)
          .first()
        setIsAdded(!!existing)
      })
      .catch(err => setError(getErrorMessage(err)))
      .finally(() => setLoading(false))
  }, [word])

  async function handleAddToReview() {
    if (!wordData || isAdded) return
    const now = Date.now()
    await db.review_items.add({
      id: crypto.randomUUID(),
      type: 'word',
      snapshot: {
        lemma: wordData.lemma,
        phonetic_uk: wordData.phonetic_uk,
        phonetic_us: wordData.phonetic_us,
        definitions: wordData.definitions,
      } as WordSnapshot,
      ease_factor: 2.5,
      interval_days: 0,
      repetitions: 0,
      due_at: now,
      added_at: now,
      last_reviewed_at: null,
    })
    setIsAdded(true)
    showToast('已加入复习本')
  }

  function handleOpenFull() {
    onClose()
    if (wordData) navigate('/lookup/' + wordData.lemma)
  }

  function speak() {
    if (!wordData || !window.speechSynthesis) return
    window.speechSynthesis.cancel()
    const utt = new SpeechSynthesisUtterance(wordData.lemma)
    utt.lang = 'en-US'
    utt.rate = 0.9
    window.speechSynthesis.speak(utt)
  }

  const visibleDefs = (wordData?.definitions ?? []).slice(0, 2)

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed', inset: 0,
          background: 'rgba(0,0,0,0.35)',
          zIndex: 200,
        }}
      />

      {/* Bottom sheet */}
      <div
        onClick={e => e.stopPropagation()}
        style={{
          position: 'fixed',
          left: 14, right: 14, bottom: 14,
          zIndex: 201,
          background: 'var(--bg-primary)',
          borderRadius: 16,
          padding: '14px 16px 12px',
          border: '0.5px solid var(--border-secondary)',
          maxWidth: 430 - 28,
          marginLeft: 'auto',
          marginRight: 'auto',
        }}
      >
        {/* Handle */}
        <div style={{
          width: 32, height: 3, borderRadius: 2,
          background: 'var(--border-tertiary)',
          margin: '0 auto 12px',
        }} />

        {/* Loading */}
        {loading && (
          <div style={{ textAlign: 'center', padding: '20px 0', fontSize: 13, color: 'var(--text-tertiary)' }}>
            Looking up…
          </div>
        )}

        {/* Error */}
        {!loading && error && (
          <div style={{ textAlign: 'center', padding: '10px 0', fontSize: 13, color: 'var(--text-secondary)' }}>
            {error}
          </div>
        )}

        {/* Content */}
        {!loading && wordData && (
          <>
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <div style={{ fontSize: 22, fontWeight: 500, color: 'var(--text-primary)', letterSpacing: '-0.3px' }}>
                  {wordData.lemma}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
                  <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                    {wordData.phonetic_us}
                  </span>
                  <button
                    onClick={speak}
                    style={{ background: 'none', border: 'none', padding: 2, cursor: 'pointer', display: 'flex' }}
                  >
                    <Volume2 size={13} color="var(--amber-600)" />
                  </button>
                </div>
              </div>
              <button
                onClick={onClose}
                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, display: 'flex', marginTop: 2 }}
              >
                <X size={20} color="var(--text-tertiary)" />
              </button>
            </div>

            {/* Definitions */}
            <div style={{ borderTop: '0.5px solid var(--border-tertiary)', marginTop: 10, paddingTop: 10 }}>
              {visibleDefs.map((def, i) => (
                <MiniDef key={i} def={def} last={i === visibleDefs.length - 1} />
              ))}
            </div>

            {/* Actions */}
            <div style={{
              display: 'flex', gap: 8,
              borderTop: '0.5px solid var(--border-tertiary)',
              marginTop: 12, paddingTop: 12,
            }}>
              <button
                onClick={handleAddToReview}
                disabled={isAdded}
                style={{
                  flex: 1,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
                  background: isAdded ? 'var(--bg-secondary)' : 'var(--amber-600)',
                  color: isAdded ? 'var(--text-secondary)' : '#fff',
                  border: 'none', borderRadius: 8, padding: '9px 0',
                  fontSize: 13, fontWeight: 500,
                  cursor: isAdded ? 'default' : 'pointer',
                  fontFamily: 'inherit',
                }}
              >
                {isAdded ? <Check size={12} /> : <Plus size={12} />}
                {isAdded ? 'Added' : 'Add to review'}
              </button>
              <button
                onClick={handleOpenFull}
                style={{
                  background: 'none',
                  border: '0.5px solid var(--border-secondary)',
                  borderRadius: 8, padding: '9px 14px',
                  fontSize: 12, color: 'var(--text-primary)',
                  cursor: 'pointer', fontFamily: 'inherit',
                  flexShrink: 0,
                }}
              >
                Open full
              </button>
            </div>
          </>
        )}
      </div>
    </>
  )
}

function MiniDef({ def, last }: { def: Definition; last: boolean }) {
  return (
    <div style={{ marginBottom: last ? 0 : 10 }}>
      <span style={{
        fontSize: 10, fontStyle: 'italic',
        color: 'var(--amber-700)', background: 'var(--amber-50)',
        borderRadius: 4, padding: '1px 6px',
      }}>
        {def.pos}
      </span>
      <div style={{ fontSize: 13, color: 'var(--text-primary)', lineHeight: 1.4, marginTop: 3 }}>
        {def.en}
      </div>
      <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.4 }}>
        {def.cn}
      </div>
      {def.examples[0] && (
        <div style={{ display: 'flex', marginTop: 4 }}>
          <div style={{ width: 2, background: 'var(--border-tertiary)', borderRadius: 1, flexShrink: 0, marginRight: 6 }} />
          <div>
            <div style={{ fontSize: 11, color: 'var(--text-primary)', lineHeight: 1.5, fontStyle: 'italic' }}>
              {def.examples[0].en}
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
              {def.examples[0].cn}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

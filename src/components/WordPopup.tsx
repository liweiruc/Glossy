import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { X, Volume2, Plus, Check } from 'lucide-react'
import type { WordCache, Definition } from '../db'
import { lookupWord } from '../api/lookup'
import { getErrorMessage } from '../api/llm'
import { addWordSense, getAddedSenseKeys, senseKey } from '../db/queries'
import { useChineseDisplay } from '../db/settings'
import { useToast } from './Toast'
import AddSenseButton from './AddSenseButton'
import SenseBlock from './SenseBlock'

interface Props {
  word: string
  onClose: () => void
}

export default function WordPopup({ word, onClose }: Props) {
  const navigate = useNavigate()
  const { showToast } = useToast()
  const chinese = useChineseDisplay()
  const [wordData, setWordData] = useState<WordCache | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [addedKeys, setAddedKeys] = useState<Set<string>>(new Set())

  useEffect(() => {
    setLoading(true)
    setError(null)
    setWordData(null)

    lookupWord(word)
      .then(async data => {
        setWordData(data)
        setAddedKeys(await getAddedSenseKeys(data.lemma))
      })
      .catch(err => setError(getErrorMessage(err)))
      .finally(() => setLoading(false))
  }, [word])

  async function handleAddSense(sense: Definition) {
    if (!wordData || addedKeys.has(senseKey(wordData.lemma, sense))) return
    await addWordSense(wordData, sense)
    setAddedKeys(prev => new Set([...prev, senseKey(wordData.lemma, sense)]))
    showToast('Added to review')
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
  const firstSense = visibleDefs[0]
  const firstAdded = !!wordData && !!firstSense && addedKeys.has(senseKey(wordData.lemma, firstSense))

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
          <div style={{ textAlign: 'center', padding: '20px 0', fontSize: 17, color: 'var(--text-tertiary)' }}>
            Looking up…
          </div>
        )}

        {/* Error */}
        {!loading && error && (
          <div style={{ textAlign: 'center', padding: '10px 0', fontSize: 17, color: 'var(--text-secondary)' }}>
            {error}
          </div>
        )}

        {/* Content */}
        {!loading && wordData && (
          <>
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <div style={{ fontSize: 29, fontWeight: 500, color: 'var(--text-primary)', letterSpacing: '-0.3px' }}>
                  {wordData.lemma}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
                  <span style={{ fontSize: 16, color: 'var(--text-secondary)' }}>
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
                <div key={i} style={{ marginBottom: i === visibleDefs.length - 1 ? 0 : 10 }}>
                  <SenseBlock
                    def={def}
                    lemma={wordData.lemma}
                    chinese={chinese}
                    size="compact"
                    maxExamples={1}
                    action={
                      <AddSenseButton
                        added={addedKeys.has(senseKey(wordData.lemma, def))}
                        onAdd={() => handleAddSense(def)}
                      />
                    }
                  />
                </div>
              ))}
            </div>

            {/* Actions */}
            <div style={{
              display: 'flex', gap: 8,
              borderTop: '0.5px solid var(--border-tertiary)',
              marginTop: 12, paddingTop: 12,
            }}>
              {/* The + on each sense is the precise action; this adds the first sense,
                  which is the most common one and what a hurried tap means. */}
              <button
                onClick={() => firstSense && handleAddSense(firstSense)}
                disabled={!firstSense || firstAdded}
                style={{
                  flex: 1,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
                  background: firstAdded ? 'var(--bg-secondary)' : 'var(--amber-600)',
                  color: firstAdded ? 'var(--text-secondary)' : '#fff',
                  border: 'none', borderRadius: 8, padding: '9px 0',
                  fontSize: 17, fontWeight: 500,
                  cursor: firstAdded ? 'default' : 'pointer',
                  fontFamily: 'inherit',
                }}
              >
                {firstAdded ? <Check size={12} /> : <Plus size={12} />}
                {firstAdded ? 'Added' : 'Add first meaning'}
              </button>
              <button
                onClick={handleOpenFull}
                style={{
                  background: 'none',
                  border: '0.5px solid var(--border-secondary)',
                  borderRadius: 8, padding: '9px 14px',
                  fontSize: 16, color: 'var(--text-primary)',
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

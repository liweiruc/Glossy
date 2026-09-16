import { useState, useEffect, useCallback } from 'react'
import { useParams, useLocation, useNavigate } from 'react-router-dom'
import { ChevronLeft, RefreshCw, Volume2, Check, Undo2 } from 'lucide-react'
import type { WordCache, Definition } from '../db'
import { lookupWord, getCachedWord, generateWord } from '../api/lookup'
import { getErrorMessage } from '../api/llm'
import { addWordSense, deleteReviewItem, getAddedSenseKeys, senseKey } from '../db/queries'
import { useChineseDisplay } from '../db/settings'
import AddSenseButton from '../components/AddSenseButton'
import ErrorBanner from '../components/ErrorBanner'
import SenseBlock from '../components/SenseBlock'
import WordPopup from '../components/WordPopup'

export default function LookupResult() {
  const { lemma } = useParams<{ lemma: string }>()
  const location = useLocation()
  const navigate = useNavigate()
  const chinese = useChineseDisplay()

  const queriedForm = (location.state as { queriedForm?: string } | null)?.queriedForm

  const [wordData, setWordData] = useState<WordCache | null>(null)
  const [loadingData, setLoadingData] = useState(true)
  const [streaming, setStreaming] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [retryable, setRetryable] = useState(false)
  const [expanded, setExpanded] = useState(false)
  const [addedKeys, setAddedKeys] = useState<Set<string>>(new Set())
  const [lastAdded, setLastAdded] = useState<{ id: string; sense: Definition } | null>(null)
  const [refreshing, setRefreshing] = useState(false)
  const [retryKey, setRetryKey] = useState(0)
  const [popupWord, setPopupWord] = useState<string | null>(null)

  const onWordClick = useCallback((w: string) => setPopupWord(w), [])

  useEffect(() => {
    if (!lemma) return

    // Which senses are already cards (fast, always from cache)
    getAddedSenseKeys(lemma).then(setAddedKeys)

    const controller = new AbortController()
    let cancelled = false
    async function load() {
      setLoadingData(true)
      setStreaming(false)
      setErrorMsg(null)
      try {
        let data: WordCache | null
        if (queriedForm) {
          // From Home search: lookupWord handles cache check + LLM + history recording
          data = await lookupWord(queriedForm, undefined, controller.signal, () => {
            if (!cancelled) setStreaming(true)
          })
        } else {
          // From History / Review / direct URL: both cache tiers, no LLM, no history
          data = await getCachedWord(lemma!)
        }
        if (!cancelled) {
          if (data) {
            setWordData(data)
          } else {
            setErrorMsg('Word data not found. Please go back and search again.')
            setRetryable(false)
          }
        }
      } catch (err) {
        if (cancelled) return
        if (err instanceof DOMException && err.name === 'AbortError') return
        setErrorMsg(getErrorMessage(err))
        setRetryable(true)
      } finally {
        if (!cancelled) setLoadingData(false)
      }
    }
    load()
    return () => {
      cancelled = true
      setStreaming(false)
      controller.abort()
    }
  }, [lemma, retryKey])

  async function handleAddSense(sense: Definition) {
    if (!wordData || addedKeys.has(senseKey(wordData.lemma, sense))) return
    const id = await addWordSense(wordData, sense)
    setAddedKeys(prev => new Set([...prev, senseKey(wordData.lemma, sense)]))
    setLastAdded({ id, sense })
  }

  async function handleUndoAdd() {
    if (!wordData || !lastAdded) return
    await deleteReviewItem(lastAdded.id)
    setAddedKeys(prev => {
      const next = new Set(prev)
      next.delete(senseKey(wordData.lemma, lastAdded.sense))
      return next
    })
    setLastAdded(null)
  }

  // Overwrites the shared cache, so everyone gets the new entry — the point of the
  // button is that the old one was wrong or thin for every learner, not just this one.
  async function handleRegenerate() {
    if (!wordData || refreshing) return
    setRefreshing(true)
    setErrorMsg(null)
    setLastAdded(null)
    try {
      const fresh = await generateWord(wordData.lemma)
      setWordData(fresh)
      // Cards keep the wording they were added with, so a reworded sense reads as new.
      setAddedKeys(await getAddedSenseKeys(fresh.lemma))
    } catch (err) {
      setErrorMsg(getErrorMessage(err))
      setRetryable(true)
    } finally {
      setRefreshing(false)
    }
  }

  const showHint = queriedForm && lemma && queriedForm.toLowerCase() !== lemma.toLowerCase()
  const definitions = wordData?.definitions ?? []
  const visibleDefs = expanded ? definitions : definitions.slice(0, 3)
  const hiddenCount = definitions.length - 3

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100dvh' }}>
      {/* AppBar */}
      <div style={{
        height: 48, display: 'flex', alignItems: 'center',
        padding: '0 18px', borderBottom: '0.5px solid var(--border-tertiary)',
        flexShrink: 0,
      }}>
        <button
          onClick={() => navigate(-1)}
          style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, display: 'flex', alignItems: 'center', marginLeft: -4 }}
        >
          <ChevronLeft size={20} color="var(--text-secondary)" />
        </button>
        <span style={{ flex: 1, textAlign: 'center', fontSize: 18, color: 'var(--text-secondary)', fontWeight: 400 }}>
          Lookup
        </span>
        <button
          onClick={handleRegenerate}
          disabled={refreshing || !wordData}
          title="Ask the model for this entry again"
          style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, display: 'flex', alignItems: 'center' }}
        >
          <RefreshCw
            size={18}
            color="var(--text-secondary)"
            style={{ animation: refreshing ? 'spin 0.8s linear infinite' : 'none' }}
          />
        </button>
      </div>

      {/* Error banner */}
      {errorMsg && (
        <ErrorBanner
          message={errorMsg}
          onClose={() => setErrorMsg(null)}
          onRetry={retryable ? () => {
            if (wordData) handleRegenerate()
            else setRetryKey(k => k + 1)
          } : undefined}
        />
      )}

      {/* Body */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '16px 18px', paddingBottom: 80 }}>
        {loadingData && !wordData && !errorMsg && (
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            gap: 7, marginTop: 80,
          }}>
            {streaming && (
              <span style={{
                display: 'inline-block', width: 6, height: 6, borderRadius: '50%',
                background: 'var(--amber-600)',
                animation: 'pulse 1s ease-in-out infinite',
              }} />
            )}
            <span style={{ fontSize: 18, color: 'var(--text-secondary)' }}>
              {streaming ? 'Writing the entry…' : `Looking up ${lemma}…`}
            </span>
          </div>
        )}

        {wordData && (
          <>
            {/* WordHeader */}
            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 39, fontWeight: 500, color: 'var(--text-primary)', letterSpacing: '-0.5px' }}>
                {wordData.lemma}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 4 }}>
                <PhoneticItem label="UK" phonetic={wordData.phonetic_uk} word={wordData.lemma} lang="en-GB" />
                <PhoneticItem label="US" phonetic={wordData.phonetic_us} word={wordData.lemma} lang="en-US" />
              </div>
            </div>

            {/* LemmaHint */}
            {showHint && (
              <div style={{
                display: 'inline-block',
                background: 'var(--bg-secondary)', borderRadius: 6,
                padding: '6px 10px', marginBottom: 14,
              }}>
                <span style={{ fontSize: 14, color: 'var(--text-tertiary)' }}>
                  '{queriedForm}' is a form of '{lemma}'
                </span>
              </div>
            )}

            {/* DefinitionList */}
            <div>
              {visibleDefs.map((def, i) => (
                <div key={i}>
                  <SenseBlock
                    def={def}
                    lemma={wordData.lemma}
                    chinese={chinese}
                    onWordClick={onWordClick}
                    action={
                      <AddSenseButton
                        added={addedKeys.has(senseKey(wordData.lemma, def))}
                        onAdd={() => handleAddSense(def)}
                      />
                    }
                  />
                  {i < visibleDefs.length - 1 && (
                    <div style={{ height: '0.5px', background: 'var(--border-tertiary)', margin: '10px 0' }} />
                  )}
                </div>
              ))}
            </div>

            {/* ExpandButton */}
            {!expanded && hiddenCount > 0 && (
              <button
                onClick={() => setExpanded(true)}
                style={{
                  display: 'block', width: '100%',
                  marginTop: 12, padding: '8px 0',
                  background: 'none', border: 'none',
                  fontSize: 16, color: 'var(--amber-600)',
                  cursor: 'pointer', textAlign: 'center',
                  fontFamily: 'inherit',
                }}
              >
                Show {hiddenCount} more {hiddenCount === 1 ? 'meaning' : 'meanings'}
              </button>
            )}
          </>
        )}
      </div>

      {/* Confirmation bar — the + on each sense is the action; this is its receipt */}
      {lastAdded && (
        <div style={{
          borderTop: '0.5px solid var(--border-tertiary)',
          padding: '10px 18px 14px',
          flexShrink: 0,
          background: 'var(--bg-primary)',
          display: 'flex', alignItems: 'center', gap: 10,
        }}>
          <Check size={16} color="var(--amber-600)" style={{ flexShrink: 0 }} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 17, color: 'var(--text-primary)' }}>Added to review</div>
            <div style={{
              fontSize: 14, color: 'var(--text-secondary)',
              whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
            }}>
              {lastAdded.sense.pos} {lastAdded.sense.en}
            </div>
          </div>
          <button
            onClick={handleUndoAdd}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: 4,
              fontSize: 17, color: 'var(--amber-600)', fontFamily: 'inherit',
              flexShrink: 0, padding: '4px 0',
            }}
          >
            <Undo2 size={14} />
            Undo
          </button>
        </div>
      )}

      {popupWord && (
        <WordPopup word={popupWord} onClose={() => setPopupWord(null)} />
      )}
    </div>
  )
}

function PhoneticItem({ label, phonetic, word, lang }: {
  label: string; phonetic: string; word: string; lang: string
}) {
  function speak() {
    if (!window.speechSynthesis) return
    window.speechSynthesis.cancel()
    const utt = new SpeechSynthesisUtterance(word)
    utt.lang = lang
    utt.rate = 0.9
    window.speechSynthesis.speak(utt)
  }

  return (
    <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 17, color: 'var(--text-secondary)' }}>
      {label} {phonetic}
      <button
        onClick={speak}
        style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 2, display: 'flex', alignItems: 'center' }}
      >
        <Volume2 size={14} color="var(--amber-600)" />
      </button>
    </span>
  )
}

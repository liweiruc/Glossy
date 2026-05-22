import { useState, useEffect, useCallback } from 'react'
import { useParams, useLocation, useNavigate } from 'react-router-dom'
import { ChevronLeft, RefreshCw, Plus, Check } from 'lucide-react'
import { db } from '../db'
import type { TranslationCache, SentenceSnapshot } from '../db'
import { translateText } from '../api/translate'
import { getErrorMessage } from '../api/llm'
import { addReviewItem } from '../db/queries'
import { useToast } from '../components/Toast'
import WordPopup from '../components/WordPopup'
import ClickableText from '../components/ClickableText'
import ErrorBanner from '../components/ErrorBanner'

type Version = 'casual' | 'formal' | 'idiomatic'

const LABELS: Record<Version, string> = {
  casual: 'Casual',
  formal: 'Formal',
  idiomatic: 'Idiomatic',
}

export default function TranslateResult() {
  const { hash } = useParams<{ hash: string }>()
  const location = useLocation()
  const navigate = useNavigate()
  const { showToast } = useToast()

  const sourceText = (location.state as { sourceText?: string } | null)?.sourceText

  const [data, setData] = useState<TranslationCache | null>(null)
  const [loadingData, setLoadingData] = useState(true)
  const [streaming, setStreaming] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)
  const [popupWord, setPopupWord] = useState<string | null>(null)
  const [retryKey, setRetryKey] = useState(0)

  const [addedVersions, setAddedVersions] = useState<Set<Version>>(new Set())
  const [allAdded, setAllAdded] = useState(false)

  useEffect(() => {
    if (!hash) return

    const controller = new AbortController()
    let cancelled = false
    async function load() {
      setLoadingData(true)
      setStreaming(false)
      setErrorMsg(null)
      try {
        let result: TranslationCache | undefined
        if (sourceText) {
          // From Home translate: translateText handles cache check + LLM + history
          result = await translateText(sourceText, undefined, controller.signal, () => {
            if (!cancelled) setStreaming(true)
          })
        } else {
          // From History / direct URL: load from cache only
          result = await db.translation_cache.get(hash!) ?? undefined
        }
        if (cancelled) return
        if (!result) {
          setErrorMsg('Translation not found. Please go back and try again.')
          return
        }
        setData(result)

        // Check review status
        const items = await db.review_items
          .filter(item => item.type === 'sentence' && (item.snapshot as SentenceSnapshot).source_text === result!.source_text)
          .toArray()
        if (cancelled) return
        if (items.length) {
          const vers = new Set<Version>()
          items.forEach(item => {
            const s = item.snapshot as SentenceSnapshot
            if (s.casual_en) vers.add('casual')
            if (s.formal_en) vers.add('formal')
            if (s.idiomatic_en) vers.add('idiomatic')
          })
          if (vers.size >= 3) setAllAdded(true)
          else setAddedVersions(vers)
        }
      } catch (err) {
        if (cancelled) return
        if (err instanceof DOMException && err.name === 'AbortError') return
        setErrorMsg(getErrorMessage(err))
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
  }, [hash, retryKey])

  async function handleRefresh() {
    if (!data || refreshing) return
    setRefreshing(true)
    setErrorMsg(null)
    try {
      await db.translation_cache.delete(hash!)
      const result = await translateText(data.source_text)
      setData(result)
      setAddedVersions(new Set())
      setAllAdded(false)
    } catch (err) {
      setErrorMsg(getErrorMessage(err))
    } finally {
      setRefreshing(false)
    }
  }

  async function handleAddVersion(version: Version) {
    if (!data || addedVersions.has(version) || allAdded) return
    const now = Date.now()
    const en = data[`${version}_en` as keyof TranslationCache] as string
    await addReviewItem({
      id: crypto.randomUUID(),
      type: 'sentence',
      snapshot: {
        source_text: data.source_text,
        casual_en: version === 'casual' ? en : '',
        formal_en: version === 'formal' ? en : '',
        idiomatic_en: version === 'idiomatic' ? en : '',
      } as SentenceSnapshot,
      ease_factor: 2.5,
      interval_days: 0,
      repetitions: 0,
      due_at: now,
      added_at: now,
      last_reviewed_at: null,
    })
    setAddedVersions(prev => new Set([...prev, version]))
    showToast('已加入复习本')
  }

  async function handleAddAll() {
    if (!data || allAdded || addedVersions.size > 0) return
    const now = Date.now()
    await addReviewItem({
      id: crypto.randomUUID(),
      type: 'sentence',
      snapshot: {
        source_text: data.source_text,
        casual_en: data.casual_en,
        formal_en: data.formal_en,
        idiomatic_en: data.idiomatic_en,
      } as SentenceSnapshot,
      ease_factor: 2.5,
      interval_days: 0,
      repetitions: 0,
      due_at: now,
      added_at: now,
      last_reviewed_at: null,
    })
    setAllAdded(true)
    showToast('已加入复习本')
  }

  const onWordClick = useCallback((word: string) => setPopupWord(word), [])
  const ctaDisabled = allAdded || addedVersions.size > 0

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
          Translate
        </span>
        <button
          onClick={handleRefresh}
          disabled={refreshing || !data}
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
          onRetry={sourceText || data ? () => {
            if (data) handleRefresh()
            else setRetryKey(k => k + 1)
          } : undefined}
        />
      )}

      {/* Body */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '14px 18px', paddingBottom: 80 }}>
        {loadingData && !data && !errorMsg && (
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
              {streaming ? 'AI 正在回复...' : '正在翻译...'}
            </span>
          </div>
        )}

        {data && (
          <>
            {/* SourceText */}
            <div style={{
              background: 'var(--bg-secondary)', borderRadius: 10,
              padding: 12, marginBottom: 16,
              fontSize: 18, color: 'var(--text-primary)', lineHeight: 1.5,
            }}>
              {data.source_text}
            </div>

            <div style={{
              fontSize: 14, color: 'var(--text-tertiary)',
              textTransform: 'uppercase', letterSpacing: '0.5px',
              marginBottom: 10,
            }}>
              Three versions
            </div>

            {(['casual', 'formal', 'idiomatic'] as Version[]).map(version => {
              const text = version === 'casual' ? data.casual_en
                : version === 'formal' ? data.formal_en
                : data.idiomatic_en
              const vAdded = addedVersions.has(version)
              return (
                <div key={version} style={{
                  border: '0.5px solid var(--border-tertiary)',
                  borderRadius: 10,
                  padding: '11px 12px',
                  marginBottom: 10,
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                    <span style={{
                      fontSize: 14, textTransform: 'uppercase',
                      letterSpacing: '0.4px', color: 'var(--amber-700)',
                      fontWeight: 500,
                    }}>
                      {LABELS[version]}
                    </span>
                    <button
                      onClick={() => handleAddVersion(version)}
                      disabled={vAdded || allAdded}
                      style={{ background: 'none', border: 'none', cursor: vAdded || allAdded ? 'default' : 'pointer', padding: 2, display: 'flex' }}
                    >
                      {vAdded || allAdded
                        ? <Check size={18} color="var(--amber-600)" />
                        : <Plus size={18} color="var(--text-tertiary)" />}
                    </button>
                  </div>

                  <div style={{ fontSize: 18, color: 'var(--text-primary)', lineHeight: 1.5 }}>
                    <ClickableText text={text} onWordClick={onWordClick} />
                  </div>

                  {version === 'idiomatic' && data.idiomatic_note && (
                    <div style={{ fontSize: 14, color: 'var(--text-tertiary)', marginTop: 6 }}>
                      {data.idiomatic_note}
                    </div>
                  )}
                </div>
              )
            })}
          </>
        )}
      </div>

      {/* CtaBar */}
      {data && (
        <div style={{
          borderTop: '0.5px solid var(--border-tertiary)',
          padding: '10px 18px 14px',
          flexShrink: 0,
          background: 'var(--bg-primary)',
        }}>
          <button
            onClick={handleAddAll}
            disabled={ctaDisabled}
            style={{
              width: '100%',
              background: ctaDisabled ? 'var(--bg-secondary)' : 'var(--amber-600)',
              color: ctaDisabled ? 'var(--text-secondary)' : '#fff',
              border: 'none', borderRadius: 10, padding: '12px 0',
              fontSize: 18, fontWeight: 500,
              cursor: ctaDisabled ? 'default' : 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
              fontFamily: 'inherit',
              transition: 'background 0.2s, color 0.2s',
            }}
          >
            {ctaDisabled ? <Check size={14} /> : <Plus size={14} />}
            {ctaDisabled ? 'Already added' : 'Add all to review'}
          </button>
        </div>
      )}

      {popupWord && (
        <WordPopup word={popupWord} onClose={() => setPopupWord(null)} />
      )}
    </div>
  )
}

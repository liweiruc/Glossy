import { Fragment, memo } from 'react'

interface Props {
  text: string
  onWordClick: (word: string) => void
}

const WORD_RE = /[A-Za-z]+(?:['’\-][A-Za-z]+)*/g

function ClickableTextInner({ text, onWordClick }: Props) {
  const parts: Array<{ kind: 'word' | 'gap'; text: string }> = []
  let last = 0
  for (const m of text.matchAll(WORD_RE)) {
    const start = m.index ?? 0
    if (start > last) parts.push({ kind: 'gap', text: text.slice(last, start) })
    parts.push({ kind: 'word', text: m[0] })
    last = start + m[0].length
  }
  if (last < text.length) parts.push({ kind: 'gap', text: text.slice(last) })

  if (parts.length === 0) return <>{text}</>

  return (
    <>
      {parts.map((p, i) =>
        p.kind === 'word' ? (
          <span
            key={i}
            className="clickable-word"
            onClick={() => onWordClick(p.text)}
            style={{
              borderBottom: '1px dotted var(--border-secondary)',
              cursor: 'pointer',
            }}
          >
            {p.text}
          </span>
        ) : (
          <Fragment key={i}>{p.text}</Fragment>
        )
      )}
    </>
  )
}

export default memo(ClickableTextInner)

import { Fragment, memo } from 'react'
import type { ReactNode } from 'react'
import { WORD_RE } from '../utils/highlight'

interface Props {
  text: string
  // `start` is the offset in `text`, so a caller reading a passage can tell which
  // occurrence was tapped and hand the model the right sentence.
  onWordClick: (word: string, start: number) => void
  chunks?: string[]
}

interface Range {
  start: number
  end: number
}

// Multi-word expressions are looked up whole: tapping inside "pull off" must not hand
// back the entry for "pull". Only the first occurrence of each chunk is marked, and
// overlapping chunks are dropped rather than nested.
function chunkRanges(text: string, chunks: string[]): Range[] {
  const lower = text.toLowerCase()
  const ranges: Range[] = []
  for (const chunk of chunks) {
    const needle = chunk.trim().toLowerCase()
    if (!needle) continue
    const start = lower.indexOf(needle)
    if (start < 0) continue
    const end = start + needle.length
    if (ranges.some(r => start < r.end && end > r.start)) continue
    ranges.push({ start, end })
  }
  return ranges.sort((a, b) => a.start - b.start)
}

function ClickableTextInner({ text, onWordClick, chunks }: Props) {
  const ranges = chunks?.length ? chunkRanges(text, chunks) : []
  const nodes: ReactNode[] = []
  let key = 0

  // Single words stay tappable but carry no decoration — underlining every word turns
  // a paragraph into noise. Only chunks are marked, because their extent is the point.
  function pushWords(slice: string, offset: number) {
    let last = 0
    for (const match of slice.matchAll(WORD_RE)) {
      const start = match.index ?? 0
      if (start > last) nodes.push(<Fragment key={key++}>{slice.slice(last, start)}</Fragment>)
      const word = match[0]
      const at = offset + start
      nodes.push(
        <span key={key++} className="clickable-word" onClick={() => onWordClick(word, at)}>
          {word}
        </span>
      )
      last = start + word.length
    }
    if (last < slice.length) nodes.push(<Fragment key={key++}>{slice.slice(last)}</Fragment>)
  }

  let cursor = 0
  for (const range of ranges) {
    if (range.start > cursor) pushWords(text.slice(cursor, range.start), cursor)
    const chunk = text.slice(range.start, range.end)
    const at = range.start
    nodes.push(
      <span key={key++} className="clickable-chunk" onClick={() => onWordClick(chunk, at)}>
        {chunk}
      </span>
    )
    cursor = range.end
  }
  if (cursor < text.length) pushWords(text.slice(cursor), cursor)

  return <>{nodes}</>
}

export default memo(ClickableTextInner)

import { useRef, useState } from 'react'
import type { ReactNode } from 'react'

const REVEAL_W = 80      // width of the Delete button revealed behind the row
const AXIS_LOCK_PX = 8   // movement before we commit the gesture to an axis
const SNAP_PX = REVEAL_W / 2

interface SwipeToDeleteProps {
  /** Controlled by the parent so only one row in a list can be open at a time. */
  open: boolean
  onOpenChange: (open: boolean) => void
  onDelete: () => void
  children: ReactNode
}

/**
 * Swipe a row left to reveal a Delete button.
 *
 * Uses Pointer Events so mouse and touch share one code path. `touchAction: 'pan-y'`
 * leaves vertical scrolling to the browser: a gesture that starts out vertical is
 * abandoned outright, so list scrolling never feels sticky.
 */
export default function SwipeToDelete({ open, onOpenChange, onDelete, children }: SwipeToDeleteProps) {
  // null while settled (offset derives from `open`); a number while dragging.
  const [drag, setDrag] = useState<number | null>(null)
  const start = useRef<{ x: number; y: number; base: number } | null>(null)
  const axis = useRef<'undecided' | 'x' | 'y'>('undecided')
  const didDrag = useRef(false)
  // Mirrors `drag` for reads inside pointerup: pointermove is a continuous event,
  // so React may defer its state update and leave the rendered value stale.
  const offsetRef = useRef(0)

  const offset = drag ?? (open ? -REVEAL_W : 0)

  function reset() {
    start.current = null
    axis.current = 'undecided'
    setDrag(null)
  }

  function handlePointerDown(e: React.PointerEvent) {
    const base = open ? -REVEAL_W : 0
    didDrag.current = false
    axis.current = 'undecided'
    offsetRef.current = base
    start.current = { x: e.clientX, y: e.clientY, base }
  }

  function handlePointerMove(e: React.PointerEvent) {
    const s = start.current
    if (!s || axis.current === 'y') return

    const dx = e.clientX - s.x
    const dy = e.clientY - s.y

    if (axis.current === 'undecided') {
      if (Math.abs(dx) < AXIS_LOCK_PX && Math.abs(dy) < AXIS_LOCK_PX) return
      if (Math.abs(dy) > Math.abs(dx)) {
        // Vertical intent — hand the gesture back to the scroll container.
        axis.current = 'y'
        return
      }
      axis.current = 'x'
      didDrag.current = true
      // Capture only once committed to horizontal, so we keep receiving moves
      // even if the pointer leaves the row.
      e.currentTarget.setPointerCapture(e.pointerId)
    }

    const next = Math.max(-REVEAL_W, Math.min(0, s.base + dx))
    offsetRef.current = next
    setDrag(next)
  }

  function handlePointerUp() {
    if (axis.current === 'x') {
      onOpenChange(offsetRef.current <= -SNAP_PX)
    }
    reset()
  }

  function handleClickCapture(e: React.MouseEvent) {
    // A mouse swipe synthesises a click on pointerup, by which point `open` is
    // already true. Swallow it whole: it must neither navigate nor close the row
    // the swipe just opened. Checked before `open` for exactly that reason.
    if (didDrag.current) {
      e.preventDefault()
      e.stopPropagation()
      didDrag.current = false
      return
    }
    // A real tap on an open row closes it rather than navigating.
    if (open) {
      e.preventDefault()
      e.stopPropagation()
      onOpenChange(false)
    }
  }

  return (
    <div style={{ position: 'relative', overflow: 'hidden' }}>
      <button
        onClick={e => { e.stopPropagation(); onDelete() }}
        tabIndex={open ? 0 : -1}
        aria-hidden={!open}
        style={{
          position: 'absolute', top: 0, right: 0, bottom: 0, width: REVEAL_W,
          background: '#dc2626', color: '#fff',
          border: 'none', padding: 0,
          fontSize: 16, fontFamily: 'inherit',
          cursor: 'pointer',
        }}
      >
        Delete
      </button>

      <div
        style={{
          position: 'relative',
          background: 'var(--bg-primary)',
          transform: `translateX(${offset}px)`,
          transition: drag === null ? 'transform 0.2s ease' : 'none',
          touchAction: 'pan-y',
          // Without this a mouse drag selects the row text instead of swiping.
          userSelect: 'none',
          WebkitUserSelect: 'none',
          WebkitTouchCallout: 'none',
        }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={reset}
        onClickCapture={handleClickCapture}
      >
        {children}
      </div>
    </div>
  )
}

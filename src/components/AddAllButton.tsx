import { Plus, Check } from 'lucide-react'

interface Props {
  total: number       // senses in the entry
  remaining: number   // of those, how many are not in the review book yet
  busy?: boolean
  compact?: boolean   // the popup's button, sharing a row with "Open full"
  onAdd: () => void
}

function labelFor(total: number, remaining: number): string {
  if (remaining === 0) return total === 1 ? 'Added' : 'All meanings added'
  if (remaining < total) return `Add ${remaining} more ${remaining === 1 ? 'meaning' : 'meanings'}`
  if (total === 1) return 'Add to review'
  if (total === 2) return 'Add both meanings'
  return `Add all ${total} meanings`
}

// Puts every sense of an entry in the review book in one tap — still one card per sense,
// the same cards the + on each would make. The label counts what a tap will add, because
// some of those senses may be folded away (the lookup page) or not shown at all (the popup).
export default function AddAllButton({ total, remaining, busy = false, compact = false, onAdd }: Props) {
  const done = remaining === 0
  return (
    <button
      onClick={onAdd}
      disabled={done || busy}
      style={{
        flex: 1,
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: compact ? 5 : 6,
        background: done ? 'var(--bg-secondary)' : 'var(--amber-600)',
        color: done ? 'var(--text-secondary)' : '#fff',
        border: 'none', borderRadius: compact ? 8 : 10,
        padding: compact ? '9px 0' : '12px 0',
        fontSize: compact ? 17 : 18, fontWeight: 500,
        cursor: done || busy ? 'default' : 'pointer',
        fontFamily: 'inherit',
        transition: 'background 0.2s, color 0.2s',
      }}
    >
      {done ? <Check size={compact ? 12 : 14} /> : <Plus size={compact ? 12 : 14} />}
      {labelFor(total, remaining)}
    </button>
  )
}

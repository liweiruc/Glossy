import { Plus, Check } from 'lucide-react'

interface Props {
  added: boolean
  onAdd: () => void
}

// Adds one sense, not the whole word. The glyph stays small — the app is quiet — but the
// tap area around it is 44px, because this is now the primary action on the screen.
export default function AddSenseButton({ added, onAdd }: Props) {
  return (
    <button
      onClick={onAdd}
      disabled={added}
      aria-label={added ? 'Added to review' : 'Add this meaning to review'}
      style={{
        width: 44, height: 44, marginRight: -12, flexShrink: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'none', border: 'none',
        cursor: added ? 'default' : 'pointer',
      }}
    >
      {added
        ? <Check size={18} color="var(--amber-600)" />
        : <Plus size={18} color="var(--text-tertiary)" />}
    </button>
  )
}

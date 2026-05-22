import { X } from 'lucide-react'

interface Props {
  message: string
  onClose: () => void
  onRetry?: () => void
}

export default function ErrorBanner({ message, onClose, onRetry }: Props) {
  return (
    <div style={{
      background: '#FEF2F2',
      borderBottom: '0.5px solid #FECACA',
      padding: '10px 14px',
      display: 'flex', alignItems: 'flex-start', gap: 8,
      flexShrink: 0,
    }}>
      <span style={{ flex: 1, fontSize: 17, color: '#991B1B', lineHeight: 1.45 }}>
        {message}
      </span>
      {onRetry && (
        <button
          onClick={onRetry}
          style={{
            background: 'none', border: 'none',
            fontSize: 16, color: '#991B1B',
            cursor: 'pointer', fontFamily: 'inherit',
            textDecoration: 'underline', flexShrink: 0, padding: '1px 0',
          }}
        >
          重试
        </button>
      )}
      <button
        onClick={onClose}
        style={{
          background: 'none', border: 'none', padding: 2,
          cursor: 'pointer', display: 'flex', alignItems: 'center', flexShrink: 0,
        }}
      >
        <X size={14} color="#991B1B" />
      </button>
    </div>
  )
}

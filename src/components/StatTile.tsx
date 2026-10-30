import type { ReactNode } from 'react'

// One number with its label: the Review tab's day at a glance, and the end of a session.
export default function StatTile({ label, value, sub }: { label: string; value: ReactNode; sub?: string }) {
  return (
    <div style={{
      border: '0.5px solid var(--border-secondary)', borderRadius: 12,
      padding: '12px 14px', minWidth: 0,
    }}>
      <div style={{ fontSize: 14, color: 'var(--text-secondary)' }}>{label}</div>
      <div style={{ fontSize: 23, fontWeight: 500, color: 'var(--text-primary)', marginTop: 2 }}>
        {value}
      </div>
      {sub && (
        <div style={{
          fontSize: 13, color: 'var(--text-tertiary)', marginTop: 2,
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
          {sub}
        </div>
      )}
    </div>
  )
}

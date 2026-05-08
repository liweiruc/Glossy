function Rect({ w, h, r = 6, mb = 0 }: { w?: string | number; h: number; r?: number; mb?: number }) {
  return (
    <div style={{
      width: w ?? '100%',
      height: h,
      borderRadius: r,
      background: 'var(--bg-secondary)',
      marginBottom: mb,
      flexShrink: 0,
    }} />
  )
}

export function LookupSkeleton() {
  return (
    <div style={{ padding: '16px 18px', paddingBottom: 80 }}>
      {/* word + phonetics */}
      <Rect w={160} h={34} mb={10} />
      <div style={{ display: 'flex', gap: 12, marginBottom: 24 }}>
        <Rect w={72} h={14} />
        <Rect w={72} h={14} />
      </div>

      {/* 3 definition blocks */}
      {[0, 1, 2].map(i => (
        <div key={i} style={{ marginBottom: 22 }}>
          <Rect w={44} h={18} r={4} mb={8} />
          <Rect h={13} mb={5} />
          <Rect w="88%" h={13} mb={5} />
          <Rect w="94%" h={11} mb={4} />
          <Rect w="76%" h={11} />
        </div>
      ))}
    </div>
  )
}

export function TranslateSkeleton() {
  return (
    <div style={{ padding: '14px 18px', paddingBottom: 80 }}>
      {/* source text block */}
      <Rect h={68} r={10} mb={16} />

      {/* 3 style cards */}
      {[0, 1, 2].map(i => (
        <div key={i} style={{
          border: '0.5px solid var(--border-tertiary)',
          borderRadius: 10, padding: '11px 12px',
          marginBottom: 10,
        }}>
          <Rect w={60} h={11} mb={10} />
          <Rect h={14} mb={5} />
          <Rect w="82%" h={14} />
        </div>
      ))}
    </div>
  )
}

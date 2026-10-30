import { Fragment, useLayoutEffect, useRef, useState } from 'react'
import type { CSSProperties, KeyboardEvent, PointerEvent, ReactNode } from 'react'
import { ChartColumn, Table2 } from 'lucide-react'

export interface Series {
  label: string
  color: string
  values: number[]
}

export interface TableView {
  columns: string[]
  rows: (string | number)[][]
}

// Hairline chrome, so the data is the only loud thing on a chart.
const GRID = 'var(--border-tertiary)'
const BASELINE = 'var(--border-primary)'
const INK = 'var(--text-tertiary)'
const ACCENT = 'var(--amber-600)'
const SURFACE = 'var(--bg-primary)'
const TRACK = 'var(--border-secondary)'

// Light to dark with how much was done: one amber ramp, each step checked to stand apart
// from the next and the lightest to show on white.
const HEAT = ['var(--amber-400)', 'var(--amber-600)', 'var(--amber-700)', 'var(--amber-950)']

const AXIS_W = 40 // the y-axis labels, right of the plot, beside the latest day
const PAD_TOP = 8 // so the top gridline's label is not cut in half
const X_AXIS = 24 // the date labels under the plot
const DAY_LABELS = 16 // the heatmap's M / W / F
const MONTHS = 20 // the heatmap's month names

const ARROWS = { ArrowLeft: -1, ArrowRight: 1 }

function percent(share: number): string {
  return `${Math.round(share * 100)}%`
}

function formatCount(n: number): string {
  return n.toLocaleString('en-US')
}

// The chart draws in pixels, so it follows the width it is given.
function useWidth() {
  const ref = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState(0)
  useLayoutEffect(() => {
    const observer = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width))
    observer.observe(ref.current!)
    return () => observer.disconnect()
  }, [])
  return [ref, width] as const
}

// Which column (or day) is picked: tapped, slid to with a finger, hovered with a mouse, or
// stepped to with the arrow keys. Nothing picked shows the chart's summary instead.
function usePicker(count: number, steps: Record<string, number>) {
  const [picked, setPicked] = useState<number | null>(null)
  // What was under the finger when it went down; -1 once it has slid off it.
  const pressed = useRef<number | null>(null)

  function bind(indexAt: (x: number, y: number) => number | null) {
    const at = (e: PointerEvent<SVGSVGElement>) => {
      const box = e.currentTarget.getBoundingClientRect()
      return indexAt(e.clientX - box.left, e.clientY - box.top)
    }
    return {
      tabIndex: 0,
      // Vertical swipes still scroll the page; sideways ones slide along the chart.
      style: { display: 'block', touchAction: 'pan-y' } as CSSProperties,
      onPointerDown(e: PointerEvent<SVGSVGElement>) {
        const i = at(e)
        if (e.pointerType === 'mouse') {
          setPicked(i)
          return
        }
        pressed.current = i
        // A second tap on the picked column brings the summary back.
        setPicked(p => (p === i ? null : i))
      },
      onPointerMove(e: PointerEvent<SVGSVGElement>) {
        const touch = e.pointerType !== 'mouse'
        if (touch && !e.buttons) return
        const i = at(e)
        if (i === null || (touch && i === pressed.current)) return
        pressed.current = -1
        setPicked(i)
      },
      onPointerLeave(e: PointerEvent<SVGSVGElement>) {
        if (e.pointerType === 'mouse') setPicked(null)
      },
      onKeyDown(e: KeyboardEvent<SVGSVGElement>) {
        const step = steps[e.key]
        if (step !== undefined && count > 0) {
          e.preventDefault()
          setPicked(p => (p === null ? count - 1 : Math.min(count - 1, Math.max(0, p + step))))
        } else if (e.key === 'Escape') {
          setPicked(null)
        }
      },
    }
  }

  return { picked, bind }
}

// A bordered card with a title, for a chart or a few figures. Given `table`, it can show
// the same numbers as rows instead, so no value depends on tapping a chart.
export function Panel({ title, note, aside, table, children }: {
  title: string
  note?: ReactNode
  aside?: ReactNode
  table?: TableView
  children: ReactNode
}) {
  const [asTable, setAsTable] = useState(false)
  return (
    <section style={{
      border: '0.5px solid var(--border-secondary)', borderRadius: 14,
      padding: 16, marginBottom: 12,
    }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <h2 style={{ fontSize: 17, fontWeight: 500, color: 'var(--text-primary)', margin: 0 }}>{title}</h2>
          {note && (
            <div style={{ fontSize: 14, color: 'var(--text-secondary)', marginTop: 2, lineHeight: 1.45 }}>{note}</div>
          )}
        </div>
        {aside}
        {table && (
          <button
            onClick={() => setAsTable(t => !t)}
            aria-pressed={asTable}
            aria-label={asTable ? 'Show as a chart' : 'Show as a table'}
            title={asTable ? 'Show as a chart' : 'Show as a table'}
            style={{
              background: 'none', border: 'none', padding: 10, margin: -10,
              cursor: 'pointer', display: 'flex', color: 'var(--text-tertiary)', flexShrink: 0,
            }}
          >
            {asTable ? <ChartColumn size={18} /> : <Table2 size={18} />}
          </button>
        )}
      </div>
      <div style={{ marginTop: 14 }}>
        {asTable && table ? <DataTable table={table} /> : children}
      </div>
    </section>
  )
}

function DataTable({ table }: { table: TableView }) {
  const cell = (i: number): CSSProperties => ({
    textAlign: i === 0 ? 'left' : 'right',
    paddingLeft: i === 0 ? 0 : 12,
  })
  return (
    <div style={{ maxHeight: 300, overflowY: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14, fontVariantNumeric: 'tabular-nums' }}>
        <thead>
          <tr>
            {table.columns.map((column, i) => (
              <th key={column} style={{
                ...cell(i), position: 'sticky', top: 0, background: SURFACE,
                fontSize: 13, fontWeight: 500, color: 'var(--text-tertiary)', paddingBottom: 6,
              }}>
                {column}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {table.rows.map((row, r) => (
            <tr key={r} style={{ borderTop: '0.5px solid var(--border-tertiary)' }}>
              {row.map((value, i) => (
                <td key={i} style={{
                  ...cell(i), padding: `7px 0 7px ${i === 0 ? 0 : 12}px`,
                  color: i === 0 ? 'var(--text-secondary)' : 'var(--text-primary)',
                }}>
                  {value}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function Legend({ items }: { items: { label: string; color: string }[] }) {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 14px', marginBottom: 8 }}>
      {items.map(item => (
        <span key={item.label} style={{
          display: 'inline-flex', alignItems: 'center', gap: 6,
          fontSize: 14, color: 'var(--text-secondary)',
        }}>
          <span style={{ width: 10, height: 10, borderRadius: 2, background: item.color, flexShrink: 0 }} />
          {item.label}
        </span>
      ))}
    </div>
  )
}

// What the chart says in words: its summary, or the picked column. Two lines high either
// way, so picking never moves the chart, and read out when it changes.
function Readout({ children }: { children: ReactNode }) {
  return (
    <div aria-live="polite" style={{
      fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.45,
      minHeight: 41, marginBottom: 8,
    }}>
      {children}
    </div>
  )
}

// Gridlines at zero and two or three round steps: whichever puts the top one closest above
// the tallest column, so the columns fill the height they are given.
function ticksFor(max: number): number[] {
  let ticks: number[] = []
  for (const steps of [2, 3]) {
    const rough = Math.max(1, max / steps)
    const power = 10 ** Math.floor(Math.log10(rough))
    const step = [1, 2, 5, 10].map(m => m * power).find(s => s >= rough)!
    if (!ticks.length || step * steps < ticks[ticks.length - 1]) {
      ticks = Array.from({ length: steps + 1 }, (_, k) => k * step)
    }
  }
  return ticks
}

function Grid({ ticks, y, width, format }: {
  ticks: number[]
  y: (value: number) => number
  width: number
  format: (value: number) => string // '' leaves the line unlabelled
}) {
  return (
    <g>
      {ticks.map(tick => (
        <g key={tick}>
          <line
            x1={0} x2={width} y1={y(tick)} y2={y(tick)}
            stroke={tick === 0 ? BASELINE : GRID} shapeRendering="crispEdges"
          />
          {format(tick) && (
            <text x={width + 6} y={y(tick)} dy="0.35em" fontSize={13} fill={INK}>{format(tick)}</text>
          )}
        </g>
      ))}
    </g>
  )
}

// Labels under the columns, each centred on its own. One at either end is only moved as far
// as it takes to stay inside the chart; on the right it may run on under the axis.
function XLabels({ labels, band, top, width }: { labels: string[]; band: number; top: number; width: number }) {
  return (
    <g>
      {labels.map((text, i) => {
        if (!text) return null
        const half = text.length * 4 // a little over half its width at 13px
        const x = Math.min(width - half, Math.max(half, (i + 0.5) * band))
        return <text key={i} x={x} y={top} fontSize={13} fill={INK} textAnchor="middle">{text}</text>
      })}
    </g>
  )
}

function Dot({ x, y }: { x: number; y: number }) {
  return <circle cx={x} cy={y} r={4} fill={ACCENT} stroke={SURFACE} strokeWidth={2} />
}

// A column grows from the baseline: rounded at the top, square at its foot.
function columnPath(x: number, top: number, width: number, bottom: number): string {
  const r = Math.min(4, width / 2, bottom - top)
  return `M${x},${bottom}V${top + r}A${r},${r} 0 0 1 ${x + r},${top}`
    + `H${x + width - r}A${r},${r} 0 0 1 ${x + width},${top + r}V${bottom}Z`
}

// One column's parts, bottom up, in the data's own units. Empty parts are left out.
function stack(series: Series[], i: number): { color: string; from: number; to: number }[] {
  const parts: { color: string; from: number; to: number }[] = []
  let base = 0
  for (const { color, values } of series) {
    if (values[i] <= 0) continue
    parts.push({ color, from: base, to: base + values[i] })
    base += values[i]
  }
  return parts
}

// Columns, one series or several stacked; tap one to read it.
export function ColumnChart({ series, labels, summary, describe, label, height = 160 }: {
  series: Series[] // stacked from the baseline up
  labels: string[] // one per column; '' for none
  summary: ReactNode
  describe: (i: number) => ReactNode
  label: string
  height?: number
}) {
  const [ref, width] = useWidth()
  const n = labels.length
  const { picked, bind } = usePicker(n, ARROWS)
  const totals = labels.map((_, i) => series.reduce((sum, s) => sum + s.values[i], 0))
  const ticks = ticksFor(Math.max(0, ...totals))
  const plotW = Math.max(0, width - AXIS_W)
  const plotH = height - PAD_TOP - X_AXIS
  const band = n ? plotW / n : 0
  // The surface gap between neighbouring columns, and between the parts of one.
  const gap = band >= 8 ? 2 : 1
  const barW = Math.max(1, Math.min(24, band - gap))
  const y = (value: number) => PAD_TOP + plotH - (value / ticks[ticks.length - 1]) * plotH

  return (
    <div>
      {series.length > 1 && <Legend items={series} />}
      <Readout>{picked === null ? summary : describe(picked)}</Readout>
      <div ref={ref} style={{ height }}>
        {width > 0 && (
          <svg
            width={width} height={height} role="img" aria-label={label}
            {...bind(x => (x < plotW ? Math.min(n - 1, Math.floor(x / band)) : null))}
          >
            <Grid ticks={ticks} y={y} width={plotW} format={formatCount} />
            {labels.map((_, i) => {
              const parts = stack(series, i)
              const x = i * band + (band - barW) / 2
              return (
                <g key={i} opacity={picked === null || picked === i ? 1 : 0.35}>
                  {parts.map((part, k) => {
                    const bottom = y(part.from) - (k > 0 ? gap : 0)
                    const top = Math.min(y(part.to), bottom - 1)
                    return k === parts.length - 1
                      ? <path key={k} d={columnPath(x, top, barW, bottom)} fill={part.color} />
                      : <rect key={k} x={x} y={top} width={barW} height={bottom - top} fill={part.color} />
                  })}
                </g>
              )
            })}
            <XLabels labels={labels} band={band} top={PAD_TOP + plotH + 17} width={width} />
          </svg>
        )}
      </div>
    </div>
  )
}

// Unbroken stretches of values: the line stops where there is nothing to show.
function runsOf(values: (number | null)[]): number[][] {
  const runs: number[][] = []
  values.forEach((value, i) => {
    if (value === null) return
    if (i > 0 && values[i - 1] !== null) runs[runs.length - 1].push(i)
    else runs.push([i])
  })
  return runs
}

// A share over time, 0 to 100%, against an optional target line.
export function LineChart({ values, labels, target, summary, describe, label, height = 160 }: {
  values: (number | null)[] // 0 to 1; null where there is nothing to show
  labels: string[]
  target?: number
  summary: ReactNode
  describe: (i: number) => ReactNode
  label: string
  height?: number
}) {
  const [ref, width] = useWidth()
  const n = values.length
  const { picked, bind } = usePicker(n, ARROWS)
  const plotW = Math.max(0, width - AXIS_W)
  const plotH = height - PAD_TOP - X_AXIS
  const band = n ? plotW / n : 0
  const x = (i: number) => (i + 0.5) * band
  const y = (value: number) => PAD_TOP + (1 - value) * plotH
  const runs = runsOf(values)
  const line = (run: number[]) => run.map((i, k) => `${k ? 'L' : 'M'}${x(i)},${y(values[i]!)}`).join('')
  const last = values.findLastIndex(value => value !== null)
  // The target is labelled beside the axis, where no line can run through it; the 100%
  // label makes way when the two would touch.
  const crowded = target !== undefined && y(target) - y(1) < 13

  return (
    <div>
      <Readout>{picked === null ? summary : describe(picked)}</Readout>
      <div ref={ref} style={{ height }}>
        {width > 0 && (
          <svg
            width={width} height={height} role="img" aria-label={label}
            {...bind(px => (px < plotW ? Math.min(n - 1, Math.floor(px / band)) : null))}
          >
            <Grid
              ticks={[0, 0.5, 1]} y={y} width={plotW}
              format={value => (value === 1 && crowded ? '' : percent(value))}
            />
            {target !== undefined && (
              <g>
                <line
                  x1={0} x2={plotW} y1={y(target)} y2={y(target)}
                  stroke={INK} strokeDasharray="4 3" shapeRendering="crispEdges"
                />
                <text
                  x={plotW + 6} y={y(target)} dy="0.35em"
                  fontSize={13} fontWeight={500} fill="var(--text-secondary)"
                >
                  {percent(target)}
                </text>
              </g>
            )}
            {runs.filter(run => run.length > 1).map(run => (
              <g key={run[0]}>
                <path
                  d={`${line(run)}L${x(run[run.length - 1])},${y(0)}L${x(run[0])},${y(0)}Z`}
                  fill={ACCENT} fillOpacity={0.1}
                />
                <path
                  d={line(run)} fill="none" stroke={ACCENT} strokeWidth={2}
                  strokeLinejoin="round" strokeLinecap="round"
                />
              </g>
            ))}
            {runs.filter(run => run.length === 1).map(([i]) => <Dot key={i} x={x(i)} y={y(values[i]!)} />)}
            {picked !== null && (
              <line x1={x(picked)} x2={x(picked)} y1={PAD_TOP} y2={PAD_TOP + plotH} stroke={BASELINE} />
            )}
            {picked !== null && values[picked] !== null && <Dot x={x(picked)} y={y(values[picked]!)} />}
            {/* The latest value is marked; its figure, like every other, is in the readout. A
                label beside it would sit on the line it ends. */}
            {last >= 0 && <Dot x={x(last)} y={y(values[last]!)} />}
            <XLabels labels={labels} band={band} top={PAD_TOP + plotH + 17} width={width} />
          </svg>
        )}
      </div>
    </div>
  )
}

// Four steps, each a quarter of the busiest day; a day with nothing done is the track's grey.
function heatScale(max: number) {
  const q = Math.max(1, Math.ceil(max / 4))
  return {
    color: (count: number) => (count > 0 ? HEAT[Math.min(3, Math.floor((count - 1) / q))] : TRACK),
    steps: [
      { color: TRACK, label: '0' },
      ...HEAT.map((color, k) => ({
        color,
        label: k === 3 ? `${3 * q + 1}+` : q === 1 ? `${k + 1}` : `${k * q + 1}–${(k + 1) * q}`,
      })),
    ],
  }
}

// A month's name over the first week whose Monday falls in it. The first week gets one
// only when the next name is far enough off not to run into it.
function monthLabels(days: { day: number }[]): { week: number; text: string }[] {
  const labels: { week: number; text: string }[] = []
  for (let week = 0; week * 7 < days.length; week++) {
    const monday = new Date(days[week * 7].day)
    if (week > 0 && monday.getMonth() === new Date(days[week * 7 - 7].day).getMonth()) continue
    labels.push({ week, text: monday.toLocaleDateString('en-US', { month: 'short' }) })
  }
  if (labels.length > 1 && labels[1].week < 3) labels.shift()
  return labels
}

// One square a day, a column a week, Monday at the top.
export function CalendarHeatmap({ days, summary, describe, label }: {
  days: { day: number; count: number }[] // one a day, from a Monday
  summary: ReactNode
  describe: (i: number) => ReactNode
  label: string
}) {
  const [ref, width] = useWidth()
  const n = days.length
  const { picked, bind } = usePicker(n, { ArrowLeft: -7, ArrowRight: 7, ArrowUp: -1, ArrowDown: 1 })
  const weeks = Math.ceil(n / 7)
  const pitch = weeks ? (width - DAY_LABELS) / weeks : 0
  const cell = Math.max(1, pitch - 2)
  const scale = heatScale(Math.max(0, ...days.map(d => d.count)))
  const left = (i: number) => DAY_LABELS + Math.floor(i / 7) * pitch
  const top = (i: number) => MONTHS + (i % 7) * pitch

  return (
    <div>
      <Readout>{picked === null ? summary : describe(picked)}</Readout>
      <div ref={ref}>
        {width > 0 && (
          <svg
            width={width} height={MONTHS + 7 * pitch} role="img" aria-label={label}
            {...bind((x, y) => {
              const row = Math.floor((y - MONTHS) / pitch)
              const i = Math.floor((x - DAY_LABELS) / pitch) * 7 + row
              return x >= DAY_LABELS && row >= 0 && row < 7 && i < n ? i : null
            })}
          >
            {['M', 'W', 'F'].map((text, k) => (
              <text key={text} x={0} y={top(k * 2) + cell / 2} dy="0.35em" fontSize={13} fill={INK}>{text}</text>
            ))}
            {monthLabels(days).map(({ week, text }) => {
              const x = DAY_LABELS + week * pitch
              return x + 26 <= width && <text key={week} x={x} y={13} fontSize={13} fill={INK}>{text}</text>
            })}
            {days.map((d, i) => (
              <rect key={d.day} x={left(i)} y={top(i)} width={cell} height={cell} rx={2} fill={scale.color(d.count)} />
            ))}
            {picked !== null && (
              <rect
                x={left(picked) - 1.5} y={top(picked) - 1.5} width={cell + 3} height={cell + 3} rx={3}
                fill="none" stroke="var(--text-primary)" strokeWidth={1.5}
              />
            )}
          </svg>
        )}
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'flex-end', gap: '4px 10px', marginTop: 10 }}>
        {scale.steps.map(step => (
          <span key={step.label} style={{
            display: 'inline-flex', alignItems: 'center', gap: 5,
            fontSize: 13, color: 'var(--text-secondary)',
          }}>
            <span style={{ width: 10, height: 10, borderRadius: 2, background: step.color }} />
            {step.label}
          </span>
        ))}
      </div>
    </div>
  )
}

// One whole split into its parts: a thin bar, each part as long as its share, with the
// figures listed underneath rather than printed on it.
export function SegmentBar({ parts }: { parts: { label: string; value: number; color: string }[] }) {
  const total = parts.reduce((sum, part) => sum + part.value, 0)
  return (
    <div>
      <div
        role="img"
        aria-label={parts.map(part => `${part.label} ${part.value}`).join(', ')}
        style={{ display: 'flex', gap: 2, height: 8 }}
      >
        {total === 0 ? (
          <div style={{ flex: 1, borderRadius: 4, background: TRACK }} />
        ) : parts.filter(part => part.value > 0).map(part => (
          <div key={part.label} style={{ flex: `${part.value} 1 0`, minWidth: 4, borderRadius: 4, background: part.color }} />
        ))}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px 16px', marginTop: 14 }}>
        {parts.map(part => (
          <div key={part.label}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 14, color: 'var(--text-secondary)' }}>
              <span style={{ width: 10, height: 10, borderRadius: 2, background: part.color, flexShrink: 0 }} />
              {part.label}
            </div>
            <div style={{ fontSize: 18, fontWeight: 500, color: 'var(--text-primary)', marginTop: 2 }}>
              {formatCount(part.value)}
              {total > 0 && (
                <span style={{ fontSize: 14, fontWeight: 400, color: 'var(--text-tertiary)', marginLeft: 6 }}>
                  {percent(part.value / total)}
                </span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// Named groups, a row each: the name, a bar as long as its count is against the largest,
// and the count. Every figure is printed, so there is nothing to tap.
export function BarList({ rows, color }: { rows: { label: string; value: number }[]; color: string }) {
  const max = Math.max(1, ...rows.map(row => row.value))
  return (
    <div style={{
      display: 'grid', gridTemplateColumns: 'auto minmax(0, 1fr) auto',
      alignItems: 'center', gap: '12px 10px',
    }}>
      {rows.map(row => (
        <Fragment key={row.label}>
          <span style={{ fontSize: 14, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>{row.label}</span>
          <div style={{ height: 8 }}>
            {row.value > 0 && (
              <div style={{ width: percent(row.value / max), minWidth: 4, height: '100%', borderRadius: 4, background: color }} />
            )}
          </div>
          <span style={{
            fontSize: 16, color: 'var(--text-primary)', textAlign: 'right',
            fontVariantNumeric: 'tabular-nums', minWidth: 24,
          }}>
            {formatCount(row.value)}
          </span>
        </Fragment>
      ))}
    </div>
  )
}

// A share against its target: the fill on a lighter track of the same amber, the target a
// tick across both.
export function Meter({ value, target, label }: { value: number; target?: number; label: string }) {
  return (
    <div role="img" aria-label={label} style={{ position: 'relative', height: 8, borderRadius: 4, background: 'var(--amber-50)' }}>
      <div style={{ width: percent(Math.min(1, value)), height: '100%', borderRadius: 4, background: ACCENT }} />
      {target !== undefined && (
        <div style={{
          position: 'absolute', left: percent(target), top: -4, bottom: -4,
          width: 2, marginLeft: -1, borderRadius: 1, background: 'var(--text-primary)',
        }} />
      )}
    </div>
  )
}

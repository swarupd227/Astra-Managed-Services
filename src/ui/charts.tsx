import React from 'react'
import { cn } from '@/lib/format'

/**
 * Charts are hand-built SVG rather than a charting library: every mark, tick
 * and label is under the design system's control, and the whole set renders
 * identically in both themes off the same CSS variables.
 */

const V = (name: string) => `rgb(var(--c-${name}))`

function niceTicks(min: number, max: number, count = 4): number[] {
  if (min === max) return [min]
  const span = max - min
  const step = Math.pow(10, Math.floor(Math.log10(span / count)))
  const err = (span / count) / step
  const mult = err >= 7.5 ? 10 : err >= 3 ? 5 : err >= 1.5 ? 2 : 1
  const s = step * mult
  const out: number[] = []
  for (let v = Math.ceil(min / s) * s; v <= max + 1e-9; v += s) out.push(Math.round(v * 1000) / 1000)
  return out
}

/* -------------------------------- Sparkline -------------------------------- */

export function Sparkline({
  data, width = 68, height = 18, tone = 'brand-ink', showLast, strokeWidth = 1.4,
}: {
  data: number[]
  width?: number
  height?: number
  tone?: 'brand-ink' | 'brand' | 'ok' | 'crit' | 'warn' | 'info' | 'agent' | 'ink-3'
  showLast?: boolean
  strokeWidth?: number
}) {
  if (!data.length) return null
  const min = Math.min(...data)
  const max = Math.max(...data)
  const span = max - min || 1
  const pts = data.map((d, i) => [(i / (data.length - 1 || 1)) * (width - 2) + 1, height - 1 - ((d - min) / span) * (height - 2)])
  const path = pts.map((p, i) => `${i ? 'L' : 'M'}${p[0].toFixed(2)},${p[1].toFixed(2)}`).join(' ')
  const area = `${path} L${pts[pts.length - 1][0].toFixed(2)},${height} L${pts[0][0].toFixed(2)},${height} Z`
  const gid = React.useId()
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className="overflow-visible" aria-hidden>
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={V(tone)} stopOpacity="0.28" />
          <stop offset="100%" stopColor={V(tone)} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#${gid})`} />
      <path d={path} fill="none" stroke={V(tone)} strokeWidth={strokeWidth} strokeLinejoin="round" strokeLinecap="round" />
      {showLast && <circle cx={pts[pts.length - 1][0]} cy={pts[pts.length - 1][1]} r={1.8} fill={V(tone)} />}
    </svg>
  )
}

/* ------------------------------- Area / line ------------------------------- */

export interface Series {
  key: string
  label: string
  color: string
  values: number[]
  dashed?: boolean
  area?: boolean
}

export function LineChart({
  series, labels, height = 180, yFormat = (n: number) => String(Math.round(n)), yMin, yMax, zeroLine, className, markers,
}: {
  series: Series[]
  labels: string[]
  height?: number
  yFormat?: (n: number) => string
  yMin?: number
  yMax?: number
  zeroLine?: boolean
  className?: string
  markers?: { index: number; label: string }[]
}) {
  const [hover, setHover] = React.useState<number | null>(null)
  const ref = React.useRef<HTMLDivElement>(null)
  const [w, setW] = React.useState(640)

  React.useEffect(() => {
    if (!ref.current) return
    const ro = new ResizeObserver((e) => setW(e[0].contentRect.width))
    ro.observe(ref.current)
    return () => ro.disconnect()
  }, [])

  const padL = 44, padR = 10, padT = 10, padB = 22
  const iw = Math.max(80, w - padL - padR)
  const ih = height - padT - padB
  const all = series.flatMap((s) => s.values)
  const lo = yMin ?? Math.min(...all, zeroLine ? 0 : Infinity)
  const hi = yMax ?? Math.max(...all, zeroLine ? 0 : -Infinity)
  const span = hi - lo || 1
  const x = (i: number) => padL + (i / Math.max(1, labels.length - 1)) * iw
  const y = (v: number) => padT + ih - ((v - lo) / span) * ih
  const ticks = niceTicks(lo, hi, 4)

  return (
    <div ref={ref} className={cn('relative w-full', className)}>
      <svg width="100%" height={height} viewBox={`0 0 ${w} ${height}`} preserveAspectRatio="none"
        onMouseLeave={() => setHover(null)}
        onMouseMove={(e) => {
          const rect = (e.currentTarget as SVGSVGElement).getBoundingClientRect()
          const px = ((e.clientX - rect.left) / rect.width) * w
          const idx = Math.round(((px - padL) / iw) * (labels.length - 1))
          setHover(Math.max(0, Math.min(labels.length - 1, idx)))
        }}
      >
        {ticks.map((t) => (
          <g key={t}>
            <line x1={padL} x2={w - padR} y1={y(t)} y2={y(t)} stroke={V('line')} strokeWidth={1} strokeDasharray={t === 0 && zeroLine ? '' : '2 4'} opacity={t === 0 && zeroLine ? 0.9 : 0.55} />
            <text x={padL - 6} y={y(t)} dy="0.32em" textAnchor="end" fontSize="9" fill={V('ink-3')} className="tnum">{yFormat(t)}</text>
          </g>
        ))}

        {markers?.map((m) => (
          <g key={m.label}>
            <line x1={x(m.index)} x2={x(m.index)} y1={padT} y2={padT + ih} stroke={V('brand')} strokeWidth={1} strokeDasharray="3 3" opacity={0.5} />
            <text x={x(m.index) + 3} y={padT + 8} fontSize="8" fill={V('brand')}>{m.label}</text>
          </g>
        ))}

        {series.map((s) => {
          const pts = s.values.map((v, i) => [x(i), y(v)])
          const path = pts.map((p, i) => `${i ? 'L' : 'M'}${p[0].toFixed(2)},${p[1].toFixed(2)}`).join(' ')
          const gid = `g-${s.key}`
          return (
            <g key={s.key}>
              {s.area && (
                <>
                  <defs>
                    <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={s.color} stopOpacity="0.22" />
                      <stop offset="100%" stopColor={s.color} stopOpacity="0" />
                    </linearGradient>
                  </defs>
                  <path d={`${path} L${x(s.values.length - 1)},${padT + ih} L${x(0)},${padT + ih} Z`} fill={`url(#${gid})`} />
                </>
              )}
              <path d={path} fill="none" stroke={s.color} strokeWidth={1.6} strokeDasharray={s.dashed ? '4 3' : ''} strokeLinejoin="round" strokeLinecap="round" />
            </g>
          )
        })}

        {hover !== null && (
          <g>
            <line x1={x(hover)} x2={x(hover)} y1={padT} y2={padT + ih} stroke={V('ink-3')} strokeWidth={1} opacity={0.6} />
            {series.map((s) => <circle key={s.key} cx={x(hover)} cy={y(s.values[hover])} r={2.6} fill={s.color} stroke={V('surface')} strokeWidth={1.2} />)}
          </g>
        )}

        {labels.map((l, i) =>
          i % Math.ceil(labels.length / 7) === 0 || i === labels.length - 1 ? (
            <text key={i} x={x(i)} y={height - 6} textAnchor={i === 0 ? 'start' : i === labels.length - 1 ? 'end' : 'middle'} fontSize="9" fill={V('ink-3')}>{l}</text>
          ) : null,
        )}
      </svg>

      {hover !== null && (
        <div
          className="pointer-events-none absolute top-1 z-20 min-w-[130px] rounded border border-line bg-raised px-2 py-1.5 text-2xs shadow-pop"
          style={{ left: Math.min(w - 150, Math.max(0, x(hover) + 8)) }}
        >
          <div className="mb-1 font-medium text-ink">{labels[hover]}</div>
          {series.map((s) => (
            <div key={s.key} className="flex items-center justify-between gap-3">
              <span className="flex items-center gap-1 text-ink-3">
                <span className="h-1.5 w-1.5 rounded-full" style={{ background: s.color }} />
                {s.label}
              </span>
              <span className="tnum font-medium text-ink">{yFormat(s.values[hover])}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

/* ------------------------------ Stacked bars ------------------------------- */

export function StackedBars({
  labels, stacks, height = 170, yFormat = (n: number) => String(Math.round(n)), className,
}: {
  labels: string[]
  stacks: { key: string; label: string; color: string; values: number[] }[]
  height?: number
  yFormat?: (n: number) => string
  className?: string
}) {
  const [hover, setHover] = React.useState<number | null>(null)
  const totals = labels.map((_, i) => stacks.reduce((s, st) => s + st.values[i], 0))
  const max = Math.max(...totals, 1)
  const padL = 44, padR = 8, padT = 8, padB = 20
  const [w, setW] = React.useState(640)
  const ref = React.useRef<HTMLDivElement>(null)
  React.useEffect(() => {
    if (!ref.current) return
    const ro = new ResizeObserver((e) => setW(e[0].contentRect.width))
    ro.observe(ref.current)
    return () => ro.disconnect()
  }, [])
  const iw = Math.max(60, w - padL - padR)
  const ih = height - padT - padB
  const bw = Math.max(2, (iw / labels.length) * 0.66)
  const ticks = niceTicks(0, max, 3)

  return (
    <div ref={ref} className={cn('relative w-full', className)}>
      <svg width="100%" height={height} viewBox={`0 0 ${w} ${height}`} onMouseLeave={() => setHover(null)}>
        {ticks.map((t) => (
          <g key={t}>
            <line x1={padL} x2={w - padR} y1={padT + ih - (t / max) * ih} y2={padT + ih - (t / max) * ih} stroke={V('line')} strokeDasharray="2 4" opacity={0.6} />
            <text x={padL - 6} y={padT + ih - (t / max) * ih} dy="0.32em" textAnchor="end" fontSize="9" fill={V('ink-3')} className="tnum">{yFormat(t)}</text>
          </g>
        ))}
        {labels.map((_, i) => {
          const cx = padL + (i + 0.5) * (iw / labels.length)
          let acc = 0
          return (
            <g key={i} onMouseEnter={() => setHover(i)}>
              <rect x={cx - (iw / labels.length) / 2} y={padT} width={iw / labels.length} height={ih} fill="transparent" />
              {stacks.map((st) => {
                const h = (st.values[i] / max) * ih
                const yy = padT + ih - acc - h
                acc += h
                return <rect key={st.key} x={cx - bw / 2} y={yy} width={bw} height={Math.max(0, h)} fill={st.color} opacity={hover === null || hover === i ? 1 : 0.4} />
              })}
            </g>
          )
        })}
        {labels.map((l, i) =>
          i % Math.ceil(labels.length / 8) === 0 || i === labels.length - 1 ? (
            <text key={i} x={padL + (i + 0.5) * (iw / labels.length)} y={height - 5} textAnchor="middle" fontSize="9" fill={V('ink-3')}>{l}</text>
          ) : null,
        )}
      </svg>
      {hover !== null && (
        <div className="pointer-events-none absolute top-1 z-20 min-w-[140px] rounded border border-line bg-raised px-2 py-1.5 text-2xs shadow-pop"
          style={{ left: Math.min(w - 160, padL + (hover + 0.5) * (iw / labels.length) + 6) }}>
          <div className="mb-1 font-medium text-ink">{labels[hover]}</div>
          {stacks.map((s) => (
            <div key={s.key} className="flex items-center justify-between gap-3">
              <span className="flex items-center gap-1 text-ink-3"><span className="h-1.5 w-1.5 rounded-full" style={{ background: s.color }} />{s.label}</span>
              <span className="tnum font-medium text-ink">{yFormat(s.values[hover])}</span>
            </div>
          ))}
          <div className="mt-1 flex items-center justify-between gap-3 border-t border-line pt-1">
            <span className="text-ink-3">Total</span>
            <span className="tnum font-medium text-ink">{yFormat(totals[hover])}</span>
          </div>
        </div>
      )}
    </div>
  )
}

/* ---------------------------------- Gauge ---------------------------------- */

export function Gauge({ value, target, label, size = 92, tone }: { value: number; target?: number; label?: string; size?: number; tone?: string }) {
  const r = size / 2 - 7
  const c = 2 * Math.PI * r
  const frac = Math.max(0, Math.min(1, value / 100))
  const col = tone ?? (target !== undefined ? (value >= target ? V('ok') : value >= target - 2 ? V('warn') : V('crit')) : V('brand'))
  return (
    <div className="flex flex-col items-center">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={V('sunken')} strokeWidth={7} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={col} strokeWidth={7} strokeLinecap="round"
          strokeDasharray={`${c * frac} ${c}`} className="transition-[stroke-dasharray] duration-700 ease-snap" />
        {target !== undefined && (
          <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={V('ink-3')} strokeWidth={9}
            strokeDasharray={`1.5 ${c}`} strokeDashoffset={-c * (target / 100)} />
        )}
      </svg>
      <div className="-mt-[calc(50%+6px)] flex flex-col items-center pb-[calc(50%-16px)]">
        <span className="tnum font-display text-base font-semibold leading-none text-ink">{value.toFixed(1)}</span>
        {label && <span className="mt-0.5 text-2xs text-ink-3">{label}</span>}
      </div>
    </div>
  )
}

/* --------------------------------- Heatmap --------------------------------- */

export function Heatmap({
  rows, cols, value, onCell, legend, cellTitle,
}: {
  rows: { id: string; label: string }[]
  cols: { id: string; label: string }[]
  value: (rowId: string, colId: string) => { level: number; target: number; blocked?: boolean } | null
  onCell?: (rowId: string, colId: string) => void
  legend?: React.ReactNode
  cellTitle?: (rowId: string, colId: string) => string
}) {
  const shade = (level: number) =>
    ['bg-sunken', 'bg-brand/15', 'bg-brand/35', 'bg-brand/60', 'bg-brand/90'][Math.max(0, Math.min(4, level))]
  return (
    <div className="min-w-0 overflow-x-auto">
      <table className="border-separate border-spacing-[2px]">
        <thead>
          <tr>
            <th className="sticky left-0 z-10 bg-surface" />
            {cols.map((c) => (
              <th key={c.id} className="px-0.5 pb-1 text-center text-2xs font-mono font-normal text-ink-3">{c.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id}>
              <th className="sticky left-0 z-10 whitespace-nowrap bg-surface pr-2 text-left text-2xs font-medium text-ink-2">{r.label}</th>
              {cols.map((c) => {
                const v = value(r.id, c.id)
                if (!v) return <td key={c.id} className="h-5 w-6 rounded-xs bg-sunken/40" />
                const gap = v.target - v.level
                return (
                  <td key={c.id}>
                    <button
                      onClick={() => onCell?.(r.id, c.id)}
                      title={cellTitle?.(r.id, c.id) ?? `${r.label} · ${c.label}: L${v.level} of L${v.target}`}
                      className={cn(
                        'relative flex h-5 w-6 items-center justify-center rounded-xs text-2xs font-medium leading-none transition-transform hover:scale-110 hover:ring-1 hover:ring-brand',
                        shade(v.level),
                        v.level >= 3 ? 'text-[#1B1B1E]' : 'text-ink-2',
                      )}
                    >
                      {v.level}
                      {gap > 0 && <span className={cn('absolute right-[1px] top-[1px] h-1 w-1 rounded-full', v.blocked ? 'bg-crit' : 'bg-warn')} />}
                    </button>
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
      {legend}
    </div>
  )
}

/* ---------------------------------- Funnel --------------------------------- */

export function Funnel({ stages }: { stages: { label: string; count: number; tone?: string }[] }) {
  const max = Math.max(...stages.map((s) => s.count), 1)
  return (
    <div className="space-y-1.5">
      {stages.map((s) => (
        <div key={s.label} className="flex items-center gap-2">
          <span className="w-20 shrink-0 text-2xs text-ink-3">{s.label}</span>
          <div className="h-4 flex-1 overflow-hidden rounded-xs bg-sunken">
            <div className="flex h-full items-center justify-end rounded-xs px-1.5 transition-[width] duration-500 ease-snap"
              style={{ width: `${Math.max(6, (s.count / max) * 100)}%`, background: s.tone ?? V('brand') }}>
              <span className="tnum text-2xs font-semibold text-[#1B1B1E]">{s.count}</span>
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

export const CHART_COLORS = {
  brand: V('brand-ink'),
  accent: V('brand'), ok: V('ok'), warn: V('warn'), crit: V('crit'), info: V('info'), agent: V('agent'), ink3: V('ink-3'),
}

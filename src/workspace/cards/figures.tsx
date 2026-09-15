import { Chip, Metric, Table, Td, Th, Tr } from '@/ui/primitives'
import { More, type CardProps } from './frame'

/* ==========================================================================
   The figures card: headline figures and a table, carried in the artifact's
   props exactly as the tool read them. Used for results whose page is a
   register or a set of instruments, so every such result has a card without
   a component of its own.
   ========================================================================== */

export type Tone = 'ok' | 'warn' | 'crit' | 'neutral'

export interface Figure {
  label: string
  value: string | number
  tone?: Tone
  hint?: string
  unit?: string
}

/** A cell is text, or a chip when it is a state. */
export type Cell = string | number | null | { chip: string; tone?: Tone } | { chips: { text: string; tone?: Tone }[] }

export interface FiguresProps {
  figures?: Figure[]
  columns?: string[]
  /** Columns aligned right — figures, not words. */
  numeric?: number[]
  rows?: Cell[][]
}

function CellView({ cell }: { cell: Cell }) {
  if (cell === null || cell === '') return <span className="text-ink-3">—</span>
  if (typeof cell === 'object' && 'chip' in cell) return <Chip tone={cell.tone === 'neutral' ? 'neutral' : cell.tone}>{cell.chip}</Chip>
  if (typeof cell === 'object' && 'chips' in cell) {
    if (!cell.chips.length) return <span className="text-ink-3">—</span>
    return <div className="flex max-w-[260px] flex-wrap gap-1">{cell.chips.map((c, i) => <Chip key={i} tone={c.tone === 'neutral' ? 'neutral' : c.tone}>{c.text}</Chip>)}</div>
  }
  return <>{cell}</>
}

export function FiguresCard({ props, size }: CardProps) {
  const p = props as FiguresProps
  const figures = p.figures ?? []
  const rows = p.rows ?? []
  const shown = size === 'card' ? rows.slice(0, 6) : rows
  const numeric = new Set(p.numeric ?? [])
  return (
    <>
      {figures.length > 0 && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {figures.slice(0, size === 'card' ? 4 : 8).map((f) => (
            <Metric key={f.label} size="sm" label={f.label} value={f.value} unit={f.unit} hint={f.hint} deltaTone={f.tone === 'neutral' ? undefined : f.tone} />
          ))}
        </div>
      )}
      {p.columns && rows.length > 0 && (
        <Table className={figures.length ? 'mt-3' : undefined}>
          <thead><tr>{p.columns.map((c, i) => <Th key={c} align={numeric.has(i) ? 'right' : 'left'}>{c}</Th>)}</tr></thead>
          <tbody>
            {shown.map((r, i) => (
              <Tr key={i}>
                {r.map((c, j) => (
                  <Td key={j} align={numeric.has(j) ? 'right' : 'left'} className={j === 0 ? 'max-w-[260px] text-2xs text-ink' : numeric.has(j) ? 'tnum text-2xs text-ink-2' : 'text-2xs text-ink-2'}>
                    <CellView cell={c} />
                  </Td>
                ))}
              </Tr>
            ))}
          </tbody>
        </Table>
      )}
      <More shown={shown.length} total={rows.length} />
    </>
  )
}

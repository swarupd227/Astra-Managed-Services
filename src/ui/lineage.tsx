import React from 'react'
import { DATA_KIND_LABEL, type DataItem, type DataKind } from '@/domain/dataEstate'

/* ==========================================================================
   The estate, drawn.

   A list of twenty affected items answers "what breaks" and does not answer
   "how far". The shape is the point: one source feeding four things that
   each feed three more is a different conversation from one source feeding
   one report, and a table of the same twenty rows reads identically either
   way.

   Laid out by what a thing is rather than by position, because data moves
   left to right through the same kinds every time — source, pipeline,
   dataset, model, and whatever reads it. A node nobody can read is drawn
   anyway: an item with no consumers is a finding, not an empty column.
   ========================================================================== */

const V = (name: string) => `rgb(var(--c-${name}))`

/** Left to right, as data moves. Kinds absent from the slice are skipped. */
const COLUMNS: DataKind[][] = [
  ['source'],
  ['feed', 'pipeline', 'workflow'],
  ['dataset'],
  ['semantic_model'],
  ['report', 'application', 'recipient'],
]

export interface LineageNode {
  item: DataItem
  /** The item the question was asked about. */
  focus?: boolean
  /** Reached by following the focus downstream — what breaks if it fails. */
  downstream?: boolean
  /** Something is wrong with it in its own right. */
  broken?: boolean
  /** Readers behind it, where the register knows. */
  audience?: number | null
}

export interface LineageProps {
  nodes: LineageNode[]
  /** Directed, by item id. Edges to items outside the slice are dropped. */
  edges: { from: string; to: string }[]
  height?: number
}

const NODE_W = 132
const NODE_H = 34
const GAP_Y = 14

/**
 * A lineage slice.
 *
 * Deliberately not a force layout: the same question must draw the same
 * picture every time, or two people comparing screens are comparing
 * animations. Columns are fixed by kind and rows are ordered by name.
 */
export function Lineage({ nodes, edges, height }: LineageProps) {
  const present = COLUMNS
    .map((kinds) => nodes.filter((n) => kinds.includes(n.item.kind)).sort((a, b) => a.item.name.localeCompare(b.item.name)))
    .filter((col) => col.length > 0)

  if (!present.length) return null

  const rows = Math.max(...present.map((c) => c.length))
  const colGap = 56
  const w = present.length * NODE_W + (present.length - 1) * colGap
  const h = rows * NODE_H + (rows - 1) * GAP_Y

  // Where each node sits, so the edges can find it.
  const at = new Map<string, { x: number; y: number }>()
  present.forEach((col, ci) => {
    const colH = col.length * NODE_H + (col.length - 1) * GAP_Y
    const top = (h - colH) / 2
    col.forEach((n, ri) => {
      at.set(n.item.id, { x: ci * (NODE_W + colGap), y: top + ri * (NODE_H + GAP_Y) })
    })
  })

  const drawn = edges.filter((e) => at.has(e.from) && at.has(e.to))
  const gid = React.useId()

  return (
    <div className="overflow-x-auto">
      <svg
        width={w}
        height={h}
        viewBox={`0 0 ${w} ${h}`}
        style={{ maxWidth: '100%', height: height ?? 'auto' }}
        role="img"
        aria-label={`${nodes.length} items and ${drawn.length} links between them`}
      >
        <defs>
          <marker id={`${gid}-a`} viewBox="0 0 8 8" refX="7" refY="4" markerWidth="6" markerHeight="6" orient="auto">
            <path d="M0,0 L8,4 L0,8 z" fill={V('line-strong')} />
          </marker>
          <marker id={`${gid}-c`} viewBox="0 0 8 8" refX="7" refY="4" markerWidth="6" markerHeight="6" orient="auto">
            <path d="M0,0 L8,4 L0,8 z" fill={V('crit')} />
          </marker>
        </defs>

        {drawn.map((e) => {
          const a = at.get(e.from)!
          const b = at.get(e.to)!
          const x1 = a.x + NODE_W
          const y1 = a.y + NODE_H / 2
          const x2 = b.x
          const y2 = b.y + NODE_H / 2
          const mid = (x1 + x2) / 2
          // Carrying a failure forward: an edge out of something broken is
          // the path the failure takes, so it is drawn as one.
          const carries = nodes.find((n) => n.item.id === e.from)?.broken
            || nodes.find((n) => n.item.id === e.from)?.focus
          return (
            <path
              key={`${e.from}->${e.to}`}
              d={`M${x1},${y1} C${mid},${y1} ${mid},${y2} ${x2},${y2}`}
              fill="none"
              stroke={carries ? V('crit') : V('line-strong')}
              strokeWidth={carries ? 1.5 : 1}
              opacity={carries ? 0.75 : 0.45}
              markerEnd={`url(#${gid}-${carries ? 'c' : 'a'})`}
            />
          )
        })}

        {present.flatMap((col) => col.map((n) => {
          const p = at.get(n.item.id)!
          const tone = n.focus || n.broken ? 'crit' : n.downstream ? 'warn' : 'line-strong'
          return (
            <g key={n.item.id}>
              <rect
                x={p.x} y={p.y} width={NODE_W} height={NODE_H} rx={5}
                fill={n.focus ? 'rgb(var(--c-crit) / 0.14)' : n.downstream ? 'rgb(var(--c-warn) / 0.07)' : V('sunken')}
                stroke={V(tone)}
                strokeWidth={n.focus ? 1.6 : 1}
              />
              <text x={p.x + 8} y={p.y + 14} fontSize="9.5" fill={V('ink')} className="tnum">
                {n.item.name.length > 20 ? `${n.item.name.slice(0, 19)}…` : n.item.name}
              </text>
              <text x={p.x + 8} y={p.y + 25} fontSize="8" fill={V('ink-3')}>
                {DATA_KIND_LABEL[n.item.kind]}
                {n.audience ? ` · ${n.audience.toLocaleString('en-GB')} readers` : ''}
              </text>
            </g>
          )
        }))}
      </svg>
    </div>
  )
}

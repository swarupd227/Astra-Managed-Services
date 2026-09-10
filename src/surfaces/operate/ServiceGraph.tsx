import React from 'react'
import { GRAPH_EDGES, GRAPH_NODES, TOWERS } from '@/domain/estate'
import { COVERAGE } from '@/domain/knowledge'
import { PageHeader } from '@/ui/domain'
import { Button, Card, Chip, Metric, Table, Td, Th, Tr, selectClass } from '@/ui/primitives'
import { cn, num, pct } from '@/lib/format'
import type { GraphNode } from '@/domain/types'
import { OPERATIONAL, openContradictions } from '@/domain/metrics'
import { ProducedBy } from '@/ui/ProducedBy'

const TYPE_COLUMN: Record<GraphNode['type'], number> = {
  BusinessService: 0, Contract: 0,
  Application: 1, AgentEntity: 1,
  Component: 2, Interface: 2, Pipeline: 2,
  InfraResource: 3, DataAsset: 3,
  Runbook: 4, KnownError: 4, DemandClass: 4,
}

const ACCENT: Record<GraphNode['type'], string> = {
  BusinessService: 'rgb(var(--c-brand))', Application: 'rgb(var(--c-info))', Component: 'rgb(var(--c-info))',
  Interface: 'rgb(var(--c-agent))', InfraResource: 'rgb(var(--c-ink-3))', DataAsset: 'rgb(var(--c-ok))',
  Pipeline: 'rgb(var(--c-ok))', Runbook: 'rgb(var(--c-warn))', KnownError: 'rgb(var(--c-crit))',
  Contract: 'rgb(var(--c-brand))', DemandClass: 'rgb(var(--c-warn))', AgentEntity: 'rgb(var(--c-agent))',
}

const COLUMN_LABEL = ['Business service', 'Application', 'Component / interface', 'Infrastructure / data', 'Knowledge']

export function ServiceGraph() {
  const [minVerification, setMinVerification] = React.useState<'unverified' | 'machine_corroborated' | 'human_verified'>('machine_corroborated')
  const [selected, setSelected] = React.useState<string | null>('db_ledger_rw')
  const [tower, setTower] = React.useState('all')

  const nodes = GRAPH_NODES.filter((n) => tower === 'all' || n.tower === tower)
  const nodeIds = new Set(nodes.map((n) => n.id))
  const edges = GRAPH_EDGES.filter((e) => nodeIds.has(e.from) && nodeIds.has(e.to))

  /* Deterministic layered layout: column by ontology depth, row by index. */
  const layout = React.useMemo(() => {
    const cols: Record<number, GraphNode[]> = {}
    nodes.forEach((n) => {
      const c = TYPE_COLUMN[n.type]
      ;(cols[c] ??= []).push(n)
    })
    const positions: Record<string, { x: number; y: number }> = {}
    const colW = 210
    const rowH = 52
    Object.entries(cols).forEach(([c, items]) => {
      const colIdx = Number(c)
      items.forEach((n, i) => {
        positions[n.id] = { x: 30 + colIdx * colW, y: 46 + i * rowH + ((5 - items.length) * rowH) / 2 }
      })
    })
    const height = Math.max(...Object.values(positions).map((p) => p.y), 200) + 60
    return { positions, height, width: 30 + 5 * colW }
  }, [nodes])

  const sel = selected ? GRAPH_NODES.find((n) => n.id === selected) : null
  const selEdges = sel ? GRAPH_EDGES.filter((e) => e.from === sel.id || e.to === sel.id) : []

  const blastRadius = React.useMemo(() => {
    if (!sel) return { hop1: [], hop2: [] }
    const hop1 = GRAPH_EDGES.filter((e) => e.to === sel.id).map((e) => e.from)
    const hop2 = GRAPH_EDGES.filter((e) => hop1.includes(e.to)).map((e) => e.from).filter((x) => !hop1.includes(x) && x !== sel.id)
    return { hop1: [...new Set(hop1)], hop2: [...new Set(hop2)] }
  }, [sel])

  const totals = COVERAGE.reduce(
    (acc, c) => ({
      entities: acc.entities + c.entities,
      mapped: acc.mapped + c.mapped,
      dark: acc.dark + c.dark,
    }),
    { entities: 0, mapped: 0, dark: 0 },
  )

  return (
    <>
      <PageHeader
        title="Service Graph"
        subtitle="Typed estate graph · confidence and verification state on every assertion"
        actions={
          <>
            <select value={minVerification} onChange={(e) => setMinVerification(e.target.value as typeof minVerification)} className={cn(selectClass, 'w-[224px]')}>
              <option value="unverified">Floor: unverified (diagnosis only)</option>
              <option value="machine_corroborated">Floor: machine-corroborated</option>
              <option value="human_verified">Floor: human-verified (L3/L4 actions)</option>
            </select>
            <select value={tower} onChange={(e) => setTower(e.target.value)} className={cn(selectClass, 'w-[190px]')}>
              <option value="all">All towers</option>
              {TOWERS.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </>
        }
      />

      <ProducedBy
        agents={["agt_archivist", "agt_sentinel"]}
        what="asserting and corroborating every edge in this graph, with a TTL on each"
      />

      <div className="grid shrink-0 grid-cols-2 gap-4 border-b border-line bg-surface px-4 py-2.5 md:grid-cols-5">
        <Metric size="sm" label="Estate entities" value={num(totals.entities)} />
        <Metric size="sm" label="Mapped" value={pct((totals.mapped / totals.entities) * 100, 1)} hint={`${num(totals.dark)} still dark`} />
        <Metric size="sm" label="Assertions" value={num(TOWERS.reduce((s, t) => s + t.assertions, 0))} />
        <Metric size="sm" label="Verification currency" value={pct(OPERATIONAL.verificationCurrency, 1)} />
        <Metric size="sm" label="Contradiction rate" value={OPERATIONAL.contradictionRatePerK.toFixed(1)} hint="per 1,000 · target ≤ 2" />
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-[1fr_340px]">
        <section className="min-h-0 overflow-auto bg-canvas grid-bg">
          <svg width={layout.width} height={layout.height} className="min-w-full">
            {COLUMN_LABEL.map((l, i) => (
              <text key={l} x={30 + i * 210} y={22} fontSize="9" fill="rgb(var(--c-ink-3))" className="uppercase tracking-widest">{l}</text>
            ))}

            {edges.map((e) => {
              const a = layout.positions[e.from]
              const b = layout.positions[e.to]
              if (!a || !b) return null
              const highlight = sel && (e.from === sel.id || e.to === sel.id)
              const mx = (a.x + 150 + b.x) / 2
              return (
                <g key={e.id} opacity={sel && !highlight ? 0.18 : 1}>
                  <path
                    d={`M${a.x + 150},${a.y + 16} C${mx},${a.y + 16} ${mx},${b.y + 16} ${b.x},${b.y + 16}`}
                    fill="none"
                    stroke={highlight ? 'rgb(var(--c-brand))' : 'rgb(var(--c-line-strong))'}
                    strokeWidth={highlight ? 1.6 : 1}
                  />
                  {highlight && (
                    <text x={mx} y={(a.y + b.y) / 2 + 12} fontSize="8" textAnchor="middle" fill="rgb(var(--c-brand))" className="font-mono">
                      {e.rel}
                    </text>
                  )}
                </g>
              )
            })}

            {nodes.map((n) => {
              const p = layout.positions[n.id]
              if (!p) return null
              const isSel = sel?.id === n.id
              const inBlast = blastRadius.hop1.includes(n.id) || blastRadius.hop2.includes(n.id)
              return (
                <g key={n.id} transform={`translate(${p.x},${p.y})`} onClick={() => setSelected(n.id)} className="cursor-pointer">
                  <rect
                    width={150} height={32} rx={4}
                    fill="rgb(var(--c-surface))"
                    stroke={isSel ? 'rgb(var(--c-brand))' : inBlast ? 'rgb(var(--c-warn))' : 'rgb(var(--c-line-strong))'}
                    strokeWidth={isSel ? 1.8 : 1}
                  />
                  <rect width={3} height={32} rx={1.5} fill={ACCENT[n.type]} />
                  <text x={10} y={13} fontSize="9.5" fill="rgb(var(--c-ink))" className="pointer-events-none">
                    {n.name.length > 22 ? `${n.name.slice(0, 21)}…` : n.name}
                  </text>
                  <text x={10} y={25} fontSize="8" fill="rgb(var(--c-ink-3))" className="pointer-events-none font-mono">
                    {n.type} · tier {n.tier}
                  </text>
                </g>
              )
            })}
          </svg>
        </section>

        <aside className="flex min-h-0 flex-col overflow-y-auto border-l border-line bg-surface">
          {sel ? (
            <>
              <div className="border-b border-line px-3 py-2.5">
                <Chip mono>{sel.type}</Chip>
                <h3 className="mt-1.5 font-display text-sm font-semibold text-ink">{sel.name}</h3>
                <p className="mt-0.5 font-mono text-2xs text-ink-3">{sel.id} · tier {sel.tier}</p>
              </div>

              <div className="border-b border-line px-3 py-2.5">
                <div className="label-cap">Attributes</div>
                <dl className="mt-1.5 space-y-1 text-2xs">
                  {Object.entries(sel.attrs).map(([k, v]) => (
                    <div key={k} className="flex items-baseline justify-between gap-2">
                      <dt className="shrink-0 text-ink-3">{k}</dt>
                      <dd className="truncate text-right font-mono text-ink-2">{String(v)}</dd>
                    </div>
                  ))}
                </dl>
              </div>

              <div className="border-b border-line px-3 py-2.5">
                <div className="label-cap">Blast radius if mutated</div>
                <div className="mt-1.5 space-y-1.5 text-2xs">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-ink-3">1 hop</span>
                    <span className="tnum text-ink-2">{blastRadius.hop1.length} dependent{blastRadius.hop1.length === 1 ? '' : 's'}</span>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-ink-3">2 hops</span>
                    <span className="tnum text-ink-2">{blastRadius.hop2.length}</span>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-ink-3">Max tier reachable</span>
                    <span className={cn('tnum', sel.tier === 0 ? 'text-crit' : 'text-ink-2')}>{Math.min(sel.tier, ...blastRadius.hop1.map((id) => GRAPH_NODES.find((n) => n.id === id)?.tier ?? 3))}</span>
                  </div>
                </div>
              </div>

              <div className="px-3 py-2.5">
                <div className="label-cap">Relationships</div>
                <ul className="mt-1.5 space-y-1">
                  {selEdges.map((e) => {
                    const other = GRAPH_NODES.find((n) => n.id === (e.from === sel.id ? e.to : e.from))
                    return (
                      <li key={e.id}>
                        <button onClick={() => setSelected(other?.id ?? null)} className="flex w-full items-center gap-1.5 rounded px-1 py-1 text-left text-2xs hover:bg-raised">
                          <span className="shrink-0 font-mono text-ink-3">{e.from === sel.id ? '→' : '←'}</span>
                          <Chip tone="neutral" mono>{e.rel}</Chip>
                          <span className="min-w-0 flex-1 truncate text-ink-2">{other?.name}</span>
                        </button>
                      </li>
                    )
                  })}
                </ul>
              </div>
            </>
          ) : (
            <div className="p-4 text-xs text-ink-3">Select a node.</div>
          )}
        </aside>
      </div>

      <div className="shrink-0 border-t border-line bg-surface p-4">
        <Card dense title="Graph quality SLOs" subtitle="By tower">
          <Table>
            <thead>
              <tr>
                <Th>Tower</Th>
                <Th align="right">Entities</Th>
                <Th align="right">Mapped</Th>
                <Th align="right">Dark</Th>
                <Th align="right">Human-verified</Th>
                <Th align="right">Contradictions /1k/mo</Th>
                <Th align="right">Verification latency</Th>
                <Th align="right">Volume covered</Th>
              </tr>
            </thead>
            <tbody>
              {COVERAGE.map((c) => {
                const t = TOWERS.find((x) => x.id === c.tower)!
                return (
                  <Tr key={c.tower}>
                    <Td className="text-ink">{t.name}</Td>
                    <Td align="right">{num(c.entities)}</Td>
                    <Td align="right">{pct((c.mapped / c.entities) * 100, 1)}</Td>
                    <Td align="right" className={c.dark > c.entities * 0.05 ? 'text-warn' : ''}>{num(c.dark)}</Td>
                    <Td align="right" className={c.humanVerified >= 95 ? 'text-ok' : c.humanVerified >= 85 ? 'text-warn' : 'text-crit'}>{pct(c.humanVerified)}</Td>
                    <Td align="right" className={c.contradictionRate <= 2 ? 'text-ok' : 'text-warn'}>{c.contradictionRate.toFixed(1)}</Td>
                    <Td align="right" className={c.verificationLatencyDays <= 5 ? '' : 'text-warn'}>{c.verificationLatencyDays.toFixed(1)}d</Td>
                    <Td align="right">{pct(c.volumeCovered)}</Td>
                  </Tr>
                )
              })}
            </tbody>
          </Table>
        </Card>
      </div>
    </>
  )
}

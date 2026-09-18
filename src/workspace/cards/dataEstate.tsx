import React from 'react'
import { Database, GitBranch, TriangleAlert } from 'lucide-react'
import {
  CLASSIFICATION_LABEL, DATA_ITEM_BY_ID, DATA_KINDS, DATA_KIND_LABEL, DATA_LIFECYCLE, LINEAGE_LABEL, OWN_LABEL,
  ancestors, dataSummary, descendants, impact, isBreach, type DataReading, type OwnState,
} from '@/domain/dataEstate'
import { TOWER_BY_ID, agentsForClass } from '@/domain/estate'
import { holdsOn } from '@/domain/privacy'
import { Card, Chip, Metric, Table, Td, Th, Tr } from '@/ui/primitives'
import { cn, num } from '@/lib/format'
import { Band, More, limit, type ArtifactView, type CardProps } from './frame'

/* ==========================================================================
   Data estate.

   Lineage left to right by kind, each item coloured by its own state and,
   where it is sound in itself, by what reaches it from upstream. Selecting
   an item lights its ancestry and everything it feeds; the panel beside it
   carries its contract, checks and recovery path. Breaches are listed with
   the reports they make wrong, and the register below holds every item's
   service levels. A card shows the same reading, cut to its first rows.
   ========================================================================== */

type Tone = 'neutral' | 'ok' | 'warn' | 'crit' | 'info' | 'brand' | 'agent'

const OWN_TONE: Record<OwnState, Tone> = {
  failed: 'crit', stale: 'crit', failing: 'crit', unobserved: 'neutral', uncontracted: 'info', healthy: 'ok',
}

/** Own breach first, then what reaches it from upstream, then what it lacks. */
function toneOf(i: DataReading): Tone {
  if (isBreach(i.own)) return 'crit'
  if (i.inherited?.state === 'exposed') return 'warn'
  if (i.own === 'unobserved' || i.inherited?.state === 'unverifiable') return 'neutral'
  if (i.own === 'uncontracted') return 'info'
  return 'ok'
}

const RANK: Record<Tone, number> = { crit: 0, warn: 1, neutral: 2, info: 3, ok: 4, brand: 5, agent: 5 }

const BOX: Record<Tone, string> = {
  crit: 'border-crit/50 bg-crit/[0.08]',
  warn: 'border-warn/50 bg-warn/[0.08]',
  neutral: 'border-dashed border-line bg-sunken',
  info: 'border-line bg-sunken',
  ok: 'border-ok/40 bg-ok/[0.06]',
  brand: 'border-line', agent: 'border-line',
}

const LEGEND: [Tone, string][] = [['crit', 'Breach'], ['warn', 'Exposed'], ['neutral', 'Unobserved'], ['info', 'No contract'], ['ok', 'Healthy']]

function InheritedChip({ i }: { i: DataReading }) {
  if (!i.inherited) return null
  return (
    <Chip tone={i.inherited.state === 'exposed' ? 'warn' : 'neutral'}>
      {i.inherited.state === 'exposed' ? 'Exposed' : 'Unverifiable'} · {i.inherited.via.name}
    </Chip>
  )
}

function Recovery({ i }: { i: DataReading }) {
  const lc = DATA_LIFECYCLE[i.kind]
  const agents = lc.recoveryClass ? agentsForClass(lc.recoveryClass, i.tower) : []
  return (
    <span className="flex flex-wrap items-center gap-1">
      <span className="text-2xs text-ink-2">{lc.recovery}</span>
      {lc.recoveryClass && <Chip mono>{lc.recoveryClass}</Chip>}
      {agents.map((a) => <Chip key={a.id} tone="agent">{a.name}</Chip>)}
    </span>
  )
}

function ReportChips({ id }: { id: string }) {
  const reach = impact(id)
  if (!reach.reports.length) return <span className="text-2xs text-ink-3">—</span>
  return <>{reach.reports.map((r) => <Chip key={r.id} tone="warn">{r.name}</Chip>)}</>
}

function DataEstateMetrics({ size }: CardProps) {
  const s = React.useMemo(() => dataSummary(), [])
  const page = size === 'page'
  return (
    <Band size={size} cols={6}>
      <Metric size="sm" label="In breach" value={s.breaches} deltaTone={s.breaches ? 'crit' : 'ok'} hint={`${s.exposed} exposed${page ? ' downstream' : ''}`} />
      <Metric size="sm" label="No telemetry" value={s.unobserved} deltaTone={s.unobserved ? 'warn' : 'ok'} hint={page ? `${s.unverifiable} unverifiable downstream` : undefined} />
      <Metric size="sm" label={page ? 'Contracts enforced' : 'Contracts'} value={`${s.contracts.enforced}/${s.contracts.eligible}`} deltaTone={page ? (s.contracts.enforced === s.contracts.eligible ? 'ok' : 'warn') : undefined} hint={page ? `${s.contracts.declared} declared only` : 'enforced'} />
      {page && <Metric size="sm" label="Lineage gaps" value={s.lineageGaps} deltaTone={s.lineageGaps ? 'warn' : 'ok'} />}
      <Metric size="sm" label="Unclassified" value={s.unclassified} deltaTone={s.unclassified ? 'crit' : 'ok'} hint={page ? `${s.personalData} hold personal data` : undefined} />
      {page && <Metric size="sm" label="No steward" value={s.noSteward} deltaTone={s.noSteward ? 'warn' : 'ok'} />}
    </Band>
  )
}

function DataEstateBody({ props, size }: CardProps) {
  const s = React.useMemo(() => dataSummary(), [])
  const ranked = React.useMemo(() => [...s.items].sort((a, b) => RANK[toneOf(a)] - RANK[toneOf(b)]), [s])
  const [selected, setSelected] = React.useState(() => ranked[0]?.id ?? '')
  const lit = React.useMemo(
    () => new Set([selected, ...ancestors(selected).map((i) => i.id), ...descendants(selected).map((i) => i.id)]),
    [selected],
  )
  const sel = s.items.find((i) => i.id === selected)
  const breaches = ranked.filter((i) => isBreach(i.own))

  if (size !== 'page') {
    const filter = String(props.filter ?? 'breaches')
    const rows = s.items.filter((i) =>
      filter === 'all' ? true : filter === 'breaches' ? isBreach(i.own) : filter === 'unobserved' ? i.own === 'unobserved' : DATA_LIFECYCLE[i.kind].contracted && i.contractState !== 'enforced')
    const shown = limit(rows, size)
    return (
      <>
        <Table>
          <thead><tr><Th>Item</Th><Th>State</Th><Th>Reports affected</Th></tr></thead>
          <tbody>
            {shown.map((i) => (
              <Tr key={i.id}>
                <Td className="text-2xs text-ink"><span className="block">{i.name}</span><span className="block text-[10px] text-ink-3">{DATA_KIND_LABEL[i.kind]} · {i.platform}</span></Td>
                <Td><Chip tone={isBreach(i.own) ? 'crit' : i.own === 'healthy' ? 'ok' : 'neutral'}>{OWN_LABEL[i.own]}</Chip></Td>
                <Td><div className="flex max-w-[260px] flex-wrap gap-1"><ReportChips id={i.id} /></div></Td>
              </Tr>
            ))}
          </tbody>
        </Table>
        <More shown={shown.length} total={rows.length} />
      </>
    )
  }

  return (
    <>
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
        <Card title="Lineage" right={<GitBranch size={13} className="text-ink-3" />}>
          <div className="overflow-x-auto">
            <div className="grid min-w-[720px] grid-cols-5 gap-2">
              {DATA_KINDS.map((k) => (
                <div key={k} className="space-y-1.5">
                  <div className="label-cap">{DATA_KIND_LABEL[k]}</div>
                  {s.items.filter((i) => i.kind === k).map((i) => (
                    <button
                      key={i.id}
                      onClick={() => setSelected(i.id)}
                      className={cn(
                        'block w-full rounded border px-2 py-1.5 text-left transition-opacity',
                        BOX[toneOf(i)],
                        i.id === selected && 'ring-1 ring-brand',
                        !lit.has(i.id) && 'opacity-40',
                      )}
                    >
                      <span className="block truncate text-2xs text-ink">{i.name}</span>
                      <span className="block truncate text-[10px] text-ink-3">{i.platform}</span>
                    </button>
                  ))}
                </div>
              ))}
            </div>
          </div>
          <div className="mt-3 flex flex-wrap gap-1.5 border-t border-line pt-2.5">
            {LEGEND.map(([t, label]) => <Chip key={label} tone={t}>{label}</Chip>)}
          </div>
        </Card>

        {sel && (
          <Card title={sel.name} subtitle={`${DATA_KIND_LABEL[sel.kind]} · ${sel.platform}`} right={<Database size={13} className="text-ink-3" />}>
            <DataItemBody props={{ id: sel.id }} size="page" />
          </Card>
        )}
      </div>

      <Card className="mt-4" title="Breaches" subtitle={`${breaches.length} items`} right={<TriangleAlert size={13} className="text-crit" />}>
        <Table>
          <thead>
            <tr><Th>Item</Th><Th>State</Th><Th>Reports affected</Th><Th align="right">Largest audience</Th><Th>Recovery</Th></tr>
          </thead>
          <tbody>
            {breaches.map((i) => {
              const reach = impact(i.id)
              return (
                <Tr key={i.id} onClick={() => setSelected(i.id)} selected={i.id === selected}>
                  <Td className="text-2xs text-ink">
                    {i.name}
                    <span className="block text-[10px] text-ink-3">{DATA_KIND_LABEL[i.kind]} · {i.platform}</span>
                  </Td>
                  <Td><Chip tone="crit">{OWN_LABEL[i.own]}</Chip></Td>
                  <Td><div className="flex max-w-[320px] flex-wrap gap-1"><ReportChips id={i.id} /></div></Td>
                  <Td align="right" className="tnum text-2xs text-ink-2">{reach.largestAudience ? num(reach.largestAudience) : '—'}</Td>
                  <Td><Recovery i={i} /></Td>
                </Tr>
              )
            })}
          </tbody>
        </Table>
      </Card>

      <Card className="mt-4" title="Register" subtitle={`${s.items.length} items`} right={<Database size={13} className="text-ink-3" />}>
        <Table>
          <thead>
            <tr>
              <Th>Item</Th><Th>Kind</Th><Th>Steward</Th><Th>Class</Th><Th>Contract</Th>
              <Th>Freshness</Th><Th align="right">Checks</Th><Th>State</Th>
            </tr>
          </thead>
          <tbody>
            {ranked.map((i) => {
              const f = i.level.freshness
              const late = f && f.landedHrsAgo !== null && f.landedHrsAgo > f.targetHrs
              return (
                <Tr key={i.id} onClick={() => setSelected(i.id)} selected={i.id === selected}>
                  <Td className="max-w-[220px] text-2xs text-ink">
                    {i.name}
                    <span className="block truncate text-[10px] text-ink-3">{i.platform} · {i.owner}</span>
                  </Td>
                  <Td><Chip tone="brand">{DATA_KIND_LABEL[i.kind]}</Chip></Td>
                  <Td className="text-2xs text-ink-2">{i.steward ?? <Chip tone="warn">None</Chip>}</Td>
                  <Td className="text-2xs text-ink-2">{i.classification ? CLASSIFICATION_LABEL[i.classification] : <Chip tone="crit">Unclassified</Chip>}</Td>
                  <Td>
                    {i.contractState === 'enforced' && <Chip tone="ok">Enforced</Chip>}
                    {i.contractState === 'declared' && <Chip tone="warn">Declared</Chip>}
                    {i.contractState === 'none' && (DATA_LIFECYCLE[i.kind].contracted ? <Chip>None</Chip> : <span className="text-2xs text-ink-3">—</span>)}
                  </Td>
                  <Td className="tnum text-2xs">
                    {f ? <span className={late ? 'text-crit' : 'text-ink-2'}>{f.landedHrsAgo ?? '—'} h / {f.targetHrs} h</span> : <span className="text-ink-3">—</span>}
                    {i.level.runs && <span className="block text-[10px] text-ink-3">{i.level.runs.onTime}/{i.level.runs.total} on time</span>}
                  </Td>
                  <Td align="right" className="tnum text-2xs">
                    {i.level.checks
                      ? <span className={i.level.checks.passed < i.level.checks.total ? 'text-crit' : 'text-ink-2'}>{i.level.checks.passed}/{i.level.checks.total}</span>
                      : <span className="text-ink-3">—</span>}
                  </Td>
                  <Td>
                    <div className="flex max-w-[260px] flex-wrap gap-1">
                      <Chip tone={OWN_TONE[i.own]}>{OWN_LABEL[i.own]}</Chip>
                      {!isBreach(i.own) && <InheritedChip i={i} />}
                    </div>
                  </Td>
                </Tr>
              )
            })}
          </tbody>
        </Table>
      </Card>
    </>
  )
}

/** One item: the card in a message, the pane, and the panel beside the lineage. */
function DataItemBody({ props, size }: CardProps) {
  const id = String(props.id)
  const item = DATA_ITEM_BY_ID[id]
  const reading = React.useMemo(() => dataSummary().items.find((i) => i.id === id), [id])
  const reach = React.useMemo(() => impact(id), [id])
  if (!item || !reading) return <span className="text-2xs text-ink-3">—</span>
  const holds = holdsOn(id)
  const full = size !== 'card'
  const f = reading.level.freshness

  return (
    <>
      <div className="flex flex-wrap items-center gap-1.5">
        {!full && <Chip>{DATA_KIND_LABEL[item.kind]}</Chip>}
        <Chip tone={OWN_TONE[reading.own]}>{OWN_LABEL[reading.own]}</Chip>
        <InheritedChip i={reading} />
        {!full && holds.map((h) => <Chip key={h.id} tone="warn" mono>{h.id}</Chip>)}
      </div>

      <dl className="mt-2.5 grid grid-cols-[84px_1fr] gap-x-2 gap-y-1 text-2xs">
        {full && <><dt className="text-ink-3">Owner</dt><dd className="text-ink-2">{reading.owner}</dd></>}
        <dt className="text-ink-3">Steward</dt>
        <dd className="text-ink-2">{item.steward ?? <Chip tone="warn">None</Chip>}</dd>
        <dt className="text-ink-3">Class</dt>
        <dd>{item.classification ? <span className="text-ink-2">{CLASSIFICATION_LABEL[item.classification]}</span> : <Chip tone="crit">Unclassified</Chip>}</dd>
        {full && (
          <>
            <dt className="text-ink-3">Lineage</dt>
            <dd>{reading.lineage === 'mapped' ? <span className="text-ink-2">{LINEAGE_LABEL.mapped}</span> : <Chip tone="warn">{LINEAGE_LABEL[reading.lineage]}</Chip>}</dd>
            <dt className="text-ink-3">Tower</dt>
            <dd className="text-ink-2">{TOWER_BY_ID[reading.tower]?.name ?? reading.tower}</dd>
          </>
        )}
        {!full && <><dt className="text-ink-3">Contract</dt><dd className="text-ink-2">{item.contract ? <>{item.contract.id} · {item.contract.state}</> : '—'}</dd></>}
        <dt className="text-ink-3">Recovery</dt>
        <dd>{full ? <Recovery i={reading} /> : <span className="text-ink-2">{DATA_LIFECYCLE[item.kind].recovery}</span>}</dd>
        {full && (
          <>
            <dt className="text-ink-3">Holds</dt>
            <dd className="flex flex-wrap gap-1">
              {holds.map((h) => <Chip key={h.id} tone="warn" mono title={h.matter}>{h.id}</Chip>)}
              {!holds.length && <span className="text-2xs text-ink-3">—</span>}
            </dd>
          </>
        )}
      </dl>

      <div className="mt-3 border-t border-line pt-3">
        {full && (
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="label-cap">Contract</span>
            {item.contract ? (
              <>
                <Chip mono>{item.contract.id}</Chip>
                <Chip tone={item.contract.state === 'enforced' ? 'ok' : 'warn'}>{item.contract.state}</Chip>
              </>
            ) : (
              <Chip tone={DATA_LIFECYCLE[item.kind].contracted ? 'warn' : 'neutral'}>{DATA_LIFECYCLE[item.kind].contracted ? 'None' : 'Inherited'}</Chip>
            )}
          </div>
        )}
        {full && f && (
          <div className="mt-2 flex justify-between text-2xs">
            <span className="text-ink-3">Landed</span>
            <span className={cn('tnum', f.landedHrsAgo !== null && f.landedHrsAgo > f.targetHrs ? 'text-crit' : 'text-ink-2')}>
              {f.landedHrsAgo ?? '—'} h ago · target {f.targetHrs} h
            </span>
          </div>
        )}
        {full && reading.level.runs && (
          <div className="mt-1 flex justify-between text-2xs">
            <span className="text-ink-3">Last 30 runs</span>
            <span className="tnum text-ink-2">{reading.level.runs.onTime}/{reading.level.runs.total} on time</span>
          </div>
        )}
        {item.contract && item.contract.checks.length > 0 && (
          <div className={cn('space-y-1', full ? 'mt-2' : '')}>
            {item.contract.checks.map((c) => (
              <div key={c.name} className="flex items-start gap-2 rounded border border-line bg-sunken px-2 py-1.5">
                <span className="min-w-0 flex-1 text-2xs text-ink">
                  {c.name}
                  <span className="block text-[10px] text-ink-3">{c.bound} · {full ? 'observed ' : ''}{c.observed}</span>
                </span>
                <Chip tone={c.passed ? 'ok' : 'crit'}>{c.passed ? 'pass' : 'fail'}</Chip>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="mt-3 border-t border-line pt-3">
        <div className="flex items-center gap-1.5">
          <span className="label-cap">Feeds</span>
          {full && <span className="tnum text-2xs text-ink-3">{reach.items.length} items · {reach.reports.length} reports</span>}
        </div>
        <div className="mt-1.5 flex flex-wrap gap-1">
          {reach.reports.map((r) => <Chip key={r.id}>{r.name}{r.consumers ? ` · ${num(r.consumers)}` : ''}</Chip>)}
          {!reach.reports.length && <span className="text-2xs text-ink-3">—</span>}
        </div>
      </div>
    </>
  )
}

export const dataEstateView: ArtifactView = {
  Body: DataEstateBody,
  Metrics: DataEstateMetrics,
  page: {
    title: 'Data estate',
    subtitle: 'Sources, pipelines, datasets, semantic models and reports',
    agents: ['agt_custodian', 'agt_archivist'],
    what: 'checking contracts and mapping lineage',
  },
}

export const dataItemView: ArtifactView = { Body: DataItemBody }

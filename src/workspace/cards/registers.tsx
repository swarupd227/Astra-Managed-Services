import React from 'react'
import { bundleCoverage, type CoverageState } from '@/domain/coverage'
import { CLASSIFICATION_LABEL, DATA_ITEM_BY_ID, DATA_KIND_LABEL, DATA_LIFECYCLE, OWN_LABEL, dataSummary, impact, isBreach } from '@/domain/dataEstate'
import { REQUESTS, REQUEST_FLAG_CRIT, REQUEST_FLAG_LABEL, REQUEST_KIND_LABEL, REQUEST_STATE_LABEL, SEARCH_LABEL, holdsOn, privacySummary, readRequest, type SearchVerdict } from '@/domain/privacy'
import { MODE_LABEL } from '@/domain/reference'
import { RELEASE_FLAG_BLOCKS, RELEASE_FLAG_LABEL, RELEASE_STATE_LABEL, releaseSummary } from '@/domain/releases'
import { DEBT_FLAG_CRIT, DEBT_FLAG_LABEL, debtSummary } from '@/domain/techDebt'
import { Chip, Metric, Table, Td, Th, Tr } from '@/ui/primitives'
import { cn, dateShort, num } from '@/lib/format'
import { More, type CardProps } from './frame'

const limit = <T,>(rows: T[], size: CardProps['size'], n = 6) => (size === 'card' ? rows.slice(0, n) : rows)

export function DataEstateCard({ props, size }: CardProps) {
  const s = React.useMemo(() => dataSummary(), [])
  const filter = String(props.filter ?? 'breaches')
  const rows = s.items.filter((i) =>
    filter === 'all' ? true : filter === 'breaches' ? isBreach(i.own) : filter === 'unobserved' ? i.own === 'unobserved' : DATA_LIFECYCLE[i.kind].contracted && i.contractState !== 'enforced')
  const shown = limit(rows, size)
  return (
    <>
      <div className="grid grid-cols-4 gap-3">
        <Metric size="sm" label="In breach" value={s.breaches} deltaTone={s.breaches ? 'crit' : 'ok'} hint={`${s.exposed} exposed`} />
        <Metric size="sm" label="No telemetry" value={s.unobserved} deltaTone={s.unobserved ? 'warn' : 'ok'} />
        <Metric size="sm" label="Contracts" value={`${s.contracts.enforced}/${s.contracts.eligible}`} hint="enforced" />
        <Metric size="sm" label="Unclassified" value={s.unclassified} deltaTone={s.unclassified ? 'crit' : 'ok'} />
      </div>
      <Table className="mt-3">
        <thead><tr><Th>Item</Th><Th>State</Th><Th>Reports affected</Th></tr></thead>
        <tbody>
          {shown.map((i) => {
            const reach = impact(i.id)
            return (
              <Tr key={i.id}>
                <Td className="text-2xs text-ink"><span className="block">{i.name}</span><span className="block text-[10px] text-ink-3">{DATA_KIND_LABEL[i.kind]} · {i.platform}</span></Td>
                <Td><Chip tone={isBreach(i.own) ? 'crit' : i.own === 'healthy' ? 'ok' : 'neutral'}>{OWN_LABEL[i.own]}</Chip></Td>
                <Td><div className="flex max-w-[260px] flex-wrap gap-1">{reach.reports.map((r) => <Chip key={r.id} tone="warn">{r.name}</Chip>)}{!reach.reports.length && <span className="text-2xs text-ink-3">—</span>}</div></Td>
              </Tr>
            )
          })}
        </tbody>
      </Table>
      <More shown={shown.length} total={rows.length} />
    </>
  )
}

export function DataItemCard({ props }: CardProps) {
  const item = DATA_ITEM_BY_ID[String(props.id)]
  const reading = React.useMemo(() => dataSummary().items.find((i) => i.id === String(props.id)), [props.id])
  if (!item || !reading) return <span className="text-2xs text-ink-3">—</span>
  const reach = impact(item.id)
  const holds = holdsOn(item.id)
  return (
    <>
      <div className="flex flex-wrap items-center gap-1.5">
        <Chip>{DATA_KIND_LABEL[item.kind]}</Chip>
        <Chip tone={isBreach(reading.own) ? 'crit' : reading.own === 'healthy' ? 'ok' : 'neutral'}>{OWN_LABEL[reading.own]}</Chip>
        {reading.inherited && <Chip tone={reading.inherited.state === 'exposed' ? 'warn' : 'neutral'}>{reading.inherited.state === 'exposed' ? 'Exposed' : 'Unverifiable'} · {reading.inherited.via.name}</Chip>}
        {holds.map((h) => <Chip key={h.id} tone="warn" mono>{h.id}</Chip>)}
      </div>
      <dl className="mt-2.5 grid grid-cols-[84px_1fr] gap-x-2 gap-y-1 text-2xs">
        <dt className="text-ink-3">Steward</dt><dd className="text-ink-2">{item.steward ?? <Chip tone="warn">None</Chip>}</dd>
        <dt className="text-ink-3">Class</dt><dd className="text-ink-2">{item.classification ? CLASSIFICATION_LABEL[item.classification] : <Chip tone="crit">Unclassified</Chip>}</dd>
        <dt className="text-ink-3">Contract</dt><dd className="text-ink-2">{item.contract ? <>{item.contract.id} · {item.contract.state}</> : '—'}</dd>
        <dt className="text-ink-3">Recovery</dt><dd className="text-ink-2">{DATA_LIFECYCLE[item.kind].recovery}</dd>
      </dl>
      {item.contract && item.contract.checks.length > 0 && (
        <div className="mt-2 space-y-1">
          {item.contract.checks.map((c) => (
            <div key={c.name} className="flex items-start gap-2 rounded border border-line bg-sunken px-2 py-1">
              <span className="min-w-0 flex-1 text-2xs text-ink">{c.name}<span className="block text-[10px] text-ink-3">{c.bound} · {c.observed}</span></span>
              <Chip tone={c.passed ? 'ok' : 'crit'}>{c.passed ? 'pass' : 'fail'}</Chip>
            </div>
          ))}
        </div>
      )}
      <div className="mt-2 flex flex-wrap items-center gap-1 border-t border-line pt-2">
        <span className="label-cap mr-1">Feeds</span>
        {reach.reports.map((r) => <Chip key={r.id}>{r.name}{r.consumers ? ` · ${num(r.consumers)}` : ''}</Chip>)}
        {!reach.reports.length && <span className="text-2xs text-ink-3">—</span>}
      </div>
    </>
  )
}

const VERDICT_TONE: Record<SearchVerdict, 'brand' | 'ok' | 'warn' | 'crit'> = { found: 'brand', none: 'ok', unvouched: 'warn', not_searched: 'crit' }

export function PrivacyRequestsCard({ size }: CardProps) {
  const s = React.useMemo(() => privacySummary(), [])
  const shown = limit(s.readings, size)
  return (
    <>
      <div className="grid grid-cols-4 gap-3">
        <Metric size="sm" label="Open" value={s.open} />
        <Metric size="sm" label="Due ≤ 7 days" value={s.dueSoon} deltaTone={s.dueSoon ? 'warn' : 'ok'} />
        <Metric size="sm" label="Search gaps" value={s.withGaps} deltaTone={s.withGaps ? 'warn' : 'ok'} />
        <Metric size="sm" label="Breaches" value={s.breaches} deltaTone={s.breaches ? 'crit' : 'ok'} />
      </div>
      <Table className="mt-3">
        <thead><tr><Th>Request</Th><Th>State</Th><Th align="right">Due</Th><Th>Flags</Th></tr></thead>
        <tbody>
          {shown.map((r) => (
            <Tr key={r.request.id}>
              <Td className="text-2xs text-ink"><span className="font-mono">{r.request.id}</span><span className="block text-[10px] text-ink-3">{REQUEST_KIND_LABEL[r.request.kind]}</span></Td>
              <Td><Chip>{REQUEST_STATE_LABEL[r.request.state]}</Chip></Td>
              <Td align="right" className={cn('tnum text-2xs', r.open && r.daysLeft <= 7 ? 'text-warn' : 'text-ink-2')}>{r.open ? `${r.daysLeft} d` : '—'}</Td>
              <Td><div className="flex max-w-[260px] flex-wrap gap-1">{r.flags.map((f) => <Chip key={f} tone={REQUEST_FLAG_CRIT[f] ? 'crit' : 'warn'}>{REQUEST_FLAG_LABEL[f]}</Chip>)}{!r.flags.length && <span className="text-2xs text-ink-3">—</span>}</div></Td>
            </Tr>
          ))}
        </tbody>
      </Table>
      <More shown={shown.length} total={s.readings.length} />
    </>
  )
}

export function PrivacyRequestCard({ props, size }: CardProps) {
  const req = REQUESTS.find((r) => r.id === String(props.id))
  const r = React.useMemo(() => (req ? readRequest(req) : null), [req])
  if (!req || !r) return <span className="text-2xs text-ink-3">—</span>
  const shown = limit(r.items, size, 8)
  return (
    <>
      <div className="flex flex-wrap items-center gap-1.5">
        <Chip>{REQUEST_KIND_LABEL[req.kind]}</Chip>
        <Chip>{REQUEST_STATE_LABEL[req.state]}</Chip>
        {r.open && <Chip tone={r.daysLeft <= 7 ? 'warn' : 'neutral'}>{r.daysLeft} d left</Chip>}
        {r.flags.map((f) => <Chip key={f} tone={REQUEST_FLAG_CRIT[f] ? 'crit' : 'warn'}>{REQUEST_FLAG_LABEL[f]}</Chip>)}
      </div>
      <Table className="mt-2.5">
        <thead><tr><Th>Store</Th><Th>Search</Th><Th align="right">Records</Th><Th>Action</Th></tr></thead>
        <tbody>
          {shown.map((i) => (
            <Tr key={i.item.id}>
              <Td className="text-2xs text-ink">{i.item.name}{i.holds.length > 0 && <span className="ml-1 font-mono text-[10px] text-warn">{i.holds.map((h) => h.id).join(' ')}</span>}</Td>
              <Td><Chip tone={VERDICT_TONE[i.verdict]}>{SEARCH_LABEL[i.verdict]}</Chip></Td>
              <Td align="right" className="tnum text-2xs text-ink-2">{i.verdict === 'found' ? num(i.records) : '—'}</Td>
              <Td className="text-2xs text-ink-2">{i.action ? <Chip tone={i.action.outcome === 'retained' ? 'warn' : 'ok'}>{i.action.outcome}</Chip> : '—'}</Td>
            </Tr>
          ))}
        </tbody>
      </Table>
      <More shown={shown.length} total={r.items.length} />
    </>
  )
}

export function ReleasesCard({ size }: CardProps) {
  const s = React.useMemo(() => releaseSummary(), [])
  const rows = [...s.readings].sort((a, b) => Number(b.blocked) - Number(a.blocked) || b.flags.length - a.flags.length)
  const shown = limit(rows, size)
  return (
    <>
      <div className="grid grid-cols-4 gap-3">
        <Metric size="sm" label="Upcoming" value={s.upcoming} />
        <Metric size="sm" label="Next 14 days" value={s.next14d} />
        <Metric size="sm" label="Failing regression" value={s.gateFail} deltaTone={s.gateFail ? 'warn' : 'ok'} />
        <Metric size="sm" label="Blocked" value={s.blocked} deltaTone={s.blocked ? 'crit' : 'ok'} />
      </div>
      <Table className="mt-3">
        <thead><tr><Th>Release</Th><Th align="right">Window</Th><Th>State</Th><Th>Flags</Th></tr></thead>
        <tbody>
          {shown.map((r) => (
            <Tr key={r.release.id}>
              <Td className="max-w-[220px] text-2xs text-ink"><span className="block truncate">{r.release.version}</span><span className="block truncate text-[10px] text-ink-3">{r.item?.name ?? r.release.itemId}</span></Td>
              <Td align="right" className="tnum text-2xs text-ink-2">{dateShort(r.release.windowStart)}</Td>
              <Td><Chip>{RELEASE_STATE_LABEL[r.release.state]}</Chip></Td>
              <Td><div className="flex max-w-[240px] flex-wrap gap-1">{r.flags.map((f) => <Chip key={f} tone={RELEASE_FLAG_BLOCKS[f] ? 'crit' : 'warn'}>{RELEASE_FLAG_LABEL[f]}</Chip>)}{!r.flags.length && <span className="text-2xs text-ink-3">—</span>}</div></Td>
            </Tr>
          ))}
        </tbody>
      </Table>
      <More shown={shown.length} total={rows.length} />
    </>
  )
}

export function TechDebtCard({ size }: CardProps) {
  const s = React.useMemo(() => debtSummary(), [])
  const rows = size === 'card' ? s.recommendation.recommended.map((r) => r) : s.readings
  return (
    <>
      <div className="grid grid-cols-4 gap-3">
        <Metric size="sm" label="Live debt" value={s.live} />
        <Metric size="sm" label="Interest" value={num(s.interestHrs)} unit="h/yr" />
        <Metric size="sm" label="Unmeasured" value={s.unmeasured} deltaTone={s.unmeasured ? 'warn' : 'ok'} />
        <Metric size="sm" label="Recommended" value={`${num(s.recommendation.hours)} h`} />
      </div>
      <Table className="mt-3">
        <thead><tr><Th>Debt</Th><Th align="right">Interest</Th><Th align="right">Estimate</Th><Th>Flags</Th></tr></thead>
        <tbody>
          {rows.map((r) => (
            <Tr key={r.debt.id}>
              <Td className="max-w-[240px] text-2xs text-ink"><span className="block truncate">{r.debt.title}</span><span className="block font-mono text-[10px] text-ink-3">{r.debt.id} · {r.debt.state}</span></Td>
              <Td align="right" className="tnum text-2xs text-ink-2">{r.interestBasis === 'unmeasured' ? '—' : `${num(r.interestHrs)} h`}</Td>
              <Td align="right" className="tnum text-2xs text-ink-2">{num(r.debt.estimateHrs)} h</Td>
              <Td><div className="flex max-w-[220px] flex-wrap gap-1">{r.flags.map((f) => <Chip key={f} tone={DEBT_FLAG_CRIT[f] ? 'crit' : 'neutral'}>{DEBT_FLAG_LABEL[f]}</Chip>)}{!r.flags.length && <span className="text-2xs text-ink-3">—</span>}</div></Td>
            </Tr>
          ))}
        </tbody>
      </Table>
    </>
  )
}

const COVER_TONE: Record<CoverageState, 'ok' | 'warn' | 'crit'> = { owned: 'ok', assisted: 'warn', uncovered: 'crit' }
const COVER_LABEL: Record<CoverageState, string> = { owned: 'Owned', assisted: 'Assisted only', uncovered: 'Uncovered' }

export function CoverageCard({ props, size }: CardProps) {
  const c = React.useMemo(() => bundleCoverage(String(props.bundle)), [props.bundle])
  const rows = [...c.functions].sort((a, b) => Number(a.state === 'owned') - Number(b.state === 'owned'))
  const shown = limit(rows, size)
  return (
    <>
      <div className="grid grid-cols-3 gap-3">
        <Metric size="sm" label="Owned" value={c.owned} deltaTone="ok" />
        <Metric size="sm" label="Assisted only" value={c.assisted} deltaTone={c.assisted ? 'warn' : 'ok'} />
        <Metric size="sm" label="Uncovered" value={c.uncovered} deltaTone={c.uncovered ? 'crit' : 'ok'} />
      </div>
      <Table className="mt-3">
        <thead><tr><Th>Function</Th><Th>Coverage</Th><Th>Owned by</Th></tr></thead>
        <tbody>
          {shown.map((f) => (
            <Tr key={f.fn.id}>
              <Td className="text-2xs text-ink">{f.fn.name}</Td>
              <Td><Chip tone={COVER_TONE[f.state]}>{COVER_LABEL[f.state]}</Chip></Td>
              <Td><div className="flex max-w-[260px] flex-wrap gap-1">{f.owners.map((o) => <Chip key={o.agent.id}>{o.agent.name} · {MODE_LABEL[o.ceiling] ?? o.ceiling}</Chip>)}{!f.owners.length && f.assists.map((o) => <Chip key={o.agent.id}>{o.agent.name}</Chip>)}</div></Td>
            </Tr>
          ))}
        </tbody>
      </Table>
      <More shown={shown.length} total={rows.length} />
    </>
  )
}

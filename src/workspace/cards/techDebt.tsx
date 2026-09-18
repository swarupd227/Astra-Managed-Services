import React from 'react'
import { Landmark, ListOrdered } from 'lucide-react'
import {
  CATEGORY_LABEL, DEBT_CAPACITY, DEBT_CATEGORIES, DEBT_FLAG_CRIT, DEBT_FLAG_LABEL, DEBT_STATE_LABEL, DEFERRAL_LABEL,
  debtSummary, type DebtReading, type DebtState,
} from '@/domain/techDebt'
import { AGENT_BY_ID } from '@/domain/estate'
import { supportedItem } from '@/domain/supported'
import { Card, Chip, Metric, Table, Td, Th, Tr } from '@/ui/primitives'
import { num } from '@/lib/format'
import { Band, type ArtifactView, type CardProps } from './frame'

/* ==========================================================================
   Technical debt.

   The recommendation for the coming quarter comes first: what fits in the
   declared capacity and in what order, and what was deferred and why. The
   register below carries every item with its measured interest, estimate,
   payback and flags. A card carries the recommendation alone.
   ========================================================================== */

type Tone = 'neutral' | 'ok' | 'warn' | 'crit' | 'info' | 'brand' | 'agent'

const STATE_TONE: Record<DebtState, Tone> = { open: 'warn', accepted: 'neutral', scheduled: 'brand', remediating: 'agent', retired: 'ok' }

const interest = (r: DebtReading) =>
  r.interestBasis === 'unmeasured' ? '—' : `${num(r.interestHrs)} h${r.interestBasis === 'partial' ? '+' : ''}`

const payback = (r: DebtReading) => (r.paybackYrs === null ? '—' : r.paybackYrs < 1 ? `${Math.round(r.paybackYrs * 12)} mo` : `${r.paybackYrs.toFixed(1)} y`)

function Items({ ids }: { ids: string[] }) {
  return (
    <div className="flex max-w-[260px] flex-wrap gap-1">
      {ids.map((id) => {
        const it = supportedItem(id)
        return <Chip key={id} title={it?.kindLabel}>{it?.name ?? id}</Chip>
      })}
    </div>
  )
}

function TechDebtMetrics({ size }: CardProps) {
  const s = React.useMemo(() => debtSummary(), [])
  const page = size === 'page'
  return (
    <Band size={size} cols={6}>
      <Metric size="sm" label="Live debt" value={s.live} />
      <Metric size="sm" label="Interest" value={num(s.interestHrs)} unit="h/yr" />
      <Metric size="sm" label="Unmeasured" value={s.unmeasured} deltaTone={s.unmeasured ? 'warn' : 'ok'} />
      {page && <Metric size="sm" label="End of support" value={s.endOfSupport} unit="≤ 180 d" deltaTone={s.endOfSupport ? 'crit' : 'ok'} />}
      {page && <Metric size="sm" label="Review overdue" value={s.reviewOverdue} deltaTone={s.reviewOverdue ? 'crit' : 'ok'} />}
      <Metric
        size="sm"
        label={page ? `${DEBT_CAPACITY.quarter} capacity` : 'Recommended'}
        value={page ? `${num(s.recommendation.hours)}/${num(DEBT_CAPACITY.hours)}` : `${num(s.recommendation.hours)} h`}
        unit={page ? 'h' : undefined}
        hint={page ? `${num(s.recommendation.relievedHrs)} h/yr relieved` : undefined}
      />
    </Band>
  )
}

function TechDebtBody({ size }: CardProps) {
  const s = React.useMemo(() => debtSummary(), [])
  const rec = s.recommendation
  const rows = React.useMemo(
    () => [...s.readings].sort((a, b) => Number(b.live) - Number(a.live) || b.flags.length - a.flags.length || b.interestHrs - a.interestHrs),
    [s],
  )

  if (size !== 'page') {
    return (
      <Table>
        <thead><tr><Th>Debt</Th><Th align="right">Interest</Th><Th align="right">Estimate</Th><Th>Flags</Th></tr></thead>
        <tbody>
          {rec.recommended.map((r) => (
            <Tr key={r.debt.id}>
              <Td className="max-w-[240px] text-2xs text-ink"><span className="block truncate">{r.debt.title}</span><span className="block font-mono text-[10px] text-ink-3">{r.debt.id} · {r.debt.state}</span></Td>
              <Td align="right" className="tnum text-2xs text-ink-2">{interest(r)}</Td>
              <Td align="right" className="tnum text-2xs text-ink-2">{num(r.debt.estimateHrs)} h</Td>
              <Td><div className="flex max-w-[220px] flex-wrap gap-1">{r.flags.map((f) => <Chip key={f} tone={DEBT_FLAG_CRIT[f] ? 'crit' : 'neutral'}>{DEBT_FLAG_LABEL[f]}</Chip>)}{!r.flags.length && <span className="text-2xs text-ink-3">—</span>}</div></Td>
            </Tr>
          ))}
        </tbody>
      </Table>
    )
  }

  return (
    <>
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <Card title={`Recommended for ${DEBT_CAPACITY.quarter}`} subtitle={`Capacity declared by ${DEBT_CAPACITY.declaredBy}`} right={<ListOrdered size={13} className="text-ink-3" />}>
          <Table>
            <thead>
              <tr><Th align="right">#</Th><Th>Debt</Th><Th>Basis</Th><Th align="right">Estimate</Th><Th align="right">Payback</Th></tr>
            </thead>
            <tbody>
              {rec.recommended.map((r, i) => (
                <Tr key={r.debt.id}>
                  <Td align="right" className="tnum text-2xs text-ink-3">{i + 1}</Td>
                  <Td className="max-w-[300px] text-2xs text-ink">
                    {r.debt.title}
                    <span className="block font-mono text-[10px] text-ink-3">{r.debt.id}</span>
                  </Td>
                  <Td>
                    {r.mandatory
                      ? <Chip tone="crit" className="whitespace-nowrap">{r.eosDays !== null && r.eosDays <= 180 ? `End of support · ${r.eosDays} d` : CATEGORY_LABEL[r.debt.category]}</Chip>
                      : <Chip tone="ok" className="whitespace-nowrap">Payback</Chip>}
                  </Td>
                  <Td align="right" className="tnum text-2xs text-ink-2">{num(r.debt.estimateHrs)} h</Td>
                  <Td align="right" className="tnum text-2xs text-ink-2">{payback(r)}</Td>
                </Tr>
              ))}
            </tbody>
          </Table>
        </Card>

        <Card title="Deferred" subtitle={`${rec.deferred.length} items`}>
          <div className="space-y-1.5">
            {rec.deferred.map(({ reading: r, reason }) => (
              <div key={r.debt.id} className="flex items-start gap-2 rounded border border-line bg-sunken px-2.5 py-1.5">
                <span className="min-w-0 flex-1 text-2xs text-ink">
                  {r.debt.title}
                  <span className="block text-[10px] text-ink-3"><span className="font-mono">{r.debt.id}</span> · {num(r.debt.estimateHrs)} h</span>
                </span>
                <Chip tone={reason === 'interest_unmeasured' ? 'neutral' : 'warn'}>{DEFERRAL_LABEL[reason]}</Chip>
              </div>
            ))}
            {!rec.deferred.length && <span className="text-2xs text-ink-3">—</span>}
          </div>
          <div className="mt-3 flex flex-wrap gap-1.5 border-t border-line pt-2.5">
            {DEBT_CATEGORIES.map((c) => <Chip key={c}>{CATEGORY_LABEL[c]} · {s.byCategory[c]}</Chip>)}
          </div>
        </Card>
      </div>

      <Card className="mt-4" title="Register" subtitle={`${s.readings.length} items`} right={<Landmark size={13} className="text-ink-3" />}>
        <Table>
          <thead>
            <tr>
              <Th>Debt</Th><Th>Category</Th><Th>Lives in</Th><Th align="right">Interest/yr</Th>
              <Th align="right">Estimate</Th><Th align="right">Payback</Th><Th>State</Th><Th>Flags</Th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <Tr key={r.debt.id} className={!r.live ? 'opacity-60' : r.flags.some((f) => DEBT_FLAG_CRIT[f]) ? 'bg-crit/[0.04]' : undefined}>
                <Td className="max-w-[260px] text-2xs text-ink">
                  {r.debt.title}
                  <span className="block text-[10px] text-ink-3">
                    <span className="font-mono">{r.debt.id}</span> · {AGENT_BY_ID[r.debt.raisedBy]?.name ?? r.debt.raisedBy}
                  </span>
                </Td>
                <Td><Chip tone={r.debt.category === 'security' ? 'crit' : 'brand'}>{CATEGORY_LABEL[r.debt.category]}</Chip></Td>
                <Td><Items ids={r.debt.itemIds} /></Td>
                <Td align="right" className="tnum text-2xs text-ink-2">{interest(r)}</Td>
                <Td align="right" className="tnum text-2xs text-ink-2">{num(r.debt.estimateHrs)} h</Td>
                <Td align="right" className="tnum text-2xs text-ink-2">{payback(r)}</Td>
                <Td>
                  <Chip tone={STATE_TONE[r.debt.state]}>{DEBT_STATE_LABEL[r.debt.state]}</Chip>
                  {(r.debt.workOrderId || r.debt.releaseId) && <span className="block font-mono text-[10px] text-ink-3">{r.debt.workOrderId ?? r.debt.releaseId}</span>}
                  {r.debt.acceptance && <span className="block text-[10px] text-ink-3">{r.debt.acceptance.by}</span>}
                </Td>
                <Td>
                  <div className="flex max-w-[240px] flex-wrap gap-1">
                    {r.flags.map((f) => <Chip key={f} tone={DEBT_FLAG_CRIT[f] ? 'crit' : f === 'end_of_support' ? 'warn' : 'neutral'}>{DEBT_FLAG_LABEL[f]}</Chip>)}
                    {!r.flags.length && <span className="text-2xs text-ink-3">—</span>}
                  </div>
                </Td>
              </Tr>
            ))}
          </tbody>
        </Table>
      </Card>
    </>
  )
}

export const techDebtView: ArtifactView = {
  Body: TechDebtBody,
  Metrics: TechDebtMetrics,
  page: {
    title: 'Technical debt',
    subtitle: 'Operational, architectural, performance, supportability and security debt',
    agents: ['agt_prospect', 'agt_archivist'],
    what: 'attributing demand to debt and costing its interest',
  },
}

import React from 'react'
import { Archive, PackageCheck, Scale } from 'lucide-react'
import {
  EXIT_STATE_LABEL, HOLDING_KIND_LABEL, HOLDING_STATE_LABEL, readExit,
  type ExitReading, type HoldingReading, type HoldingState, type ObligationState,
} from '@/domain/exit'
import { ENGAGEMENT } from '@/domain/engagement'
import { useAstra } from '@/domain/store'
import { Card, Chip, Metric, Table, Td, Th, Tr } from '@/ui/primitives'
import { dateShort, num, pct } from '@/lib/format'
import { Band, More, limit, type ArtifactView, type CardProps } from './frame'

/* ==========================================================================
   Renew or exit.

   The obligations of leaving, each against the clause that creates it; what
   the platform itself holds of the client and what has become of it; and
   the two packs the end of a term calls for — one for the benchmarker, one
   for whoever takes over.
   ========================================================================== */

type Tone = 'neutral' | 'ok' | 'warn' | 'crit' | 'info' | 'brand'

const OBLIGATION_TONE: Record<ObligationState, Tone> = { not_started: 'warn', ready: 'info', done: 'ok' }
const HOLDING_TONE: Record<HoldingState, Tone> = { held: 'warn', returned: 'info', destroyed: 'ok' }

function useExit(): ExitReading {
  const log = useAstra((s) => s.exitLog)
  const verified = useAstra((s) => s.assertions.filter((a) => a.verification === 'human_verified').length)
  return React.useMemo(() => readExit(log, verified), [log, verified])
}

function ExitMetrics({ size }: CardProps) {
  const r = useExit()
  const page = size === 'page'
  const ready = r.obligations.filter((o) => o.state !== 'not_started').length
  return (
    <Band size={size} cols={6}>
      <Metric size="sm" label="Obligations ready" value={`${ready}/${r.obligations.length}`} deltaTone={ready === r.obligations.length ? 'ok' : 'warn'} hint={page ? `${r.obligations.filter((o) => o.state === 'done').length} done` : undefined} />
      <Metric size="sm" label="Holdings" value={r.holdings.length} hint={page ? 'what the platform keeps of the client' : undefined} />
      <Metric size="sm" label="Returned" value={r.returned} deltaTone={r.returned ? 'ok' : undefined} />
      <Metric size="sm" label="Destroyed" value={r.destroyed} deltaTone={r.destroyed ? 'ok' : undefined} />
      <Metric size="sm" label="Retained" value={r.residual.length} deltaTone={r.residual.length ? 'warn' : 'ok'} hint={page ? 'each with a stated reason' : undefined} />
      {page && <Metric size="sm" label="Term remaining" value={r.monthsLeft} unit="months" hint={`${ENGAGEMENT.contract.termMonths}-month term`} />}
    </Band>
  )
}

function ObligationsTable({ r, full }: { r: ExitReading; full: boolean }) {
  return (
    <Table>
      <thead>
        <tr><Th>Obligation</Th>{full && <Th>Clause</Th>}{full && <Th>Owner</Th>}<Th>State</Th><Th>What it rests on</Th></tr>
      </thead>
      <tbody>
        {r.obligations.map((o) => (
          <Tr key={o.obligation.id} className={o.state === 'not_started' ? 'bg-warn/[0.05]' : undefined}>
            <Td className="max-w-[300px] text-2xs text-ink">{o.obligation.obligation}</Td>
            {full && <Td className="whitespace-nowrap text-2xs text-ink-2">{o.obligation.clause}</Td>}
            {full && <Td className="text-2xs text-ink-2">{o.obligation.owner}</Td>}
            <Td><Chip tone={OBLIGATION_TONE[o.state]} className="whitespace-nowrap">{EXIT_STATE_LABEL[o.state]}</Chip></Td>
            <Td className="max-w-[300px] text-2xs text-ink-2">{o.note}</Td>
          </Tr>
        ))}
      </tbody>
    </Table>
  )
}

function HoldingsTable({ rows, full }: { rows: HoldingReading[]; full: boolean }) {
  return (
    <Table>
      <thead>
        <tr>
          <Th>What the platform holds</Th>{full && <Th>Contains</Th>}{full && <Th align="right">Records</Th>}
          {full && <Th>Location</Th>}<Th>State</Th><Th>Retained because</Th>
        </tr>
      </thead>
      <tbody>
        {rows.map((h) => (
          <Tr key={h.holding.id} className={h.mustKeep ? 'bg-warn/[0.04]' : undefined}>
            <Td className="max-w-[200px] text-2xs text-ink">
              {h.holding.name}
              <span className="block text-[10px] text-ink-3">{HOLDING_KIND_LABEL[h.holding.kind]}{h.returnable ? '' : ' · cannot be returned'}</span>
            </Td>
            {full && <Td className="max-w-[300px] text-2xs text-ink-2">{h.holding.what}</Td>}
            {full && <Td align="right" className="tnum text-2xs text-ink-2">{h.count === null ? 'not counted' : num(h.count)}</Td>}
            {full && <Td className="text-2xs text-ink-2">{h.holding.location}</Td>}
            <Td>
              <Chip tone={HOLDING_TONE[h.state]} className="whitespace-nowrap">{HOLDING_STATE_LABEL[h.state]}</Chip>
              {full && h.settlement && (
                <span className="block text-[10px] text-ink-3">
                  {h.settlement.by} · {dateShort(h.settlement.at)} · {h.settlement.reference}
                  {h.settlement.method ? ` · ${h.settlement.method}` : ''}
                </span>
              )}
            </Td>
            <Td className="max-w-[220px] text-2xs text-ink-2">
              {h.mustKeep ? <>{h.mustKeep.reason}<span className="block text-[10px] text-ink-3">{h.mustKeep.until}</span></> : <span className="text-ink-3">—</span>}
            </Td>
          </Tr>
        ))}
      </tbody>
    </Table>
  )
}

function ExitBody({ props, size }: CardProps) {
  const r = useExit()
  const full = size !== 'card'

  if (size !== 'page') {
    if (String(props.focus ?? '') === 'holdings') {
      const shown = limit(r.holdings, size)
      return <><HoldingsTable rows={shown} full={full} /><More shown={shown.length} total={r.holdings.length} /></>
    }
    return <ObligationsTable r={r} full={full} />
  }

  return (
    <>
      <Card title="Exit obligations" subtitle={`${ENGAGEMENT.client} · ${r.monthsLeft} months of the term remaining`} right={<Scale size={13} className="text-ink-3" />}>
        <ObligationsTable r={r} full />
      </Card>

      <Card className="mt-4" title="What the platform holds" subtitle={`${r.holdings.length} holdings · ${r.returned} returned · ${r.destroyed} destroyed · ${r.residual.length} retained`} right={<Archive size={13} className="text-ink-3" />}>
        <HoldingsTable rows={r.holdings} full />
      </Card>

      <div className="mt-4 grid gap-4 xl:grid-cols-2">
        <Card title="Benchmark pack" subtitle="Measured, not reconstructed" right={<Scale size={13} className="text-ink-3" />}>
          <div className="grid grid-cols-3 gap-3">
            <Metric size="sm" label="Quarters" value={r.benchmark.quarters.length} />
            <Metric size="sm" label="Baseline" value={r.benchmark.baselineHrsPerYear === null ? '—' : num(r.benchmark.baselineHrsPerYear)} unit="h/yr" />
            <Metric size="sm" label="Banked" value={num(r.benchmark.bankedHrs)} unit="h" />
          </div>
          <Table className="mt-3">
            <thead><tr><Th>Quarter</Th><Th align="right">Contracted</Th><Th align="right">Actual</Th></tr></thead>
            <tbody>
              {r.benchmark.quarters.map((q) => (
                <Tr key={q.quarter}>
                  <Td className="text-2xs text-ink">{q.quarter}</Td>
                  <Td align="right" className="tnum text-2xs text-ink-2">{pct(q.contractedPct, 1)}</Td>
                  <Td align="right" className={q.actualPct <= q.contractedPct ? 'tnum text-2xs text-ok' : 'tnum text-2xs text-warn'}>{pct(q.actualPct, 1)}</Td>
                </Tr>
              ))}
            </tbody>
          </Table>
          <div className="mt-2 flex flex-wrap gap-1 border-t border-line pt-2">
            <span className="label-cap mr-1">Service levels</span>
            {r.benchmark.serviceLevels.slice(0, 6).map((s) => (
              <Chip key={s.id} tone={s.attainmentMtd >= s.target ? 'ok' : 'crit'}>{s.attainmentMtd} / {s.target}</Chip>
            ))}
          </div>
        </Card>

        <Card title="Successor pack" subtitle="What the next provider starts from" right={<PackageCheck size={13} className="text-ink-3" />}>
          <div className="grid grid-cols-2 gap-3">
            <Metric size="sm" label="Verified assertions" value={num(r.reverse.verifiedAssertions)} hint={`of ${num(r.reverse.totalAssertions)} held`} />
            <Metric size="sm" label="Demand classes" value={r.reverse.demandClasses} />
            <Metric size="sm" label="Estate items" value={r.reverse.estateItems} hint={`${r.reverse.applications} applications`} />
            <Metric size="sm" label="Evidence records" value={num(r.reverse.evidenceRecords)} hint={`${r.reverse.runbooks} handover artefacts`} />
          </div>
        </Card>
      </div>
    </>
  )
}

export const exitView: ArtifactView = {
  Body: ExitBody,
  Metrics: ExitMetrics,
  page: {
    title: 'Renew or exit',
    subtitle: 'Exit obligations, what the platform holds of the client, and the packs a benchmark or a successor needs',
    agents: ['agt_archivist', 'agt_herald'],
    what: 'holding what the service knows, and giving it back',
  },
}

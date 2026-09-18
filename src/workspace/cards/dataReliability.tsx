import React from 'react'
import { Activity, Gauge, MoonStar, Wrench } from 'lucide-react'
import { AGENT_BY_ID } from '@/domain/estate'
import { CAPACITY, PERIOD_DAYS, RECOVERY_LABEL, SCHEDULES, type RecoveryPath } from '@/domain/dataRuns'
import {
  reliabilitySummary,
  type BudgetState, type FailureRow, type Risk, type RunReading, type ServiceReading,
} from '@/domain/dataReliability'
import { Bar, Card, Chip, Metric, Table, Td, Th, Tr } from '@/ui/primitives'
import { cn, mins, pct } from '@/lib/format'
import { Band, More, limit, type ArtifactView, type CardProps } from './frame'

/* ==========================================================================
   Data reliability.

   Data services against their availability targets first, then tonight's
   runs projected against their windows, then the capacity under them, then
   every failure of the period and who put it right. A card carries one of
   those, chosen by the question that opened it.
   ========================================================================== */

type Tone = 'neutral' | 'ok' | 'warn' | 'crit' | 'info'

const BUDGET_TONE: Record<BudgetState, Tone> = { within: 'ok', burning: 'warn', exhausted: 'crit' }
const BUDGET_LABEL: Record<BudgetState, string> = { within: 'Within', burning: 'Over half used', exhausted: 'Exhausted' }
const RISK_TONE: Record<Risk, Tone> = { miss: 'crit', tight: 'warn', clear: 'ok', blocked: 'crit' }
const RISK_LABEL: Record<Risk, string> = { miss: 'Will miss', tight: 'Tight', clear: 'Clear', blocked: 'Blocked' }
const PATH_TONE: Record<RecoveryPath, Tone> = { first_try: 'neutral', retry: 'ok', agent: 'ok', human: 'warn', code_change: 'warn', open: 'crit' }

/** A UTC instant as local HH:MM for a schedule's offset. */
const local = (iso: string, offsetHrs: number) => {
  const d = new Date(Date.parse(iso) + offsetHrs * 3_600_000)
  return `${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')}`
}
const localDay = (iso: string, offsetHrs: number) =>
  new Date(Date.parse(iso) + offsetHrs * 3_600_000).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', timeZone: 'UTC' })

const who = (id: string | null) => (id ? AGENT_BY_ID[id]?.name ?? id : '—')

function useSummary() {
  return React.useMemo(() => reliabilitySummary(), [])
}

function Availability({ s }: { s: ServiceReading }) {
  if (s.availabilityPct === null) return <Chip>Not measured</Chip>
  return (
    <span className="block min-w-[110px]">
      <span className={cn('tnum text-2xs', s.meetsTarget ? 'text-ink-2' : 'text-crit')}>
        {pct(s.availabilityPct, 2)} <span className="text-ink-3">/ {pct(s.service.target, 1)}</span>
      </span>
      {/* The bar spans the error budget, not the whole period: a full bar is a spent budget. */}
      <Bar value={Math.min(s.budget.usedMins, s.budget.allowedMins)} max={s.budget.allowedMins || 1} tone={BUDGET_TONE[s.budget.state]} height={3} className="mt-1" />
    </span>
  )
}

function Now({ s }: { s: ServiceReading }) {
  if (!s.measured) return <span className="text-2xs text-ink-3">—</span>
  if (s.open) {
    return (
      <Chip tone="crit" className="whitespace-nowrap">
        Down since {localDay(s.open.since, s.service.utcOffsetHrs)} {local(s.open.since, s.service.utcOffsetHrs)}
        {s.open.cause ? ` · ${s.open.cause.name}` : ''}
      </Chip>
    )
  }
  return <Chip tone="ok">Up</Chip>
}

function DataReliabilityMetrics({ size }: CardProps) {
  const s = useSummary()
  const page = size === 'page'
  const recovered = s.failures.filter((f) => f.path !== 'open').length
  return (
    <Band size={size} cols={6}>
      <Metric size="sm" label="Services on target" value={`${s.meetingTarget}/${s.measured}`} deltaTone={s.meetingTarget === s.measured ? 'ok' : 'crit'} hint={page ? `${s.services.length - s.measured} not measured` : undefined} />
      <Metric size="sm" label="Open outages" value={s.openOutages} deltaTone={s.openOutages ? 'crit' : 'ok'} hint={page ? `${s.budgetsExhausted} budget exhausted` : undefined} />
      {page && <Metric size="sm" label="Runs on time" value={`${s.onTime}/${s.totalRuns}`} hint="retries included" />}
      <Metric size="sm" label="Recovered without a person" value={s.withoutPersonPct === null ? '—' : pct(s.withoutPersonPct, 0)} hint={`${recovered} recovered`} />
      {page && <Metric size="sm" label="Median restart" value={s.medianRestartMins === null ? '—' : mins(s.medianRestartMins)} hint={s.medianRecoverMins === null ? undefined : `${mins(s.medianRecoverMins)} to landing`} />}
      <Metric size="sm" label="At risk tonight" value={s.atRisk} deltaTone={s.atRisk ? 'warn' : 'ok'} hint={`${s.lengthening} lengthening`} />
    </Band>
  )
}

function ServicesTable({ rows, full }: { rows: ServiceReading[]; full: boolean }) {
  return (
    <Table>
      <thead>
        <tr>
          <Th>Service</Th>{full && <Th align="right">Due</Th>}<Th>Availability</Th>
          <Th align="right">Unplanned</Th>{full && <Th align="right">Planned</Th>}{full && <Th align="right">Degraded</Th>}
          <Th>Budget</Th><Th>Now</Th>{full && <Th>Not observed</Th>}
        </tr>
      </thead>
      <tbody>
        {rows.map((s) => (
          <Tr key={s.service.id} className={s.open ? 'bg-crit/[0.05]' : undefined}>
            <Td className="max-w-[220px] text-2xs text-ink">
              {s.service.name}
              <span className="mt-0.5 flex items-center gap-1 text-[10px] text-ink-3">
                <Chip tone={s.service.tier === 1 ? 'warn' : 'neutral'}>Tier {s.service.tier}</Chip>
                {full && <span>{s.service.declaredBy}</span>}
              </span>
            </Td>
            {full && <Td align="right" className="tnum text-2xs text-ink-2">{s.service.due}</Td>}
            <Td><Availability s={s} /></Td>
            <Td align="right" className={cn('tnum text-2xs', s.unplannedMins ? 'text-ink' : 'text-ink-3')}>{s.measured ? mins(s.unplannedMins) : '—'}</Td>
            {full && <Td align="right" className="tnum text-2xs text-ink-3">{s.plannedMins ? mins(s.plannedMins) : '—'}</Td>}
            {full && <Td align="right" className={cn('tnum text-2xs', s.degradedMins ? 'text-warn' : 'text-ink-3')}>{s.degradedMins ? mins(s.degradedMins) : '—'}</Td>}
            <Td>
              {s.measured
                ? <Chip tone={BUDGET_TONE[s.budget.state]} className="whitespace-nowrap">{BUDGET_LABEL[s.budget.state]}{full ? ` · ${mins(s.budget.usedMins)}/${mins(s.budget.allowedMins)}` : ''}</Chip>
                : <span className="text-2xs text-ink-3">—</span>}
            </Td>
            <Td><Now s={s} /></Td>
            {full && (
              <Td>
                <div className="flex max-w-[200px] flex-wrap gap-1">
                  {s.unobserved.map((i) => <Chip key={i.id}>{i.name}</Chip>)}
                  {!s.unobserved.length && <span className="text-2xs text-ink-3">—</span>}
                </div>
              </Td>
            )}
          </Tr>
        ))}
      </tbody>
    </Table>
  )
}

function Trend({ r }: { r: RunReading }) {
  if (r.duration.daysToMiss === null) return <span className="text-2xs text-ink-3">Flat</span>
  return (
    <Chip tone={r.duration.daysToMiss <= 14 ? 'warn' : 'neutral'} className="whitespace-nowrap">
      +{r.duration.slopePerDay} m/night · misses in {r.duration.daysToMiss} d
    </Chip>
  )
}

function TonightTable({ rows, full }: { rows: RunReading[]; full: boolean }) {
  return (
    <Table>
      <thead>
        <tr>
          <Th>Run</Th>{full && <Th>Window</Th>}<Th>Tonight</Th><Th align="right">Projected</Th><Th align="right">Margin</Th>
          <Th>Trend</Th>{full && <Th>Capacity</Th>}
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <Tr key={r.item.id} className={r.tonight.risk === 'blocked' || r.tonight.risk === 'miss' ? 'bg-crit/[0.05]' : r.tonight.risk === 'tight' ? 'bg-warn/[0.05]' : undefined}>
            <Td className="max-w-[200px] text-2xs text-ink">
              {r.item.name}
              <span className="block text-[10px] text-ink-3">{r.item.platform}</span>
            </Td>
            {full && <Td className="tnum whitespace-nowrap text-2xs text-ink-2">{r.schedule.start}–{r.schedule.due}</Td>}
            <Td>
              <Chip tone={RISK_TONE[r.tonight.risk]} className="whitespace-nowrap">
                {r.tonight.state === 'running' ? 'Running · ' : ''}{RISK_LABEL[r.tonight.risk]}
              </Chip>
              {r.tonight.blockedBy && r.tonight.blockedBy.id !== r.item.id && <span className="block text-[10px] text-ink-3">{r.tonight.blockedBy.name}</span>}
            </Td>
            <Td align="right" className="tnum text-2xs text-ink-2">{r.tonight.projectedAt ? local(r.tonight.projectedAt, r.schedule.utcOffsetHrs) : '—'}</Td>
            <Td align="right" className={cn('tnum text-2xs', r.tonight.marginMins !== null && r.tonight.marginMins < 0 ? 'text-crit' : 'text-ink-2')}>
              {r.tonight.marginMins === null ? '—' : `${r.tonight.marginMins < 0 ? '−' : ''}${mins(Math.abs(r.tonight.marginMins))}`}
            </Td>
            <Td><Trend r={r} /></Td>
            {full && (
              <Td>
                <div className="flex max-w-[200px] flex-wrap gap-1">
                  {r.capacity.map((c) => <Chip key={c.id} tone={c.peakPct >= c.thresholdPct ? 'warn' : 'neutral'} className="whitespace-nowrap">{c.metric} {c.peakPct}%</Chip>)}
                  {!r.capacity.length && <span className="text-2xs text-ink-3">—</span>}
                </div>
              </Td>
            )}
          </Tr>
        ))}
      </tbody>
    </Table>
  )
}

function FailuresTable({ rows, full }: { rows: FailureRow[]; full: boolean }) {
  return (
    <Table>
      <thead>
        <tr>
          <Th>Day</Th><Th>Run</Th>{full && <Th>Failure</Th>}<Th>Recovered by</Th>
          {full && <Th align="right">Restart</Th>}<Th align="right">To landing</Th><Th>Window</Th>
        </tr>
      </thead>
      <tbody>
        {rows.map((f) => (
          <Tr key={`${f.item.id}-${f.run.day}`} className={f.path === 'open' ? 'bg-crit/[0.05]' : undefined}>
            <Td className="tnum whitespace-nowrap text-2xs text-ink-2">{localDay(f.run.scheduledAt, SCHEDULES[f.item.id]?.utcOffsetHrs ?? 0)}</Td>
            <Td className="max-w-[180px] text-2xs text-ink">{f.item.name}</Td>
            {full && <Td className="max-w-[260px] text-2xs text-ink-2">{f.error}</Td>}
            <Td>
              <Chip tone={PATH_TONE[f.path]} className="whitespace-nowrap">{RECOVERY_LABEL[f.path]}</Chip>
              {f.recoveredBy && <span className="block text-[10px] text-ink-3">{who(f.recoveredBy)}</span>}
            </Td>
            {full && <Td align="right" className="tnum text-2xs text-ink-2">{f.restartMins === null ? '—' : mins(f.restartMins)}</Td>}
            <Td align="right" className="tnum text-2xs text-ink-2">{f.path === 'open' ? `${mins(f.recoverMins)}+` : mins(f.recoverMins)}</Td>
            <Td><Chip tone={f.onTime ? 'ok' : 'crit'}>{f.onTime ? 'In window' : f.path === 'open' ? 'Missed' : 'Late'}</Chip></Td>
          </Tr>
        ))}
      </tbody>
    </Table>
  )
}

function DataReliabilityBody({ props, size }: CardProps) {
  const s = useSummary()
  const full = size !== 'card'

  if (size !== 'page') {
    const focus = String(props.focus ?? 'services')
    if (focus === 'tonight') {
      const rows = [...s.runs].sort((a, b) => ['blocked', 'miss', 'tight', 'clear'].indexOf(a.tonight.risk) - ['blocked', 'miss', 'tight', 'clear'].indexOf(b.tonight.risk))
      const shown = limit(rows, size)
      return <><TonightTable rows={shown} full={full} /><More shown={shown.length} total={rows.length} /></>
    }
    if (focus === 'failures') {
      const shown = limit(s.failures, size)
      return <><FailuresTable rows={shown} full={full} /><More shown={shown.length} total={s.failures.length} /></>
    }
    const rows = props.service ? s.services.filter((x) => x.service.id === props.service) : s.services
    const shown = limit(rows, size)
    return (
      <>
        <ServicesTable rows={shown} full={full} />
        <More shown={shown.length} total={rows.length} />
        {props.service && shown[0] && shown[0].outages.length > 0 && (
          <div className="mt-2.5 flex flex-wrap gap-1 border-t border-line pt-2">
            <span className="label-cap mr-1">Outages</span>
            {shown[0].outages.map((o) => (
              <Chip key={o.start} tone={o.planned ? 'neutral' : 'crit'} className="whitespace-nowrap">
                {localDay(o.start, shown[0].service.utcOffsetHrs)} · {mins(o.mins)}{o.planned ? ' · planned' : ''}{o.cause ? ` · ${o.cause.name}` : ''}
              </Chip>
            ))}
          </div>
        )}
      </>
    )
  }

  return (
    <>
      <Card title="Data services" subtitle={`${s.services.length} services · ${PERIOD_DAYS} days`} right={<Activity size={13} className="text-ink-3" />}>
        <ServicesTable rows={s.services} full />
      </Card>

      <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <Card title="Tonight" subtitle="Projected · trend + p90" right={<MoonStar size={13} className="text-ink-3" />}>
          <TonightTable rows={s.runs} full />
        </Card>

        <Card title="Capacity" subtitle={`${CAPACITY.length} platforms`} right={<Gauge size={13} className="text-ink-3" />}>
          <div className="space-y-2">
            {CAPACITY.map((c) => {
              const over = c.peakPct >= c.thresholdPct
              return (
                <div key={c.id} className="rounded border border-line bg-sunken px-2.5 py-2">
                  <div className="flex items-center gap-2">
                    <span className="min-w-0 flex-1 text-2xs text-ink">
                      {c.resource}
                      <span className="block text-[10px] text-ink-3">{c.platform} · {c.metric} · {c.window}</span>
                    </span>
                    <span className={cn('tnum text-2xs', over ? 'text-warn' : 'text-ink-2')}>{c.peakPct}% / {c.thresholdPct}%</span>
                  </div>
                  <Bar value={c.peakPct} tone={over ? 'warn' : 'ok'} height={3} className="mt-1.5" />
                  <div className="mt-1.5 flex flex-wrap gap-1">
                    <Chip tone={c.trendPts > 0 ? 'warn' : 'neutral'}>{c.trendPts > 0 ? '+' : ''}{c.trendPts} pts · 7 d</Chip>
                    {c.throttledMins7d !== undefined && <Chip tone={c.throttledMins7d ? 'warn' : 'neutral'}>{mins(c.throttledMins7d)} throttled</Chip>}
                    <Chip tone="agent">{who(c.watchedBy)}</Chip>
                  </div>
                </div>
              )
            })}
          </div>
        </Card>
      </div>

      <Card className="mt-4" title="Failures" subtitle={`${s.failures.length} in ${s.totalRuns} runs`} right={<Wrench size={13} className="text-ink-3" />}>
        <div className="mb-2.5 flex flex-wrap gap-1.5">
          {(['retry', 'agent', 'human', 'code_change', 'open'] as RecoveryPath[]).map((p) => (
            <Chip key={p} tone={s.byPath[p] ? PATH_TONE[p] : 'neutral'}>{RECOVERY_LABEL[p]} · {s.byPath[p]}</Chip>
          ))}
        </div>
        <FailuresTable rows={s.failures} full />
      </Card>
    </>
  )
}

export const dataReliabilityView: ArtifactView = {
  Body: DataReliabilityBody,
  Metrics: DataReliabilityMetrics,
  page: {
    title: 'Data reliability',
    subtitle: 'Data services, tonight’s runs, capacity and recovery · 30 days',
    agents: ['agt_custodian', 'agt_bursar'],
    what: 'recovering failed runs and watching platform capacity',
  },
}

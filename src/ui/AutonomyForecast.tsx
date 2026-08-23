import React from 'react'
import { Link } from 'react-router-dom'
import { Ban, CalendarClock, CircleSlash, Gavel, Lock, TrendingUp } from 'lucide-react'
import { buildForecast, forecastSummary, type ForecastRow, type ForecastState } from '@/domain/forecast'
import { LevelPip } from './domain'
import { Card, Chip, Metric, Table, Td, Th, Tr } from './primitives'
import { cn, dateShort, num } from '@/lib/format'

/* ==========================================================================
   The Autonomy Forecast (§A5.3).

   Per action class: where it is, where it is contracted to get to, and when
   it will be eligible at the rate it is actually accumulating evidence.

   The blocked rows are the useful ones. A date says the plan is working; a
   named blocker with the transform item that clears it says what to do about
   the plan that is not.
   ========================================================================== */

const STATE_META: Record<ForecastState, { label: string; tone: 'ok' | 'brand' | 'crit' | 'warn' | 'neutral'; icon: typeof Ban }> = {
  at_target: { label: 'At target', tone: 'ok', icon: TrendingUp },
  evidence_met: { label: 'Awaiting decision', tone: 'warn', icon: Gavel },
  on_track: { label: 'Projected', tone: 'brand', icon: CalendarClock },
  blocked: { label: 'Blocked', tone: 'crit', icon: Ban },
  capped: { label: 'Capped', tone: 'neutral', icon: Lock },
  no_history: { label: 'No history', tone: 'warn', icon: CircleSlash },
}

function Row({ r }: { r: ForecastRow }) {
  const meta = STATE_META[r.state]
  const Icon = meta.icon

  return (
    <Tr>
      <Td>
        <span className="block truncate text-ink">{r.actionName}</span>
        <span className="block font-mono text-[10px] text-ink-3">{r.actionClass} · {r.towerName}</span>
      </Td>
      <Td>
        <span className="flex items-center gap-1.5">
          <LevelPip level={r.current} target={r.target} />
          <span className="tnum text-2xs text-ink-3">L{r.current} → L{r.target}</span>
        </span>
      </Td>
      <Td align="right" className="tnum text-2xs">
        {r.runsRequired ? `${num(r.runsToDate)} / ${num(r.runsRequired)}` : num(r.runsToDate)}
      </Td>
      <Td align="right" className="tnum text-2xs text-ink-3">
        {r.ratePerDay >= 1 ? `${r.ratePerDay.toFixed(0)}/day` : `${(r.ratePerDay * 7).toFixed(1)}/wk`}
      </Td>
      <Td>
        <span className="flex items-center gap-1.5">
          <Icon size={11} className={cn(
            meta.tone === 'ok' && 'text-ok',
            meta.tone === 'brand' && 'text-brand-ink',
            meta.tone === 'crit' && 'text-crit',
            meta.tone === 'warn' && 'text-warn',
            meta.tone === 'neutral' && 'text-ink-3',
          )} />
          {r.projectedDate ? (
            <span className="tnum text-2xs text-ink">
              {dateShort(r.projectedDate)}
              <span className="ml-1 text-ink-3">({r.daysOut}d)</span>
            </span>
          ) : (
            <Chip tone={meta.tone}>{meta.label}</Chip>
          )}
        </span>
      </Td>
      <Td className="text-2xs">
        {r.blocker ? (
          <span className="block leading-relaxed text-ink-2">
            {/* The blocker text often names the transform item itself, so the
                link replaces that mention rather than repeating it. */}
            {r.clearedBy ? r.blocker.replace(/\s*[—-]\s*transform item ta_\d+ raised/i, '') : r.blocker}
            {r.clearedBy && (
              <Link
                to="/governance/glidepath"
                className="mt-1 flex items-center gap-1 text-[10px] text-brand-ink hover:underline"
                title={`Transform item ${r.clearedBy.id} — ${r.clearedBy.title}`}
              >
                <span className="font-mono">{r.clearedBy.id}</span>
                <span className="truncate">clears it — {r.clearedBy.title}</span>
              </Link>
            )}
          </span>
        ) : r.state === 'capped' ? (
          <span className="text-ink-3">Platform floor — no evidence changes this</span>
        ) : r.state === 'evidence_met' ? (
          <span className="text-ink-2">Evidence gate passed — needs a governance decision, not more runs</span>
        ) : r.agreement !== null ? (
          <span className="text-ink-3">Shadow agreement {r.agreement}%</span>
        ) : (
          <span className="text-ink-3">—</span>
        )}
      </Td>
    </Tr>
  )
}

export function AutonomyForecast() {
  const rows = React.useMemo(() => buildForecast(), [])
  const summary = React.useMemo(() => forecastSummary(rows), [rows])

  // Blocked first — those are the rows that need a person. Then nearest date.
  const ordered = React.useMemo(
    () =>
      [...rows]
        .filter((r) => r.state !== 'at_target')
        .sort((a, b) => {
          const rank = (r: ForecastRow) =>
            r.state === 'blocked' ? 0 : r.state === 'evidence_met' ? 1 : r.state === 'on_track' ? 2 : 3
          return rank(a) - rank(b) || (a.daysOut ?? 1e9) - (b.daysOut ?? 1e9)
        }),
    [rows],
  )

  return (
    <Card
      title="Autonomy forecast"
      subtitle="Projected eligibility at the rate each class is actually accumulating evidence — and what is stopping the rest"
      right={<Chip tone={summary.blocked ? 'crit' : 'ok'}>{summary.blocked} blocked</Chip>}
    >
      <div className="grid grid-cols-2 gap-3 border-b border-line pb-3 sm:grid-cols-4">
        <Metric size="sm" label="At contracted target" value={`${summary.atTarget} / ${summary.total}`} hint="tower × action class" />
        <Metric size="sm" label="Awaiting your decision" value={summary.awaitingDecision} hint="evidence gate already passed" />
        <Metric size="sm" label="Blocked" value={summary.blocked} hint={`${summary.blockedWithOwner} with a transform item tracking it`} />
        <Metric
          size="sm"
          label="Last class eligible"
          value={summary.lastDateOut === null ? '—' : `${summary.lastDateOut}d`}
          hint="the end of the datable plan"
        />
      </div>

      <div className="mt-3 overflow-x-auto">
        <Table>
          <thead>
            <Tr>
              <Th>Action class</Th>
              <Th>Level</Th>
              <Th align="right">Executions</Th>
              <Th align="right">Rate</Th>
              <Th>Eligible</Th>
              <Th>Blocker</Th>
            </Tr>
          </thead>
          <tbody>
            {ordered.map((r) => <Row key={`${r.tower}-${r.actionClass}`} r={r} />)}
          </tbody>
        </Table>
      </div>

      <p className="mt-3 text-2xs leading-relaxed text-ink-3">
        Dates are executions-to-gate divided by the rate this class has actually run at over the
        engagement. A class with a named blocker gets no date until the blocker clears — the
        forecast declines to guess rather than filling the column.
      </p>
    </Card>
  )
}

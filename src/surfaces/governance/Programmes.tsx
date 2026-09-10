import React from 'react'
import { Link } from 'react-router-dom'
import { Flag, TriangleAlert } from 'lucide-react'
import {
  EVIDENCE_IS_CONCLUSIVE, EVIDENCE_LABEL, SCOPE_LABEL, allBurnDowns, type ScopeItem, type ScopeState,
} from '@/domain/programmes'
import { DEMAND_CLASSES } from '@/domain/ledgers'
import { PageHeader } from '@/ui/domain'
import { Bar, Card, Chip, Metric, Table, Td, Th, Tr } from '@/ui/primitives'
import { num } from '@/lib/format'
import { cn } from '@/lib/format'

/* ==========================================================================
   Programmes — a target end state with something to burn down against.

   The one distinction this page exists to hold open: an item somebody
   declared finished is not an item the platform can evidence is gone. Both
   counts are shown, side by side, and the gap between them is the honest
   part. A single burn-down line would have to pick one, and picking the
   flattering one is how estates end up with servers nobody admits to owning.
   ========================================================================== */

const STATE_TONE: Record<ScopeState, 'ok' | 'warn' | 'crit' | 'info' | 'neutral'> = {
  in_scope: 'neutral',
  in_flight: 'info',
  asserted_done: 'warn',
  evidenced_done: 'ok',
  descoped: 'neutral',
}

export function Programmes() {
  const burndowns = React.useMemo(() => allBurnDowns(), [])

  return (
    <>
      <PageHeader
        title="Programmes"
        subtitle="Target end states and evidenced completion"
      />

      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        {burndowns.map((b) => {
          const evidencedDone = b.total - b.descoped.length - b.remainingEvidenced
          const live = b.total - b.descoped.length
          return (
            <Card
              key={b.programme.id}
              title={b.programme.name}
              subtitle={`owner ${b.programme.owner} · started ${b.programme.startedAt.slice(0, 10)} · target ${b.programme.targetEndAt.slice(0, 10)}`}
              right={
                <span className="flex items-center gap-1.5">
                  {b.overdue.length > 0 && <Chip tone="warn">{b.overdue.length} overdue</Chip>}
                  <Chip tone={b.onSchedule === true ? 'ok' : b.onSchedule === false ? 'warn' : 'neutral'}>
                    {b.onSchedule === null ? 'no rate to project' : b.onSchedule ? 'on schedule' : 'behind'}
                  </Chip>
                </span>
              }
            >
              <div className="grid gap-4 border-b border-line pb-3 sm:grid-cols-5">
                <Metric size="sm" label="Remaining — evidenced" value={`${b.remainingEvidenced} / ${live}`} deltaTone="warn" />
                <Metric size="sm" label="Remaining — if declarations count" value={`${b.remainingAsserted} / ${live}`} hint={`${b.assertedOnly.length} declared but unevidenced`} />
                <Metric size="sm" label="Past target date" value={b.overdue.length} deltaTone={b.overdue.length ? 'warn' : 'ok'} />
                <Metric size="sm" label="Completing per 30 days" value={b.ratePer30d.toFixed(2)} />
                <Metric
                  size="sm" label="At that rate, complete"
                  value={b.projectedEndAt ? b.projectedEndAt.slice(0, 7) : '—'}
                  deltaTone={b.onSchedule === true ? 'ok' : 'warn'}
                  hint={b.projectedEndAt ? `target ${b.programme.targetEndAt.slice(0, 7)}` : 'no completions yet'}
                />
              </div>

              <div className="mt-3">
                <div className="flex items-baseline justify-between">
                  <span className="label-cap">Burn-down</span>
                  <span className="text-2xs text-ink-3">{evidencedDone} of {live} evidenced gone · {b.descoped.length} descoped and excluded</span>
                </div>
                <div className="mt-1.5">
                  <Bar value={live ? (evidencedDone / live) * 100 : 0} tone="ok" height={5} />
                  <div className="mt-1">
                    <Bar value={live ? ((live - b.remainingAsserted) / live) * 100 : 0} tone="warn" height={3} />
                  </div>
                </div>
              </div>

              <div className="mt-3">
                <Table>
                  <thead>
                    <tr><Th>Scope item</Th><Th>Target</Th><Th>State</Th><Th>Evidence</Th><Th align="right">Demand it still causes</Th></tr>
                  </thead>
                  <tbody>
                    {b.programme.items.map((i) => (
                      <Tr key={i.id} className={b.overdue.includes(i) ? 'bg-warn/[0.05]' : undefined}>
                        <Td className="max-w-[240px] text-2xs leading-snug text-ink">
                          {i.name}
                        </Td>
                        <Td className="text-2xs text-ink-2">
                          {i.targetDate.slice(0, 10)}
                          {b.overdue.includes(i) && <Chip tone="warn" className="ml-1.5">overdue</Chip>}
                        </Td>
                        <Td><Chip tone={STATE_TONE[i.state]}>{SCOPE_LABEL[i.state]}</Chip></Td>
                        <Td className="max-w-[260px] text-2xs leading-snug text-ink-2">
                          {i.evidence ? (
                            <>
                              <span className={cn(EVIDENCE_IS_CONCLUSIVE[i.evidence.kind] ? 'text-ink' : 'text-warn')}>
                                {EVIDENCE_LABEL[i.evidence.kind]}
                              </span>
                              {!EVIDENCE_IS_CONCLUSIVE[i.evidence.kind] && <Chip tone="warn" className="ml-1.5">not conclusive</Chip>}
                              <span className="mt-0.5 block text-[10px] leading-snug text-ink-3">{i.evidence.ref}</span>
                            </>
                          ) : (
                            <span className="text-ink-3">none</span>
                          )}
                        </Td>
                        <Td align="right" className="tnum text-2xs text-ink-2">{num(demandHours(i))} h/yr</Td>
                      </Tr>
                    ))}
                  </tbody>
                </Table>
              </div>

              {b.assertedOnly.length > 0 && (
                <div className="mt-3 rounded border border-warn/40 bg-warn/[0.05] p-3">
                  <div className="flex items-center gap-1.5">
                    <TriangleAlert size={12} className="text-warn" />
                    <span className="label-cap text-warn">Unevidenced completions</span>
                  </div>
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    {b.assertedOnly.map((i) => <Chip key={i.id} tone="warn">{i.name}</Chip>)}
                  </div>
                </div>
              )}

              {b.descoped.length > 0 && (
                <div className="mt-3 rounded border border-line bg-sunken p-3">
                  <div className="flex items-center gap-1.5">
                    <Flag size={12} className="text-ink-3" />
                    <span className="label-cap">Descoped</span>
                  </div>
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    {b.descoped.map((i) => <Chip key={i.id}>{i.name}</Chip>)}
                  </div>
                </div>
              )}

              <div className="mt-3 flex flex-wrap items-center gap-1">
                <span className="label-cap mr-1">Demand still attached</span>
                <span className="tnum text-2xs text-ink">{num(Math.round(b.demandHoursRemaining))} h/yr</span>
                <Link to="/governance/elimination" className="ml-auto text-2xs text-brand-ink hover:underline">open elimination →</Link>
              </div>
            </Card>
          )
        })}
      </div>
    </>
  )
}

function demandHours(i: ScopeItem): number {
  return i.demandClasses.reduce((s, id) => s + (DEMAND_CLASSES.find((d) => d.id === id)?.hoursYr ?? 0), 0)
}

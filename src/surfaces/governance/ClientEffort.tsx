import React from 'react'
import { Link } from 'react-router-dom'
import { BookLock, TriangleAlert } from 'lucide-react'
import {
  ATTESTATION_DAYS, METHOD_LABEL, clientEffortSummary, type FunctionEffort,
} from '@/domain/clientEffort'
import { DEMAND_CLASSES } from '@/domain/ledgers'
import { PageHeader } from '@/ui/domain'
import { Card, Chip, Metric, Table, Td, Th, Tr } from '@/ui/primitives'
import { num } from '@/lib/format'
import { cn } from '@/lib/format'

/* ==========================================================================
   Client effort — the book the provider does not write.

   Everything else in this platform measures our side of the boundary. This
   page shows the client's own declaration about their own people, and its
   whole design is about not letting that figure pass for something it isn't:
   how it was arrived at, how old it is, and whether our banked hours agree
   with it.
   ========================================================================== */

const STRENGTH_TONE: Record<FunctionEffort['strength'], 'ok' | 'warn' | 'crit' | 'neutral'> = {
  measured: 'ok',
  sampled: 'ok',
  reported: 'warn',
  estimated: 'crit',
}

const STRENGTH_LABEL: Record<FunctionEffort['strength'], string> = {
  measured: 'measured',
  sampled: 'sampled',
  reported: 'reported',
  estimated: 'estimated',
}

const fte = (n: number) => `${n >= 0 ? '' : '−'}${Math.abs(n).toFixed(1)}`

export function ClientEffort() {
  const s = React.useMemo(() => clientEffortSummary(), [])

  return (
    <>
      <PageHeader
        title="Client effort"
        subtitle="What the client declares about their own staff — held, aged and corroborated, never measured here"
      />

      <div className="grid shrink-0 grid-cols-2 gap-4 border-b border-line bg-surface px-4 py-2.5 md:grid-cols-5">
        <Metric size="sm" label="Released from run work" value={`${fte(s.releasedFte)} FTE`} deltaTone={s.releasedFte > 0 ? 'ok' : 'warn'} hint="current declarations only" />
        <Metric size="sm" label="Now on strategic work" value={`${fte(s.strategicGained)} FTE`} deltaTone={s.strategicGained > 0 ? 'ok' : 'warn'} hint="released and redeployed are different facts" />
        <Metric size="sm" label="Stale declarations" value={`${s.staleCount} / ${s.functions.length}`} deltaTone={s.staleCount ? 'warn' : 'ok'} hint={`beyond the ${ATTESTATION_DAYS}-day window`} />
        <Metric size="sm" label="Resting on an estimate" value={s.estimatedCount} deltaTone={s.estimatedCount ? 'warn' : 'ok'} hint="not evidence of a timesheet's kind" />
        <Metric size="sm" label="Corroborating hours" value={num(Math.round(s.corroboratingHours))} hint="banked by us in the classes they name" />
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        <div className="mb-4 rounded-md border border-info/40 bg-info/[0.06] p-3">
          <div className="flex items-center gap-1.5">
            <BookLock size={12} className="text-info" />
            <span className="label-cap">Whose book this is</span>
          </div>
          <p className="mt-1.5 text-2xs leading-relaxed text-ink-2">
            The glidepath ledger measures our effort against a contracted baseline. An objective about releasing the client's <em>own</em> people is a different baseline held on the other side of the boundary, and there are no client timesheets, queues or headcount in this platform. The dishonest fix would be to take our banked hours, assert that some share of them landed on client staff, and print a figure. Instead the client declares their own split and signs it. What follows is theirs; our part is to hold it, age it, show how it was arrived at, and set it beside our own hours so a disagreement between the two books stays visible.
          </p>
        </div>

        <div className="space-y-3">
          {s.functions.map((f) => (
            <Card
              key={f.function}
              title={f.function}
              subtitle={`${f.current.declaredBy} · declared ${f.current.at.slice(0, 10)} · ${f.ageDays} days ago`}
              right={
                <span className="flex items-center gap-1.5">
                  <Chip tone={STRENGTH_TONE[f.strength]}>{STRENGTH_LABEL[f.strength]}</Chip>
                  {f.stale && <Chip tone="warn">stale</Chip>}
                  {f.neverReattested && <Chip tone="neutral">never re-attested</Chip>}
                </span>
              }
            >
              <Table>
                <thead>
                  <tr>
                    <Th>Declaration</Th><Th align="right">Run FTE</Th><Th align="right">Strategic FTE</Th>
                    <Th>How it was arrived at</Th><Th>Signed by</Th>
                  </tr>
                </thead>
                <tbody>
                  {/* One declaration means one row. Repeating it as a
                      "current" figure would draw a movement out of a single
                      observation, which is the error this page exists to
                      avoid. */}
                  {(f.neverReattested ? [f.baseline] : [f.baseline, f.current]).map((d, i) => (
                    <Tr key={d.id}>
                      <Td className="text-2xs text-ink">
                        {f.neverReattested ? 'Baseline — the only declaration' : i === 0 ? 'Baseline' : 'Current'} · {d.at.slice(0, 10)}
                      </Td>
                      <Td align="right" className="tnum text-2xs text-ink">{d.runFte.toFixed(1)}</Td>
                      <Td align="right" className="tnum text-2xs text-ink">{d.strategicFte.toFixed(1)}</Td>
                      <Td className="text-2xs text-ink-2">{METHOD_LABEL[d.method]}</Td>
                      <Td className="text-2xs text-ink-2">{d.declaredBy}</Td>
                    </Tr>
                  ))}
                  {f.neverReattested && (
                    <Tr>
                      <Td colSpan={5} className="bg-warn/[0.06] text-2xs leading-relaxed text-ink-2">
                        Nothing has been declared since the opening figure. This function contributes no movement in either direction, and its figures are excluded from the headline rather than carried forward as though they were current.
                      </Td>
                    </Tr>
                  )}
                </tbody>
              </Table>

              <div className="mt-3 grid gap-2 rounded border border-line bg-sunken p-3 sm:grid-cols-4">
                <div>
                  <div className="label-cap">Released from run</div>
                  <p className={cn('tnum mt-1 text-xs', f.runReleased > 0 ? 'text-ok' : 'text-ink-3')}>{fte(f.runReleased)} FTE</p>
                </div>
                <div>
                  <div className="label-cap">Gained on strategic</div>
                  <p className={cn('tnum mt-1 text-xs', f.strategicGained > 0 ? 'text-ok' : 'text-ink-3')}>{fte(f.strategicGained)} FTE</p>
                </div>
                <div>
                  <div className="label-cap">Unaccounted</div>
                  <p className={cn('tnum mt-1 text-xs', Math.abs(f.unaccounted) > 0.3 ? 'text-warn' : 'text-ink-3')}>{fte(f.unaccounted)} FTE</p>
                  {Math.abs(f.unaccounted) > 0.3 && (
                    <p className="mt-0.5 text-[10px] leading-snug text-ink-3">Released but not on strategic work. Attrition, vacancy and reassignment elsewhere are indistinguishable from here.</p>
                  )}
                </div>
                <div>
                  <div className="label-cap">Our banked hours</div>
                  <p className="tnum mt-1 text-xs text-ink">{num(Math.round(f.corroboratingHours))} h</p>
                  <p className="mt-0.5 text-[10px] leading-snug text-ink-3">
                    {f.corroboratingHours === 0
                      ? 'Nothing banked in the classes this function names — the declared movement, where there is one, is not corroborated from our side.'
                      : 'Corroborates; does not measure. Whether removing this work reached their week is what nobody here can see.'}
                  </p>
                </div>
              </div>

              <div className="mt-2 flex flex-wrap items-center gap-1">
                <span className="label-cap mr-1">Exposed to</span>
                {f.current.exposedTo.map((id) => (
                  <Link key={id} to="/governance/elimination">
                    <Chip mono title={DEMAND_CLASSES.find((d) => d.id === id)?.name}>{id}</Chip>
                  </Link>
                ))}
              </div>

              <p className="mt-2 text-2xs leading-relaxed text-ink-3">{f.current.note}</p>
            </Card>
          ))}
        </div>

        <Card className="mt-4" title="Before you use these figures" subtitle="Every one of these applies today" right={<TriangleAlert size={13} className="text-warn" />}>
          <ul className="space-y-1.5">
            {s.caveats.map((c) => (
              <li key={c} className="text-2xs leading-relaxed text-ink-2">· {c}</li>
            ))}
          </ul>
        </Card>
      </div>
    </>
  )
}

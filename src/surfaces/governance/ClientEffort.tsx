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
        subtitle="Client-declared run and strategic effort, by function"
      />

      <div className="grid shrink-0 grid-cols-2 gap-4 border-b border-line bg-surface px-4 py-2.5 md:grid-cols-5">
        <Metric size="sm" label="Released from run work" value={`${fte(s.releasedFte)} FTE`} deltaTone={s.releasedFte > 0 ? 'ok' : 'warn'} />
        <Metric size="sm" label="Now on strategic work" value={`${fte(s.strategicGained)} FTE`} deltaTone={s.strategicGained > 0 ? 'ok' : 'warn'} />
        <Metric size="sm" label="Stale declarations" value={`${s.staleCount} / ${s.functions.length}`} deltaTone={s.staleCount ? 'warn' : 'ok'} hint={`over ${ATTESTATION_DAYS} days`} />
        <Metric size="sm" label="Resting on an estimate" value={s.estimatedCount} deltaTone={s.estimatedCount ? 'warn' : 'ok'} />
        <Metric size="sm" label="Corroborating hours" value={num(Math.round(s.corroboratingHours))} />
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-4">
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
                    <Th>Basis</Th><Th>Signed by</Th>
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
                </div>
                <div>
                  <div className="label-cap">Our banked hours</div>
                  <p className="tnum mt-1 text-xs text-ink">{num(Math.round(f.corroboratingHours))} h</p>
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

            </Card>
          ))}
        </div>

      </div>
    </>
  )
}

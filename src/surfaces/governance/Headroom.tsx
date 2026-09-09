import React from 'react'
import { Link } from 'react-router-dom'
import { CircleHelp, TrendingUp, TriangleAlert } from 'lucide-react'
import {
  CAUSE_IS_GROWTH, CAUSE_LABEL, DRIVER_BASIS_LABEL, GROWTH_TEST_MIN_CLASSES,
  headroomSummary, type GrowthCause,
} from '@/domain/headroom'
import { PageHeader } from '@/ui/domain'
import { Bar, Card, Chip, Metric, Table, Td, Th, Tr } from '@/ui/primitives'
import { num, pct } from '@/lib/format'
import { cn } from '@/lib/format'

/* ==========================================================================
   Growth headroom.

   The page is built around refusing to sum four different things. Demand
   rises because the client grew, because a programme is in flight, or
   because the service broke something — and only the first is growth worth
   claiming to have absorbed. They are shown as separate rows and there is
   deliberately no total.
   ========================================================================== */

const CAUSE_TONE: Record<GrowthCause, 'ok' | 'warn' | 'crit' | 'info'> = {
  business: 'ok',
  transition: 'info',
  service_failure: 'crit',
  ai_estate: 'warn',
}

export function Headroom() {
  const h = React.useMemo(() => headroomSummary(), [])
  const verdictTone = h.absorption === 'absorbed' ? 'ok' : h.absorption === 'not_absorbed' ? 'warn' : 'neutral'

  return (
    <>
      <PageHeader
        title="Growth headroom"
        subtitle="Whether the service absorbs growth — and whether it has yet been asked to"
      />

      <div className="grid shrink-0 grid-cols-2 gap-4 border-b border-line bg-surface px-4 py-2.5 md:grid-cols-5">
        <Metric size="sm" label="Absorption" value={h.absorption === 'untested' ? 'untested' : h.absorption === 'absorbed' ? 'absorbed' : 'not absorbed'} deltaTone={h.absorption === 'absorbed' ? 'ok' : 'warn'} hint="the claim under test" />
        <Metric size="sm" label="Business-caused growth" value={pct(h.businessGrowthPct)} hint="the only growth worth absorbing" />
        <Metric size="sm" label="Effort change" value={pct(h.effortChangePct)} deltaTone="ok" hint="glidepath actual, towers in run" />
        <Metric size="sm" label="Rising volume not the client" value={pct(h.selfInflictedShare * 100, 0)} deltaTone={h.selfInflictedShare > 0.5 ? 'warn' : 'ok'} hint="transition, defects, AI estate" />
        <Metric size="sm" label="Forecast headroom" value={h.headroomPct === null ? '—' : pct(h.headroomPct)} deltaTone={h.headroomPct !== null && h.headroomPct >= 60 ? 'ok' : 'warn'} hint={`${h.drivers.length} declared driver${h.drivers.length === 1 ? '' : 's'}`} />
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        <Card
          title="Has growth been absorbed?"
          subtitle="Backward-looking, from the ledgers"
          right={<Chip tone={verdictTone}>{h.absorption === 'untested' ? 'not tested' : h.absorption === 'absorbed' ? 'absorbed' : 'not absorbed'}</Chip>}
        >
          <div className={cn('rounded border p-3', h.absorption === 'untested' ? 'border-warn/40 bg-warn/[0.06]' : 'border-line bg-sunken')}>
            <div className="flex items-center gap-1.5">
              <CircleHelp size={12} className={h.absorption === 'untested' ? 'text-warn' : 'text-ink-3'} />
              <span className={cn('label-cap', h.absorption === 'untested' && 'text-warn')}>The verdict, and why</span>
            </div>
            <p className="mt-1.5 text-2xs leading-relaxed text-ink-2">{h.absorptionNote}</p>
          </div>

          <div className="mt-3 grid gap-3 sm:grid-cols-3">
            <div className="rounded border border-line bg-sunken p-3">
              <div className="label-cap">All demand</div>
              <p className="tnum mt-1 text-sm text-ink">{pct(h.demandChangePct)}</p>
              <p className="mt-0.5 text-[10px] leading-snug text-ink-3">Volume-weighted across every class. Falling.</p>
            </div>
            <div className="rounded border border-line bg-sunken p-3">
              <div className="label-cap">Business-caused only</div>
              <p className="tnum mt-1 text-sm text-ink">{pct(h.businessGrowthPct)}</p>
              <p className="mt-0.5 text-[10px] leading-snug text-ink-3">The only rise a growth claim may rest on.</p>
            </div>
            <div className="rounded border border-line bg-sunken p-3">
              <div className="label-cap">Effort</div>
              <p className="tnum mt-1 text-sm text-ink">{pct(h.effortChangePct)}</p>
              <p className="mt-0.5 text-[10px] leading-snug text-ink-3">Glidepath actual. Standing in for headcount.</p>
            </div>
          </div>
        </Card>

        <Card
          className="mt-4"
          title="What is actually rising"
          subtitle={`${num(h.risingVolumeYr)} arrivals a year across rising classes — shown by cause, never summed`}
          right={<TrendingUp size={13} className="text-ink-3" />}
        >
          <p className="mb-3 text-2xs leading-relaxed text-ink-2">
            A single figure for "demand growth" would let work the service caused count as work the service absorbed. These four are different facts about different things, so the page reports four rows and no total.
          </p>

          {h.rising.map((slice) => (
            <div key={slice.cause} className="mb-3 rounded border border-line bg-sunken p-3">
              <div className="flex flex-wrap items-baseline gap-2">
                <Chip tone={CAUSE_TONE[slice.cause]}>{CAUSE_LABEL[slice.cause]}</Chip>
                {CAUSE_IS_GROWTH[slice.cause]
                  ? <span className="text-2xs text-ok">counts as growth</span>
                  : <span className="text-2xs text-ink-3">does not count as growth</span>}
                <span className="tnum ml-auto text-2xs text-ink">
                  +{num(Math.round(slice.incrementalYr))}/yr on {num(slice.volumeYr)}
                </span>
              </div>
              <div className="mt-1.5">
                <Bar value={h.risingVolumeYr ? (slice.volumeYr / h.risingVolumeYr) * 100 : 0} tone={CAUSE_TONE[slice.cause] === 'crit' ? 'crit' : CAUSE_TONE[slice.cause]} height={3} />
              </div>
              <ul className="mt-1.5 space-y-0.5">
                {slice.classes.map((c) => (
                  <li key={c.id} className="flex flex-wrap items-baseline gap-2 text-2xs text-ink-2">
                    <Chip mono>{c.id}</Chip>
                    <span className="text-ink">{c.name}</span>
                    <span className="tnum ml-auto text-ink-3">{num(c.volumeYr)}/yr at {pct(c.trend * 100, 0)}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </Card>

        <Card
          className="mt-4"
          title="Forecast headroom"
          subtitle="Forward-looking, and only as good as the drivers behind it"
        >
          {h.headroomWithheld ? (
            <div className="rounded border border-warn/40 bg-warn/[0.06] p-3 text-2xs leading-relaxed text-ink-2">{h.headroomWithheld}</div>
          ) : (
            <div className="rounded border border-line bg-sunken p-3">
              <p className="tnum text-sm text-ink">{pct(h.headroomPct ?? 0)}</p>
              <p className="mt-0.5 text-2xs leading-relaxed text-ink-2">
                of the {num(Math.round(h.forecastIncrementalYr))} incremental arrivals a year implied by the declared drivers would land in classes the service can already take without adding effort — one with an elimination in flight, or in a tower already handling a substantial share autonomously. That is a capacity judgement, not a measurement.
              </p>
            </div>
          )}

          <div className="mt-3">
            <div className="label-cap">Declared drivers</div>
            <Table>
              <thead>
                <tr><Th>Driver</Th><Th align="right">Baseline</Th><Th align="right">Forecast</Th><Th>Basis</Th><Th>Declared by</Th></tr>
              </thead>
              <tbody>
                {h.drivers.map((d) => (
                  <Tr key={d.id}>
                    <Td className="max-w-[220px] text-2xs leading-snug text-ink">
                      {d.name}
                      <span className="mt-0.5 block text-[10px] leading-snug text-ink-3">{d.note}</span>
                    </Td>
                    <Td align="right" className="tnum text-2xs text-ink-2">{num(d.baselineValue)}</Td>
                    <Td align="right" className="tnum text-2xs text-ink">{num(d.forecastValue)} <span className="text-ink-3">/ {d.horizonMonths}m</span></Td>
                    <Td className="text-2xs text-ink-2">{DRIVER_BASIS_LABEL[d.basis]}</Td>
                    <Td className="text-2xs text-ink-2">{d.declaredBy} · {d.at.slice(0, 10)}</Td>
                  </Tr>
                ))}
              </tbody>
            </Table>
          </div>

          <div className="mt-3 rounded border border-warn/40 bg-warn/[0.05] p-3">
            <div className="flex items-center gap-1.5">
              <TriangleAlert size={12} className="text-warn" />
              <span className="label-cap text-warn">Drivers named but never quantified</span>
            </div>
            <ul className="mt-1.5 space-y-1.5">
              {h.undeclared.map((u) => (
                <li key={u.id} className="text-2xs leading-relaxed text-ink-2">
                  <span className="text-ink">{u.name}</span> — {u.why}
                  <span className="mt-0.5 block text-[10px] text-ink-3">drives {u.drives.join(', ')}</span>
                </li>
              ))}
            </ul>
          </div>
        </Card>

        <Card className="mt-4" title="Before you quote any of this" subtitle="Each applies to the figures above">
          <ul className="space-y-1.5">
            {h.warnings.map((w) => (
              <li key={w} className="text-2xs leading-relaxed text-ink-2">· {w}</li>
            ))}
            <li className="text-2xs leading-relaxed text-ink-2">
              · A verdict needs business growth in at least {GROWTH_TEST_MIN_CLASSES} demand classes. Every class here was assigned its cause by judgement, and a claim about the whole service should not rest on one of those judgements being right.
            </li>
          </ul>
          <p className="mt-3 text-2xs leading-relaxed text-ink-3">
            The objective this serves is <Link to="/governance/objectives" className="text-brand-ink hover:underline">Cost Efficiency and Scalability</Link>, where both halves are reported with these caveats attached.
          </p>
        </Card>
      </div>
    </>
  )
}

import React from 'react'
import { TrendingUp, TriangleAlert } from 'lucide-react'
import {
  CAUSE_IS_GROWTH, CAUSE_LABEL, DRIVER_BASIS_LABEL, headroomSummary, type GrowthCause,
} from '@/domain/headroom'
import { PageHeader } from '@/ui/domain'
import { Bar, Card, Chip, Metric, Table, Td, Th, Tr } from '@/ui/primitives'
import { num, pct } from '@/lib/format'

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
        subtitle="Demand growth against effort, and capacity for forecast growth"
      />

      <div className="grid shrink-0 grid-cols-2 gap-4 border-b border-line bg-surface px-4 py-2.5 md:grid-cols-5">
        <Metric size="sm" label="Absorption" value={h.absorption === 'untested' ? 'untested' : h.absorption === 'absorbed' ? 'absorbed' : 'not absorbed'} deltaTone={h.absorption === 'absorbed' ? 'ok' : 'warn'} />
        <Metric size="sm" label="Business-caused growth" value={pct(h.businessGrowthPct)} />
        <Metric size="sm" label="Effort change" value={pct(h.effortChangePct)} deltaTone="ok" />
        <Metric size="sm" label="Rising volume not the client" value={pct(h.selfInflictedShare * 100, 0)} deltaTone={h.selfInflictedShare > 0.5 ? 'warn' : 'ok'} />
        <Metric size="sm" label="Forecast headroom" value={h.headroomPct === null ? '—' : pct(h.headroomPct)} deltaTone={h.headroomPct !== null && h.headroomPct >= 60 ? 'ok' : 'warn'} hint={`${h.drivers.length} declared driver${h.drivers.length === 1 ? '' : 's'}`} />
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        <Card
          title="Absorption"
          subtitle="Observed to date"
          right={<Chip tone={verdictTone}>{h.absorption === 'untested' ? 'not tested' : h.absorption === 'absorbed' ? 'absorbed' : 'not absorbed'}</Chip>}
        >

          <div className="mt-3 grid gap-3 sm:grid-cols-3">
            <div className="rounded border border-line bg-sunken p-3">
              <div className="label-cap">All demand</div>
              <p className="tnum mt-1 text-sm text-ink">{pct(h.demandChangePct)}</p>
            </div>
            <div className="rounded border border-line bg-sunken p-3">
              <div className="label-cap">Business-caused only</div>
              <p className="tnum mt-1 text-sm text-ink">{pct(h.businessGrowthPct)}</p>
            </div>
            <div className="rounded border border-line bg-sunken p-3">
              <div className="label-cap">Effort</div>
              <p className="tnum mt-1 text-sm text-ink">{pct(h.effortChangePct)}</p>
            </div>
          </div>
        </Card>

        <Card
          className="mt-4"
          title="Rising demand by cause"
          subtitle={`${num(h.risingVolumeYr)} arrivals a year across rising classes`}
          right={<TrendingUp size={13} className="text-ink-3" />}
        >

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
          subtitle="Against declared business drivers"
        >
          {h.headroomWithheld ? (
            <div className="rounded border border-warn/40 bg-warn/[0.06] p-3 text-2xs leading-relaxed text-ink-2">{h.headroomWithheld}</div>
          ) : (
            <div className="rounded border border-line bg-sunken p-3">
              <p className="tnum text-sm text-ink">{pct(h.headroomPct ?? 0)}</p>
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
              <span className="label-cap text-warn">Unquantified drivers</span>
            </div>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {h.undeclared.map((u) => (
                <Chip key={u.id} tone="warn" title={u.why}>{u.name}</Chip>
              ))}
            </div>
          </div>
        </Card>

      </div>
    </>
  )
}

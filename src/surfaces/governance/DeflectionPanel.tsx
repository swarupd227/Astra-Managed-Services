import React from 'react'
import { TrendingDown, TriangleAlert } from 'lucide-react'
import { BASIS_LABEL, BASIS_SEASONAL, MIN_OBSERVED_DAYS, deflectionSummary } from '@/domain/deflection'
import { Card, Chip, Metric, Table, Td, Th, Tr } from '@/ui/primitives'
import { num, pct } from '@/lib/format'

/* ==========================================================================
   Deflection — a rate, with the counterfactual made explicit.

   The denominator here is something that did not happen, so the whole panel
   is arranged around not pretending otherwise: every baseline is signed by a
   named person on a stated basis, a window too short to mean anything yields
   no rate at all, and the fall is split into the part the ledger can account
   for and the part it cannot. The second number is usually the bigger one,
   and it is a question rather than an achievement.
   ========================================================================== */

export function DeflectionPanel() {
  const s = React.useMemo(() => deflectionSummary(), [])
  const attributedShare = s.fallVolume > 0 ? s.attributedVolume / s.fallVolume : 0

  return (
    <Card
      className="mt-4"
      title="Deflection rate"
      subtitle="Arrivals no longer arriving, against baselines the client agreed"
      right={<TrendingDown size={13} className="text-ink-3" />}
    >
      <div className="grid gap-4 border-b border-line pb-3 sm:grid-cols-4">
        <Metric
          size="sm" label="Attributed fall" value={s.attributedRate === null ? '—' : pct(s.attributedRate * 100)}
          deltaTone="ok" hint="the defensible figure"
        />
        <Metric
          size="sm" label="Total fall" value={s.rate === null ? '—' : pct(s.rate * 100)}
          hint="includes what nobody can explain"
        />
        <Metric
          size="sm" label="Unexplained" value={`${num(Math.round(s.unexplainedVolume))}/yr`}
          deltaTone={attributedShare < 0.5 ? 'warn' : 'ok'}
          hint={`${pct((1 - attributedShare) * 100, 0)} of the fall`}
        />
        <Metric
          size="sm" label="Withheld" value={s.withheldCount}
          deltaTone={s.withheldCount ? 'warn' : 'ok'} hint={`window under ${MIN_OBSERVED_DAYS} days`}
        />
      </div>

      {attributedShare < 0.5 && (
        <div className="mt-3 rounded border border-warn/40 bg-warn/[0.06] p-3">
          <div className="flex items-center gap-1.5">
            <TriangleAlert size={12} className="text-warn" />
            <span className="label-cap text-warn">Most of the fall is unattributed</span>
          </div>
          <p className="mt-1.5 text-2xs leading-relaxed text-ink-2">
            {num(Math.round(s.unexplainedVolume))} of {num(Math.round(s.fallVolume))} fewer arrivals a year cannot be traced to anything in the glidepath ledger. Demand that stopped for reasons nobody can name is a question about those classes, not evidence that anything was deflected — so the attributed rate is the one to quote, and it is the smaller of the two by a wide margin.
          </p>
        </div>
      )}

      <div className="mt-3">
        <Table>
          <thead>
            <tr>
              <Th>Demand class</Th><Th align="right">Baseline/yr</Th><Th align="right">Now/yr</Th>
              <Th align="right">Rate</Th><Th align="right">Attributed</Th><Th>Baseline agreed</Th>
            </tr>
          </thead>
          <tbody>
            {s.readings.map((r) => (
              <Tr key={r.baseline.demandClass} className={r.withheld ? 'bg-warn/[0.05]' : undefined}>
                <Td className="max-w-[240px] text-2xs leading-snug text-ink">
                  {r.className}
                  <span className="mt-0.5 block font-mono text-[10px] text-ink-3">{r.baseline.demandClass}</span>
                </Td>
                <Td align="right" className="tnum text-2xs text-ink-2">{num(r.baseline.baselineVolumeYr)}</Td>
                <Td align="right" className="tnum text-2xs text-ink-2">
                  {r.annualisedArrivals === null ? '—' : num(Math.round(r.annualisedArrivals))}
                </Td>
                <Td align="right" className="tnum text-2xs text-ink">
                  {r.rate === null ? <span className="text-ink-3">withheld</span> : pct(r.rate * 100)}
                </Td>
                <Td align="right" className="tnum text-2xs text-ink-2">
                  {r.attributedShare === null ? '—' : `${pct(r.attributedShare * 100, 0)} of it`}
                </Td>
                <Td className="max-w-[220px] text-2xs leading-snug text-ink-2">
                  {BASIS_LABEL[r.baseline.basis]}
                  {!BASIS_SEASONAL[r.baseline.basis] && <Chip tone="warn" className="ml-1.5">partial cycle</Chip>}
                  <span className="mt-0.5 block text-[10px] leading-snug text-ink-3">
                    {r.baseline.agreedBy} · {r.baseline.observedDays} days observed
                  </span>
                </Td>
              </Tr>
            ))}
          </tbody>
        </Table>
      </div>

      {s.readings.some((r) => r.withheld || r.warnings.length) && (
        <div className="mt-3 rounded border border-line bg-sunken p-3">
          <div className="label-cap">What each of these needs read alongside it</div>
          <ul className="mt-1.5 space-y-1.5">
            {s.readings.filter((r) => r.withheld || r.warnings.length).map((r) => (
              <li key={r.baseline.demandClass} className="text-2xs leading-relaxed text-ink-2">
                <span className="text-ink">{r.className}</span>
                <ul className="mt-0.5 space-y-0.5">
                  {r.withheld && <li className="text-ink-3">· {r.withheld}</li>}
                  {r.warnings.map((w) => <li key={w} className="text-ink-3">· {w}</li>)}
                </ul>
              </li>
            ))}
          </ul>
        </div>
      )}

      <p className="mt-3 text-2xs leading-relaxed text-ink-3">
        Attributed arrivals are derived from attributed hours at each class's own average cost per arrival, and only from the avoidance and elimination attributions — automation and acceleration mean the work still arrives and costs less, which is a different claim. The derivation assumes the arrivals removed cost what an average arrival costs, so it is an estimate of a real quantity rather than a count of one.
      </p>
    </Card>
  )
}

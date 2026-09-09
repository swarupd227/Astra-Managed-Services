import React from 'react'
import { TrendingDown } from 'lucide-react'
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
      subtitle="Against client-agreed baselines"
      right={<TrendingDown size={13} className="text-ink-3" />}
    >
      <div className="grid gap-4 border-b border-line pb-3 sm:grid-cols-4">
        <Metric
          size="sm" label="Attributed fall" value={s.attributedRate === null ? '—' : pct(s.attributedRate * 100)}
          deltaTone="ok"
        />
        <Metric
          size="sm" label="Total fall" value={s.rate === null ? '—' : pct(s.rate * 100)}
         
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


    </Card>
  )
}

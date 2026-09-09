import React from 'react'
import { Link } from 'react-router-dom'
import { Radar, ScanSearch, UserSearch } from 'lucide-react'
import { COVERAGE } from '@/domain/knowledge'
import { TOWERS, TOWER_BY_ID } from '@/domain/estate'
import { useAstra } from '@/domain/store'
import { HISTORY, verifiedVolumeCoverage } from '@/domain/metrics'
import { PageHeader } from '@/ui/domain'
import { Button, Card, Chip, Metric, Table, Td, Th, Tr } from '@/ui/primitives'
import { Gauge, Sparkline, CHART_COLORS } from '@/ui/charts'
import { cn, num, pct } from '@/lib/format'
import { SLO_TARGETS, PHASES } from '@/domain/transitionSeed'
import { ProducedBy } from '@/ui/ProducedBy'



export function CoverageDashboard() {
  const pushToast = useAstra((s) => s.pushToast)
  const inTransition = TOWERS.filter((t) => ['S0', 'S1', 'S2', 'S3'].includes(t.state))
  const [focus, setFocus] = React.useState(inTransition[0]?.id ?? 'twr_claims')

  const row = COVERAGE.find((c) => c.tower === focus)!
  const t = TOWER_BY_ID[focus]

  return (
    <>
      <PageHeader
        title="Coverage Dashboard"
        subtitle="Estate ingestion and graph quality by tower"
        meta={<Chip tone="warn">{inTransition.length} towers in transition</Chip>}
        actions={
          <>
            <Button size="sm" variant="default" onClick={() => pushToast({ title: 'Deep scan queued', body: 'Repository crawlers and telemetry corroboration will re-run against the dark estate overnight.', tone: 'info' })}>
              <ScanSearch size={12} /> Trigger deep scan
            </Button>
            <Button size="sm" variant="default" onClick={() => pushToast({ title: 'Interviews assigned', body: 'Structured interview capture scheduled with 3 incumbent SMEs. Statements become typed assertions agents can cite.', tone: 'info' })}>
              <UserSearch size={12} /> Assign interviews
            </Button>
          </>
        }
      />

      <ProducedBy
        agents={["agt_archivist"]}
        what="reverse-engineering the estate into typed assertions, and queueing what it will not self-verify"
      />

      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        <Card title="Transition pipeline" subtitle="Phase exit criteria">
          <ol className="grid gap-3 md:grid-cols-4">
            {PHASES.map((p, i) => (
              <li key={p.id} className={cn('relative rounded border p-3', p.state === 'done' ? 'border-ok/40 bg-ok/[0.06]' : p.state === 'active' ? 'border-brand/45 bg-brand/[0.06]' : 'border-line bg-sunken')}>
                <div className="flex items-center gap-2">
                  <span className={cn('flex h-4 w-4 items-center justify-center rounded-full text-[9px] font-semibold', p.state === 'done' ? 'bg-ok text-ink-inv' : p.state === 'active' ? 'bg-brand text-ink-inv' : 'bg-line-strong text-ink-3')}>{i + 1}</span>
                  <span className="text-xs font-medium text-ink">{p.label}</span>
                  <span className="ml-auto text-2xs text-ink-3">{p.weeks}</span>
                </div>
                <p className="mt-2 text-2xs leading-relaxed text-ink-3">{p.exit}</p>
                <div className="mt-2">
                  <Chip tone={p.state === 'done' ? 'ok' : p.state === 'active' ? 'brand' : 'neutral'}>
                    {p.state === 'done' ? 'exit criteria met' : p.state === 'active' ? 'in progress' : 'not started'}
                  </Chip>
                </div>
              </li>
            ))}
          </ol>
        </Card>

        <div className="mt-4 grid gap-4 lg:grid-cols-[1.4fr_1fr]">
          <Card title="Estate coverage by tower" subtitle="By tower">
            <Table>
              <thead>
                <tr>
                  <Th>Tower</Th>
                  <Th>State</Th>
                  <Th align="right">Entities</Th>
                  <Th align="right">Mapped</Th>
                  <Th align="right">Dark</Th>
                  <Th>Verification mix</Th>
                  <Th align="right">Volume covered</Th>
                  <Th>Next action</Th>
                </tr>
              </thead>
              <tbody>
                {COVERAGE.map((c) => {
                  const tw = TOWER_BY_ID[c.tower]
                  const transition = ['S0', 'S1', 'S2', 'S3'].includes(tw.state)
                  return (
                    <Tr key={c.tower} selected={c.tower === focus} onClick={() => setFocus(c.tower)}>
                      <Td className="text-ink">{tw.name}</Td>
                      <Td><Chip tone={transition ? 'warn' : 'ok'}>{tw.state}</Chip></Td>
                      <Td align="right">{num(c.entities)}</Td>
                      <Td align="right">{pct((c.mapped / c.entities) * 100, 1)}</Td>
                      <Td align="right" className={c.dark > c.entities * 0.05 ? 'text-warn' : 'text-ink-3'}>{num(c.dark)}</Td>
                      <Td>
                        <span className="flex h-[6px] w-28 overflow-hidden rounded-full bg-sunken" title={`human-verified ${c.humanVerified}% · corroborated ${c.machineCorroborated}% · unverified ${c.unverified}%`}>
                          <span className="h-full bg-ok" style={{ width: `${c.humanVerified}%` }} />
                          <span className="h-full bg-info" style={{ width: `${c.machineCorroborated}%` }} />
                          <span className="h-full bg-line-strong" style={{ width: `${c.unverified}%` }} />
                        </span>
                      </Td>
                      <Td align="right" className={c.volumeCovered >= 85 ? 'text-ok' : 'text-warn'}>{pct(c.volumeCovered)}</Td>
                      <Td>
                        {c.dark > c.entities * 0.05 ? (
                          <span className="text-warn">Deep-scan {num(c.dark)} dark</span>
                        ) : c.volumeCovered < 85 ? (
                          <Link to="/transition/verify" className="text-brand-ink hover:underline" onClick={(e) => e.stopPropagation()}>Verify knowledge</Link>
                        ) : (
                          <span className="text-ink-3">Within SLO</span>
                        )}
                      </Td>
                    </Tr>
                  )
                })}
              </tbody>
            </Table>
            <div className="mt-2 flex flex-wrap gap-3 text-2xs text-ink-3">
              <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-ok" />human-verified</span>
              <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-info" />machine-corroborated</span>
              <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-line-strong" />unverified</span>
            </div>
          </Card>

          <Card title={t.name} subtitle="Graph quality SLOs">
            <div className="flex items-center justify-around">
              <Gauge value={row.humanVerified} target={95} label="coverage" />
              <Gauge value={row.volumeCovered} target={85} label="volume covered" />
            </div>

            <dl className="mt-3 space-y-2 border-t border-line pt-3">
              {SLO_TARGETS.map((s) => {
                const value =
                  s.key === 'coverage' ? pct(row.humanVerified)
                    : s.key === 'currency' ? pct(100 - row.stale)
                      : s.key === 'contradiction' ? row.contradictionRate.toFixed(1)
                        : `${row.verificationLatencyDays.toFixed(1)}d`
                const ok =
                  s.key === 'coverage' ? row.humanVerified >= 95
                    : s.key === 'currency' ? 100 - row.stale >= 99
                      : s.key === 'contradiction' ? row.contradictionRate <= 2
                        : row.verificationLatencyDays <= 5
                return (
                  <div key={s.key}>
                    <div className="flex items-baseline justify-between gap-2">
                      <dt className="text-2xs font-medium text-ink-2">{s.label}</dt>
                      <dd className={cn('tnum text-2xs font-medium', ok ? 'text-ok' : 'text-warn')}>{value}</dd>
                    </div>
                    <p className="mt-0.5 text-[10px] leading-snug text-ink-3">{s.definition} · target {s.target}</p>
                  </div>
                )
              })}
            </dl>

            <div className="mt-3 rounded border border-line bg-sunken p-2.5">
              <div className="flex items-center gap-1.5"><Radar size={11} className="text-brand-ink" /><span className="label-cap">Commercial impact</span></div>
              <div className="mt-2 flex items-center gap-2">
                <Sparkline data={[...HISTORY.verificationCoverage, verifiedVolumeCoverage()]} tone="ok" showLast width={90} />
                <span className="text-2xs text-ink-3">autonomy-eligible volume, 7 quarters</span>
              </div>
            </div>
          </Card>
        </div>

      </div>
    </>
  )
}

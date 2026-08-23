import React from 'react'
import { AlertTriangle, Gauge as GaugeIcon, Layers, Wallet } from 'lucide-react'
import { DISTILLATION_CANDIDATES, ROUTING_TABLE, TOKEN_SERIES } from '@/domain/ledgers'
import { TOWERS } from '@/domain/estate'
import { useAstra } from '@/domain/store'
import { ROLE_BY_ID } from '@/domain/reference'
import { OPERATIONAL } from '@/domain/metrics'
import { PageHeader } from '@/ui/domain'
import { Button, Card, Chip, Metric, Table, Tabs, Td, Th, Tr } from '@/ui/primitives'
import { Gauge, LineChart, StackedBars, CHART_COLORS } from '@/ui/charts'
import { cn, dateShort, num, pct, usd } from '@/lib/format'
import { BUDGETS, ANOMALIES } from '@/domain/tokenOpsSeed'
import { ProducedBy } from '@/ui/ProducedBy'



export function TokenOpsStudio() {
  const pushToast = useAstra((s) => s.pushToast)
  const roleId = useAstra((s) => s.roleId)
  const role = ROLE_BY_ID[roleId]
  const [tab, setTab] = React.useState<'economics' | 'routing' | 'budgets'>('economics')

  const spend30 = TOKEN_SERIES.reduce((s, d) => s + d.frontierUsd + d.midUsd + d.smallUsd, 0)
  const displaced30 = TOKEN_SERIES.reduce((s, d) => s + d.displacedUsd, 0)
  const ratio = (spend30 / displaced30) * 100
  const cacheHit = TOKEN_SERIES[TOKEN_SERIES.length - 1].cacheHitPct

  const labels = TOKEN_SERIES.map((d) => d.day.slice(5))
  const stacks = [
    { key: 'frontier', label: 'Frontier tier', color: CHART_COLORS.brand, values: TOKEN_SERIES.map((d) => d.frontierUsd) },
    { key: 'mid', label: 'Mid tier', color: CHART_COLORS.info, values: TOKEN_SERIES.map((d) => d.midUsd) },
    { key: 'small', label: 'Small / client-hosted', color: CHART_COLORS.agent, values: TOKEN_SERIES.map((d) => d.smallUsd) },
  ]

  return (
    <>
      <PageHeader
        title="TokenOps Studio"
        subtitle="Trailing 30 days · metered per agent, skill and step"
        actions={
          <Button size="sm" variant="default" disabled={!role.canApprove} onClick={() => pushToast({ title: 'Routing table re-fit queued', body: 'Refits weekly from evaluation data — quality and cost frontiers per step type, canaried by tower before rollout.', tone: 'info' })}>
            <Layers size={12} /> Re-fit routing
          </Button>
        }
      />

      <ProducedBy
        agents={["agt_bursar"]}
        what="metering every model call by agent, skill and step, and hunting the routing frontier"
      />

      <div className="grid shrink-0 grid-cols-2 gap-4 border-b border-line bg-surface px-4 py-2.5 md:grid-cols-5">
        <Metric size="sm" label="Model spend, 30d" value={usd(spend30)} hint="every call metered by agent, skill, step and work object" />
        <Metric size="sm" label="Human cost displaced, 30d" value={usd(displaced30)} deltaTone="ok" />
        <Metric
          size="sm"
          label="Spend vs. displaced"
          value={pct(ratio, 2)}
          deltaTone={ratio <= 6 ? 'ok' : 'warn'}
          hint="design target ≤ 4–6% at steady state — published, because a provider that hides its AI costs will hide its AI failures"
        />
        <Metric size="sm" label="Cache hit rate" value={pct(cacheHit)} deltaTone="ok" hint="prompt-prefix caching and retrieval deduplication" />
        <Metric size="sm" label="Budget breaches, 30d" value={ANOMALIES.length} deltaTone="warn" hint="triaged as work objects, like any other demand" />
      </div>

      <div className="shrink-0 border-b border-line bg-surface px-4 py-1.5">
        <Tabs value={tab} onChange={setTab} tabs={[{ id: 'economics', label: 'Unit economics' }, { id: 'routing', label: 'Routing & distillation' }, { id: 'budgets', label: 'Budgets & anomalies' }]} />
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        {tab === 'economics' && (
          <>
            <Card title="Spend by model tier, 30 days" subtitle="By model tier">
              <StackedBars labels={labels} stacks={stacks} height={210} yFormat={(n) => `$${Math.round(n)}`} />
              <div className="mt-2 flex flex-wrap gap-3 text-2xs text-ink-3">
                {stacks.map((s) => (
                  <span key={s.key} className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full" style={{ background: s.color }} />{s.label}</span>
                ))}
                <span className="ml-auto">Weekend troughs are real demand, not sampling.</span>
              </div>
            </Card>

            <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_340px]">
              <Card title="Cost per resolved work object" subtitle="Trailing 30 days">
                <LineChart
                  labels={labels}
                  series={[
                    { key: 'cost', label: 'Cost per resolved WO', color: CHART_COLORS.brand, values: TOKEN_SERIES.map((d) => (d.frontierUsd + d.midUsd + d.smallUsd) / 220), area: true },
                    { key: 'cache', label: 'Cache hit rate ÷ 100', color: CHART_COLORS.ok, values: TOKEN_SERIES.map((d) => d.cacheHitPct / 100), dashed: true },
                  ]}
                  height={180}
                  yFormat={(n) => n.toFixed(2)}
                />
              </Card>

              <Card title="Efficiency" subtitle="Against design targets">
                <div className="flex items-center justify-around">
                  <Gauge value={ratio * 10} target={60} label="spend ratio ×10" />
                  <Gauge value={cacheHit} target={45} label="cache hit %" />
                </div>
                <dl className="mt-3 space-y-1.5 border-t border-line pt-3 text-2xs">
                  <div className="flex justify-between gap-2"><dt className="text-ink-3">Context budget adherence</dt><dd className="tnum text-ok">{pct(OPERATIONAL.contextBudgetAdherence, 1)}</dd></div>
                  <div className="flex justify-between gap-2"><dt className="text-ink-3">Retrieval dedup savings</dt><dd className="tnum text-ink-2">{usd(412)} /mo</dd></div>
                  <div className="flex justify-between gap-2"><dt className="text-ink-3">Zero-retention enforced</dt><dd className="text-ok">all providers</dd></div>
                  <div className="flex justify-between gap-2"><dt className="text-ink-3">EU-only routing</dt><dd className="text-ok">enforced by policy</dd></div>
                </dl>
              </Card>
            </div>
          </>
        )}

        {tab === 'routing' && (
          <div className="grid gap-4 lg:grid-cols-[1.15fr_1fr]">
            <Card title="Routing table" subtitle="Re-fit weekly from evaluation data">
              <Table>
                <thead>
                  <tr>
                    <Th>Step type</Th>
                    <Th>Selected tier</Th>
                    <Th align="right">Share</Th>
                    <Th align="right">Quality delta</Th>
                    <Th align="right">Cost /1k</Th>
                    <Th>Last re-fit</Th>
                  </tr>
                </thead>
                <tbody>
                  {ROUTING_TABLE.map((r) => (
                    <Tr key={r.step}>
                      <Td className="text-ink">{r.step}</Td>
                      <Td>
                        <Chip tone={r.tier.startsWith('frontier') ? 'brand' : r.tier.startsWith('mid') ? 'info' : 'agent'}>{r.tier}</Chip>
                      </Td>
                      <Td align="right">{r.share}%</Td>
                      <Td align="right" className={r.qualityDelta === 0 ? 'text-ink-3' : Math.abs(r.qualityDelta) < 0.01 ? 'text-ok' : 'text-warn'}>
                        {r.qualityDelta === 0 ? '—' : r.qualityDelta.toFixed(3)}
                      </Td>
                      <Td align="right">${r.costPer1k.toFixed(4)}</Td>
                      <Td className="text-2xs text-ink-3">{dateShort(r.refitAt)}</Td>
                    </Tr>
                  ))}
                </tbody>
              </Table>
            </Card>

            <Card title="Distillation candidates" subtitle="Flagged when the frontier-to-small quality delta clears threshold">
              <ul className="space-y-2">
                {DISTILLATION_CANDIDATES.map((d) => (
                  <li key={d.skill} className={cn('rounded border p-3', d.verdict === 'ready' ? 'border-ok/40 bg-ok/[0.05]' : d.verdict === 'below_threshold' ? 'border-warn/35 bg-warn/[0.05]' : 'border-line bg-sunken')}>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-2xs text-ink">{d.skill}</span>
                      <span className="text-2xs text-ink-3">{d.step}</span>
                      <Chip tone={d.verdict === 'ready' ? 'ok' : d.verdict === 'below_threshold' ? 'warn' : 'neutral'} className="ml-auto">
                        {d.verdict.replace(/_/g, ' ')}
                      </Chip>
                    </div>
                    <div className="mt-2 grid grid-cols-4 gap-2 text-2xs">
                      <div><span className="text-ink-3">Volume 30d</span><div className="tnum text-ink-2">{num(d.volume30d)}</div></div>
                      <div><span className="text-ink-3">Frontier</span><div className="tnum text-ink-2">{d.frontierScore.toFixed(3)}</div></div>
                      <div><span className="text-ink-3">Small</span><div className="tnum text-ink-2">{d.smallScore.toFixed(3)}</div></div>
                      <div><span className="text-ink-3">Δ</span><div className={cn('tnum', d.delta < 0.01 ? 'text-ok' : 'text-warn')}>{d.delta.toFixed(3)}</div></div>
                    </div>
                    {d.verdict === 'ready' && (
                      <div className="mt-2 flex items-center gap-2">
                        <Button size="sm" variant="default" disabled={!role.canApprove} onClick={() => pushToast({ title: `${d.skill} flagged for distillation`, body: 'The distilled replacement goes through the same promotion pipeline as any other capability change.', tone: 'ok' })}>
                          Flag for distillation
                        </Button>
                        <span className="text-2xs text-ok">projected {usd(d.projectedSaveUsd30d)} /month</span>
                      </div>
                    )}
                    {d.verdict === 'frontier_only' && (
                      <p className="mt-2 text-2xs leading-relaxed text-ink-3">
                        Quality gap 0.156 — stays on the frontier tier.
                      </p>
                    )}
                  </li>
                ))}
              </ul>
            </Card>
          </div>
        )}

        {tab === 'budgets' && (
          <div className="grid gap-4 lg:grid-cols-[1fr_400px]">
            <Card title="Budgets are policy" subtitle="Per tower, per month · soft and hard thresholds">
              <Table>
                <thead>
                  <tr>
                    <Th>Scope</Th>
                    <Th align="right">Limit</Th>
                    <Th align="right">Spent</Th>
                    <Th>Consumption</Th>
                    <Th>State</Th>
                    <Th>Behaviour at threshold</Th>
                  </tr>
                </thead>
                <tbody>
                  {BUDGETS.map((b) => {
                    const frac = b.spent / b.limit
                    const tw = TOWERS.find((t) => t.id === b.scope)
                    return (
                      <Tr key={b.scope}>
                        <Td className="text-ink">{tw?.name ?? b.scope}</Td>
                        <Td align="right">{usd(b.limit)}</Td>
                        <Td align="right">{usd(b.spent)}</Td>
                        <Td>
                          <span className="relative flex h-3 w-36 items-center rounded-xs bg-sunken">
                            <span className={cn('h-full rounded-xs', frac >= b.hard ? 'bg-crit' : frac >= b.soft ? 'bg-warn' : 'bg-ok')} style={{ width: `${Math.min(100, frac * 100)}%` }} />
                            <span className="absolute inset-y-0 w-px bg-warn/70" style={{ left: `${b.soft * 100}%` }} title="soft threshold" />
                            <span className="absolute inset-y-0 w-px bg-crit/70" style={{ left: `${b.hard * 100}%` }} title="hard threshold" />
                          </span>
                        </Td>
                        <Td>
                          <Chip tone={b.state === 'ok' ? 'ok' : b.state === 'soft' ? 'warn' : 'crit'}>
                            {b.state === 'ok' ? 'within budget' : b.state === 'soft' ? 'soft breach' : 'hard breach'}
                          </Chip>
                        </Td>
                        <Td className="text-2xs text-ink-3">
                          {b.state === 'hard' ? 'Degraded to mid tier; work object raised against the owner' : b.state === 'soft' ? 'Alerting; routing biased to cheaper tiers' : 'No action'}
                        </Td>
                      </Tr>
                    )
                  })}
                </tbody>
              </Table>
            </Card>

            <Card title="Anomaly detection" subtitle="Detected on cost signals">
              <ul className="space-y-2">
                {ANOMALIES.map((a) => (
                  <li key={a.id} className="rounded border border-warn/35 bg-warn/[0.05] p-3">
                    <div className="flex items-start gap-2">
                      <AlertTriangle size={12} className="mt-px shrink-0 text-warn" />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="min-w-0 flex-1 truncate text-xs text-ink">{a.title}</span>
                          <span className="shrink-0 text-2xs text-ink-3">{a.at}d ago</span>
                        </div>
                        <p className="mt-1 text-2xs leading-relaxed text-ink-2">{a.detail}</p>
                        <p className="mt-1 text-2xs text-ok">Quarantined automatically · {usd(a.savedUsd)} avoided</p>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
              <div className="mt-3 flex items-start gap-2 rounded border border-line bg-sunken p-3">
                <Wallet size={12} className="mt-px shrink-0 text-brand-ink" />
              </div>
            </Card>
          </div>
        )}
      </div>
    </>
  )
}

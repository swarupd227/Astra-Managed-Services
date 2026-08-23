import React from 'react'
import { Presentation, Sprout } from 'lucide-react'
import { INNOVATION } from '@/domain/ledgers'
import { useAstra } from '@/domain/store'
import { ROLE_BY_ID } from '@/domain/reference'
import { AgentChip, PageHeader } from '@/ui/domain'
import { Button, Card, Chip, Metric, Table, Tabs, Td, Th, Tr } from '@/ui/primitives'
import { Funnel, CHART_COLORS } from '@/ui/charts'
import { cn, num, pct, usd } from '@/lib/format'
import type { InnovationItem } from '@/domain/types'
import { ProducedBy } from '@/ui/ProducedBy'

const STAGE_ORDER: InnovationItem['stage'][] = ['idea', 'assessed', 'funded', 'delivered', 'verified', 'scaled', 'retired']

const SOURCE_LABEL: Record<InnovationItem['source'], string> = {
  artizent: 'Artizent', client: 'Client staff', agent: 'Agent (Prospect)', council: 'Joint council',
}

const VALUE_TONE: Record<InnovationItem['valueClass'], 'brand' | 'info' | 'crit' | 'ok' | 'agent'> = {
  cost: 'brand', experience: 'info', risk: 'crit', revenue: 'ok', capability: 'agent',
}

export function InnovationRegister() {
  const pushToast = useAstra((s) => s.pushToast)
  const roleId = useAstra((s) => s.roleId)
  const role = ROLE_BY_ID[roleId]
  const [filter, setFilter] = React.useState<'all' | 'active' | 'verified' | 'failed'>('all')

  const list = INNOVATION.filter((i) =>
    filter === 'all' ? true
      : filter === 'active' ? ['idea', 'assessed', 'funded', 'delivered'].includes(i.stage)
        : filter === 'verified' ? i.verdict === 'verified'
          : i.verdict === 'failed' || i.verdict === 'partial',
  ).sort((a, b) => STAGE_ORDER.indexOf(b.stage) - STAGE_ORDER.indexOf(a.stage))

  const delivered = INNOVATION.filter((i) => i.verdict)
  const verified = delivered.filter((i) => i.verdict === 'verified')
  const failed = delivered.filter((i) => i.verdict === 'failed')
  const successRate = (verified.length / Math.max(1, delivered.length)) * 100
  const realised = verified.reduce((s, i) => s + (i.realisedValueUsd ?? 0), 0)
  const clientShare = (INNOVATION.filter((i) => i.source === 'client' && ['funded', 'delivered', 'verified', 'scaled'].includes(i.stage)).length /
    Math.max(1, INNOVATION.filter((i) => ['funded', 'delivered', 'verified', 'scaled'].includes(i.stage)).length)) * 100

  const stages = [
    { label: 'Idea', count: INNOVATION.filter((i) => STAGE_ORDER.indexOf(i.stage) >= 0).length, tone: CHART_COLORS.ink3 },
    { label: 'Assessed', count: INNOVATION.filter((i) => STAGE_ORDER.indexOf(i.stage) >= 1).length, tone: CHART_COLORS.info },
    { label: 'Funded', count: INNOVATION.filter((i) => STAGE_ORDER.indexOf(i.stage) >= 2).length, tone: CHART_COLORS.brand },
    { label: 'Delivered', count: INNOVATION.filter((i) => STAGE_ORDER.indexOf(i.stage) >= 3).length, tone: CHART_COLORS.agent },
    { label: 'Verified', count: INNOVATION.filter((i) => STAGE_ORDER.indexOf(i.stage) >= 4).length, tone: CHART_COLORS.ok },
    { label: 'Scaled', count: INNOVATION.filter((i) => STAGE_ORDER.indexOf(i.stage) >= 5).length, tone: CHART_COLORS.ok },
  ]

  return (
    <>
      <PageHeader
        title="Innovation Register"
        subtitle="Idea to verified value · failures retained"
        actions={
          <Button size="sm" variant="primary" disabled={!role.canApprove} onClick={() => pushToast({ title: 'Quarterly showcase generated', body: 'Verified value with evidence, live demonstrations of shipped items, and next-quarter candidates for sponsorship.', tone: 'ok' })}>
            <Presentation size={12} /> Generate showcase
          </Button>
        }
      />

      <ProducedBy
        agents={["agt_prospect", "agt_forge"]}
        what="raising candidate experiments and measuring what they actually returned"
      />

      <div className="grid shrink-0 grid-cols-2 gap-4 border-b border-line bg-surface px-4 py-2.5 md:grid-cols-5">
        <Metric size="sm" label="Verified value" value={usd(realised)} deltaTone="ok" hint="cumulative, evidence-linked" />
        <Metric
          size="sm"
          label="Success rate"
          value={pct(successRate, 0)}
          deltaTone={successRate >= 40 && successRate <= 70 ? 'ok' : 'warn'}
          hint="target band 40–70% · evidence of real risk-taking"
        />
        <Metric size="sm" label="Published failures" value={failed.length} hint="visible, with what was learned" />
        <Metric size="sm" label="Client co-creation" value={pct(clientShare, 0)} hint="funded items originating from client staff" />
        <Metric size="sm" label="Median cycle time" value={`${Math.round(delivered.reduce((s, i) => s + (i.cycleDays ?? 0), 0) / Math.max(1, delivered.length))} d`} hint="idea to delivered" />
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        <div className="grid gap-4 lg:grid-cols-[300px_1fr]">
          <div className="space-y-4">
            <Card title="Funnel" subtitle="By stage">
              <Funnel stages={stages} />
            </Card>

            <Card title="The honesty rule" subtitle="§18.1">
              <div className="flex items-start gap-2">
                <Sprout size={13} className="mt-px shrink-0 text-ok" />
              </div>
              <ul className="mt-3 space-y-2 border-t border-line pt-3">
                {failed.map((f) => (
                  <li key={f.id} className="rounded border border-crit/30 bg-crit/[0.04] p-2.5">
                    <div className="flex items-center gap-1.5">
                      <Chip tone="crit">failed</Chip>
                      <span className="truncate text-2xs text-ink">{f.title}</span>
                    </div>
                    <p className="mt-1 text-2xs leading-relaxed text-ink-3">{f.hypothesis}</p>
                    <p className="mt-1 text-2xs text-ink-3">
                      {usd(f.projectedValueUsd ?? 0)} projected · {usd(0)} realised · {f.cycleDays} days to verdict
                    </p>
                  </li>
                ))}
              </ul>
            </Card>
          </div>

          <Card
            title="Register"
            subtitle="Tracked separately from the contractual glidepath"
            right={
              <Tabs
                value={filter}
                onChange={setFilter}
                tabs={[
                  { id: 'all', label: 'All', count: INNOVATION.length },
                  { id: 'active', label: 'In flight', count: INNOVATION.filter((i) => ['idea', 'assessed', 'funded', 'delivered'].includes(i.stage)).length },
                  { id: 'verified', label: 'Verified', count: verified.length },
                  { id: 'failed', label: 'Failed / partial', count: delivered.length - verified.length },
                ]}
              />
            }
          >
            <Table>
              <thead>
                <tr>
                  <Th>Item</Th>
                  <Th>Source</Th>
                  <Th>Sponsor</Th>
                  <Th>Value class</Th>
                  <Th>Stage</Th>
                  <Th align="right">Projected</Th>
                  <Th align="right">Realised</Th>
                  <Th>Verdict</Th>
                  <Th align="right">Reuse</Th>
                </tr>
              </thead>
              <tbody>
                {list.map((i) => (
                  <Tr key={i.id}>
                    <Td>
                      <span className="block max-w-[280px] truncate text-ink">{i.title}</span>
                      <span className="block max-w-[280px] truncate text-[10px] text-ink-3" title={i.hypothesis}>{i.hypothesis}</span>
                    </Td>
                    <Td className="text-2xs">
                      {i.source === 'agent' ? (
                        <AgentChip id="agt_prospect" />
                      ) : (
                        SOURCE_LABEL[i.source]
                      )}
                    </Td>
                    <Td className="text-2xs">{i.sponsor}</Td>
                    <Td><Chip tone={VALUE_TONE[i.valueClass]}>{i.valueClass}</Chip></Td>
                    <Td><Chip tone={i.stage === 'scaled' || i.stage === 'verified' ? 'ok' : i.stage === 'funded' || i.stage === 'delivered' ? 'brand' : 'neutral'}>{i.stage}</Chip></Td>
                    <Td align="right">{i.projectedValueUsd ? usd(i.projectedValueUsd) : '—'}</Td>
                    <Td align="right" className={i.realisedValueUsd && i.projectedValueUsd && i.realisedValueUsd >= i.projectedValueUsd ? 'text-ok' : ''}>
                      {i.realisedValueUsd !== undefined ? usd(i.realisedValueUsd) : '—'}
                    </Td>
                    <Td>
                      {i.verdict ? (
                        <Chip tone={i.verdict === 'verified' ? 'ok' : i.verdict === 'partial' ? 'warn' : 'crit'}>{i.verdict}</Chip>
                      ) : (
                        <span className="text-2xs text-ink-3">pending</span>
                      )}
                    </Td>
                    <Td align="right">{i.reuseCount ?? '—'}</Td>
                  </Tr>
                ))}
              </tbody>
            </Table>

            <div className="mt-3 grid gap-3 border-t border-line pt-3 md:grid-cols-3">
              {[
                { t: 'Innovation velocity', v: `${INNOVATION.filter((i) => ['funded', 'delivered', 'verified', 'scaled'].includes(i.stage)).length} funded`, b: 'Ideas reaching Funded per quarter, with median cycle time from idea to delivered.' },
                { t: 'Reuse factor', v: `${INNOVATION.reduce((s, i) => s + (i.reuseCount ?? 0), 0)} adoptions`, b: 'Verified items promoted to the golden repos and adopted on other towers or clients.' },
                { t: 'Funding source discipline', v: `${INNOVATION.filter((i) => i.fundingSource === 'capacity_credits').length} credit-funded`, b: 'Capacity credits, innovation allowance or client-funded — recorded per item so the ledgers reconcile.' },
              ].map((m) => (
                <div key={m.t} className="rounded border border-line bg-sunken p-2.5">
                  <div className="label-cap">{m.t}</div>
                  <div className="tnum mt-1 font-display text-sm font-semibold text-ink">{m.v}</div>
                  <p className="mt-1 text-2xs leading-relaxed text-ink-3">{m.b}</p>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </>
  )
}

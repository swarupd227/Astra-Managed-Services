import React from 'react'
import { ArrowLeftRight, TrendingUp } from 'lucide-react'
import { SHADOW, SHADOW_DISAGREEMENTS } from '@/domain/knowledge'
import { AC } from '@/domain/reference'
import { TOWER_BY_ID, agentsForClass } from '@/domain/estate'
import { useAstra } from '@/domain/store'
import { AgentChip, PageHeader } from '@/ui/domain'
import { Button, Card, Chip, Metric, Table, Td, Th, Tr } from '@/ui/primitives'
import { cn, ago, pct } from '@/lib/format'

export function ShadowScoreboard() {
  const pushToast = useAstra((s) => s.pushToast)
  const [selected, setSelected] = React.useState(SHADOW_DISAGREEMENTS[0].id)
  const dis = SHADOW_DISAGREEMENTS.find((d) => d.id === selected)!

  const unexplained = SHADOW.reduce((s, r) => s + r.unexplained, 0)
  const met = SHADOW.filter((r) => r.readiness === 'met').length

  return (
    <>
      <PageHeader
        title="Shadow Scoreboard"
        subtitle="Agent proposals scored daily against actual resolutions"
        meta={<Chip tone={unexplained ? 'warn' : 'ok'}>{unexplained} unexplained disagreements</Chip>}
      />

      <div className="grid shrink-0 grid-cols-2 gap-4 border-b border-line bg-surface px-4 py-2.5 md:grid-cols-4">
        <Metric size="sm" label="Action classes ready" value={`${met} of ${SHADOW.length}`} />
        <Metric size="sm" label="Proposals scored" value={SHADOW.reduce((s, r) => s + r.proposals, 0).toLocaleString('en-GB')} />
        <Metric size="sm" label="Unexplained disagreements" value={unexplained} deltaTone={unexplained ? 'warn' : 'ok'} hint="target 0" />
        <Metric size="sm" label="Overall agreement" value={pct(SHADOW.reduce((s, r) => s + r.agreement * r.proposals, 0) / SHADOW.reduce((s, r) => s + r.proposals, 0))} hint="volume-weighted" />
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        <Card title="Agreement by action class" subtitle="With 95% confidence bands against threshold">
          <Table>
            <thead>
              <tr>
                <Th>Action class</Th>
                <Th>Tower</Th>
                <Th align="right">Proposals</Th>
                <Th align="right">Agreement</Th>
                <Th>Confidence band vs. threshold</Th>
                <Th align="right">Unexplained</Th>
                <Th>Readiness</Th>
                <Th>Proposed grade</Th>
              </tr>
            </thead>
            <tbody>
              {SHADOW.map((r) => {
                const lo = r.confidenceBand[0]
                const hi = r.confidenceBand[1]
                const scale = (v: number) => ((v - 75) / 25) * 100
                return (
                  <Tr key={`${r.tower}-${r.actionClass}`}>
                    <Td>
                      <span className="flex items-center gap-1.5">
                        <span className="font-mono text-ink">{r.actionClass}</span>
                        <span className="truncate text-ink-3">{AC[r.actionClass]?.name}</span>
                      </span>
                    </Td>
                    <Td>
                      {/* Shadow agreement is an agent's bid for trust on this
                          class — the row is meaningless without naming it. */}
                      <span className="flex flex-wrap items-center gap-1">
                        {agentsForClass(r.actionClass, r.tower).slice(0, 2).map((a) => (
                          <AgentChip key={a.id} id={a.id} showGrade={r.actionClass} />
                        ))}
                        {agentsForClass(r.actionClass, r.tower).length === 0 && (
                          <span className="text-2xs text-ink-3">no agent posted</span>
                        )}
                      </span>
                    </Td>
                    <Td>{TOWER_BY_ID[r.tower]?.name}</Td>
                    <Td align="right">{r.proposals.toLocaleString('en-GB')}</Td>
                    <Td align="right" className={r.agreement >= r.threshold ? 'text-ok' : 'text-warn'}>{pct(r.agreement)}</Td>
                    <Td>
                      <span className="relative block h-4 w-40 rounded-xs bg-sunken" title={`95% CI ${lo}–${hi}% · threshold ${r.threshold}%`}>
                        <span
                          className={cn('absolute top-1 h-2 rounded-full', lo >= r.threshold ? 'bg-ok' : hi >= r.threshold ? 'bg-warn' : 'bg-crit')}
                          style={{ left: `${scale(lo)}%`, width: `${Math.max(2, scale(hi) - scale(lo))}%` }}
                        />
                        <span className="absolute inset-y-0 w-px bg-ink-2" style={{ left: `${scale(r.threshold)}%` }} />
                      </span>
                    </Td>
                    <Td align="right" className={r.unexplained ? 'text-crit' : 'text-ok'}>{r.unexplained}</Td>
                    <Td>
                      <Chip tone={r.readiness === 'met' ? 'ok' : r.readiness === 'approaching' ? 'warn' : 'crit'}>
                        {r.readiness === 'met' ? 'threshold met' : r.readiness === 'approaching' ? 'approaching' : 'below threshold'}
                      </Chip>
                    </Td>
                    <Td>
                      <span className="flex items-center gap-1.5">
                        <Chip tone={r.proposedGrade === 'A' ? 'ok' : r.proposedGrade === 'B' ? 'brand' : r.proposedGrade === 'C' ? 'warn' : 'crit'} mono>{r.proposedGrade}</Chip>
                        {r.readiness === 'met' && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => pushToast({ title: `Grade ${r.proposedGrade} proposed for ${r.actionClass}`, body: 'Promotion pack assembled with replay and shadow evidence. Client governance approves the schedule change.', tone: 'ok' })}
                          >
                            Propose
                          </Button>
                        )}
                      </span>
                    </Td>
                  </Tr>
                )
              })}
            </tbody>
          </Table>
        </Card>

        <div className="mt-4 grid gap-4 lg:grid-cols-[340px_1fr]">
          <Card title="Disagreements" subtitle="Reviewed and classified" dense bodyClass="p-0">
            <ul>
              {SHADOW_DISAGREEMENTS.map((d) => (
                <li key={d.id}>
                  <button
                    onClick={() => setSelected(d.id)}
                    className={cn('flex w-full items-start gap-2 border-b border-line/60 px-3 py-2 text-left', selected === d.id ? 'bg-brand/[0.09]' : 'hover:bg-raised')}
                  >
                    <Chip tone={d.verdict === 'unexplained' ? 'crit' : 'ok'}>{d.verdict}</Chip>
                    <span className="min-w-0 flex-1">
                      <span className="block font-mono text-2xs text-ink">{d.actionClass}</span>
                      <span className="mt-0.5 block truncate text-2xs text-ink-3">{d.agentProposal}</span>
                    </span>
                    <span className="shrink-0 text-[10px] text-ink-3">{ago(d.at)}</span>
                  </button>
                </li>
              ))}
            </ul>
          </Card>

          <Card title="Side by side" subtitle={`${dis.actionClass} · ${ago(dis.at)}`}>
            <div className="grid gap-3 md:grid-cols-[1fr_auto_1fr]">
              <div className="rounded border border-agent/35 bg-agent/[0.06] p-3">
                <div className="label-cap text-agent">Agent proposed</div>
                <p className="mt-1.5 text-2xs leading-relaxed text-ink-2">{dis.agentProposal}</p>
              </div>
              <div className="flex items-center justify-center"><ArrowLeftRight size={14} className="text-ink-3" /></div>
              <div className="rounded border border-line bg-sunken p-3">
                <div className="label-cap">Human resolved</div>
                <p className="mt-1.5 text-2xs leading-relaxed text-ink-2">{dis.humanResolution}</p>
              </div>
            </div>

            <div className="mt-3 rounded border border-line p-3">
              <div className="label-cap">Divergence</div>
              <p className="mt-1.5 text-2xs leading-relaxed text-ink-2">{dis.why}</p>
            </div>

            <div className={cn('mt-3 rounded border p-3', dis.verdict === 'unexplained' ? 'border-crit/40 bg-crit/[0.06]' : 'border-ok/40 bg-ok/[0.06]')}>
              <div className="flex items-center gap-1.5">
                <TrendingUp size={11} className={dis.verdict === 'unexplained' ? 'text-crit' : 'text-ok'} />
                <span className="label-cap">Action taken</span>
              </div>
              <p className="mt-1.5 text-2xs leading-relaxed text-ink-2">{dis.action}</p>
            </div>

          </Card>
        </div>
      </div>
    </>
  )
}

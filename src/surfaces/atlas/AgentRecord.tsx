import React from 'react'
import { useNavigate, useParams, Link } from 'react-router-dom'
import { ArrowLeft, Ban, Fingerprint, Pause, Play, TrendingUp } from 'lucide-react'
import { useAstra } from '@/domain/store'
import { AC, ACTION_CLASSES, ROLE_BY_ID } from '@/domain/reference'
import { SKILL_BY_ID, TOWER_BY_ID } from '@/domain/estate'
import { PageHeader, AutonomyChip, GradeChip, EvidenceLink } from '@/ui/domain'
import { Button, Card, Chip, Empty, Metric, Table, Td, Th, Tr } from '@/ui/primitives'
import { LineChart, CHART_COLORS } from '@/ui/charts'
import { cn, ago, dateShort, num, pct, usd } from '@/lib/format'
import { PIPELINE } from '@/domain/autonomySeed'


export function AgentRecord() {
  const { id } = useParams()
  const nav = useNavigate()
  const agent = useAstra((s) => (id ? s.agents[id] : undefined))
  const suspend = useAstra((s) => s.suspendAgent)
  const reinstate = useAstra((s) => s.reinstateAgent)
  const pushToast = useAstra((s) => s.pushToast)
  const roleId = useAstra((s) => s.roleId)
  const role = ROLE_BY_ID[roleId]

  if (!agent) {
    return <Empty title="Agent not found" action={<Button onClick={() => nav('/atlas/fleet')}>Back to fleet</Button>} />
  }

  const stageReached =
    agent.ceiling === 'autonomous' ? 5 : agent.ceiling === 'supervised' ? 4 : agent.ceiling === 'approve_first' ? 3 : agent.state === 'onboarding' ? 1 : 2

  const displacedHrs = agent.economics.humanMinsDisplaced30d / 60
  const displacedUsd = displacedHrs * 78

  return (
    <>
      <PageHeader
        title={agent.name}
        subtitle={agent.mission}
        meta={
          <span className="flex items-center gap-1.5">
            <Chip tone={agent.origin === 'client' ? 'info' : 'agent'}>{agent.origin === 'client' ? 'client-owned' : 'Artizent'}</Chip>
            <Chip tone={agent.state === 'active' ? 'ok' : agent.state === 'probation' ? 'warn' : agent.state === 'suspended' ? 'crit' : 'info'}>{agent.state}</Chip>
            <AutonomyChip mode={agent.ceiling} full />
          </span>
        }
        actions={
          <>
            <Button size="sm" variant="ghost" onClick={() => nav('/atlas/fleet')}><ArrowLeft size={12} /> Fleet</Button>
            {role.canApprove && (
              agent.state === 'suspended' ? (
                <Button size="sm" variant="primary" onClick={() => reinstate(agent.id, role.person)}><Play size={12} /> Reinstate</Button>
              ) : (
                <Button size="sm" variant="danger" onClick={() => suspend(agent.id, role.person, 'suspended from the employment record')}><Pause size={12} /> Suspend</Button>
              )
            )}
          </>
        }
      />

      <div className="grid shrink-0 grid-cols-2 gap-4 border-b border-line bg-surface px-4 py-2.5 md:grid-cols-5">
        <Metric size="sm" label="Evaluation score" value={agent.evaluation.score.toFixed(3)} hint={`suite ${agent.evaluation.suiteId} · ${ago(agent.evaluation.lastRun)}`} />
        <Metric size="sm" label="Live success 90d" value={agent.evaluation.liveSuccess90d ? pct(agent.evaluation.liveSuccess90d * 100) : 'not in production'} deltaTone={agent.evaluation.liveSuccess90d >= 0.97 ? 'ok' : 'warn'} />
        <Metric size="sm" label="Replay sample" value={num(agent.evaluation.replayN)} hint="golden dataset from this client's own history" />
        <Metric size="sm" label="Cost 30d" value={usd(agent.economics.costUsd30d)} hint={`${usd(agent.economics.costPerWo)} per work object`} />
        <Metric size="sm" label="Human cost displaced" value={usd(displacedUsd)} deltaTone="ok" hint={`${num(Math.round(displacedHrs))} hours · ratio ${pct((agent.economics.costUsd30d / Math.max(1, displacedUsd)) * 100, 1)}`} />
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
          <div className="space-y-4">
            <Card title="Role charter" subtitle="Mission, prohibitions, identity and ownership">
              <div className="grid gap-3 md:grid-cols-2">
                <div>
                  <div className="label-cap">Mission</div>
                  <p className="mt-1 text-2xs leading-relaxed text-ink-2">{agent.mission}</p>
                </div>
                <div>
                  <div className="label-cap">Prohibited actions</div>
                  <div className="mt-1 flex flex-wrap gap-1">
                    {agent.prohibited.map((p) => (
                      <Chip key={p} tone="crit" mono title={AC[p]?.name ?? p}><Ban size={9} />{p}</Chip>
                    ))}
                  </div>
                </div>
              </div>

              <div className="mt-3 grid gap-3 border-t border-line pt-3 md:grid-cols-2">
                <div>
                  <div className="label-cap">Non-human identity</div>
                  <p className="mt-1 break-all font-mono text-2xs text-ink-2">{agent.nhi}</p>
                  <p className="mt-1 flex items-start gap-1.5 text-2xs leading-relaxed text-ink-3">
                    <Fingerprint size={11} className="mt-[2px] shrink-0" />
                    Short-lived, scoped credentials issued per run. Actions are attributable to this identity in the client's own audit logs.
                  </p>
                </div>
                <div>
                  <div className="label-cap">Accountable human</div>
                  <p className="mt-1 text-2xs text-ink-2">{agent.ownerHuman}</p>
                  <div className="mt-2 label-cap">Towers in scope</div>
                  <div className="mt-1 flex flex-wrap gap-1">
                    {agent.towers.slice(0, 6).map((t) => <Chip key={t}>{TOWER_BY_ID[t]?.name ?? t}</Chip>)}
                    {agent.towers.length > 6 && <span className="text-2xs text-ink-3">+{agent.towers.length - 6}</span>}
                  </div>
                </div>
              </div>
            </Card>

            <Card title="Live success trend" subtitle="Last seven evaluation periods">
              <LineChart
                labels={['P-6', 'P-5', 'P-4', 'P-3', 'P-2', 'P-1', 'now']}
                series={[{ key: 'success', label: 'Live success', color: agent.driftAlarm ? CHART_COLORS.warn : CHART_COLORS.ok, values: agent.trend, area: true }]}
                height={160}
                yFormat={(n) => `${(n * 100).toFixed(0)}%`}
              />
              {agent.driftAlarm && (
                <p className="mt-2 rounded border border-warn/40 bg-warn/[0.06] p-2.5 text-2xs leading-relaxed text-ink-2">
                  Sampled review doubled automatically; next evaluation suite scheduled.
                </p>
              )}
            </Card>

            <Card title="Autonomy grants" subtitle="Earned per action class">
              <Table>
                <thead>
                  <tr>
                    <Th>Action class</Th>
                    <Th>Name</Th>
                    <Th>Grade</Th>
                    <Th>Platform floor</Th>
                    <Th>Reversibility</Th>
                    <Th>Verification pack</Th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(agent.grants).map(([ac, g]) => (
                    <Tr key={ac}>
                      <Td className="font-mono text-ink">{ac}</Td>
                      <Td>{AC[ac]?.name}</Td>
                      <Td><GradeChip grade={g} /></Td>
                      <Td className="text-2xs">{AC[ac]?.floor.replace(/_/g, '-')}</Td>
                      <Td className="text-2xs">{AC[ac]?.reversibility.replace(/_/g, ' ')}</Td>
                      <Td className="font-mono text-2xs text-ink-3">{AC[ac]?.verificationPack}</Td>
                    </Tr>
                  ))}
                </tbody>
              </Table>
            </Card>

            <Card title="Incident history" subtitle="Automatic demotions, client-visible">
              {agent.incidents.length === 0 ? (
                <p className="text-2xs text-ink-3">No incidents recorded against this agent.</p>
              ) : (
                <ul className="space-y-2">
                  {agent.incidents.map((i) => (
                    <li key={i.id} className="rounded border border-crit/35 bg-crit/[0.05] p-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono text-2xs text-ink-2">{i.id}</span>
                        <Chip mono>{i.actionClass}</Chip>
                        <span className="min-w-0 flex-1 truncate text-xs text-ink">{i.summary}</span>
                        <span className="shrink-0 text-2xs text-ink-3">{dateShort(i.at)}</span>
                      </div>
                      <p className="mt-1.5 text-2xs leading-relaxed text-ink-2">{i.outcome}</p>
                      <p className="mt-1 text-2xs text-ink-3">
                        Demoted one level for {i.demotedDays} days. Restoration required root cause and re-passing the stage gates.
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </div>

          <div className="space-y-4">
            <Card title="Promotion pipeline" subtitle="Five stage gates">
              <ol className="space-y-2">
                {PIPELINE.map((p, i) => {
                  const passed = i < stageReached
                  const current = i === stageReached
                  return (
                    <li key={p.stage} className={cn('rounded border p-2.5', passed ? 'border-ok/35 bg-ok/[0.05]' : current ? 'border-brand/45 bg-brand/[0.06]' : 'border-line bg-sunken')}>
                      <div className="flex items-center gap-2">
                        <span className={cn('flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[9px] font-semibold', passed ? 'bg-ok text-ink-inv' : current ? 'bg-brand text-ink-inv' : 'bg-line-strong text-ink-3')}>
                          {passed ? '✓' : i + 1}
                        </span>
                        <span className="text-2xs font-medium text-ink">{p.stage}</span>
                      </div>
                      <p className="mt-1.5 text-2xs leading-relaxed text-ink-3">{p.gate}</p>
                      <p className="mt-1 text-[10px] text-ink-3">Evidence: {p.evidence}</p>
                    </li>
                  )
                })}
              </ol>
              {role.canApprove && stageReached < 5 && (
                <Button
                  className="mt-3 w-full"
                  variant="primary"
                  onClick={() => pushToast({ title: 'Promotion proposed', body: 'Pack assembled with replay, shadow and live evidence. Requires SDM sign-off and, for L4, client governance approval for the class.', tone: 'ok' })}
                >
                  <TrendingUp size={12} /> Propose promotion
                </Button>
              )}
              <p className="mt-2 text-2xs text-ink-3">Next promotion review: {dateShort(agent.promotionReview)}</p>
            </Card>

            <Card title="Skills" subtitle="Versioned, evaluation-gated">
              <ul className="space-y-1.5">
                {agent.skills.map((s) => {
                  const skill = SKILL_BY_ID[s]
                  return (
                    <li key={s} className="rounded border border-line bg-sunken p-2.5">
                      <div className="flex items-center gap-1.5">
                        <span className="min-w-0 flex-1 truncate font-mono text-2xs text-ink">{s}</span>
                        {skill && <Chip tone={skill.layer === 'client' ? 'brand' : skill.layer === 'industry' ? 'info' : 'neutral'}>{skill.layer}</Chip>}
                      </div>
                      {skill && (
                        <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-[10px] text-ink-3">
                          <span>{skill.name}</span>
                          <span>success {pct(skill.successRate * 100)}</span>
                          <span>n={num(skill.runs)}</span>
                          <span>eval {skill.evalScore.toFixed(3)}</span>
                        </div>
                      )}
                    </li>
                  )
                })}
              </ul>
            </Card>

            <Card title="Economics" subtitle="The AI P&L for this agent">
              <dl className="space-y-1.5 text-2xs">
                <div className="flex justify-between gap-2"><dt className="text-ink-3">Model spend, 30 days</dt><dd className="tnum text-ink-2">{usd(agent.economics.costUsd30d)}</dd></div>
                <div className="flex justify-between gap-2"><dt className="text-ink-3">Cost per work object</dt><dd className="tnum text-ink-2">{usd(agent.economics.costPerWo)}</dd></div>
                <div className="flex justify-between gap-2"><dt className="text-ink-3">Human minutes displaced</dt><dd className="tnum text-ink-2">{num(agent.economics.humanMinsDisplaced30d)}</dd></div>
                <div className="flex justify-between gap-2 border-t border-line pt-1.5"><dt className="text-ink-3">Spend versus displaced cost</dt><dd className={cn('tnum font-medium', (agent.economics.costUsd30d / Math.max(1, displacedUsd)) * 100 <= 6 ? 'text-ok' : 'text-warn')}>{pct((agent.economics.costUsd30d / Math.max(1, displacedUsd)) * 100, 2)}</dd></div>
              </dl>
              <Link to="/atlas/tokenops" className="mt-2 inline-block text-2xs text-brand-ink hover:underline">Open TokenOps Studio →</Link>
            </Card>

            <Card title="Record integrity" subtitle="Employment record as an audit object">
              <EvidenceLink id={`ev_aer_${agent.id}`} className="mt-2" label="Open record history" />
            </Card>
          </div>
        </div>
      </div>
    </>
  )
}

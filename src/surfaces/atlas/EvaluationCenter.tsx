import React from 'react'
import { Link } from 'react-router-dom'
import { Crosshair, FlaskConical, GitCompare, Play } from 'lucide-react'
import { SKILLS, AGENTS } from '@/domain/estate'
import { AC, ROLE_BY_ID } from '@/domain/reference'
import { useAstra } from '@/domain/store'
import { HISTORY } from '@/domain/metrics'
import { PageHeader, AgentChip } from '@/ui/domain'
import { Button, Card, Chip, Metric, Table, Tabs, Td, Th, Tr } from '@/ui/primitives'
import { LineChart, CHART_COLORS } from '@/ui/charts'
import { cn, dateShort, num, pct } from '@/lib/format'
import { SUITES, REGRESSION } from '@/domain/evaluationSeed'
import { RED_TEAM_CASES } from '@/domain/redTeamSeed'
import { gatewayDeps, runRedTeam } from '@/domain/redTeam'
import { ProducedBy } from '@/ui/ProducedBy'



export function EvaluationCenter() {
  const pushToast = useAstra((s) => s.pushToast)
  const agents = useAstra((s) => s.agents)
  const roleId = useAstra((s) => s.roleId)
  const role = ROLE_BY_ID[roleId]
  const [tab, setTab] = React.useState<'suites' | 'skills' | 'regression' | 'redteam'>('suites')
  const [running, setRunning] = React.useState<string | null>(null)

  // The red-team library runs against the live controls — the gateway's
  // classifier and registry, the detectors, the policy engine — never a copy.
  const redTeam = useAstra((s) => s.redTeam)
  const recordRedTeam = useAstra((s) => s.recordRedTeam)
  const [attacking, setAttacking] = React.useState(false)
  const runRedTeamNow = async () => {
    setAttacking(true)
    try {
      const results = await runRedTeam(RED_TEAM_CASES, gatewayDeps)
      recordRedTeam(results, role.person)
    } catch (e) {
      pushToast({ title: 'Red-team run failed', body: (e as Error).message, tone: 'crit' })
    } finally {
      setAttacking(false)
    }
  }
  const byCase = new Map((redTeam?.results ?? []).map((r) => [r.caseId, r]))

  const runSuite = (id: string) => {
    setRunning(id)
    setTimeout(() => {
      setRunning(null)
      pushToast({ title: `Suite ${id} complete`, body: 'Results attached to every affected employment record. A skill version that fails its suite is not loadable in production.', tone: 'ok' })
    }, 1600)
  }

  const pipeline = Object.values(agents).map((a) => ({
    agent: a,
    stage: a.ceiling === 'autonomous' ? 5 : a.ceiling === 'supervised' ? 4 : a.ceiling === 'approve_first' ? 3 : a.state === 'onboarding' ? 1 : 2,
  }))

  return (
    <>
      <PageHeader
        title="Evaluation Center"
        subtitle="Evaluation suites, skill registry and the promotion pipeline"
        actions={
          <Button size="sm" variant="primary" disabled={!role.canApprove} onClick={() => runSuite('all')}>
            <Play size={12} /> Run all suites
          </Button>
        }
      />

      <ProducedBy
        agents={["agt_remedian", "agt_custodian", "agt_warden"]}
        what="the agents under evaluation — every suite score and promotion here is theirs"
      />

      <div className="grid shrink-0 grid-cols-2 gap-4 border-b border-line bg-surface px-4 py-2.5 md:grid-cols-5">
        <Metric size="sm" label="Suites" value={SUITES.length} hint="golden datasets built from this client's own history" />
        <Metric size="sm" label="Total cases" value={num(SUITES.reduce((s, x) => s + x.cases, 0))} hint="≥ 200 per action class required" />
        <Metric size="sm" label="Open regressions" value={SUITES.reduce((s, x) => s + x.regression, 0)} deltaTone="warn" hint="block promotion until resolved" />
        <Metric size="sm" label="Skills in registry" value={SKILLS.length} hint="platform, industry and client layers" />
        <Metric size="sm" label="Agents at L4" value={pipeline.filter((p) => p.stage === 5).length} hint={`of ${pipeline.length} in the fleet`} />
      </div>

      <div className="shrink-0 border-b border-line bg-surface px-4 py-1.5">
        <Tabs value={tab} onChange={setTab} tabs={[{ id: 'suites', label: 'Suites & pipeline' }, { id: 'skills', label: 'Skill registry', count: SKILLS.length }, { id: 'regression', label: 'Regression diffs', count: REGRESSION.length }, { id: 'redteam', label: 'Red team', count: RED_TEAM_CASES.length }]} />
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        {tab === 'suites' && (
          <div className="grid gap-4 lg:grid-cols-[1.1fr_1fr]">
            <Card title="Evaluation suites" subtitle="Scored on correctness, safety and narrative quality">
              <Table>
                <thead>
                  <tr>
                    <Th>Suite</Th>
                    <Th>Coverage</Th>
                    <Th align="right">Cases</Th>
                    <Th align="right">Pass score</Th>
                    <Th align="right">Regressions</Th>
                    <Th>Last run</Th>
                    <Th></Th>
                  </tr>
                </thead>
                <tbody>
                  {SUITES.map((s) => (
                    <Tr key={s.id}>
                      <Td>
                        <span className="block text-ink">{s.name}</span>
                        <span className="block font-mono text-[10px] text-ink-3">{s.id}</span>
                      </Td>
                      <Td>
                        <span className="flex flex-wrap gap-1">
                          {s.coverage.map((c) => <Chip key={c} mono title={AC[c]?.name}>{c}</Chip>)}
                        </span>
                      </Td>
                      <Td align="right">{num(s.cases)}</Td>
                      <Td align="right" className={s.pass >= 0.9 ? 'text-ok' : s.pass >= 0.8 ? 'text-warn' : 'text-crit'}>{s.pass.toFixed(3)}</Td>
                      <Td align="right" className={s.regression ? 'text-warn' : 'text-ok'}>{s.regression}</Td>
                      <Td className="text-2xs text-ink-3">{s.lastRun}d ago</Td>
                      <Td>
                        <Button size="sm" variant="ghost" disabled={running !== null} onClick={() => runSuite(s.id)}>
                          {running === s.id ? 'Running…' : <><FlaskConical size={11} /> Run</>}
                        </Button>
                      </Td>
                    </Tr>
                  ))}
                </tbody>
              </Table>
            </Card>

            <Card title="Promotion pipeline" subtitle="Where every agent sits on the five stage gates">
              <div className="space-y-2">
                {pipeline
                  .slice()
                  .sort((a, b) => b.stage - a.stage)
                  .map(({ agent, stage }) => (
                    <div key={agent.id} className="flex items-center gap-3 rounded border border-line bg-sunken px-2.5 py-2">
                      <span className="w-[120px] shrink-0"><AgentChip id={agent.id} /></span>
                      <span className="flex flex-1 items-center gap-1">
                        {[1, 2, 3, 4, 5].map((n) => (
                          <span
                            key={n}
                            title={['Replay', 'Shadow', 'Assisted (L1–L2)', 'Supervised (L3)', 'Autonomous (L4)'][n - 1]}
                            className={cn('h-1.5 flex-1 rounded-full', n <= stage ? 'bg-brand' : 'bg-line-strong/50')}
                          />
                        ))}
                      </span>
                      <span className="w-[78px] shrink-0 text-right text-2xs text-ink-3">
                        {['Replay', 'Shadow', 'Assisted', 'Supervised', 'Autonomous'][stage - 1]}
                      </span>
                      {agent.state !== 'active' && <Chip tone={agent.state === 'suspended' ? 'crit' : 'warn'}>{agent.state}</Chip>}
                    </div>
                  ))}
              </div>
            </Card>
          </div>
        )}

        {tab === 'skills' && (
          <Card title="Skill registry" subtitle="Versioned procedures with tests, verification packs and applicability predicates">
            <Table>
              <thead>
                <tr>
                  <Th>Skill</Th>
                  <Th>Version</Th>
                  <Th>Layer</Th>
                  <Th>Action classes</Th>
                  <Th align="right">Runs</Th>
                  <Th align="right">Success</Th>
                  <Th align="right">Eval score</Th>
                  <Th>Verification pack</Th>
                  <Th>Owner</Th>
                </tr>
              </thead>
              <tbody>
                {SKILLS.map((s) => (
                  <Tr key={s.id}>
                    <Td>
                      <span className="block text-ink">{s.name}</span>
                      <span className="block font-mono text-[10px] text-ink-3">{s.id}</span>
                    </Td>
                    <Td className="font-mono text-2xs">{s.version}</Td>
                    <Td><Chip tone={s.layer === 'client' ? 'brand' : s.layer === 'industry' ? 'info' : 'neutral'}>{s.layer}</Chip></Td>
                    <Td><span className="flex flex-wrap gap-1">{s.actionClasses.map((c) => <Chip key={c} mono>{c}</Chip>)}</span></Td>
                    <Td align="right">{num(s.runs)}</Td>
                    <Td align="right" className={s.successRate >= 0.97 ? 'text-ok' : 'text-warn'}>{pct(s.successRate * 100)}</Td>
                    <Td align="right">{s.evalScore.toFixed(3)}</Td>
                    <Td className="font-mono text-2xs text-ink-3">{s.verificationPack}</Td>
                    <Td className="text-2xs">{s.owner}</Td>
                  </Tr>
                ))}
              </tbody>
            </Table>
          </Card>
        )}

        {tab === 'regression' && (
          <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
            <Card title="Version-to-version regression" subtitle="Version-to-version on the same golden dataset">
              <Table>
                <thead>
                  <tr>
                    <Th>Change</Th>
                    <Th>Metric</Th>
                    <Th align="right">Before</Th>
                    <Th align="right">After</Th>
                    <Th align="right">Delta</Th>
                    <Th>Verdict</Th>
                  </tr>
                </thead>
                <tbody>
                  {REGRESSION.map((r) => {
                    const delta = r.after - r.before
                    return (
                      <Tr key={r.id}>
                        <Td className="font-mono text-2xs text-ink-2">{r.from} → {r.to}</Td>
                        <Td>{r.metric}</Td>
                        <Td align="right">{r.before.toFixed(3)}</Td>
                        <Td align="right">{r.after.toFixed(3)}</Td>
                        <Td align="right" className={delta > 0 ? 'text-ok' : delta < -0.01 ? 'text-crit' : 'text-ink-3'}>
                          {delta >= 0 ? '+' : ''}{delta.toFixed(3)}
                        </Td>
                        <Td>
                          <Chip tone={r.verdict === 'improved' ? 'ok' : r.verdict === 'regressed' ? 'crit' : 'neutral'}>{r.verdict}</Chip>
                        </Td>
                      </Tr>
                    )
                  })}
                </tbody>
              </Table>
              <div className="mt-3 rounded border border-warn/35 bg-warn/[0.06] p-3">
                <div className="flex items-center gap-1.5"><GitCompare size={11} className="text-warn" /><span className="label-cap">Blocking regression</span></div>
                <p className="mt-1.5 text-2xs leading-relaxed text-ink-2">
                  Correctness and test coverage improve; narrative quality regresses 0.012. Version held until the narrative prompt is corrected.
                </p>
              </div>
            </Card>

            <Card title="Model change control" subtitle="Model and router changes are agent changes">
              <LineChart
                labels={['Nov', 'Dec', 'Jan', 'Feb']}
                series={[
                  { key: 'frontier', label: 'Frontier tier', color: CHART_COLORS.brand, values: [...HISTORY.evalFrontier] },
                  { key: 'mid', label: 'Mid tier', color: CHART_COLORS.info, values: [...HISTORY.evalMid] },
                  { key: 'small', label: 'Small / client-hosted', color: CHART_COLORS.agent, values: [...HISTORY.evalSmall] },
                ]}
                height={160}
                yFormat={(n) => n.toFixed(2)}
              />
              <Link to="/atlas/tokenops" className="mt-2 inline-block text-2xs text-brand-ink hover:underline">See the cost frontier behind these choices →</Link>
            </Card>
          </div>
        )}

        {tab === 'redteam' && (
          <Card
            title="Red-team library"
            subtitle="Prompt injection, retrieval poisoning, tool misuse, fabrication and unregistered models — run against the live controls"
            right={
              <Button size="sm" variant="primary" disabled={!role.canApprove || attacking} onClick={runRedTeamNow}>
                <Crosshair size={12} /> {attacking ? 'Running…' : 'Run red team'}
              </Button>
            }
          >
            <div className="mb-3 grid grid-cols-2 gap-3 md:grid-cols-4">
              <Metric size="sm" label="Cases" value={RED_TEAM_CASES.length} hint="every case names the control that should hold" />
              <Metric size="sm" label="Passed" value={redTeam ? redTeam.results.filter((r) => r.pass).length : '—'} deltaTone={redTeam && redTeam.results.every((r) => r.pass) ? 'ok' : undefined} />
              <Metric size="sm" label="Failed" value={redTeam ? redTeam.results.filter((r) => !r.pass).length : '—'} deltaTone={redTeam ? (redTeam.results.some((r) => !r.pass) ? 'crit' : 'ok') : undefined} hint="a failure blocks promotion on the classes it covers" />
              <Metric size="sm" label="Last run" value={redTeam ? redTeam.at.slice(0, 16).replace('T', ' ') : 'never'} />
            </div>
            <Table>
              <thead>
                <tr>
                  <Th>Case</Th>
                  <Th>Vector</Th>
                  <Th>Expected</Th>
                  <Th>Observed</Th>
                  <Th>Result</Th>
                  <Th>Detail</Th>
                </tr>
              </thead>
              <tbody>
                {RED_TEAM_CASES.map((c) => {
                  const r = byCase.get(c.id)
                  return (
                    <Tr key={c.id} className={r && !r.pass ? 'bg-crit/[0.06]' : undefined}>
                      <Td>
                        <span className="block text-ink">{c.label}</span>
                        <span className="block font-mono text-[10px] text-ink-3">{c.id}</span>
                      </Td>
                      <Td><Chip mono>{c.vector}</Chip></Td>
                      <Td><Chip tone={c.expected === 'pass' ? 'ok' : c.expected === 'refuse' ? 'crit' : 'warn'}>{c.expected.replace(/_/g, ' ')}</Chip></Td>
                      <Td>{r ? <Chip tone={r.observed === 'pass' ? 'ok' : r.observed === 'refuse' ? 'crit' : r.observed === 'error' ? 'crit' : 'warn'}>{r.observed.replace(/_/g, ' ')}</Chip> : <span className="text-2xs text-ink-3">not run</span>}</Td>
                      <Td>{r ? <Chip tone={r.pass ? 'ok' : 'crit'}>{r.pass ? 'holds' : 'FAILED'}</Chip> : <span className="text-2xs text-ink-3">—</span>}</Td>
                      <Td className="max-w-[360px] text-2xs leading-snug text-ink-2">{r?.detail ?? ''}</Td>
                    </Tr>
                  )
                })}
              </tbody>
            </Table>
            <p className="mt-3 text-2xs leading-relaxed text-ink-3">
              No model is called by any case. Injection cases hit the gateway's classifier through its own endpoint; poisoning cases run the policy engine's retrieval floor; tool-misuse and fabrication cases run the inline detectors; model cases hit the registry through the settings guard, which refuses before any vendor request. Every run is a verification record in the evidence chain.
            </p>
          </Card>
        )}
      </div>
    </>
  )
}

import React from 'react'
import { Bot, ClipboardCheck, Hand, Wrench } from 'lucide-react'
import {
  AGENT_OPS, PHASE_LABEL, STAGES, STAGE_LABEL, fleetLifecycle, readAgent,
  type AgentReading, type Check, type CheckState, type Phase, type Stage,
} from '@/domain/agentLifecycle'
import { REASON_LABEL, escalationSummary } from '@/domain/escalations'
import { MODE_LABEL } from '@/domain/reference'
import { approvedModels, approvedModelsNow } from '@/domain/registry'
import { useAstra } from '@/domain/store'
import { Bar, Card, Chip, Metric, Table, Td, Th, Tr } from '@/ui/primitives'
import { cn, dateShort, num } from '@/lib/format'
import { Band, More, limit, type ArtifactView, type CardProps } from './frame'

/* ==========================================================================
   Agent lifecycle and readiness.

   What it takes to put an agent into a client's service: build it, prove it
   against that client's own history, make it operational, and watch it. Each
   check reads a record the platform already holds, and what stands between
   an agent and its next stage is computed rather than asserted.
   ========================================================================== */

type Tone = 'neutral' | 'ok' | 'warn' | 'crit' | 'info' | 'brand' | 'agent'

const CHECK_TONE: Record<CheckState, Tone> = { pass: 'ok', fail: 'crit', unknown: 'neutral' }
const CHECK_LABEL: Record<CheckState, string> = { pass: 'Pass', fail: 'Fail', unknown: 'Not known' }
const STAGE_TONE: Record<Stage, Tone> = {
  draft: 'neutral', evaluated: 'info', shadow: 'warn', supervised: 'brand', autonomous: 'ok', suspended: 'crit',
}
const PHASES: Phase[] = ['build', 'prove', 'operate', 'watch']

/** The approved models the gateway enforces, from the one reader the tool uses too. */
function useApprovedModels(): string[] | undefined {
  const [models, setModels] = React.useState<string[] | undefined>(approvedModelsNow)
  React.useEffect(() => {
    let live = true
    approvedModels().then((m) => { if (live) setModels(m) })
    return () => { live = false }
  }, [])
  return models
}

function useFleet() {
  const models = useApprovedModels()
  const agents = useAstra((s) => s.agents)
  return React.useMemo(() => fleetLifecycle(models, Object.values(agents)), [models, agents])
}

function LifecycleMetrics({ size }: CardProps) {
  const f = useFleet()
  const page = size === 'page'
  const e = React.useMemo(() => escalationSummary(), [])
  const esc = { total: e.total, waiting: e.waiting, ofRunsPctLabel: `${e.ratePct}%` }
  const live = f.byStage.supervised + f.byStage.autonomous
  return (
    <Band size={size} cols={6}>
      <Metric size="sm" label="Agents" value={f.agents.length} hint={page ? `${live} acting on the estate` : undefined} />
      {page && <Metric size="sm" label="Autonomous" value={f.byStage.autonomous} hint={`${f.byStage.supervised} supervised`} />}
      {page && <Metric size="sm" label="In proving" value={f.byStage.shadow + f.byStage.evaluated + f.byStage.draft} hint="shadow or earlier" />}
      <Metric size="sm" label="Ready to promote" value={f.readyToPromote.length} deltaTone={f.readyToPromote.length ? 'ok' : undefined} />
      <Metric size="sm" label="Blocked" value={f.blocked.length} deltaTone={f.blocked.length ? 'warn' : 'ok'} hint={page ? f.commonGaps[0]?.check : undefined} />
      <Metric size="sm" label="Over budget" value={f.overBudget.length} deltaTone={f.overBudget.length ? 'crit' : 'ok'} />
      {page && <Metric size="sm" label="Escalated to people" value={num(esc.total)} hint={`${esc.ofRunsPctLabel} of runs · ${esc.waiting} waiting`} />}
    </Band>
  )
}

function StageStrip({ f }: { f: ReturnType<typeof fleetLifecycle> }) {
  return (
    <div className="overflow-x-auto">
      <ol className="grid gap-2" style={{ gridTemplateColumns: `repeat(${STAGES.length}, minmax(130px, 1fr))` }}>
        {STAGES.map((s, i) => (
          <li key={s} className={cn('rounded border p-2.5', f.byStage[s] ? 'border-line bg-sunken' : 'border-dashed border-line')}>
            <div className="flex items-center gap-1.5">
              <span className="flex h-4 w-4 items-center justify-center rounded-full bg-line-strong text-[9px] font-semibold text-ink-2">{i + 1}</span>
              <span className="text-xs font-medium text-ink">{STAGE_LABEL[s]}</span>
              <span className="tnum ml-auto text-2xs text-ink-2">{f.byStage[s]}</span>
            </div>
            <div className="mt-1.5 flex flex-wrap gap-1">
              {f.agents.filter((a) => a.stage === s).map((a) => <Chip key={a.agent.id} tone="agent">{a.agent.name}</Chip>)}
              {!f.byStage[s] && <span className="text-[10px] text-ink-3">—</span>}
            </div>
          </li>
        ))}
      </ol>
    </div>
  )
}

function FleetTable({ rows, full, onPick, picked }: { rows: AgentReading[]; full: boolean; onPick?: (id: string) => void; picked?: string }) {
  return (
    <Table>
      <thead>
        <tr>
          <Th>Agent</Th><Th>Stage</Th><Th align="right">Checks</Th>{full && <Th align="right">Budget</Th>}
          <Th>Next</Th><Th>What stands in the way</Th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <Tr
            key={r.agent.id}
            onClick={onPick ? () => onPick(r.agent.id) : undefined}
            selected={picked === r.agent.id}
            className={r.blockers.length ? undefined : 'bg-ok/[0.04]'}
          >
            <Td className="max-w-[190px] text-2xs text-ink">
              {r.agent.name}
              <span className="block text-[10px] text-ink-3">{r.agent.codename} · {r.agent.origin === 'client' ? 'client-owned' : 'ours'}</span>
            </Td>
            <Td><Chip tone={STAGE_TONE[r.stage]}>{STAGE_LABEL[r.stage]}</Chip></Td>
            <Td align="right" className="tnum text-2xs text-ink-2">{r.passed}/{r.checks.length}</Td>
            {full && (
              <Td align="right" className="w-[92px]">
                {r.budgetPct === null ? <span className="text-2xs text-ink-3">—</span> : (
                  <>
                    <span className={cn('tnum text-2xs', r.budgetPct > 100 ? 'text-crit' : 'text-ink-2')}>{r.budgetPct}%</span>
                    <Bar value={Math.min(r.budgetPct, 100)} tone={r.budgetPct > 100 ? 'crit' : 'brand'} height={3} className="mt-1" />
                  </>
                )}
              </Td>
            )}
            <Td className="text-2xs text-ink-2">{r.next ? STAGE_LABEL[r.next] : '—'}</Td>
            <Td>
              <div className="flex max-w-[300px] flex-wrap gap-1">
                {r.blockers.map((b) => <Chip key={b.id} tone="crit">{b.name}</Chip>)}
                {r.unverified.map((b) => <Chip key={b.id} title="Could not be read">{b.name} · not known</Chip>)}
                {!r.blockers.length && !r.unverified.length && <Chip tone="ok">Nothing</Chip>}
              </div>
            </Td>
          </Tr>
        ))}
      </tbody>
    </Table>
  )
}

function Checklist({ r }: { r: AgentReading }) {
  return (
    <div className="grid gap-3 md:grid-cols-2">
      {PHASES.map((phase) => (
        <div key={phase} className="rounded border border-line bg-sunken p-2.5">
          <div className="flex items-center gap-1.5">
            <span className="label-cap">{PHASE_LABEL[phase]}</span>
            <span className="tnum ml-auto text-2xs text-ink-3">
              {r.checks.filter((c) => c.phase === phase && c.state === 'pass').length}/{r.checks.filter((c) => c.phase === phase).length}
            </span>
          </div>
          <ul className="mt-2 space-y-1.5">
            {r.checks.filter((c) => c.phase === phase).map((c: Check) => (
              <li key={c.id} className="flex items-start gap-2">
                <Chip tone={CHECK_TONE[c.state]} className="mt-px shrink-0">{CHECK_LABEL[c.state]}</Chip>
                <span className="min-w-0 flex-1 text-2xs text-ink">
                  {c.name}
                  <span className="block text-[10px] text-ink-3">{c.detail} · {c.source}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  )
}

function Escalations({ r }: { r: AgentReading }) {
  const e = r.escalations
  if (!e.runs) return <p className="text-2xs text-ink-3">Has not run in the window.</p>
  return (
    <>
      <div className="grid grid-cols-3 gap-3">
        <Metric size="sm" label="Escalated" value={num(e.count)} hint={e.ratePct === null ? undefined : `${e.ratePct}% of ${num(e.runs)} runs`} />
        <Metric size="sm" label="Median pick-up" value={e.medianPickupMins === null ? '—' : `${e.medianPickupMins}m`} />
        <Metric size="sm" label="Waiting" value={e.waiting} deltaTone={e.waiting ? 'warn' : 'ok'} hint={e.oldestWaitingMins ? `oldest ${e.oldestWaitingMins}m` : undefined} />
      </div>
      <Table className="mt-3">
        <thead><tr><Th>Why it escalated</Th><Th align="right">Times</Th></tr></thead>
        <tbody>
          {e.byReason.map((x) => (
            <Tr key={x.reason}>
              <Td className="text-2xs text-ink">{REASON_LABEL[x.reason]}</Td>
              <Td align="right" className="tnum text-2xs text-ink-2">{num(x.count)}</Td>
            </Tr>
          ))}
        </tbody>
      </Table>
    </>
  )
}

function Setup({ r }: { r: AgentReading }) {
  const o = r.ops
  if (!o) return <p className="text-2xs text-ink-3">Nothing set up for this agent yet.</p>
  return (
    <dl className="grid grid-cols-[112px_1fr] gap-x-2 gap-y-1.5 text-2xs">
      <dt className="text-ink-3">Accountable</dt><dd className="text-ink-2">{r.agent.ownerHuman}</dd>
      <dt className="text-ink-3">Identity</dt><dd className="text-ink-2">{r.agent.nhi}<span className="block text-[10px] text-ink-3">{o.identityScope}</span></dd>
      <dt className="text-ink-3">Model</dt><dd className="text-ink-2">{o.servedModel}</dd>
      <dt className="text-ink-3">Ceiling</dt><dd className="text-ink-2">{MODE_LABEL[r.agent.ceiling] ?? r.agent.ceiling}</dd>
      <dt className="text-ink-3">Budget</dt>
      <dd className="text-ink-2">${num(o.budgetUsd30d)} / 30 d<span className="block text-[10px] text-ink-3">${num(r.agent.economics.costUsd30d)} spent · {r.budgetPct}%</span></dd>
      <dt className="text-ink-3">Step limit</dt><dd className="text-ink-2">{o.maxSteps} per run</dd>
      <dt className="text-ink-3">Escalates to</dt><dd className="text-ink-2">{o.escalateTo}</dd>
      <dt className="text-ink-3">Stop tested</dt><dd className="text-ink-2">{o.killSwitchTestedAt ? dateShort(o.killSwitchTestedAt) : <Chip tone="crit">Never</Chip>}</dd>
      <dt className="text-ink-3">Change record</dt><dd className="text-ink-2">{o.changeRef ?? <Chip tone="crit">None</Chip>}</dd>
      <dt className="text-ink-3">Prohibited</dt>
      <dd className="flex flex-wrap gap-1">{r.agent.prohibited.map((p) => <Chip key={p} mono tone="crit">{p}</Chip>)}</dd>
      <dt className="text-ink-3">Context</dt>
      <dd className="flex flex-wrap gap-1">{o.contextSources.map((c) => <Chip key={c}>{c}</Chip>)}</dd>
    </dl>
  )
}

function LifecycleBody({ props, size }: CardProps) {
  const f = useFleet()
  const fleetEsc = React.useMemo(() => escalationSummary(), [])
  const full = size !== 'card'
  const wanted = String(props.agent ?? '')
  const [picked, setPicked] = React.useState(() => wanted || f.agents.find((a) => a.blockers.length)?.agent.id || f.agents[0]?.agent.id || '')
  const sel = f.agents.find((a) => a.agent.id === picked || a.agent.name.toLowerCase() === picked.toLowerCase())

  if (size !== 'page') {
    if (wanted && sel) {
      return (
        <>
          <div className="mb-2.5 flex flex-wrap items-center gap-1.5">
            <Chip tone={STAGE_TONE[sel.stage]}>{STAGE_LABEL[sel.stage]}</Chip>
            <Chip tone={sel.blockers.length ? 'warn' : 'ok'}>{sel.passed}/{sel.checks.length} checks</Chip>
            {sel.next && <Chip>Next: {STAGE_LABEL[sel.next]}</Chip>}
            {sel.escalations.runs > 0 && (
              <Chip tone={sel.escalations.waiting ? 'warn' : 'neutral'}>
                {num(sel.escalations.count)} escalated · {sel.escalations.ratePct}% of runs
              </Chip>
            )}
          </div>
          <Checklist r={sel} />
        </>
      )
    }
    const rows = limit(f.agents, size)
    return <><FleetTable rows={rows} full={full} /><More shown={rows.length} total={f.agents.length} /></>
  }

  return (
    <>
      <Card title="Lifecycle" subtitle={`${f.agents.length} agents · ${f.readyToPromote.length} ready to promote`} right={<Bot size={13} className="text-ink-3" />}>
        <StageStrip f={f} />
      </Card>

      <Card className="mt-4" title="Readiness" subtitle={`${f.blocked.length} blocked · ${f.overBudget.length} over budget`} right={<ClipboardCheck size={13} className="text-ink-3" />}>
        <FleetTable rows={f.agents} full onPick={setPicked} picked={sel?.agent.id} />
      </Card>

      {sel && (
        <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
          <Card title={sel.agent.name} subtitle={`${sel.passed} of ${sel.checks.length} checks · ${STAGE_LABEL[sel.stage]}${sel.next ? ` → ${STAGE_LABEL[sel.next]}` : ''}`}>
            <Checklist r={sel} />
          </Card>
          <div className="space-y-4">
            <Card title="Escalations" subtitle="What it handed back, and why" right={<Hand size={13} className="text-ink-3" />}>
              <Escalations r={sel} />
            </Card>
            <Card title="Set-up" subtitle="What the platform team configured" right={<Wrench size={13} className="text-ink-3" />}>
              <Setup r={sel} />
            </Card>
          </div>
        </div>
      )}

      <Card className="mt-4" title="Why agents escalate" subtitle={`${num(fleetEsc.total)} escalations · ${fleetEsc.ratePct}% of ${num(fleetEsc.runs)} runs · median pick-up ${fleetEsc.medianPickupMins ?? '—'} min`} right={<Hand size={13} className="text-ink-3" />}>
        <Table>
          <thead><tr><Th>Reason</Th><Th align="right">Times</Th><Th align="right">Agents</Th><Th>What would fix it</Th></tr></thead>
          <tbody>
            {fleetEsc.byReason.map((x) => (
              <Tr key={x.reason}>
                <Td className="text-2xs text-ink">{REASON_LABEL[x.reason]}</Td>
                <Td align="right" className="tnum text-2xs text-ink-2">{num(x.count)}</Td>
                <Td align="right" className="tnum text-2xs text-ink-2">{x.agents}</Td>
                <Td className="max-w-[320px] text-2xs text-ink-2">{x.fix}</Td>
              </Tr>
            ))}
          </tbody>
        </Table>
      </Card>

      {f.commonGaps.length > 0 && (
        <Card className="mt-4" title="Where the fleet is short" subtitle={`${f.commonGaps.length} checks failing somewhere`}>
          <Table>
            <thead><tr><Th>Check</Th><Th>Phase</Th><Th align="right">Agents failing</Th></tr></thead>
            <tbody>
              {f.commonGaps.map((g) => (
                <Tr key={g.check}>
                  <Td className="text-2xs text-ink">{g.check}</Td>
                  <Td className="text-2xs text-ink-2">{PHASE_LABEL[g.phase]}</Td>
                  <Td align="right" className="tnum text-2xs text-ink-2">{g.agents}</Td>
                </Tr>
              ))}
            </tbody>
          </Table>
        </Card>
      )}
    </>
  )
}

export const agentLifecycleView: ArtifactView = {
  Body: LifecycleBody,
  Metrics: LifecycleMetrics,
  page: {
    title: 'Agent lifecycle and readiness',
    subtitle: 'How each agent is built, proved, made operational and watched, and what stands between it and its next stage',
    agents: ['agt_herald'],
    what: 'reading each agent against the records that prove it',
  },
}

export { readAgent, AGENT_OPS }

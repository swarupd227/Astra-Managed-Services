import React from 'react'
import { Link } from 'react-router-dom'
import { Bot, Coins, Cpu, Pause, Play, ShieldAlert, Zap } from 'lucide-react'
import { useAstra, useWorkList } from '@/domain/store'
import { AC, ROLE_BY_ID } from '@/domain/reference'
import { TOWER_BY_ID } from '@/domain/estate'
import { AutonomyChip, GradeChip, PageHeader } from '@/ui/domain'
import { Button, Card, Chip, Dot, Metric } from '@/ui/primitives'
import { StreamText } from '@/ui/StreamText'
import { liveStateOf } from '@/ui/WorkforcePanel'
import { Sparkline } from '@/ui/charts'
import { cn, num, pct, usd } from '@/lib/format'
import type { Agent } from '@/domain/types'

/* --------------------------------------------------------------------------
   What each agent is doing right now — read off the work it actually holds.
   Nothing on this screen is scripted: if an agent has no work routed to it,
   the card says so.
   -------------------------------------------------------------------------- */

function AgentCard({ agent }: { agent: Agent }) {
  const workList = useWorkList()
  const suspend = useAstra((s) => s.suspendAgent)
  const reinstate = useAstra((s) => s.reinstateAgent)
  const roleId = useAstra((s) => s.roleId)
  const role = ROLE_BY_ID[roleId]

  // What this agent is doing is read off the work it actually holds, and the
  // narration is the work object's own latest entry (§A7.3 — presence is
  // honest telemetry, not a typing indicator). An agent holding nothing says
  // so rather than performing.
  const mine = workList.filter((w) => w.assigneeKind === 'agent' && w.assignee === agent.id)
  const live = liveStateOf(agent, workList)
  const focus =
    mine.find((w) => w.state === 'executing') ??
    mine.find((w) => w.state === 'gated') ??
    mine.find((w) => !['resolved', 'learned'].includes(w.state))
  const latest = focus?.narrative[focus.narrative.length - 1]

  const line =
    agent.state === 'suspended'
      ? 'Suspended — no credentials issued, no work routed'
      : agent.state === 'onboarding'
        ? 'Onboarding — shadowing only, no work routed'
        : latest
          ? `${latest.text} · ${focus!.ref}`
          : 'No work routed in this window'

  const idle = live.state === 'suspended' || !focus
  const working = !idle
  const phase = live.state

  const displacedHrs = agent.economics.humanMinsDisplaced30d / 60
  const ratio = agent.economics.costUsd30d / Math.max(1, displacedHrs * 78)

  return (
    <article
      className={cn(
        'flex min-w-0 flex-col rounded-md border bg-surface shadow-e1 transition-shadow hover:shadow-e2',
        agent.state === 'suspended' ? 'border-crit/40' : agent.state === 'probation' ? 'border-warn/40' : agent.driftAlarm ? 'border-warn/35' : 'border-line',
      )}
    >
      <header className="flex items-start gap-2.5 border-b border-line px-3 py-2.5">
        <span
          className={cn(
            'relative flex h-8 w-8 shrink-0 items-center justify-center rounded-md border text-[11px] font-semibold',
            agent.origin === 'client' ? 'border-info/40 bg-info/10 text-info' : 'border-agent/40 bg-agent/10 text-agent',
          )}
        >
          {agent.name.slice(0, 2)}
          {working && <span className="absolute -bottom-0.5 -right-0.5 h-2 w-2 rounded-full border-2 border-surface bg-ok" />}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <Link to={`/atlas/agent/${agent.id}`} className="truncate text-xs font-medium text-ink hover:text-brand-ink hover:underline">
              {agent.name}
            </Link>
            {agent.origin === 'client' && <Chip tone="info">client-owned</Chip>}
            {agent.driftAlarm && <Chip tone="warn">drift</Chip>}
            {agent.state !== 'active' && <Chip tone={agent.state === 'suspended' ? 'crit' : 'warn'}>{agent.state}</Chip>}
          </div>
          <p className="mt-0.5 truncate text-2xs text-ink-3">{agent.codename}</p>
        </div>
        <AutonomyChip mode={agent.ceiling} />
      </header>

      <div className="min-h-[74px] px-3 py-2.5">
        <div className="flex items-center gap-1.5">
          {working ? (
            <>
              <span className="relative h-[3px] w-10 overflow-hidden rounded-full bg-sunken">
                <span className="absolute inset-y-0 w-1/2 animate-agent-work rounded-full bg-brand" />
              </span>
              <span className="text-2xs text-ink-3">{phase}</span>
            </>
          ) : (
            <>
              <Dot tone="neutral" />
              <span className="text-2xs text-ink-3">{agent.state === 'suspended' ? 'stopped' : 'not in production'}</span>
            </>
          )}
        </div>
        <p className="mt-1.5 text-2xs leading-relaxed text-ink-2">
          <StreamText key={line} text={line} speed={11} />
        </p>
      </div>

      <div className="grid grid-cols-3 gap-2 border-t border-line px-3 py-2">
        <div>
          <div className="label-cap">Live success</div>
          <div className={cn('tnum text-2xs font-medium', agent.evaluation.liveSuccess90d >= 0.97 ? 'text-ok' : agent.evaluation.liveSuccess90d > 0 ? 'text-warn' : 'text-ink-3')}>
            {agent.evaluation.liveSuccess90d ? pct(agent.evaluation.liveSuccess90d * 100) : '—'}
          </div>
        </div>
        <div>
          <div className="label-cap">Cost 30d</div>
          <div className="tnum text-2xs text-ink-2">{usd(agent.economics.costUsd30d)}</div>
        </div>
        <div>
          <div className="label-cap">Displaced</div>
          <div className="tnum text-2xs text-ink-2">{num(Math.round(displacedHrs))} h</div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-1 border-t border-line px-3 py-2">
        {Object.entries(agent.grants).slice(0, 5).map(([ac, g]) => <GradeChip key={ac} grade={g} ac={ac} />)}
        <span className="ml-auto flex items-center gap-1.5">
          <Sparkline data={agent.trend.filter((x) => x > 0)} tone={agent.driftAlarm ? 'warn' : 'ok'} width={46} height={14} showLast />
          {role.canApprove && (
            agent.state === 'suspended' ? (
              <Button size="sm" variant="ghost" onClick={() => reinstate(agent.id, role.person)} title="Reinstate at probation"><Play size={11} /></Button>
            ) : (
              <Button size="sm" variant="ghost" onClick={() => suspend(agent.id, role.person, 'suspended from the workforce view')} title="Suspend — client-visible, evidenced"><Pause size={11} /></Button>
            )
          )}
        </span>
      </div>
    </article>
  )
}

export function AgentWorkforce() {
  const agents = useAstra((s) => s.agents)
  const tick = useAstra((s) => s.tick)
  const brake = useAstra((s) => s.brake)
  const mi = useAstra((s) => s.mi)
  const setBrake = useAstra((s) => s.setBrake)
  const roleId = useAstra((s) => s.roleId)
  const role = ROLE_BY_ID[roleId]
  const [filter, setFilter] = React.useState<'all' | 'artizent' | 'client'>('all')

  const list = Object.values(agents)
    .filter((a) => filter === 'all' || a.origin === filter)
    .sort((a, b) => {
      const pin = (x: Agent) => (x.state === 'suspended' ? 0 : x.state === 'probation' ? 1 : x.driftAlarm ? 2 : 3)
      return pin(a) - pin(b) || b.economics.humanMinsDisplaced30d - a.economics.humanMinsDisplaced30d
    })

  const all = Object.values(agents)
  const working = all.filter((a) => a.state === 'active').length
  const spend = all.reduce((s, a) => s + a.economics.costUsd30d, 0)
  const displaced = (all.reduce((s, a) => s + a.economics.humanMinsDisplaced30d, 0) / 60) * 78
  const capped = brake.global || mi.active

  return (
    <>
      <PageHeader
        title="Agent Workforce"
        subtitle="Live agent activity across every tower"
        meta={
          <Chip tone={capped ? 'crit' : 'ok'}>
            <Dot tone={capped ? 'crit' : 'ok'} pulse={!capped} />
            {capped ? 'capped at L1 Advise' : `${working} active`}
          </Chip>
        }
        actions={
          <>
            <div className="flex rounded border border-line-strong p-0.5">
              {(['all', 'artizent', 'client'] as const).map((f) => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={cn('rounded-xs px-2 py-0.5 text-2xs font-medium capitalize transition-colors', filter === f ? 'bg-raised text-ink' : 'text-ink-3 hover:text-ink-2')}
                >
                  {f}
                </button>
              ))}
            </div>
            {role.canApprove && (
              <Button size="sm" variant={brake.global ? 'danger' : 'default'} onClick={() => setBrake('global', !brake.global, role.person)}>
                <ShieldAlert size={12} /> {brake.global ? 'Release brake' : 'Apply brake'}
              </Button>
            )}
          </>
        }
      />

      {capped && (
        <div className="flex shrink-0 items-center gap-2 border-b border-crit/35 bg-crit/[0.06] px-4 py-2">
          <ShieldAlert size={13} className="shrink-0 text-crit" />
          <p className="text-2xs leading-relaxed text-ink-2">
            {mi.active
              ? 'A major incident is open. Every policy carries the override incident.major_active == true → max_mode advise, so the whole workforce is at L1 and in-flight supervised runs paused at their next checkpoint.'
              : 'The platform-wide brake is applied. Every agent is at L1 Advise; work continues through humans via the mirrored ITSM. Applying and releasing it are both evidenced.'}
          </p>
        </div>
      )}

      <div className="grid shrink-0 grid-cols-2 gap-4 border-b border-line bg-surface px-4 py-2.5 md:grid-cols-5">
        <Metric size="sm" label="Agents active" value={`${working} / ${all.length}`} hint="suspended and onboarding agents are routed no work" />
        <Metric size="sm" label="Client-owned, managed" value={all.filter((a) => a.origin === 'client').length} hint="AgentOps as a service — same governance as ours" />
        <Metric size="sm" label="Model spend, 30d" value={usd(spend)} hint="metered per agent, skill and step" />
        <Metric size="sm" label="Human cost displaced" value={usd(displaced)} deltaTone="ok" />
        <Metric
          size="sm"
          label="Spend vs. displaced"
          value={pct((spend / displaced) * 100, 1)}
          deltaTone={(spend / displaced) * 100 <= 6 ? 'ok' : 'warn'}
          hint="design target ≤ 4–6% at steady state"
        />
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
          {list.map((a) => <AgentCard key={a.id} agent={a} />)}
        </div>
      </div>
    </>
  )
}

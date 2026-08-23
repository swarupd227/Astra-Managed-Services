import React from 'react'
import { Link } from 'react-router-dom'
import { Bot, Eye, Loader2, PauseCircle, TimerReset, TrendingUp } from 'lucide-react'
import { useAstra } from '@/domain/store'
import { AGENTS, TOWERS } from '@/domain/estate'
import { ROLES } from '@/domain/reference'
import { AutonomyChip, Avatar } from './domain'
import { Chip, Dot } from './primitives'
import { cn, pct, usd } from '@/lib/format'
import type { Agent, WorkObject } from '@/domain/types'

/* ==========================================================================
   The Workforce panel (Addendum A §A3.1, D1).

   Agents and humans on shift as peers. The live state is derived from the
   work each agent actually holds, so an "executing" chip is bound to real
   work rather than being decorative telemetry (§A7.3: presence semantics are
   honest, not theatrical).
   ========================================================================== */

export type LiveState = 'executing' | 'awaiting' | 'watching' | 'suspended'

const LIVE_META: Record<LiveState, { label: string; icon: typeof Eye; tone: 'brand' | 'warn' | 'ok' | 'crit' }> = {
  executing: { label: 'executing', icon: Loader2, tone: 'brand' },
  awaiting: { label: 'awaiting you', icon: TimerReset, tone: 'warn' },
  watching: { label: 'watching', icon: Eye, tone: 'ok' },
  suspended: { label: 'suspended', icon: PauseCircle, tone: 'crit' },
}

export function liveStateOf(agent: Agent, work: WorkObject[]): { state: LiveState; executing: number; awaiting: number; towers: number } {
  if (agent.state === 'suspended') return { state: 'suspended', executing: 0, awaiting: 0, towers: agent.towers.length }

  const mine = work.filter((w) => w.assigneeKind === 'agent' && w.assignee === agent.id)
  const executing = mine.filter((w) => ['executing', 'verifying'].includes(w.state)).length
  const awaiting = mine.filter((w) => w.state === 'gated').length

  return {
    state: executing > 0 ? 'executing' : awaiting > 0 ? 'awaiting' : 'watching',
    executing,
    awaiting,
    towers: agent.towers.length,
  }
}

function AgentRow({ agent, work }: { agent: Agent; work: WorkObject[] }) {
  const live = liveStateOf(agent, work)
  const meta = LIVE_META[live.state]
  const Icon = meta.icon

  return (
    <Link
      to={`/atlas/agent/${agent.id}`}
      className="group flex items-start gap-2 border-b border-line/50 px-3 py-2 transition-colors hover:bg-raised"
    >
      <span
        className={cn(
          'mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border',
          live.state === 'executing' && 'border-brand bg-brand/20 text-brand-ink',
          live.state === 'awaiting' && 'border-warn/50 bg-warn/15 text-warn',
          live.state === 'watching' && 'border-agent/40 bg-agent/10 text-agent',
          live.state === 'suspended' && 'border-crit/50 bg-crit/15 text-crit',
        )}
      >
        <Bot size={11} strokeWidth={2.2} />
      </span>

      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1.5">
          <span className="truncate text-xs font-medium text-ink group-hover:text-brand-ink">{agent.name}</span>
          <AutonomyChip mode={agent.ceiling} />
        </span>
        <span className="mt-0.5 flex items-center gap-1 text-2xs text-ink-3">
          <Icon size={9} className={cn('shrink-0', live.state === 'executing' && 'animate-spin')} />
          <span className="truncate">
            {live.state === 'executing'
              ? `executing ${live.executing}`
              : live.state === 'awaiting'
                ? `awaiting you · ${live.awaiting}`
                : live.state === 'suspended'
                  ? 'suspended'
                  : `watching ${live.towers} tower${live.towers === 1 ? '' : 's'}`}
          </span>
          {/* The cost-today micro-meter the Agent Chip spec asks for. */}
          <span className="tnum ml-auto shrink-0 opacity-70">{usd(agent.economics.costUsd30d / 30)}</span>
        </span>
      </span>
    </Link>
  )
}

export function WorkforcePanel({ tower = 'all' }: { tower?: string }) {
  const work = useAstra((s) => s.work)
  const agentMap = useAstra((s) => s.agents)
  const tick = useAstra((s) => s.tick)

  const workList = React.useMemo(() => Object.values(work), [work, tick])

  const agents = React.useMemo(
    () =>
      Object.values(agentMap)
        .filter((a) => tower === 'all' || a.towers.includes(tower))
        .sort((a, b) => {
          const rank = { executing: 0, awaiting: 1, watching: 2, suspended: 3 }
          return rank[liveStateOf(a, workList).state] - rank[liveStateOf(b, workList).state]
        }),
    [agentMap, tower, workList],
  )

  const humans = ROLES.filter((r) => r.org === 'artizent').slice(0, 4)

  // Autonomy for the scope in view — permanently on display, per D6.
  // autonomyEligibleVolume is already a percentage, not a 0–1 fraction.
  const scopeTowers = tower === 'all' ? TOWERS.filter((t) => t.state === 'S4') : TOWERS.filter((t) => t.id === tower)
  const autonomy = scopeTowers.length
    ? scopeTowers.reduce((s, t) => s + t.autonomyEligibleVolume, 0) / scopeTowers.length
    : 0

  const executing = agents.filter((a) => liveStateOf(a, workList).state === 'executing').length

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex shrink-0 items-center gap-1.5 border-b border-line px-3 py-2">
        <span className="label-cap">On shift</span>
        <Chip tone={executing ? 'brand' : 'neutral'}>
          <Dot tone={executing ? 'brand' : 'neutral'} pulse={executing > 0} />
          {executing} working
        </Chip>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {agents.map((a) => <AgentRow key={a.id} agent={a} work={workList} />)}

        <div className="flex flex-wrap items-center gap-1.5 px-3 py-2.5">
          {humans.map((h) => (
            <span key={h.id} title={`${h.person} — ${h.title}`}>
              <Avatar name={h.person} size={20} />
            </span>
          ))}
          <span className="text-2xs text-ink-3">+{humans.length} humans on shift</span>
        </div>
      </div>

      {/* D6: autonomy level and trajectory sit here permanently — the
          commercial promise made ambient rather than filed on a report. */}
      <div className="shrink-0 border-t border-line px-3 py-2.5">
        <div className="flex items-baseline justify-between gap-2">
          <span className="label-cap">Autonomy</span>
          <span className="tnum inline-flex items-center gap-1 text-2xs font-medium text-ok">
            <TrendingUp size={10} />
            {pct(autonomy, 0)}
          </span>
        </div>
        <div className="mt-1.5 h-[5px] w-full overflow-hidden rounded-full bg-sunken">
          <div className="h-full rounded-full bg-ok transition-[width] duration-700 ease-snap" style={{ width: `${Math.min(100, autonomy)}%` }} />
        </div>
        <p className="mt-1.5 text-2xs leading-relaxed text-ink-3">
          of eligible volume, {tower === 'all' ? 'across steady-run towers' : 'in this tower'}
        </p>
      </div>
    </div>
  )
}

import React from 'react'
import { Bot, Check, Coins, Gauge, Send, ShieldCheck, Target, Timer, X } from 'lucide-react'
import { useAstra } from '@/domain/store'
import { ROLE_BY_ID, AC } from '@/domain/reference'
import { AGENTS, TOWERS, AGENT_BY_ID } from '@/domain/estate'
import {
  BUDGET_WARN, MISSION_STATE_META, budgetUse, missionCeiling, type Mission,
} from '@/domain/missions'
import { AgentChip, AutonomyChip, PageHeader } from '@/ui/domain'
import { Button, Card, Chip, Dot, Empty, Field, Metric, inputClass, selectClass } from '@/ui/primitives'
import { cn, usd } from '@/lib/format'

/* ==========================================================================
   Missions (Addendum A §A4).

   Standing, goal-directed delegation. The screen has to make three things
   legible at a glance, because they are what a client is being asked to trust:
   what the mission is pursuing, what it has spent, and what it is not allowed
   to do.
   ========================================================================== */

function BudgetBar({ used, label, detail }: { used: number; label: string; detail: string }) {
  const tone = used >= 1 ? 'crit' : used >= BUDGET_WARN ? 'warn' : 'ok'
  const bar = { crit: 'bg-crit', warn: 'bg-warn', ok: 'bg-ok' }[tone]
  return (
    <div className="min-w-0">
      <div className="flex items-baseline justify-between gap-2">
        <span className="label-cap">{label}</span>
        <span className={cn('tnum text-2xs font-medium', used >= BUDGET_WARN ? 'text-warn' : 'text-ink-2')}>{detail}</span>
      </div>
      <div className="mt-1 h-[5px] w-full overflow-hidden rounded-full bg-sunken">
        <div className={cn('h-full rounded-full transition-[width] duration-700 ease-snap', bar)} style={{ width: `${Math.min(100, used * 100)}%` }} />
      </div>
    </div>
  )
}

function MissionCard({ m }: { m: Mission }) {
  const setMissionState = useAstra((s) => s.setMissionState)
  const chargeMission = useAstra((s) => s.chargeMission)
  const roleId = useAstra((s) => s.roleId)
  const role = ROLE_BY_ID[roleId]
  const use = budgetUse(m)
  const meta = MISSION_STATE_META[m.state]
  const tower = TOWERS.find((t) => t.id === m.tower)

  // What the mission would do to a supervised decision on its most permissive
  // class — the guardrail made visible rather than asserted.
  const sample = m.constraints.allow.find((c) => AC[c]?.floor === 'supervised') ?? m.constraints.allow[0] ?? 'AC-05'
  const ceiling = missionCeiling(m, 'supervised', sample)

  return (
    <Card
      title={m.name}
      subtitle={m.goal}
      right={
        <span className="flex items-center gap-1.5">
          <Chip tone={m.kind === 'standing' ? 'brand' : 'info'}>{m.kind}</Chip>
          <Chip tone={meta.tone}><Dot tone={meta.tone} pulse={m.state === 'active'} />{meta.label}</Chip>
        </span>
      }
    >
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-2xs text-ink-3">
        <span>{tower?.name ?? m.tower}</span>
        <span>·</span>
        <span>owner {m.owner}</span>
        <span>·</span>
        <span>sponsor {m.sponsor}</span>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-1.5">
        <span className="label-cap mr-1">Workforce</span>
        {m.workforce.map((id) => <AgentChip key={id} id={id} />)}
      </div>

      <div className="mt-3 grid gap-3 border-t border-line pt-3 sm:grid-cols-2">
        <BudgetBar used={use.spend} label="Spend budget" detail={`${usd(m.consumed.spendUsd)} of ${usd(m.constraints.spendBudgetUsd)}`} />
        <BudgetBar used={use.runs} label="Run budget" detail={`${m.consumed.runs} of ${m.constraints.runBudget} runs`} />
      </div>

      <div className="mt-3 rounded border border-line bg-sunken px-3 py-2.5">
        <div className="flex items-center gap-1.5">
          <ShieldCheck size={12} className="shrink-0 text-ok" />
          <span className="label-cap">Policy precedence</span>
        </div>
        {m.constraints.deny.length > 0 && (
          <p className="mt-1.5 text-2xs text-ink-3">
            Denied outright: <span className="font-mono">{m.constraints.deny.join(', ')}</span>
          </p>
        )}
      </div>

      <div className="mt-3 border-t border-line pt-3">
        <p className="label-cap mb-1.5">Plan read-back {m.plan.acknowledged && <Check size={10} className="ml-1 inline text-ok" />}</p>
        <ul className="space-y-1 text-2xs leading-relaxed text-ink-2">
          <li>· Watching: {m.plan.watching.join(', ')}</li>
          <li>· Pre-positioned: {m.plan.prepositioned.join(', ')}</li>
          {m.plan.decisionPoints.map((d) => <li key={d}>· {d}</li>)}
        </ul>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-line pt-3">
        <span className="text-2xs text-ink-3">
          Escalates to <span className="font-medium text-ink-2">{m.escalation.pageRole}</span> on {m.escalation.on.join(', ')}
        </span>
        <span className="ml-auto flex items-center gap-1.5">
          {/* Charging the mission is how a run reports its cost back. Exposed
              here so the budget guardrail can be seen to bite. */}
          <Button
            size="sm"
            variant="ghost"
            disabled={m.state !== 'active'}
            title="Simulate one run charging against this mission's budget"
            onClick={() => chargeMission(m.id, m.constraints.spendBudgetUsd * 0.09, 1)}
          >
            <Coins size={11} /> Charge a run
          </Button>
          {m.state === 'active' ? (
            <Button size="sm" variant="ghost" onClick={() => setMissionState(m.id, 'paused', role.person)}>Pause</Button>
          ) : m.state === 'paused' || m.state === 'exhausted' ? (
            <Button size="sm" variant="default" onClick={() => setMissionState(m.id, 'active', role.person)}>Resume</Button>
          ) : null}
        </span>
      </div>
    </Card>
  )
}

/* ------------------------------- Delegate ---------------------------------- */

const CLASS_OPTIONS = ['AC-05', 'AC-08', 'AC-12', 'AC-18', 'AC-24', 'AC-31', 'AC-41']

function Composer({ onClose }: { onClose: () => void }) {
  const delegateMission = useAstra((s) => s.delegateMission)
  const roleId = useAstra((s) => s.roleId)
  const role = ROLE_BY_ID[roleId]

  const [goal, setGoal] = React.useState('')
  const [tower, setTower] = React.useState(TOWERS[0]?.id ?? '')
  const [spend, setSpend] = React.useState(120)
  const [runs, setRuns] = React.useState(60)
  const [allow, setAllow] = React.useState<string[]>(['AC-05', 'AC-08', 'AC-12'])
  const [team, setTeam] = React.useState<string[]>(['agt_sentinel', 'agt_diagnost'])

  const toggle = (list: string[], set: (v: string[]) => void, v: string) =>
    set(list.includes(v) ? list.filter((x) => x !== v) : [...list, v])

  const submit = () => {
    if (!goal.trim()) return
    delegateMission(
      {
        name: goal.trim().slice(0, 48),
        kind: 'episodic',
        goal: goal.trim(),
        tower,
        owner: role.person,
        sponsor: role.title,
        workforce: team,
        constraints: {
          maxMode: 'policy_defaults',
          allow,
          deny: ['AC-71', 'AC-58'],
          honourFreeze: true,
          spendBudgetUsd: spend,
          runBudget: runs,
        },
        escalation: { pageRole: 'sdm_oncall', on: ['novel_class', 'confidence < 0.8', 'budget 80%'] },
        reporting: ['on completion'],
        window: { from: new Date().toISOString(), to: new Date().toISOString() },
        plan: {
          watching: [TOWERS.find((t) => t.id === tower)?.name ?? tower],
          prepositioned: ['runbooks matching the allowed classes'],
          decisionPoints: ['Anything outside the allowed classes stops for a human'],
          acknowledged: false,
        },
      },
      role.person,
    )
    onClose()
  }

  return (
    <Card
      title="Delegate a mission"
      subtitle="Outcome, limits and budgets"
      right={<Button size="sm" variant="ghost" onClick={onClose}><X size={12} /></Button>}
    >
      <Field label="Goal" hint="An outcome, not a task. The workforce decides how.">
        <input
          value={goal}
          onChange={(e) => setGoal(e.target.value)}
          placeholder="Keep the FOCUS weekly billing run inside its 90-minute objective over the release weekend"
          className={inputClass}
        />
      </Field>

      <div className="mt-3 grid gap-3 sm:grid-cols-3">
        <Field label="Tower">
          <select value={tower} onChange={(e) => setTower(e.target.value)} className={selectClass}>
            {TOWERS.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
        </Field>
        <Field label="Spend budget (USD)">
          <input type="number" min={10} value={spend} onChange={(e) => setSpend(Number(e.target.value))} className={inputClass} />
        </Field>
        <Field label="Run budget">
          <input type="number" min={1} value={runs} onChange={(e) => setRuns(Number(e.target.value))} className={inputClass} />
        </Field>
      </div>

      <div className="mt-3">
        <p className="label-cap mb-1.5">Allowed action classes</p>
        <div className="flex flex-wrap gap-1.5">
          {CLASS_OPTIONS.map((c) => (
            <button
              key={c}
              onClick={() => toggle(allow, setAllow, c)}
              className={cn(
                'rounded-xs border px-2 py-1 font-mono text-2xs transition-colors',
                allow.includes(c) ? 'border-brand bg-brand/15 text-ink' : 'border-line text-ink-3 hover:border-line-strong',
              )}
              title={AC[c]?.name}
            >
              {c}
            </button>
          ))}
        </div>
        <p className="mt-1.5 text-2xs text-ink-3">
          AC-71 and AC-58 are denied on every mission.
        </p>
      </div>

      <div className="mt-3">
        <p className="label-cap mb-1.5">Workforce</p>
        <div className="flex flex-wrap gap-1.5">
          {AGENTS.slice(0, 8).map((a) => (
            <button
              key={a.id}
              onClick={() => toggle(team, setTeam, a.id)}
              className={cn(
                'inline-flex items-center gap-1 rounded-xs border px-2 py-1 text-2xs transition-colors',
                team.includes(a.id) ? 'border-agent bg-agent/15 text-ink' : 'border-line text-ink-3 hover:border-line-strong',
              )}
            >
              <Bot size={10} />{a.name}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-3 flex items-center gap-2 border-t border-line pt-3">
        <Button variant="primary" disabled={!goal.trim() || !team.length} onClick={submit}>
          <Send size={12} /> Delegate
        </Button>
      </div>
    </Card>
  )
}

/* -------------------------------- Screen ----------------------------------- */

export function Missions() {
  const missions = useAstra((s) => s.missions)
  const [composing, setComposing] = React.useState(false)

  const all = Object.values(missions)
  const active = all.filter((m) => m.state === 'active')
  const standing = all.filter((m) => m.kind === 'standing')
  const spend = all.reduce((s, m) => s + m.consumed.spendUsd, 0)
  const atRisk = all.filter((m) => budgetUse(m).worst >= BUDGET_WARN && m.state === 'active').length

  return (
    <>
      <PageHeader
        title="Missions"
        subtitle="Standing delegations with goals and budgets"
        meta={
          <Chip tone={atRisk ? 'warn' : 'ok'}>
            <Dot tone={atRisk ? 'warn' : 'ok'} pulse={active.length > 0} />
            {active.length} active
          </Chip>
        }
        actions={
          !composing && (
            <Button size="sm" variant="primary" onClick={() => setComposing(true)}>
              <Target size={11} /> Delegate
            </Button>
          )
        }
      />

      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        <div className="mx-auto max-w-4xl space-y-4">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Metric size="sm" label="Active" value={active.length} />
            <Metric size="sm" label="Standing" value={standing.length} />
            <Metric size="sm" label="Spend to date" value={usd(spend)} />
            <Metric size="sm" label="Near budget" value={atRisk} hint="at or past 80%" />
          </div>

          {composing && <Composer onClose={() => setComposing(false)} />}

          {all.length === 0 ? (
            <Empty title="No missions" body="No missions yet." />
          ) : (
            all
              .sort((a, b) => Number(b.state === 'active') - Number(a.state === 'active'))
              .map((m) => <MissionCard key={m.id} m={m} />)
          )}
        </div>
      </div>
    </>
  )
}

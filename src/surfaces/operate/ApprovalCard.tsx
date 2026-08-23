import React from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, GitBranch, ShieldCheck, Undo2 } from 'lucide-react'
import { AC } from '@/domain/reference'
import { AGENT_BY_ID, TOWER_BY_ID } from '@/domain/estate'
import { useAstra } from '@/domain/store'
import { ROLE_BY_ID } from '@/domain/reference'
import { AgentChip, AutonomyChip, EvidenceLink, GradeChip, PriorityChip, SlaClock } from '@/ui/domain'
import { Button, Chip, Field, inputClass, selectClass } from '@/ui/primitives'
import { cn, clock, pct } from '@/lib/format'
import type { WorkObject } from '@/domain/types'

/**
 * The approval card is a complete decision package — what, why, blast radius,
 * safety, agent record, policy — sized for a defensible yes or no in about
 * thirty seconds. The same anatomy renders on desktop, mobile and chat.
 *
 * "Modify" opens a constrained editor over policy-bounded parameters only.
 * Free-text override is deliberately impossible: a changed plan re-enters
 * policy evaluation.
 */
export function ApprovalCard({ wo, onDone, compactMode }: { wo: WorkObject; onDone?: () => void; compactMode?: boolean }) {
  const approve = useAstra((s) => s.approve)
  const reject = useAstra((s) => s.reject)
  const escalate = useAstra((s) => s.escalate)
  const modifyPlan = useAstra((s) => s.modifyPlan)
  const runs = useAstra((s) => s.runs)
  const roleId = useAstra((s) => s.roleId)
  const role = ROLE_BY_ID[roleId]

  const [mode, setMode] = React.useState<'idle' | 'modify' | 'reject'>('idle')
  const [param, setParam] = React.useState('conn_pool.max')
  const [value, setValue] = React.useState('500')
  const [reason, setReason] = React.useState('')

  const a = wo.autonomy
  if (!a) return null

  const run = wo.runId ? runs[wo.runId] : undefined
  const mutating = run?.steps.filter((s) => s.kind === 'tool') ?? []
  const primary = AC[a.actionClasses[0]]
  const agentId = wo.assigneeKind === 'agent' ? wo.assignee! : 'agt_remedian'
  const agent = AGENT_BY_ID[agentId]
  const gate = a.gates[0]
  const timeoutRemaining = Math.max(0, (gate?.timeoutSec ?? 600) / 60 - (wo.slaElapsedMins % ((gate?.timeoutSec ?? 600) / 60)))
  const tower = TOWER_BY_ID[wo.tower]

  const Row = ({ k, children }: { k: string; children: React.ReactNode }) => (
    <div className="flex gap-2.5 border-b border-line/60 px-3 py-2 last:border-b-0">
      <span className="w-[52px] shrink-0 pt-[1px] text-2xs font-semibold uppercase tracking-[0.08em] text-ink-3">{k}</span>
      <div className="min-w-0 flex-1 text-2xs leading-relaxed text-ink-2">{children}</div>
    </div>
  )

  return (
    <article className={cn('flex min-w-0 flex-col overflow-hidden rounded-md border border-warn/45 bg-surface', compactMode ? '' : 'shadow-card')}>
      <header className="flex flex-wrap items-center gap-2 border-b border-warn/35 bg-warn/[0.08] px-3 py-2">
        <Chip tone="warn">Approval</Chip>
        <span className="font-mono text-2xs text-ink-2">{a.actionClasses.join(' + ')}</span>
        <span className="truncate text-2xs text-ink-2">{primary?.name}</span>
        <span className="text-2xs text-ink-3">·</span>
        <span className="truncate text-2xs text-ink-2">{wo.service}</span>
        <Chip tone={a.blastRadius.maxTier === 0 ? 'crit' : 'neutral'}>tier {a.blastRadius.maxTier}</Chip>
        <span className="ml-auto flex items-center gap-2">
          <PriorityChip p={wo.priority} />
          <span className="w-[72px]"><SlaClock elapsed={wo.slaElapsedMins} target={wo.slaTargetMins} compactMode /></span>
        </span>
      </header>

      <div>
        <Row k="What">
          <div className="flex flex-wrap items-center gap-1.5">
            {mutating.map((s) => (
              <span key={s.id} className="rounded-xs border border-line bg-sunken px-1.5 py-0.5 font-mono text-2xs text-ink">{s.label}</span>
            ))}
            {mutating.length === 0 && <span className="font-mono text-ink">{primary?.name}</span>}
          </div>
          <p className="mt-1 text-ink-3">
            Targets: {wo.affected.join(', ')} · reversibility <span className="text-ink-2">{primary?.reversibility.replace(/_/g, ' ')}</span>
          </p>
        </Row>

        <Row k="Why">
          {wo.narrative.find((n) => n.actor === 'Diagnost')?.text ??
            `Causal chain built from the Service Graph at ${pct(a.planConfidence * 100, 0)} confidence.`}
          {wo.narrative.find((n) => n.actor === 'Diagnost')?.evidenceId && (
            <EvidenceLink id={wo.narrative.find((n) => n.actor === 'Diagnost')!.evidenceId!} className="ml-1" />
          )}
        </Row>

        <Row k="Blast">
          <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <span><span className="tnum text-ink">{a.blastRadius.services}</span> service{a.blastRadius.services === 1 ? '' : 's'}</span>
            <span><span className="tnum text-ink">{a.blastRadius.dependents}</span> dependent{a.blastRadius.dependents === 1 ? '' : 's'}</span>
            <span>max tier <span className="tnum text-ink">{a.blastRadius.maxTier}</span></span>
            <span className={a.blastRadius.dataMutation ? 'text-crit' : 'text-ok'}>
              {a.blastRadius.dataMutation ? 'mutates data' : 'no data mutation'}
            </span>
            <Link to="/operate/graph" className="inline-flex items-center gap-1 text-brand-ink hover:underline" onClick={(e) => e.stopPropagation()}>
              <GitBranch size={10} />view graph
            </Link>
          </span>
          {tower?.regulatory.length ? (
            <p className="mt-1 text-ink-3">Regulatory tags in scope: {tower.regulatory.join(', ')}</p>
          ) : null}
        </Row>

        <Row k="Safety">
          <ul className="space-y-0.5">
            {mutating.filter((s) => s.compensation).map((s) => (
              <li key={s.id} className="flex items-start gap-1.5">
                <Undo2 size={10} className="mt-[3px] shrink-0 text-ok" />
                <span>Rollback: <span className="text-ink">{s.compensation}</span></span>
              </li>
            ))}
            <li className="flex items-start gap-1.5">
              <ShieldCheck size={10} className="mt-[3px] shrink-0 text-ok" />
              <span>Verification pack <span className="font-mono text-ink">{primary?.verificationPack}</span> runs before the object can reach Resolved.</span>
            </li>
          </ul>
        </Row>

        <Row k="Agent">
          <span className="flex flex-wrap items-center gap-1.5">
            <AgentChip id={agentId} />
            {a.actionClasses.map((c) => (
              <GradeChip key={c} grade={a.agentGrades[c] ?? 'C'} ac={c} />
            ))}
            <span className="text-ink-3">
              live success <span className="tnum text-ink-2">{pct((agent?.evaluation.liveSuccess90d ?? 0) * 100)}</span> over 90d ·{' '}
              {agent?.incidents.length ? (
                <span className="text-warn">last incident {agent.incidents[0].id}</span>
              ) : (
                <span className="text-ok">no incidents</span>
              )}
            </span>
          </span>
        </Row>

        <Row k="Policy">
          <span className="flex flex-wrap items-center gap-1.5">
            <Link to="/atlas/policy" className="font-mono text-brand-ink hover:underline">{a.policyId} {a.policyVersion}</Link>
            <ArrowRight size={10} className="text-ink-3" />
            <AutonomyChip mode={a.mode} full />
            <span className="text-ink-3">decided in {a.evaluatedInMs} ms</span>
          </span>
          <ul className="mt-1 space-y-0.5 text-ink-3">
            {a.reasons.map((r) => <li key={r}>· {r}</li>)}
          </ul>
          <p className="mt-1 text-ink-3">
            You are: <span className="text-ink-2">{role.title}</span> · gate role <span className="text-ink-2">{gate?.role}</span>
          </p>
        </Row>
      </div>

      {mode === 'modify' && (
        <div className="grid gap-2 border-t border-line bg-raised px-3 py-2.5 sm:grid-cols-[1fr_1fr_auto]">
          <Field label="Parameter (policy-bounded)">
            <select value={param} onChange={(e) => setParam(e.target.value)} className={selectClass}>
              <option value="conn_pool.max">conn_pool.max</option>
              <option value="canary_percentage">canary_percentage</option>
              <option value="restart_batch_size">restart_batch_size</option>
            </select>
          </Field>
          <Field label="Value" hint="Free-text override is not offered — the plan re-enters policy evaluation.">
            <input value={value} onChange={(e) => setValue(e.target.value)} className={inputClass} />
          </Field>
          <div className="flex items-end gap-1.5">
            <Button variant="primary" onClick={() => { modifyPlan(wo.id, role.person, param, value); setMode('idle') }}>Re-evaluate</Button>
            <Button variant="ghost" onClick={() => setMode('idle')}>Cancel</Button>
          </div>
        </div>
      )}

      {mode === 'reject' && (
        <div className="grid gap-2 border-t border-line bg-raised px-3 py-2.5 sm:grid-cols-[1fr_auto]">
          <Field label="Reason (recorded as evidence and scored against the agent)">
            <input autoFocus value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. quarter-end volume peak starts in 20 minutes" className={inputClass} />
          </Field>
          <div className="flex items-end gap-1.5">
            <Button variant="danger" disabled={!reason.trim()} onClick={() => { reject(wo.id, role.person, reason.trim()); setMode('idle'); onDone?.() }}>Confirm reject</Button>
            <Button variant="ghost" onClick={() => setMode('idle')}>Cancel</Button>
          </div>
        </div>
      )}

      <footer className="flex flex-wrap items-center gap-1.5 border-t border-line bg-raised px-3 py-2">
        <Button
          variant="primary"
          disabled={!role.canApprove}
          title={role.canApprove ? undefined : `${role.title} does not hold the approval pen for this gate`}
          onClick={() => { approve(wo.id, role.person); onDone?.() }}
        >
          Approve
        </Button>
        <Button variant="default" disabled={!role.canApprove} onClick={() => setMode('modify')}>Modify…</Button>
        <Button variant="default" disabled={!role.canApprove} onClick={() => setMode('reject')}>Reject</Button>
        <Button variant="ghost" disabled={!role.canApprove} onClick={() => { escalate(wo.id, role.person); onDone?.() }}>Escalate</Button>
        <span className="ml-auto text-2xs text-ink-3">
          escalates to {gate?.escalatesTo} in <span className="tnum text-warn">{clock(timeoutRemaining)}</span> if unactioned
        </span>
      </footer>
    </article>
  )
}

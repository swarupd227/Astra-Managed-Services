import React from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  ArrowUp, Ban, Check, CircleDot, Coins, Cpu, FileCheck2, Layers, Radar, ShieldAlert,
  ShieldCheck, Sparkles, Square, Target, TriangleAlert, Undo2, X,
} from 'lucide-react'
import { buildSuggestions, decide, execute, runIntent, type Beat, type AgentProposal } from '@/domain/agentRuntime'
import { AGENT_BY_ID } from '@/domain/estate'
import { AC, ROLE_BY_ID } from '@/domain/reference'
import { useAstra, useWorkList } from '@/domain/store'
import { NOW } from '@/domain/workSeed'
import { modeLabel } from '@/domain/policyEngine'
import { AgentChip, AutonomyChip, EvidenceLink, GradeChip, PageHeader } from '@/ui/domain'
import { Button, Card, Chip, Dot } from '@/ui/primitives'
import { StreamText } from '@/ui/StreamText'
import { cn, mins, num, pct, usd } from '@/lib/format'

/* ------------------------------- Beat blocks ------------------------------- */

function AgentLine({ agentId, children, tone = 'agent' }: { agentId: string; children: React.ReactNode; tone?: 'agent' | 'ok' | 'crit' }) {
  const a = AGENT_BY_ID[agentId]
  return (
    <div className="flex gap-3">
      <div className="flex w-7 shrink-0 flex-col items-center pt-0.5">
        <span
          className={cn(
            'flex h-7 w-7 items-center justify-center rounded-md border text-[11px] font-semibold',
            tone === 'crit' ? 'border-crit/40 bg-crit/10 text-crit' : tone === 'ok' ? 'border-ok/40 bg-ok/10 text-ok' : 'border-agent/40 bg-agent/10 text-agent',
          )}
          title={a?.mission}
        >
          {a ? a.name.slice(0, 2) : '··'}
        </span>
      </div>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  )
}

function BeatBlock({ beat, live, onGate }: { beat: Beat; live: boolean; onGate?: (d: 'approve' | 'reject') => void }) {
  const roleId = useAstra((s) => s.roleId)
  const role = ROLE_BY_ID[roleId]

  switch (beat.t) {
    case 'route':
      return (
        <div className="flex flex-wrap items-center gap-2 rounded-md border border-line bg-raised px-3 py-2">
          <Radar size={13} className="shrink-0 text-brand-ink" />
          <span className="text-2xs text-ink-2">Routed as</span>
          <Chip mono tone="brand">{beat.intent}</Chip>
          <span className="tnum text-2xs text-ink-3">{pct(beat.confidence * 100, 0)} confidence</span>
          <span className="text-2xs text-ink-3">→</span>
          <AgentChip id={beat.agent} />
          <span className="w-full text-2xs leading-relaxed text-ink-3">{beat.note}</span>
        </div>
      )

    case 'think':
      return (
        <AgentLine agentId={beat.agent}>
          <div className="flex items-baseline gap-2">
            <span className="text-2xs font-medium text-agent">{AGENT_BY_ID[beat.agent]?.name}</span>
            <span className="text-2xs text-ink-3">reasoning</span>
          </div>
          <p className="mt-1 text-xs leading-relaxed text-ink-2">
            <StreamText text={beat.text} instant={!live} />
          </p>
        </AgentLine>
      )

    case 'retrieve':
      return (
        <AgentLine agentId={beat.agent}>
          <div className="rounded-md border border-line bg-surface">
            <div className="flex flex-wrap items-center gap-2 border-b border-line px-3 py-1.5">
              <Layers size={12} className="shrink-0 text-ink-3" />
              <span className="text-2xs font-medium text-ink">Decision-scoped context assembled</span>
              <Chip mono className="ml-auto">{beat.pkg}</Chip>
            </div>
            <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 px-3 py-2 sm:grid-cols-4">
              {[
                { k: 'Assertions', v: num(beat.assertions) },
                { k: 'Human-verified', v: num(beat.humanVerified) },
                { k: 'Runbooks', v: num(beat.runbooks) },
                { k: 'Prior incidents', v: num(beat.priors) },
              ].map((x) => (
                <div key={x.k}>
                  <div className="label-cap">{x.k}</div>
                  <div className="tnum text-xs text-ink">{x.v}</div>
                </div>
              ))}
            </div>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-line px-3 py-1.5 text-2xs text-ink-3">
              <span>Verification floor enforced: <span className="font-mono text-ink-2">{beat.floor}</span></span>
              <span className="ml-auto tnum">
                {num(beat.tokensUsed)} / {num(beat.tokenBudget)} token budget
              </span>
              <span className="h-[3px] w-16 overflow-hidden rounded-full bg-sunken">
                <span className="block h-full rounded-full bg-brand" style={{ width: `${(beat.tokensUsed / beat.tokenBudget) * 100}%` }} />
              </span>
            </div>
          </div>
        </AgentLine>
      )

    case 'finding':
      return (
        <div className={cn('rounded-md border p-3', beat.severity === 'crit' ? 'border-crit/40 bg-crit/[0.05]' : beat.severity === 'warn' ? 'border-warn/40 bg-warn/[0.05]' : 'border-info/35 bg-info/[0.05]')}>
          <div className="flex flex-wrap items-center gap-2">
            <Chip tone={beat.severity === 'crit' ? 'crit' : beat.severity === 'warn' ? 'warn' : 'info'}>finding</Chip>
            <span className="min-w-0 flex-1 text-xs font-medium text-ink">{beat.title}</span>
            <span className="tnum text-2xs text-ink-3">{pct(beat.confidence * 100, 0)}</span>
          </div>
          <p className="mt-1.5 text-xs leading-relaxed text-ink-2">{beat.detail}</p>
        </div>
      )

    case 'plan':
      return (
        <div className="rounded-md border border-line bg-surface">
          <div className="flex flex-wrap items-center gap-2 border-b border-line px-3 py-1.5">
            <span className="text-2xs font-medium text-ink">Proposed plan</span>
            <Chip mono>{beat.skill}</Chip>
            <span className="tnum text-2xs text-ink-3">{pct(beat.success * 100)} success over {beat.runs} runs</span>
          </div>
          <ol className="divide-y divide-line">
            {beat.steps.map((st, i) => (
              <li key={i} className="flex gap-3 px-3 py-2">
                <span className="mt-px flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-sunken text-[10px] font-semibold text-ink-2">{i + 1}</span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="text-xs text-ink">{st.label}</span>
                    {st.ac && <Chip mono title={AC[st.ac]?.name}>{st.ac}</Chip>}
                  </div>
                  {st.compensation && (
                    <p className="mt-0.5 flex items-start gap-1 text-2xs text-ink-3">
                      <Undo2 size={10} className="mt-[3px] shrink-0 text-ok" />
                      <span>Compensation: <span className="text-ink-2">{st.compensation}</span></span>
                    </p>
                  )}
                </div>
              </li>
            ))}
          </ol>
        </div>
      )

    // A mission narrowing the engine's answer is stated in the open — a
    // constraint the operator cannot see is not one they can trust (§A4.2).
    case 'mission':
      return (
        <div className="rounded-md border border-agent/45 bg-agent/[0.06]">
          <div className="flex flex-wrap items-center gap-2 border-b border-line/70 px-3 py-2">
            <Target size={13} className="shrink-0 text-agent" />
            <span className="text-2xs font-medium text-ink">Mission constraint</span>
            <Link to="/missions" className="font-mono text-2xs text-agent hover:underline">{beat.missionId}</Link>
            <span className="ml-auto flex items-center gap-1.5">
              <AutonomyChip mode={beat.from} />
              <span className="text-ink-3">→</span>
              <AutonomyChip mode={beat.to} />
            </span>
          </div>
          <div className="px-3 py-2">
            <p className="text-2xs leading-relaxed text-ink-2">
              This run is being carried out under <span className="font-medium text-ink">{beat.name}</span> — {beat.goal}
            </p>
            <p className="mt-1 text-2xs leading-relaxed text-ink-3">{beat.reason}</p>
          </div>
        </div>
      )

    case 'policy': {
      const r = beat.result

      // Nothing was going to execute, so the engine evaluated a hypothetical.
      // A full decision card here is theatre: it implies a gate that was never
      // in play. One honest line, and the detail stays in the rail.
      if (beat.advisory) {
        return (
          <div className="flex flex-wrap items-center gap-2 rounded-md border border-line bg-sunken px-3 py-2">
            <ShieldCheck size={12} className="shrink-0 text-ink-3" />
            <span className="text-2xs text-ink-2">
              Read-only — no action proposed, so no autonomy decision was required.
            </span>
            <span className="ml-auto font-mono text-2xs text-ink-3">{beat.policyName}</span>
          </div>
        )
      }

      const tone = r.mode === 'autonomous' ? 'ok' : r.mode === 'supervised' ? 'brand' : r.mode === 'approve_first' ? 'warn' : 'crit'
      return (
        <div className={cn('rounded-md border', tone === 'ok' ? 'border-ok/40 bg-ok/[0.05]' : tone === 'brand' ? 'border-brand/50 bg-brand/[0.07]' : tone === 'warn' ? 'border-warn/40 bg-warn/[0.06]' : 'border-crit/40 bg-crit/[0.06]')}>
          <div className="flex flex-wrap items-center gap-2 border-b border-line/70 px-3 py-2">
            <ShieldCheck size={13} className="shrink-0 text-ink-2" />
            <span className="text-2xs font-medium text-ink">Autonomy Policy Engine</span>
            <span className="font-mono text-2xs text-ink-3">{beat.policyName}</span>
            <span className="ml-auto flex items-center gap-2">
              <AutonomyChip mode={r.mode} full />
              <span className="tnum text-2xs text-ink-3">{r.evaluatedInMs} ms</span>
            </span>
          </div>
          <div className="grid gap-x-4 gap-y-2 px-3 py-2 sm:grid-cols-2">
            <div>
              <div className="label-cap">Inputs evaluated</div>
              <ul className="mt-1 space-y-0.5 text-2xs text-ink-2">
                <li>Action class <span className="font-mono">{r.actionClasses.join(', ')}</span> · floor {modeLabel(r.floorApplied)}</li>
                <li>Blast radius: {r.blastRadius.services} service, {r.blastRadius.dependents} dependents, tier {r.blastRadius.maxTier}</li>
                <li className="flex flex-wrap items-center gap-1">
                  Agent standing:
                  {Object.entries(r.agentGrades).map(([ac, g]) => <GradeChip key={ac} grade={g} ac={ac} />)}
                </li>
                <li>Plan confidence <span className="tnum">{r.planConfidence.toFixed(2)}</span></li>
              </ul>
            </div>
            <div>
              <div className="label-cap">Why this mode</div>
              <ul className="mt-1 space-y-0.5 text-2xs text-ink-2">
                {r.reasons.slice(0, 4).map((x) => <li key={x}>· {x}</li>)}
              </ul>
              {r.overrides.length > 0 && (
                <ul className="mt-1 space-y-0.5 text-2xs text-crit">
                  {r.overrides.map((x) => <li key={x}>· {x}</li>)}
                </ul>
              )}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2 border-t border-line/70 px-3 py-1.5 text-2xs text-ink-3">
            <span>Decision written to evidence with its full input vector.</span>
            <Link to="/atlas/policy" className="ml-auto text-brand-ink hover:underline">Open the simulator →</Link>
          </div>
        </div>
      )
    }

    case 'gate':
      return (
        <div className="rounded-md border border-warn/50 bg-warn/[0.07]">
          <div className="flex flex-wrap items-center gap-2 px-3 py-2">
            <ShieldAlert size={13} className="shrink-0 text-warn" />
            <span className="text-xs font-medium text-ink">Held at a gate — a named human decides</span>
            <Chip tone="warn" className="ml-auto">{beat.role}</Chip>
          </div>
          <p className="px-3 pb-2 text-2xs leading-relaxed text-ink-2">
            Escalates to {beat.escalatesTo} in {Math.round(beat.timeoutSec / 60)} minutes if unactioned.
          </p>
          {onGate && (
            <div className="flex flex-wrap items-center gap-2 border-t border-warn/35 px-3 py-2">
              <Button variant="primary" disabled={!role.canApprove} onClick={() => onGate('approve')}>
                <Check size={12} /> Approve and execute
              </Button>
              <Button variant="default" disabled={!role.canApprove} onClick={() => onGate('reject')}>
                <X size={12} /> Reject
              </Button>
              {!role.canApprove && (
                <span className="text-2xs text-ink-3">{role.title} does not hold the approval pen for this gate.</span>
              )}
            </div>
          )}
        </div>
      )

    case 'exec':
      return (
        <div className="flex items-center gap-2.5 rounded-md border border-line bg-surface px-3 py-2">
          <Check size={13} className="shrink-0 text-ok" />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-baseline gap-2">
              <span className="text-2xs font-medium text-ink">Step {beat.stepIndex + 1} executed</span>
              <span className="tnum text-2xs text-ink-3">{(beat.ms / 1000).toFixed(1)}s</span>
            </div>
            <p className="mt-0.5 text-2xs text-ink-2">{beat.detail}</p>
          </div>
        </div>
      )

    case 'verify':
      return (
        <div className={cn('rounded-md border px-3 py-2', beat.result === 'green' ? 'border-ok/40 bg-ok/[0.05]' : 'border-warn/40 bg-warn/[0.05]')}>
          <div className="flex flex-wrap items-center gap-2">
            <FileCheck2 size={13} className={beat.result === 'green' ? 'text-ok' : 'text-warn'} />
            <span className="text-2xs font-medium text-ink">Verification pack</span>
            <Chip mono>{beat.pack}</Chip>
            <Chip tone={beat.result === 'green' ? 'ok' : 'warn'} className="ml-auto">{beat.result}</Chip>
          </div>
          <ul className="mt-1.5 space-y-0.5">
            {beat.probes.map((p) => (
              <li key={p} className="flex items-center gap-1.5 text-2xs text-ink-2">
                <Check size={10} className="shrink-0 text-ok" />{p}
              </li>
            ))}
          </ul>
          <p className="mt-1.5 text-2xs text-ink-3">
            
          </p>
        </div>
      )

    case 'evidence':
      return (
        <div className="flex flex-wrap items-center gap-2 px-1 text-2xs text-ink-3">
          <ShieldCheck size={11} className="shrink-0 text-ok" />
          <span>{beat.summary}</span>
          <Link to="/governance/evidence" className="text-brand-ink hover:underline">open chain →</Link>
        </div>
      )

    case 'ledger':
      return (
        <div className="rounded-md border border-line bg-surface px-3 py-2">
          <div className="flex flex-wrap items-center gap-2">
            <Coins size={12} className="shrink-0 text-ink-3" />
            <span className="text-2xs font-medium text-ink">Glidepath Ledger entry</span>
            <Chip tone="brand" className="ml-auto">{beat.attribution}</Chip>
            <span className="tnum text-2xs text-ink">{beat.hours.toFixed(2)} h</span>
          </div>
          <p className="mt-1 text-2xs leading-relaxed text-ink-3">{beat.note}</p>
        </div>
      )

    case 'cost':
      return (
        <div className="flex flex-wrap items-center gap-2 px-1 text-2xs text-ink-3">
          <Coins size={11} className="shrink-0" />
          <span className="tnum text-ink-2">{usd(beat.usd)}</span>
          <span>of model spend on this run.</span>
          <span className="min-w-0 flex-1">{beat.note}</span>
          {beat.system && <Chip mono>{beat.system}</Chip>}
          {beat.mismatch && (
            <span className="flex items-center gap-1 text-warn">
              <TriangleAlert size={10} /> served {beat.model}, registered {beat.registered} — recorded for notice
            </span>
          )}
        </div>
      )

    case 'system':
      return (
        <div className="flex flex-wrap items-center gap-2 px-1 text-2xs text-ink-3">
          <Cpu size={11} className="shrink-0" />
          <span>Model resolved against the registry —</span>
          <span className="text-ink-2">{beat.vendor} {beat.model}</span>
          <Chip mono>{beat.id}</Chip>
          <span>{beat.hosting.replace(/_/g, ' ')} · {beat.region}</span>
        </div>
      )

    case 'incident':
      return (
        <div className={cn('rounded-md border px-3 py-2.5', beat.consequential ? 'border-crit/45 bg-crit/[0.06]' : 'border-warn/40 bg-warn/[0.06]')}>
          <div className="flex flex-wrap items-center gap-2">
            <TriangleAlert size={13} className={cn('shrink-0', beat.consequential ? 'text-crit' : 'text-warn')} />
            <span className="text-xs font-medium text-ink">AI Incident — {beat.class.replace(/_/g, ' ')}</span>
            <Chip mono>{beat.detector}</Chip>
            <Chip tone={beat.consequential ? 'crit' : 'warn'} className="ml-auto">{beat.consequential ? 'consequential' : 'recorded'}</Chip>
          </div>
          <p className="mt-1 text-2xs leading-relaxed text-ink-2">{beat.summary}</p>
          <ul className="mt-1.5 space-y-0.5">
            {beat.details.map((d) => <li key={d} className="text-2xs leading-relaxed text-ink-2">· {d}</li>)}
          </ul>
        </div>
      )

    case 'answer':
      return (
        <AgentLine agentId={beat.agent} tone="ok">
          <div className="flex items-baseline gap-2">
            <span className="text-2xs font-medium text-ink">{AGENT_BY_ID[beat.agent]?.name}</span>
            <span className="text-2xs text-ink-3">response</span>
          </div>
          <p className="mt-1 text-[13px] leading-relaxed text-ink">
            <StreamText text={beat.text} instant={!live} speed={5} />
          </p>
        </AgentLine>
      )

    case 'refuse':
      return (
        <AgentLine agentId={beat.agent} tone="crit">
          <div className="flex items-baseline gap-2">
            <span className="text-2xs font-medium text-crit">{AGENT_BY_ID[beat.agent]?.name}</span>
            <span className="text-2xs text-ink-3">refusal</span>
          </div>
          <p className="mt-1 text-[13px] leading-relaxed text-ink">
            <StreamText text={beat.text} instant={!live} speed={5} />
          </p>
          <p className="mt-2 flex items-start gap-1.5 rounded border border-crit/35 bg-crit/[0.05] px-2 py-1.5 text-2xs leading-relaxed text-ink-2">
            <Ban size={11} className="mt-[2px] shrink-0 text-crit" />
            {beat.rule}
          </p>
        </AgentLine>
      )

    case 'rejected':
      return (
        <div className="rounded-md border border-line bg-raised px-3 py-2 text-2xs leading-relaxed text-ink-2">
          {beat.text}
        </div>
      )

    case 'error':
      return (
        <div className="rounded-md border border-crit/45 bg-crit/[0.06] px-3 py-2.5">
          <div className="flex items-center gap-2">
            <ShieldAlert size={13} className="shrink-0 text-crit" />
            <span className="text-xs font-medium text-ink">Agent gateway error</span>
          </div>
          <p className="mt-1 text-2xs leading-relaxed text-ink-2">{beat.message}</p>
        </div>
      )

    default:
      return null
  }
}

/* ------------------------------- Live rail --------------------------------- */

function LiveRail({ beats, running }: { beats: Beat[]; running: boolean }) {
  const plan = [...beats].reverse().find((b) => b.t === 'plan') as Extract<Beat, { t: 'plan' }> | undefined
  const policy = [...beats].reverse().find((b) => b.t === 'policy') as Extract<Beat, { t: 'policy' }> | undefined
  const execed = beats.filter((b) => b.t === 'exec').length
  const gated = beats.some((b) => b.t === 'gate') && !beats.some((b) => b.t === 'exec')
  const evidence = beats.filter((b) => b.t === 'evidence').length
  const retrieval = [...beats].reverse().find((b) => b.t === 'retrieve') as Extract<Beat, { t: 'retrieve' }> | undefined
  const cost = beats.filter((b) => b.t === 'cost').reduce((s, b) => s + (b as Extract<Beat, { t: 'cost' }>).usd, 0)

  const activeAgents = [...new Set(beats.flatMap((b) => ('agent' in b && typeof b.agent === 'string' ? [b.agent] : [])))]

  return (
    <aside className="hidden min-h-0 w-[290px] shrink-0 flex-col overflow-y-auto border-l border-line bg-surface xl:flex">
      <div className="border-b border-line px-3 py-2.5">
        <div className="flex items-center gap-1.5">
          <Dot tone={running ? 'brand' : 'neutral'} pulse={running} />
          <span className="label-cap">{running ? 'Run in progress' : beats.length ? 'Run complete' : 'Idle'}</span>
        </div>
      </div>

      <div className="border-b border-line px-3 py-2.5">
        <div className="label-cap">Agents engaged</div>
        <div className="mt-1.5 flex flex-wrap gap-1">
          {activeAgents.length === 0 && <span className="text-2xs text-ink-3">None yet.</span>}
          {activeAgents.map((a) => <AgentChip key={a} id={a} />)}
        </div>
      </div>

      {retrieval && (
        <div className="border-b border-line px-3 py-2.5">
          <div className="label-cap">Context</div>
          <dl className="mt-1.5 space-y-1 text-2xs">
            <div className="flex justify-between gap-2"><dt className="text-ink-3">Assertions relied on</dt><dd className="tnum text-ink-2">{retrieval.assertions}</dd></div>
            <div className="flex justify-between gap-2"><dt className="text-ink-3">Human-verified</dt><dd className="tnum text-ok">{retrieval.humanVerified}</dd></div>
            <div className="flex justify-between gap-2"><dt className="text-ink-3">Floor enforced</dt><dd className="font-mono text-ink-2">{retrieval.floor}</dd></div>
          </dl>
        </div>
      )}

      {plan && (
        <div className="border-b border-line px-3 py-2.5">
          <div className="label-cap">Plan</div>
          <ol className="mt-1.5 space-y-1.5">
            {plan.steps.map((s, i) => {
              const done = i < execed
              const blocked = gated && i === 0
              return (
                <li key={i} className="flex gap-2">
                  <span className="mt-[3px] shrink-0">
                    {done ? <Check size={11} className="text-ok" /> : blocked ? <Square size={11} className="text-warn" /> : <CircleDot size={11} className="text-ink-3" />}
                  </span>
                  <span className={cn('min-w-0 flex-1 text-2xs leading-snug', done ? 'text-ink-2' : 'text-ink-3')}>{s.label}</span>
                </li>
              )
            })}
          </ol>
        </div>
      )}

      {policy && (
        <div className="border-b border-line px-3 py-2.5">
          {/* An advisory run proposed no mutation, so this mode is what a
              plan on this class would face, not a decision that governed
              anything here — the label and caption say so, so this panel
              never reads as contradicting the "no decision required" line
              in the transcript above it. */}
          <div className="label-cap">{policy.advisory ? 'Would-be decision' : 'Decision'}</div>
          <div className="mt-1.5"><AutonomyChip mode={policy.result.mode} full /></div>
          <p className="mt-1.5 text-2xs leading-relaxed text-ink-3">
            {policy.advisory ? (
              <>No action was proposed, so this did not govern the run — shown for reference only.</>
            ) : (
              <>
                Floor {modeLabel(policy.result.floorApplied)} · decided in {policy.result.evaluatedInMs} ms ·{' '}
                {policy.result.trace.filter((t) => t.matched).length} of {policy.result.trace.length} rules matched
              </>
            )}
          </p>
        </div>
      )}

      <div className="border-b border-line px-3 py-2.5">
        <div className="label-cap">Evidence sealed</div>
        <div className="tnum mt-1 font-display text-lg font-semibold text-ink">{evidence}</div>
        <p className="mt-0.5 text-2xs text-ink-3">records appended to the chain by this run</p>
      </div>

      <div className="px-3 py-2.5">
        <div className="label-cap">Run cost</div>
        <div className="tnum mt-1 font-display text-lg font-semibold text-ink">{cost ? usd(cost) : '—'}</div>
        <p className="mt-0.5 text-2xs leading-relaxed text-ink-3">
          Metered by agent, skill and step. Budgets are policy: a soft breach alerts, a hard breach degrades the tier or drops to advise.
        </p>
      </div>
    </aside>
  )
}

/* --------------------------------- Screen ---------------------------------- */

export function Copilot() {
  const nav = useNavigate()
  const [input, setInput] = React.useState('')
  const [beats, setBeats] = React.useState<Beat[]>([])
  const [running, setRunning] = React.useState(false)
  const [gateOpen, setGateOpen] = React.useState(false)
  const [utterance, setUtterance] = React.useState('')
  const pendingRef = React.useRef<{ proposal: AgentProposal; decision: ReturnType<typeof decide> } | null>(null)
  const abortRef = React.useRef<AbortController | null>(null)
  const scrollRef = React.useRef<HTMLDivElement>(null)
  const [gateway, setGateway] = React.useState<'checking' | 'up' | 'down'>('checking')
  const [gatewayModel, setGatewayModel] = React.useState('')

  React.useEffect(() => {
    fetch('/api/agent/health')
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((j) => { setGateway('up'); setGatewayModel(j.model) })
      .catch(() => setGateway('down'))
  }, [])

  const logEvidence = useAstra((s) => s.logEvidence)
  const missionMap = useAstra((s) => s.missions)
  const chargeMission = useAstra((s) => s.chargeMission)
  // What the model is told is "known right now" is read off these two, not
  // authored — see liveContext() in agentRuntime.ts.
  const workList = useWorkList()
  const proposalMap = useAstra((s) => s.proposals)
  const clockOffsetMins = useAstra((s) => s.clockOffsetMins)
  // The control plane the run is decided under: live suspensions, suspended
  // agents and whether a major incident is open.
  const suspensions = useAstra((s) => s.suspensions)
  const agentMap = useAstra((s) => s.agents)
  const miActive = useAstra((s) => s.mi.active)
  // Recomputed only when the underlying work or proposals change — cheap, and
  // means a suggestion never outlives the record it was built from.
  const suggestions = React.useMemo(() => buildSuggestions(workList, Object.values(proposalMap)), [workList, proposalMap])
  /** The mission this run is under, so its budget can be charged as cost lands. */
  const missionRef = React.useRef<string | null>(null)
  const pushToast = useAstra((s) => s.pushToast)
  const raiseAiIncident = useAstra((s) => s.raiseAiIncident)
  const roleId = useAstra((s) => s.roleId)
  const role = ROLE_BY_ID[roleId]
  /** The intent under way, readable from inside emit without re-creating it per run. */
  const utteranceRef = React.useRef('')

  React.useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [beats.length])

  /** Appends a beat, or replaces the last one when a stream is still filling it. */
  const emit = React.useCallback(
    (b: Beat, replaceLast?: boolean) => {
      setBeats((prev) => (replaceLast && prev.length ? [...prev.slice(0, -1), b] : [...prev, b]))

      if (b.t === 'route') logEvidence('observation', 'Astra Copilot', `Intent routed — ${b.intent}`, { confidence: b.confidence, agent: b.agent })
      if (b.t === 'policy') {
        // An advisory evaluation governed nothing, so it is not sealed as a
        // 'decision' — the evidence chain would otherwise carry a permanent
        // record claiming a mode was decided and, by implication, executed,
        // for a run that proposed no action at all.
        logEvidence(
          b.advisory ? 'observation' : 'decision',
          'Autonomy Policy Engine',
          b.advisory
            ? `No action proposed — autonomy decision not required (would-be mode ${b.result.mode} under ${b.policyName})`
            : `Execution mode ${b.result.mode} under ${b.policyName}`,
          {
            inputVector: { actionClasses: b.result.actionClasses, blast: b.result.blastRadius, grades: b.result.agentGrades, confidence: b.result.planConfidence },
            reasons: b.result.reasons,
          },
          { agentId: b.agentId, actionClass: b.result.actionClasses[0] },
        )
      }
      if (b.t === 'mission') missionRef.current = b.missionId
      // Every model call this run makes is charged to the mission that governs
      // it. Without this the budget is a number on a card, not a ceiling.
      if (b.t === 'cost' && missionRef.current) chargeMission(missionRef.current, b.usd, 1)
      if (b.t === 'refuse') logEvidence('decision', b.agent, 'Action refused by platform rule', { rule: b.rule })
      // A detector fired: the incident opens its finding, starts both clocks
      // and, when consequential, puts the agent on probation.
      if (b.t === 'incident') {
        raiseAiIncident(
          { class: b.class, detector: b.detector, summary: b.summary, details: b.details, consequential: b.consequential },
          { agentId: b.agent, systemId: b.systemId, runRef: utteranceRef.current },
        )
      }
      // A served model that differs from the registered one is the change the
      // contract wants notice of; the record is the start of that clock.
      if (b.t === 'cost' && b.mismatch) {
        logEvidence('observation', 'AI-system registry', 'Served model differs from the registered system', { system: b.system, registered: b.registered, served: b.model })
      }
      if (b.t === 'gate') setGateOpen(true)
    },
    [logEvidence, chargeMission, raiseAiIncident],
  )

  const run = React.useCallback(
    async (text: string) => {
      abortRef.current?.abort()
      const controller = new AbortController()
      abortRef.current = controller

      setUtterance(text)
      utteranceRef.current = text
      setBeats([])
      setGateOpen(false)
      setRunning(true)
      pendingRef.current = null
      missionRef.current = null

      const nowMs = NOW.getTime() + clockOffsetMins * 60_000
      const { proposal, decision, mode } = await runIntent(
        text, emit, controller.signal, Object.values(missionMap), workList, Object.values(proposalMap), nowMs,
        {
          suspensions,
          suspendedAgents: Object.values(agentMap).filter((a) => a.state === 'suspended').map((a) => a.id),
          majorActive: miActive,
        },
      )
      if (controller.signal.aborted) return

      if (proposal && decision && mode === 'approve_first') {
        pendingRef.current = { proposal, decision }
      }
      setRunning(false)
    },
    [emit, missionMap, workList, proposalMap, clockOffsetMins, suspensions, agentMap, miActive],
  )

  const decideGate = async (verdict: 'approve' | 'reject') => {
    setGateOpen(false)
    const pending = pendingRef.current
    if (!pending) return

    if (verdict === 'reject') {
      const evId = logEvidence('decision', role.person, 'Gated action rejected by approver', { reason: 'operator declined at the gate' })
      emit({ t: 'rejected', text: `Rejected by ${role.person}. The work object returns to the human queue; the proposal is retained and scored against the agent. Evidence ${evId}.` })
      pushToast({ title: 'Rejected at the gate', body: 'The disagreement feeds the evaluation service.', tone: 'warn', evidenceId: evId })
      return
    }

    const evId = logEvidence('approval', role.person, 'Gated action approved', {
      shown: ['plan', 'blast_radius', 'rollback', 'agent_record', 'policy'],
      actionClass: pending.proposal.action_class,
    })
    emit({ t: 'evidence', summary: `Approval by ${role.person} sealed — ${evId}`, kind: 'approval' })

    const controller = new AbortController()
    abortRef.current = controller
    setRunning(true)
    await execute(
      pending.proposal, pending.decision, emit, utterance, controller.signal,
      workList, Object.values(proposalMap), NOW.getTime() + clockOffsetMins * 60_000,
    )
    if (!controller.signal.aborted) setRunning(false)
  }

  const stop = () => {
    abortRef.current?.abort()
    setRunning(false)
    setGateOpen(false)
  }

  return (
    <>
      <PageHeader
        title="Astra Copilot"
        subtitle={gateway === 'up' ? `Live · ${gatewayModel}` : gateway === 'down' ? 'Agent gateway unreachable' : undefined}
        meta={
          <Chip tone={gateway === 'down' ? 'crit' : running ? 'brand' : 'neutral'}>
            <Dot tone={gateway === 'down' ? 'crit' : running ? 'brand' : 'ok'} pulse={running} />
            {gateway === 'down' ? 'gateway offline' : running ? 'agents working' : 'ready'}
          </Chip>
        }
        actions={running ? <Button size="sm" variant="danger" onClick={stop}><Square size={11} /> Abort run</Button> : undefined}
      />

      <div className="flex min-h-0 flex-1">
        <div className="flex min-w-0 flex-1 flex-col">
          <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
            <div className="mx-auto max-w-3xl">
              {beats.length === 0 && !running ? (
                <div className="py-6">
                  {gateway === 'down' && (
                    <div className="mb-4 flex flex-wrap items-center gap-2 rounded-md border border-crit/45 bg-crit/[0.06] px-3 py-2.5">
                      <ShieldAlert size={13} className="shrink-0 text-crit" />
                      <span className="min-w-0 flex-1 text-2xs text-ink-2">
                        The agent runtime is not connected, so intents cannot be run.
                      </span>
                      <Button size="sm" variant="default" onClick={() => nav('/settings/connection')}>
                        Open connection settings
                      </Button>
                    </div>
                  )}
                  <div className="flex items-center gap-2">
                    <Sparkles size={15} className="text-brand-ink" />
                    <h2 className="font-display text-sm font-semibold text-ink">What would you like done?</h2>
                  </div>

                  <ul className="mt-4 grid gap-2 sm:grid-cols-2">
                    {suggestions.map((s) => (
                      <li key={s.id}>
                        <button
                          onClick={() => { if (!running) run(s.text) }}
                          disabled={running || gateway === 'down'}
                          className="group flex h-full w-full flex-col rounded-md border border-line bg-surface p-3 text-left shadow-e1 transition-colors hover:border-brand disabled:pointer-events-none disabled:opacity-50"
                        >
                          <span className="text-xs font-medium text-ink group-hover:text-brand-ink">{s.text}</span>
                          <span className="mt-1 text-2xs leading-relaxed text-ink-3">{s.hint}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="flex justify-end">
                    <div className="max-w-[80%] rounded-md rounded-br-xs border border-line-strong bg-raised px-3 py-2">
                      <p className="text-xs text-ink">{utterance}</p>
                      <p className="mt-0.5 text-2xs text-ink-3">{role.person} · {role.title}</p>
                    </div>
                  </div>

                  {beats.map((b, i) => (
                    <div key={i} className="animate-rise-in">
                      <BeatBlock
                        beat={b}
                        live={i === beats.length - 1}
                        onGate={b.t === 'gate' && gateOpen && i === beats.length - 1 ? decideGate : undefined}
                      />
                    </div>
                  ))}

                  {running && (
                    <div className="flex items-center gap-2.5 rounded-md border border-line bg-surface px-3 py-2.5 shadow-e1">
                      <Dot tone="brand" pulse />
                      <span className="min-w-0 flex-1 text-2xs leading-relaxed text-ink-2">
                        {beats.length === 0
                          ? 'Reaching the agent runtime — the first response takes a few seconds.'
                          : 'Working…'}
                      </span>
                      <span className="relative h-[3px] w-16 shrink-0 overflow-hidden rounded-full bg-sunken">
                        <span className="absolute inset-y-0 w-1/3 animate-agent-work rounded-full bg-brand" />
                      </span>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          <div className="shrink-0 border-t border-line bg-surface px-4 py-3">
            <form
              onSubmit={(e) => { e.preventDefault(); if (input.trim() && !running) run(input.trim()) }}
              className="mx-auto flex max-w-3xl items-end gap-2"
            >
              <div className="relative min-w-0 flex-1">
                <textarea
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); if (input.trim() && !running) run(input.trim()) }
                  }}
                  rows={2}
                  placeholder="Diagnose, remediate, analyse — or ask for a governed metric…"
                  className="w-full resize-none rounded-md border border-line-strong bg-sunken px-3 py-2 pr-11 text-xs leading-relaxed text-ink placeholder:text-ink-3 focus:border-brand focus:outline-none"
                />
                <button
                  type="submit"
                  disabled={!input.trim() || running}
                  className="absolute bottom-2 right-2 flex h-7 w-7 items-center justify-center rounded bg-brand text-[#1B1B1E] transition-opacity disabled:opacity-30"
                  aria-label="Send"
                >
                  <ArrowUp size={14} strokeWidth={2.5} />
                </button>
              </div>
              {beats.length > 0 && (
                <Button variant="ghost" onClick={() => { stop(); setBeats([]); setInput('') }}>Clear</Button>
              )}
            </form>
          </div>
        </div>

        <LiveRail beats={beats} running={running} />
      </div>
    </>
  )
}

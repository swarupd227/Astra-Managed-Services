import React from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, CircleDot, OctagonX, PlayCircle, Undo2 } from 'lucide-react'
import { useAstra } from '@/domain/store'
import { AGENT_BY_ID, GRAPH_EDGES, GRAPH_NODES, TOWER_BY_ID } from '@/domain/estate'
import { AC, ROLE_BY_ID } from '@/domain/reference'
import { ApprovalCard } from './ApprovalCard'
import {
  AgentChip, AutonomyChip, Assignee, EvidenceLink, PageHeader, PriorityChip, SlaClock, StateChip,
} from '@/ui/domain'
import { Button, Card, Chip, Dot, Empty, Metric, Tabs } from '@/ui/primitives'
import { cn, ago, dateTime, mins, pct, usd } from '@/lib/format'
import type { RunStep } from '@/domain/types'

/* ------------------------------ Causal chain -------------------------------- */

function CausalChain({ affected, demandClass }: { affected: string[]; demandClass: string }) {
  const nodes = GRAPH_NODES.filter((n) => affected.includes(n.id))
  const neighbours = GRAPH_EDGES
    .filter((e) => affected.includes(e.from) || affected.includes(e.to))
    .map((e) => (affected.includes(e.from) ? e.to : e.from))
    .filter((id, i, arr) => arr.indexOf(id) === i && !affected.includes(id))
    .map((id) => GRAPH_NODES.find((n) => n.id === id))
    .filter(Boolean)

  const chain = [
    { label: 'Symptom', value: 'Latency SLO breach', tone: 'crit' as const, detail: 'p99 > 1,800 ms for 3 evaluations' },
    { label: 'Surface', value: nodes[0]?.name ?? affected[0], tone: 'warn' as const, detail: nodes[0] ? `${nodes[0].type} · tier ${nodes[0].tier}` : '' },
    { label: 'Component', value: nodes[1]?.name ?? neighbours[0]?.name ?? '—', tone: 'warn' as const, detail: 'connection pool saturated' },
    { label: 'Cause', value: 'chg_5511 reduced conn_pool.max 500 → 200', tone: 'crit' as const, detail: 'change applied 2027-02-16 21:14' },
    { label: 'Class', value: demandClass, tone: 'info' as const, detail: 'known error ke_pool_5511 · 7 prior occurrences' },
  ]

  return (
    <div className="space-y-2">
      {chain.map((c, i) => (
        <div key={c.label} className="flex gap-2.5">
          <div className="flex w-4 shrink-0 flex-col items-center pt-1">
            <Dot tone={c.tone} />
            {i < chain.length - 1 && <span className="mt-1 w-px flex-1 bg-line-strong/60" />}
          </div>
          <div className="min-w-0 flex-1 pb-1">
            <div className="label-cap">{c.label}</div>
            <div className="mt-0.5 truncate font-mono text-2xs text-ink">{c.value}</div>
            <div className="mt-0.5 text-2xs text-ink-3">{c.detail}</div>
          </div>
        </div>
      ))}

      <div className="mt-3 rounded border border-line bg-sunken p-2.5">
        <div className="label-cap">Graph neighbourhood in play</div>
        <div className="mt-1.5 flex flex-wrap gap-1">
          {[...nodes, ...neighbours].map((n) => (
            <Chip key={n!.id} tone={n!.tier === 0 ? 'crit' : 'neutral'} mono title={`${n!.type} · tier ${n!.tier}`}>
              {n!.name}
            </Chip>
          ))}
        </div>
        <p className="mt-2 text-2xs leading-relaxed text-ink-3">
          Context package assembled at a <span className="text-ink-2">machine-corroborated</span> confidence floor: 27 assertions
          (11 human-verified), 2 runbooks, 3 prior incidents — fitted inside a 6,000-token budget by decision relevance rather than
          document dumping. The floor applied is recorded in evidence.
        </p>
      </div>
    </div>
  )
}

/* --------------------------------- Run DAG ---------------------------------- */

const STEP_TONE: Record<RunStep['state'], 'ok' | 'brand' | 'warn' | 'crit' | 'neutral'> = {
  done: 'ok', running: 'brand', blocked: 'warn', failed: 'crit', pending: 'neutral', skipped: 'neutral',
}

function RunPane({ woId }: { woId: string }) {
  const wo = useAstra((s) => s.work[woId])
  const run = useAstra((s) => (wo?.runId ? s.runs[wo.runId] : undefined))
  const abortRun = useAstra((s) => s.abortRun)
  const roleId = useAstra((s) => s.roleId)
  const role = ROLE_BY_ID[roleId]

  if (!run) return <Empty title="No run planned" body="This work object has not yet been planned into an orchestrated execution." />

  const done = run.steps.filter((s) => s.state === 'done').length
  const canAbort = ['executing', 'verifying'].includes(run.state) && role.canApprove

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-line px-3 py-2">
        <span className="font-mono text-2xs text-ink-2">{run.id}</span>
        <Chip tone={run.state === 'complete' ? 'ok' : run.state === 'gated' ? 'warn' : run.state === 'compensated' ? 'crit' : 'brand'}>{run.state}</Chip>
        <span className="text-2xs text-ink-3">skill <Link to="/atlas/evaluation" className="font-mono text-brand-ink hover:underline">{run.skillId}</Link></span>
        <span className="tnum ml-auto text-2xs text-ink-3">{done}/{run.steps.length} steps · {usd(run.tokensUsd)}</span>
        {/* The Watch verb (§A7.1) — the same run, played rather than listed. */}
        <Button size="sm" variant="ghost">
          <Link to={`/operate/run/${run.id}`} className="flex items-center gap-1.5">
            <PlayCircle size={11} /> Watch
          </Link>
        </Button>
        {canAbort && (
          <Button size="sm" variant="danger" onClick={() => abortRun(woId, role.person)}>
            <OctagonX size={11} /> Abort
          </Button>
        )}
      </div>

      <ol className="min-h-0 flex-1 overflow-y-auto p-3">
        {run.steps.map((s, i) => (
          <li key={s.id} className="flex gap-2.5">
            <div className="flex w-4 shrink-0 flex-col items-center pt-[5px]">
              {s.state === 'running' ? (
                <CircleDot size={11} className="animate-pulse text-brand-ink" />
              ) : (
                <Dot tone={STEP_TONE[s.state]} />
              )}
              {i < run.steps.length - 1 && <span className={cn('mt-1 w-px flex-1', s.state === 'done' ? 'bg-ok/40' : 'bg-line-strong/50')} />}
            </div>
            <div className={cn('min-w-0 flex-1 pb-3', s.state === 'pending' && 'opacity-55')}>
              <div className="flex flex-wrap items-center gap-1.5">
                <Chip tone={s.kind === 'gate' ? 'warn' : s.kind === 'verify' ? 'agent' : s.kind === 'tool' ? 'brand' : 'neutral'}>{s.kind}</Chip>
                <span className="min-w-0 flex-1 truncate text-2xs text-ink">{s.label}</span>
                {s.durationMs ? <span className="tnum shrink-0 text-[10px] text-ink-3">{(s.durationMs / 1000).toFixed(1)}s</span> : null}
              </div>
              {s.agentId && <div className="mt-1"><AgentChip id={s.agentId} /></div>}
              {s.detail && <p className="mt-1 text-2xs leading-relaxed text-ink-3">{s.detail}</p>}
              {s.compensation && (
                <p className="mt-1 flex items-start gap-1 text-2xs text-ink-3">
                  <Undo2 size={10} className="mt-[3px] shrink-0 text-ok" />
                  <span>Compensation: <span className="text-ink-2">{s.compensation}</span></span>
                </p>
              )}
            </div>
          </li>
        ))}
      </ol>

      <div className="shrink-0 border-t border-line bg-raised px-3 py-2 text-2xs leading-relaxed text-ink-3">
        Every mutating step declares a compensation or takes a gate. Verification runs before Resolved.
      </div>
    </div>
  )
}

/* ---------------------------------- Screen ---------------------------------- */

export function WorkObjectDetail() {
  const { id } = useParams()
  const nav = useNavigate()
  const wo = useAstra((s) => (id ? s.work[id] : undefined))
  const [tab, setTab] = React.useState<'narrative' | 'causal' | 'economics'>('narrative')

  if (!wo) {
    return <Empty title="Work object not found" body="It may have been resolved and archived." action={<Button onClick={() => nav('/operate/board')}>Back to the board</Button>} />
  }

  const tower = TOWER_BY_ID[wo.tower]
  const a = wo.autonomy
  const savedMins = wo.economics.actualAgentMins ? wo.economics.estManualMins - wo.economics.actualAgentMins : 0

  return (
    <>
      <PageHeader
        title={wo.title}
        subtitle={
          <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="font-mono text-ink-2">{wo.ref}</span>
            <span>·</span>
            <span>{tower?.name}</span>
            <span>·</span>
            <span>mirrored from {wo.source.system} ({wo.source.ref})</span>
            <span>·</span>
            <span>opened {ago(wo.createdAt)}</span>
          </span>
        }
        meta={
          <span className="flex items-center gap-1.5">
            <PriorityChip p={wo.priority} />
            <StateChip state={wo.state} />
            {a && <AutonomyChip mode={a.mode} full />}
          </span>
        }
        actions={
          <>
            <Button size="sm" variant="ghost" onClick={() => nav(-1)}><ArrowLeft size={12} /> Back</Button>
            <EvidenceLink id={wo.evidenceHead} label="Evidence" />
          </>
        }
      />

      {wo.state === 'gated' && (
        <div className="shrink-0 border-b border-line bg-canvas p-4">
          <ApprovalCard wo={wo} onDone={() => {}} />
        </div>
      )}

      <div className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-[1.15fr_0.85fr_0.9fr]">
        <section className="flex min-h-0 flex-col border-r border-line bg-surface">
          <div className="shrink-0 border-b border-line px-3 py-1.5">
            <Tabs
              value={tab}
              onChange={setTab}
              tabs={[
                { id: 'narrative', label: 'Narrative timeline', count: wo.narrative.length },
                { id: 'causal', label: 'Causal chain' },
                { id: 'economics', label: 'Economics' },
              ]}
            />
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto p-3">
            {tab === 'narrative' && (
              <ol className="space-y-3">
                {wo.narrative.slice().reverse().map((n) => (
                  <li key={n.id} className="flex gap-2.5">
                    <span className="mt-1.5 shrink-0">
                      <Dot tone={n.level === 'crit' ? 'crit' : n.level === 'warn' ? 'warn' : n.level === 'ok' ? 'ok' : n.actorKind === 'agent' ? 'agent' : 'neutral'} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline gap-2">
                        {n.actorKind === 'agent' && AGENT_BY_ID[`agt_${n.actor.toLowerCase()}`] ? (
                          <AgentChip id={`agt_${n.actor.toLowerCase()}`} />
                        ) : (
                          <span className={cn('text-2xs font-medium', n.actorKind === 'agent' ? 'text-agent' : n.actorKind === 'system' ? 'text-ink-3' : 'text-ink-2')}>
                            {n.actor}
                          </span>
                        )}
                        <span className="ml-auto shrink-0 text-[10px] text-ink-3" title={dateTime(n.at)}>{ago(n.at)}</span>
                      </div>
                      <p className="mt-1 text-2xs leading-relaxed text-ink-2">{n.text}</p>
                      {n.evidenceId && <EvidenceLink id={n.evidenceId} className="mt-1" />}
                    </div>
                  </li>
                ))}
              </ol>
            )}

            {tab === 'causal' && <CausalChain affected={wo.affected} demandClass={wo.demandClass} />}

            {tab === 'economics' && (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <Metric size="sm" label="Estimated manual effort" value={mins(wo.economics.estManualMins)} />
                  <Metric size="sm" label="Actual agent path" value={wo.economics.actualAgentMins ? mins(wo.economics.actualAgentMins) : '—'} />
                  <Metric size="sm" label="Model spend" value={usd(wo.economics.tokensUsd)} />
                  <Metric size="sm" label="Attribution" value={wo.economics.attribution} />
                </div>
                {savedMins > 0 && (
                  <div className="rounded border border-ok/35 bg-ok/[0.07] p-2.5">
                    <p className="text-2xs leading-relaxed text-ink-2">
                      <span className="tnum font-medium text-ok">{mins(savedMins)}</span> of effort delta, attributed to{' '}
                      <span className="text-ink">{wo.economics.attribution}</span>. It does not count as a saving yet — the ledger banks
                      it only after the demand class's actual volume decay is verified in telemetry for 60 to 90 days.
                    </p>
                  </div>
                )}
                <div className="rounded border border-line bg-sunken p-2.5 text-2xs leading-relaxed text-ink-3">
                  Cost to serve this object: <span className="tnum text-ink-2">{usd(wo.economics.tokensUsd)}</span> of model spend against{' '}
                  <span className="tnum text-ink-2">{usd((savedMins / 60) * 78)}</span> of displaced human cost at the contracted blended rate —
                  a ratio of {savedMins > 0 ? pct((wo.economics.tokensUsd / Math.max(0.01, (savedMins / 60) * 78)) * 100, 1) : '—'}.
                  The platform publishes this ratio because a provider that hides its AI costs will eventually hide its AI failures.
                </div>
              </div>
            )}
          </div>
        </section>

        <section className="flex min-h-0 flex-col border-r border-line bg-surface">
          <div className="shrink-0 border-b border-line px-3 py-2">
            <h3 className="font-display text-[13px] font-semibold text-ink">Plan &amp; execution</h3>
            <p className="mt-0.5 text-2xs text-ink-3">Typed DAG with gates and compensation</p>
          </div>
          <RunPane woId={wo.id} />
        </section>

        <aside className="flex min-h-0 flex-col overflow-y-auto bg-surface">
          <div className="border-b border-line px-3 py-2.5">
            <div className="label-cap">Service level</div>
            <div className="mt-1.5"><SlaClock elapsed={wo.slaElapsedMins} target={wo.slaTargetMins} paused={wo.slaPaused} /></div>
            <div className="mt-2 grid grid-cols-2 gap-2 text-2xs">
              <div><span className="text-ink-3">Target</span><div className="tnum text-ink-2">{mins(wo.slaTargetMins)}</div></div>
              <div><span className="text-ink-3">Elapsed</span><div className="tnum text-ink-2">{mins(wo.slaElapsedMins)}</div></div>
              <div><span className="text-ink-3">Breach risk</span><div className={cn('tnum', wo.breachProbability > 0.6 ? 'text-crit' : 'text-ink-2')}>{pct(wo.breachProbability * 100, 0)}</div></div>
              <div><span className="text-ink-3">Clock</span><div className="text-ink-2">{wo.slaPaused ? `paused · ${wo.pauseReason}` : 'running'}</div></div>
            </div>
          </div>

          <div className="border-b border-line px-3 py-2.5">
            <div className="label-cap">Accountability</div>
            <div className="mt-1.5 space-y-1.5 text-2xs">
              <div className="flex items-center justify-between gap-2"><span className="text-ink-3">Holder</span><Assignee id={wo.assignee} kind={wo.assigneeKind} /></div>
              <div className="flex items-center justify-between gap-2"><span className="text-ink-3">SDM</span><span className="text-ink-2">{tower?.sdm}</span></div>
              <div className="flex items-center justify-between gap-2"><span className="text-ink-3">Service owner</span><span className="text-ink-2">{tower?.owner}</span></div>
              {a?.gates[0] && <div className="flex items-center justify-between gap-2"><span className="text-ink-3">Gate role</span><span className="text-ink-2">{a.gates[0].role}</span></div>}
            </div>
          </div>

          {a && (
            <div className="border-b border-line px-3 py-2.5">
              <div className="label-cap">Policy decision</div>
              <div className="mt-1.5 space-y-1.5 text-2xs">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-ink-3">Mode</span>
                  <AutonomyChip mode={a.mode} full />
                </div>
                <div className="flex items-center justify-between gap-2"><span className="text-ink-3">Policy</span><Link to="/atlas/policy" className="font-mono text-brand-ink hover:underline">{a.policyId} {a.policyVersion}</Link></div>
                <div className="flex items-center justify-between gap-2"><span className="text-ink-3">Action classes</span><span className="font-mono text-ink-2">{a.actionClasses.join(', ')}</span></div>
                <div className="flex items-center justify-between gap-2"><span className="text-ink-3">Decided in</span><span className="tnum text-ink-2">{a.evaluatedInMs} ms</span></div>
              </div>
              <ul className="mt-2 space-y-0.5 text-2xs leading-relaxed text-ink-3">
                {a.reasons.map((r) => <li key={r}>· {r}</li>)}
              </ul>
            </div>
          )}

          <div className="border-b border-line px-3 py-2.5">
            <div className="label-cap">Action classes in play</div>
            <div className="mt-1.5 space-y-1.5">
              {(a?.actionClasses ?? ['AC-05']).map((c) => {
                const cls = AC[c]
                return (
                  <div key={c} className="rounded border border-line bg-sunken p-2">
                    <div className="flex items-center gap-1.5">
                      <span className="font-mono text-2xs text-ink">{cls?.id}</span>
                      <span className="truncate text-2xs text-ink-2">{cls?.name}</span>
                    </div>
                    <div className="mt-1 flex flex-wrap gap-1 text-[10px] text-ink-3">
                      <span>reversibility: {cls?.reversibility.replace(/_/g, ' ')}</span>
                      <span>·</span>
                      <span>floor: {cls?.floor.replace(/_/g, '-')}</span>
                      {cls?.fourEyes && <><span>·</span><span className="text-warn">four-eyes</span></>}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          <div className="px-3 py-2.5">
            <div className="label-cap">Experience</div>
            <div className="mt-1.5 grid grid-cols-3 gap-2 text-2xs">
              <div><span className="text-ink-3">Touches</span><div className="tnum text-ink-2">{wo.xla?.touches}</div></div>
              <div><span className="text-ink-3">Reassignments</span><div className="tnum text-ink-2">{wo.xla?.reassignments}</div></div>
              <div><span className="text-ink-3">Reopened</span><div className="text-ink-2">{wo.xla?.reopened ? 'yes' : 'no'}</div></div>
            </div>
          </div>
        </aside>
      </div>
    </>
  )
}

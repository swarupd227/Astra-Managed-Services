import React from 'react'
import { useNavigate } from 'react-router-dom'
import { Check, PenLine, ThumbsDown, ThumbsUp, X } from 'lucide-react'
import { useAstra, useWorkList } from '@/domain/store'
import { ROLE_BY_ID, AC } from '@/domain/reference'
import { TOWER_BY_ID } from '@/domain/estate'
import { AgentChip, Assignee, EvidenceLink, PageHeader, PriorityChip, SlaClock, StateChip, AutonomyChip } from '@/ui/domain'
import { Button, Card, Chip, Empty, Metric, Tabs } from '@/ui/primitives'
import { cn, ago, mins, pct } from '@/lib/format'
import type { WorkObject } from '@/domain/types'
import { OPERATIONAL } from '@/domain/metrics'

/**
 * The resolver's queue is not a list of raw tickets. Every object arrives
 * triaged, enriched and usually with a drafted plan; the engineer's first
 * action is adopt, modify or reject — and that keystroke feeds evaluation.
 */
export function ResolverWorkspace() {
  const nav = useNavigate()
  const work = useWorkList()
  const roleId = useAstra((s) => s.roleId)
  const approve = useAstra((s) => s.approve)
  const reject = useAstra((s) => s.reject)
  const pushToast = useAstra((s) => s.pushToast)
  const role = ROLE_BY_ID[roleId]

  const [tab, setTab] = React.useState<'mine' | 'unassigned' | 'agentPre'>('agentPre')
  const [selectedId, setSelectedId] = React.useState<string | null>(null)
  const [feedback, setFeedback] = React.useState<Record<string, 'up' | 'down'>>({})

  const queues = React.useMemo(() => {
    const open = work.filter((w) => !['resolved', 'learned'].includes(w.state))
    return {
      agentPre: open.filter((w) => w.assigneeKind === 'agent' && ['triaged', 'planned', 'gated'].includes(w.state)).slice(0, 40),
      mine: open.filter((w) => w.assignee === role.person).slice(0, 40),
      unassigned: open.filter((w) => !w.assignee).slice(0, 40),
    }
  }, [work, role.person])

  const list = queues[tab]
  const selected = selectedId ? work.find((w) => w.id === selectedId) ?? null : list[0] ?? null

  const rate = (wo: WorkObject, v: 'up' | 'down') => {
    setFeedback((f) => ({ ...f, [wo.id]: v }))
    pushToast({
      title: v === 'up' ? 'Agent pre-work rated useful' : 'Agent pre-work rated unhelpful',
      body: 'One keystroke. The score joins the evaluation dataset and moves this agent’s grade on this action class.',
      tone: v === 'up' ? 'ok' : 'warn',
    })
  }

  return (
    <>
      <PageHeader
        title="Resolver Workspace"
        subtitle="Agent-triaged queue · adopt, modify or reject"
        meta={<Chip tone="agent">{queues.agentPre.length} pre-worked</Chip>}
        actions={<span className="text-2xs text-ink-3">Signed in as {role.person}</span>}
      />

      <div className="grid shrink-0 grid-cols-2 gap-4 border-b border-line bg-surface px-4 py-2.5 md:grid-cols-4">
        <Metric size="sm" label="Pre-worked for you" value={queues.agentPre.length} hint="triaged, enriched, plan drafted" />
        <Metric size="sm" label="Assigned to you" value={queues.mine.length} hint="you hold accountability" />
        <Metric size="sm" label="Median pre-work saving" value={`${OPERATIONAL.preWorkSavingMins} min`} hint="diagnosis time you no longer spend" />
        <Metric size="sm" label="Your adopt rate" value={`${OPERATIONAL.planAdoptRate}%`} hint="how often you take the agent's plan unchanged" />
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-[380px_1fr]">
        <section className="flex min-h-0 flex-col border-r border-line">
          <div className="shrink-0 border-b border-line px-3 py-1.5">
            <Tabs
              value={tab}
              onChange={(v) => { setTab(v); setSelectedId(null) }}
              tabs={[
                { id: 'agentPre', label: 'Agent pre-worked', count: queues.agentPre.length },
                { id: 'mine', label: 'Mine', count: queues.mine.length },
                { id: 'unassigned', label: 'Unassigned', count: queues.unassigned.length },
              ]}
            />
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto">
            {list.length === 0 && <Empty title="Queue clear" body="Nothing waiting in this lane." />}
            {list.map((wo) => (
              <button
                key={wo.id}
                onClick={() => setSelectedId(wo.id)}
                className={cn(
                  'flex w-full items-start gap-2 border-b border-line/60 px-3 py-2 text-left transition-colors',
                  selected?.id === wo.id ? 'bg-brand/[0.09]' : 'hover:bg-raised',
                )}
              >
                <PriorityChip p={wo.priority} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-xs text-ink">{wo.title}</span>
                  <span className="mt-0.5 flex flex-wrap items-center gap-1.5 text-2xs text-ink-3">
                    <span className="font-mono">{wo.ref}</span>
                    <StateChip state={wo.state} />
                    {/* Who did the pre-work this queue exists to hand over. */}
                    <Assignee id={wo.assignee} kind={wo.assigneeKind} />
                  </span>
                </span>
                <span className="w-[66px] shrink-0">
                  <SlaClock elapsed={wo.slaElapsedMins} target={wo.slaTargetMins} paused={wo.slaPaused} compactMode />
                </span>
              </button>
            ))}
          </div>
        </section>

        <section className="min-h-0 overflow-y-auto bg-surface">
          {!selected ? (
            <Empty title="Nothing selected" body="Pick a work object from your queue." />
          ) : (
            <div className="space-y-3 p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <PriorityChip p={selected.priority} />
                    <StateChip state={selected.state} />
                    {selected.autonomy && <AutonomyChip mode={selected.autonomy.mode} full />}
                  </div>
                  <h2 className="mt-1.5 font-display text-sm font-semibold text-ink">{selected.title}</h2>
                  <p className="mt-1 text-2xs text-ink-3">
                    <span className="font-mono text-ink-2">{selected.ref}</span> · {TOWER_BY_ID[selected.tower]?.name} · opened {ago(selected.createdAt)}
                  </p>
                </div>
                <Button size="sm" variant="ghost" onClick={() => nav(`/operate/work/${selected.id}`)}>Full detail</Button>
              </div>

              <Card dense title="What the agents have already done" >
                <ol className="space-y-2">
                  {selected.narrative.filter((n) => n.actorKind === 'agent').map((n) => (
                    <li key={n.id} className="flex gap-2">
                      <span className="mt-[3px] shrink-0"><Check size={11} className="text-ok" /></span>
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center gap-1.5">
                          <span className="text-2xs font-medium text-agent">{n.actor}</span>
                          <span className="text-[10px] text-ink-3">{ago(n.at)}</span>
                        </span>
                        <p className="mt-0.5 text-2xs leading-relaxed text-ink-2">{n.text}</p>
                        {n.evidenceId && <EvidenceLink id={n.evidenceId} className="mt-0.5" />}
                      </span>
                    </li>
                  ))}
                </ol>

                <div className="mt-3 flex items-center gap-2 border-t border-line pt-2.5">
                  <span className="text-2xs text-ink-3">Was this pre-work useful?</span>
                  <Button
                    size="sm"
                    variant={feedback[selected.id] === 'up' ? 'primary' : 'ghost'}
                    onClick={() => rate(selected, 'up')}
                  >
                    <ThumbsUp size={11} /> Useful
                  </Button>
                  <Button
                    size="sm"
                    variant={feedback[selected.id] === 'down' ? 'danger' : 'ghost'}
                    onClick={() => rate(selected, 'down')}
                  >
                    <ThumbsDown size={11} /> Not useful
                  </Button>
                  <span className="ml-auto text-2xs text-ink-3">one keystroke · feeds the evaluation service</span>
                </div>
              </Card>

              {selected.autonomy && (
                <Card dense title="Proposed plan" subtitle={`${selected.autonomy.actionClasses.map((c) => `${c} ${AC[c]?.name}`).join(' · ')}`}>
                  <div className="space-y-2 text-2xs leading-relaxed text-ink-2">
                    <p>
                      Execution mode <span className="text-ink">{selected.autonomy.mode.replace(/_/g, '-')}</span> under{' '}
                      <span className="font-mono text-ink">{selected.autonomy.policyId} {selected.autonomy.policyVersion}</span>, decided in{' '}
                      <span className="tnum">{selected.autonomy.evaluatedInMs} ms</span> at{' '}
                      <span className="tnum">{pct(selected.autonomy.planConfidence * 100, 0)}</span> plan confidence.
                    </p>
                    <p className="text-ink-3">
                      Estimated manual path <span className="tnum text-ink-2">{mins(selected.economics.estManualMins)}</span>. Adopting the
                      agent plan puts the effort delta into the Glidepath Ledger under <span className="text-ink-2">acceleration</span>, pending verification.
                    </p>
                  </div>

                  <div className="mt-3 flex flex-wrap items-center gap-1.5 border-t border-line pt-2.5">
                    {selected.state === 'gated' && role.canApprove ? (
                      <>
                        <Button variant="primary" onClick={() => approve(selected.id, role.person, 'adopted unchanged')}>
                          <Check size={12} /> Adopt plan
                        </Button>
                        <Button variant="default" onClick={() => nav(`/operate/work/${selected.id}`)}><PenLine size={12} /> Modify…</Button>
                        <Button variant="default" onClick={() => reject(selected.id, role.person, 'resolver took a different approach')}>
                          <X size={12} /> Reject
                        </Button>
                      </>
                    ) : (
                      <>
                        <Button variant="primary" onClick={() => nav(`/operate/work/${selected.id}`)}>Open workspace</Button>
                        {!role.canApprove && (
                          <span className="text-2xs text-ink-3">
                            {role.title} does not hold the approval pen — adopting a gated plan routes to {TOWER_BY_ID[selected.tower]?.sdm}.
                          </span>
                        )}
                      </>
                    )}
                  </div>
                </Card>
              )}

              <Card dense title="Knowledge in context" subtitle="Graph slice cited by the agent">
                <div className="flex flex-wrap gap-1">
                  {selected.affected.map((a) => <Chip key={a} mono>{a}</Chip>)}
                  <Chip tone="info" mono>{selected.demandClass}</Chip>
                </div>
              </Card>
            </div>
          )}
        </section>
      </div>
    </>
  )
}

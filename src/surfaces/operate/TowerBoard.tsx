import React from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { Activity, Filter, Radio, Siren, SlidersHorizontal } from 'lucide-react'
import { TOWERS, TOWER_BY_ID, AGENT_BY_ID } from '@/domain/estate'
import { SERVICE_LINES } from '@/domain/reference'
import { useAstra } from '@/domain/store'
import { PageHeader, PriorityChip, SlaClock, StateChip, Assignee, AutonomyChip, EvidenceLink, AgentChip } from '@/ui/domain'
import { ActivityStream } from '@/ui/ActivityStream'
import { Button, Card, Chip, Dot, Empty, Metric, Tabs, inputClass, selectClass } from '@/ui/primitives'
import { Sparkline } from '@/ui/charts'
import { cn, ago, mins, num, pct } from '@/lib/format'
import type { Priority, WorkObject } from '@/domain/types'
import { HISTORY } from '@/domain/metrics'

const TOWER_STATE_LABEL: Record<string, string> = {
  S0: 'Onboarding', S1: 'Codifying', S2: 'Shadowing', S3: 'Hypercare',
  S4: 'Steady Run', S5: 'Optimising', S6: 'Transforming',
}

function TowerStateChips({ towerId }: { towerId: string }) {
  const t = TOWER_BY_ID[towerId]
  if (!t) return null
  return (
    <span className="flex flex-wrap items-center gap-1">
      {t.concurrentStates.map((s) => (
        <Chip key={s} tone={s === 'S4' ? 'ok' : s === 'S5' ? 'brand' : s === 'S6' ? 'agent' : 'warn'} title={`${s} ${TOWER_STATE_LABEL[s]}`}>
          {s} {TOWER_STATE_LABEL[s]}
        </Chip>
      ))}
    </span>
  )
}

/* ------------------------------- Work row ---------------------------------- */

function WorkRow({ wo, selected, onSelect }: { wo: WorkObject; selected: boolean; onSelect: () => void }) {
  const nav = useNavigate()
  return (
    <button
      onClick={onSelect}
      onDoubleClick={() => nav(`/operate/work/${wo.id}`)}
      className={cn(
        'group flex w-full items-center gap-2 border-b border-line/60 px-2.5 py-1.5 text-left transition-colors',
        selected ? 'bg-brand/[0.09]' : 'hover:bg-raised',
      )}
    >
      <PriorityChip p={wo.priority} />
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1.5">
          <span className="truncate text-xs text-ink">{wo.title}</span>
          {wo.awaitingApproval && <Chip tone="warn">gate</Chip>}
          {wo.slaPaused && <Chip tone="neutral" title={`Clock paused — ${wo.pauseReason}`}>paused</Chip>}
        </span>
        <span className="mt-0.5 flex items-center gap-1.5 text-2xs text-ink-3">
          <span className="font-mono">{wo.ref}</span>
          <span>·</span>
          <span className="truncate">{wo.demandClass}</span>
        </span>
      </span>
      <span className="hidden w-[86px] shrink-0 sm:block">
        <Assignee id={wo.assignee} kind={wo.assigneeKind} />
      </span>
      <span className="w-[74px] shrink-0">
        <SlaClock elapsed={wo.slaElapsedMins} target={wo.slaTargetMins} paused={wo.slaPaused} compactMode />
      </span>
    </button>
  )
}

/* ---------------------------------------------------------------------------
   The activity feed now lives in ui/ActivityStream — the Operations Room
   (Addendum A §A3.1) renders the same component in its centre zone.
   -------------------------------------------------------------------------- */

/* -------------------------------- Selected --------------------------------- */

function SelectedPane({ wo }: { wo: WorkObject | null }) {
  const nav = useNavigate()
  const declareMi = useAstra((s) => s.declareMi)
  const roleId = useAstra((s) => s.roleId)

  if (!wo) {
    return <Empty title="Select a work object" body="Pick a row on the left to see its summary, or press ⌘K to jump straight to one." />
  }

  const t = TOWER_BY_ID[wo.tower]
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="shrink-0 border-b border-line px-4 py-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <PriorityChip p={wo.priority} />
              <StateChip state={wo.state} />
              {wo.autonomy && <AutonomyChip mode={wo.autonomy.mode} full />}
            </div>
            <h3 className="mt-1.5 text-sm font-medium leading-snug text-ink">{wo.title}</h3>
            <p className="mt-1 flex flex-wrap items-center gap-1.5 text-2xs text-ink-3">
              <span className="font-mono text-ink-2">{wo.ref}</span>
              <span>·</span>
              <span>{t?.name}</span>
              <span>·</span>
              <span>from {wo.source.system}</span>
              <EvidenceLink id={wo.evidenceHead} />
            </p>
          </div>
          <div className="flex shrink-0 flex-col gap-1">
            <Button size="sm" variant="primary" onClick={() => nav(`/operate/work/${wo.id}`)}>Open</Button>
            {wo.priority === 'P1' && roleId === 'mim' && (
              <Button size="sm" variant="danger" onClick={() => declareMi(wo.id, 'D. Kowalski')}>
                <Siren size={11} /> Declare MI
              </Button>
            )}
          </div>
        </div>
      </div>

      <div className="grid shrink-0 grid-cols-3 gap-3 border-b border-line px-4 py-3">
        <Metric size="sm" label="SLA remaining" value={<SlaClock elapsed={wo.slaElapsedMins} target={wo.slaTargetMins} paused={wo.slaPaused} />} />
        <Metric size="sm" label="Breach probability" value={pct(wo.breachProbability * 100, 0)} hint={wo.breachProbability > 0.6 ? 'jeopardy' : 'within tolerance'} />
        <Metric size="sm" label="Effort delta" value={`${mins(wo.economics.estManualMins)} → ${wo.economics.actualAgentMins ? mins(wo.economics.actualAgentMins) : '—'}`} hint={`tokens ${wo.economics.tokensUsd.toFixed(2)} USD`} />
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
        <h4 className="label-cap">Narrative</h4>
        <ol className="mt-2 space-y-2.5">
          {wo.narrative.slice().reverse().map((n) => (
            <li key={n.id} className="flex gap-2">
              <span className="mt-1 shrink-0"><Dot tone={n.level === 'crit' ? 'crit' : n.level === 'warn' ? 'warn' : n.level === 'ok' ? 'ok' : n.actorKind === 'agent' ? 'agent' : 'neutral'} /></span>
              <span className="min-w-0 flex-1">
                <span className="flex items-baseline gap-1.5">
                  {n.actorKind === 'agent' && AGENT_BY_ID[`agt_${n.actor.toLowerCase()}`] ? (
                    <AgentChip id={`agt_${n.actor.toLowerCase()}`} />
                  ) : (
                    <span className={cn('text-2xs font-medium', n.actorKind === 'agent' ? 'text-agent' : 'text-ink-2')}>{n.actor}</span>
                  )}
                  <span className="ml-auto shrink-0 text-[10px] text-ink-3">{ago(n.at)}</span>
                </span>
                <p className="mt-0.5 text-2xs leading-relaxed text-ink-3">{n.text}</p>
                {n.evidenceId && <EvidenceLink id={n.evidenceId} className="mt-0.5" />}
              </span>
            </li>
          ))}
        </ol>
      </div>
    </div>
  )
}

/* --------------------------------- Screen ---------------------------------- */

export function TowerBoard() {
  const [params, setParams] = useSearchParams()
  const tower = params.get('tower') ?? 'twr_payments'
  const work = useAstra((s) => s.work)
  const brake = useAstra((s) => s.brake)
  const [selectedId, setSelectedId] = React.useState<string | null>('wo_hero01')
  const [q, setQ] = React.useState('')
  const [showResolved, setShowResolved] = React.useState(false)
  const [lane, setLane] = React.useState<'priority' | 'state' | 'assignee'>('priority')

  const t = TOWER_BY_ID[tower]
  const all = React.useMemo(() => Object.values(work).filter((w) => w.tower === tower), [work, tower])

  const filtered = React.useMemo(() => {
    const needle = q.trim().toLowerCase()
    return all.filter((w) => {
      if (!showResolved && ['resolved', 'learned'].includes(w.state)) return false
      if (!needle) return true
      return `${w.ref} ${w.title} ${w.demandClass} ${w.assignee ?? ''}`.toLowerCase().includes(needle)
    })
  }, [all, q, showResolved])

  const lanes = React.useMemo(() => {
    if (lane === 'priority') {
      const order: Priority[] = ['P1', 'P2', 'P3', 'P4']
      return order.map((p) => ({ key: p, label: p, items: filtered.filter((w) => w.priority === p) })).filter((l) => l.items.length)
    }
    if (lane === 'state') {
      const order = ['gated', 'executing', 'verifying', 'planned', 'triaged', 'detected', 'resolved', 'learned']
      return order.map((s) => ({ key: s, label: s[0].toUpperCase() + s.slice(1), items: filtered.filter((w) => w.state === s) })).filter((l) => l.items.length)
    }
    return [
      { key: 'agent', label: 'Agent-held', items: filtered.filter((w) => w.assigneeKind === 'agent') },
      { key: 'human', label: 'Human-held', items: filtered.filter((w) => w.assigneeKind === 'human') },
      { key: 'none', label: 'Unassigned', items: filtered.filter((w) => !w.assigneeKind) },
    ].filter((l) => l.items.length)
  }, [filtered, lane])

  const selected = selectedId ? work[selectedId] ?? null : null
  const openCount = all.filter((w) => !['resolved', 'learned'].includes(w.state)).length
  const jeopardy = all.filter((w) => w.breachProbability > 0.6 && !['resolved', 'learned'].includes(w.state)).length
  const agentHeld = all.filter((w) => w.assigneeKind === 'agent').length
  const braked = brake.global || brake.towers.includes(tower)

  return (
    <>
      <PageHeader
        title={t?.name ?? 'Tower Board'}
        subtitle={t ? `${SERVICE_LINES[t.line].name} · owner ${t.owner} · SDM ${t.sdm} · ${num(t.entities)} estate entities, ${num(t.assertions)} assertions` : undefined}
        meta={<TowerStateChips towerId={tower} />}
        actions={
          <>
            {braked && <Chip tone="crit">brake applied · L1 max</Chip>}
            <select value={tower} onChange={(e) => setParams({ tower: e.target.value })} className={cn(selectClass, 'w-[210px]')}>
              {TOWERS.map((tw) => (
                <option key={tw.id} value={tw.id}>{tw.name}</option>
              ))}
            </select>
          </>
        }
      />

      <div className="grid shrink-0 grid-cols-2 gap-4 border-b border-line bg-surface px-4 py-2.5 md:grid-cols-5">
        <Metric size="sm" label="Open work" value={openCount} hint={`${all.length} total in window`} />
        <Metric size="sm" label="In jeopardy" value={jeopardy} deltaTone={jeopardy ? 'crit' : 'ok'} hint="predicted breach > 60%" />
        <Metric size="sm" label="Agent-held" value={pct((agentHeld / Math.max(1, all.length)) * 100, 0)} hint={`${agentHeld} of ${all.length} work objects`} />
        <Metric size="sm" label="Autonomy-eligible volume" value={pct(t?.autonomyEligibleVolume ?? 0, 1)} hint="coupling F1" />
        <div className="min-w-0">
          <div className="label-cap">Glidepath vs. contract</div>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="tnum font-display text-lg font-semibold leading-none text-ink">{(t?.glidepathActual ?? 0).toFixed(1)}%</span>
            <span className={cn('tnum text-2xs', (t?.glidepathActual ?? 0) <= (t?.glidepathContracted ?? 0) ? 'text-ok' : 'text-warn')}>
              vs {(t?.glidepathContracted ?? 0).toFixed(1)}% contracted
            </span>
          </div>
          <div className="mt-1"><Sparkline data={[...HISTORY.glidepathActual, t?.glidepathActual ?? HISTORY.glidepathActual[HISTORY.glidepathActual.length - 1]]} tone="ok" showLast /></div>
        </div>
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-[minmax(320px,1fr)_minmax(360px,1.15fr)_minmax(260px,0.75fr)]">
        {/* Lanes */}
        <section className="flex min-h-0 flex-col border-r border-line">
          <div className="flex shrink-0 items-center gap-2 border-b border-line px-2.5 py-1.5">
            <Filter size={12} className="shrink-0 text-ink-3" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Filter this tower…" className={cn(inputClass, 'h-7 flex-1')} />
            <select value={lane} onChange={(e) => setLane(e.target.value as typeof lane)} className={cn(selectClass, 'h-7 w-[104px]')}>
              <option value="priority">By priority</option>
              <option value="state">By state</option>
              <option value="assignee">By holder</option>
            </select>
            <Button size="sm" variant={showResolved ? 'default' : 'ghost'} onClick={() => setShowResolved((v) => !v)} title="Include resolved and learned">
              <SlidersHorizontal size={11} />
            </Button>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto">
            {lanes.length === 0 && <Empty title="Nothing matches" body="Adjust the filter, or include resolved work." />}
            {lanes.map((l) => (
              <div key={l.key}>
                <div className="sticky top-0 z-10 flex items-center gap-2 border-b border-line bg-sunken px-2.5 py-1">
                  <span className="text-2xs font-semibold uppercase tracking-[0.08em] text-ink-2">{l.label}</span>
                  <span className="tnum text-2xs text-ink-3">{l.items.length}</span>
                  <span className="ml-auto h-[3px] w-14 overflow-hidden rounded-full bg-line">
                    <span className="block h-full rounded-full bg-brand" style={{ width: `${(l.items.length / Math.max(1, filtered.length)) * 100}%` }} />
                  </span>
                </div>
                {l.items
                  .slice()
                  .sort((a, b) => b.slaElapsedMins / b.slaTargetMins - a.slaElapsedMins / a.slaTargetMins)
                  .map((wo) => (
                    <WorkRow key={wo.id} wo={wo} selected={wo.id === selectedId} onSelect={() => setSelectedId(wo.id)} />
                  ))}
              </div>
            ))}
          </div>
        </section>

        {/* Selected */}
        <section className="flex min-h-0 flex-col border-r border-line bg-surface">
          <SelectedPane wo={selected} />
        </section>

        {/* Activity */}
        <section className="hidden min-h-0 flex-col bg-surface lg:flex">
          <div className="flex shrink-0 items-center gap-2 border-b border-line px-3 py-2">
            <Radio size={12} className="text-agent" />
            <h3 className="font-display text-[13px] font-semibold text-ink">Live agent activity</h3>
            <Chip tone="agent" className="ml-auto"><Activity size={9} />streaming</Chip>
          </div>
          <ActivityStream tower={tower} />
        </section>
      </div>
    </>
  )
}

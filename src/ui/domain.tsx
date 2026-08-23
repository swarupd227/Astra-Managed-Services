import React from 'react'
import { Link } from 'react-router-dom'
import { Bot, ShieldCheck, User, Link2 } from 'lucide-react'
import { Chip, Dot, Hint } from './primitives'
import { cn, clock, initials, pct } from '@/lib/format'
import { AGENT_BY_ID } from '@/domain/estate'
import { MODE_TO_LEVEL } from '@/domain/reference'
import type { ExecutionMode, Grade, Priority, WorkState } from '@/domain/types'

/* --------------------------------- Autonomy -------------------------------- */

export const MODE_META: Record<ExecutionMode, { label: string; short: string; tone: 'neutral' | 'info' | 'warn' | 'brand' | 'ok'; meaning: string }> = {
  manual: { label: 'L0 Manual', short: 'L0', tone: 'neutral', meaning: 'Platform observes and records only. Humans execute.' },
  advise: { label: 'L1 Advise', short: 'L1', tone: 'info', meaning: 'Agent diagnoses and plans. A human executes; the platform verifies and learns.' },
  approve_first: { label: 'L2 Approve-first', short: 'L2', tone: 'warn', meaning: 'Agent executes only after explicit approval of the concrete plan.' },
  supervised: { label: 'L3 Supervised', short: 'L3', tone: 'brand', meaning: 'Agent executes immediately. Human on the loop with real-time visibility and a hard abort.' },
  autonomous: { label: 'L4 Autonomous', short: 'L4', tone: 'ok', meaning: 'Agent executes unattended within budgeted scope. Humans audit by evidence and sampled review.' },
}

export function AutonomyChip({ mode, full, className }: { mode: ExecutionMode; full?: boolean; className?: string }) {
  const m = MODE_META[mode]
  return (
    <Hint text={m.meaning}>
      <Chip tone={m.tone} className={className}>{full ? m.label : m.short}</Chip>
    </Hint>
  )
}

export function LevelPip({ level, target }: { level: number; target?: number }) {
  return (
    <span className="inline-flex items-center gap-[2px]" title={target !== undefined ? `Current L${level} · target L${target}` : `L${level}`}>
      {[0, 1, 2, 3, 4].map((i) => (
        <span
          key={i}
          className={cn(
            'h-2.5 w-[3px] rounded-full',
            i <= level ? 'bg-brand' : target !== undefined && i <= target ? 'bg-brand/25' : 'bg-line-strong/50',
          )}
        />
      ))}
    </span>
  )
}

/* ---------------------------------- Grades --------------------------------- */

export function GradeChip({ grade, ac }: { grade: Grade; ac?: string }) {
  const tone = grade === 'A' ? 'ok' : grade === 'B' ? 'brand' : grade === 'C' ? 'warn' : 'crit'
  return (
    <Chip tone={tone} mono title={ac ? `Grade ${grade} on ${ac}` : undefined}>
      {ac ? `${ac} ${grade}` : grade}
    </Chip>
  )
}

/* --------------------------------- Identity -------------------------------- */

/**
 * Agent contributions are always attributed and styled distinctly (§15.2) —
 * never laundered as system text.
 */
export function AgentChip({ id, showGrade, className }: { id: string; showGrade?: string; className?: string }) {
  const a = AGENT_BY_ID[id]
  if (!a) return <span className="text-2xs text-ink-3">{id}</span>
  return (
    <Link
      to={`/atlas/agent/${a.id}`}
      onClick={(e) => e.stopPropagation()}
      className={cn(
        'inline-flex h-[18px] max-w-full shrink-0 items-center gap-1 rounded-xs border border-agent/40 bg-agent/10 px-1.5 text-2xs font-medium leading-none text-agent hover:bg-agent/20',
        className,
      )}
      title={`${a.name} — ${a.mission}`}
    >
      <Bot size={10} strokeWidth={2.2} className="shrink-0" />
      <span className="truncate">{a.name}</span>
      {showGrade && a.grants[showGrade] && <span className="font-mono opacity-70">{a.grants[showGrade]}</span>}
    </Link>
  )
}

export function HumanChip({ name, className }: { name: string; className?: string }) {
  return (
    <span className={cn('inline-flex h-[18px] max-w-full items-center gap-1 rounded-xs border border-line-strong/70 bg-raised px-1.5 text-2xs font-medium leading-none text-ink-2', className)}>
      <User size={10} strokeWidth={2.2} className="shrink-0 opacity-60" />
      <span className="truncate">{name}</span>
    </span>
  )
}

export function Assignee({ id, kind }: { id: string | null; kind: 'human' | 'agent' | null }) {
  if (!id || !kind) return <span className="text-2xs text-ink-3">Unassigned</span>
  return kind === 'agent' ? <AgentChip id={id} /> : <HumanChip name={id} />
}

export function Avatar({ name, size = 22 }: { name: string; size?: number }) {
  return (
    <span
      className="inline-flex shrink-0 items-center justify-center rounded-full border border-line-strong bg-raised font-medium text-ink-2"
      style={{ width: size, height: size, fontSize: size * 0.38 }}
    >
      {initials(name)}
    </span>
  )
}

/* ---------------------------------- SLA ------------------------------------ */

export function SlaClock({ elapsed, target, paused, compactMode }: { elapsed: number; target: number; paused?: boolean; compactMode?: boolean }) {
  const remaining = target - elapsed
  const burn = elapsed / target
  const tone = paused ? 'neutral' : burn >= 1 ? 'crit' : burn >= 0.8 ? 'warn' : burn >= 0.6 ? 'info' : 'ok'
  const col = { neutral: 'text-ink-3', crit: 'text-crit', warn: 'text-warn', info: 'text-info', ok: 'text-ink-2' }[tone]
  const barCol = { neutral: 'bg-ink-3', crit: 'bg-crit', warn: 'bg-warn', info: 'bg-info', ok: 'bg-ok' }[tone]
  return (
    <span className="inline-flex min-w-0 flex-col gap-1" title={paused ? 'Clock paused — typed reason recorded as an evidence record' : `${pct(burn * 100, 0)} of target elapsed`}>
      <span className={cn('tnum inline-flex items-center gap-1 text-2xs font-medium leading-none', col)}>
        {paused && <span className="text-ink-3">❙❙</span>}
        {remaining < 0 ? `−${clock(-remaining)}` : clock(remaining)}
        {!compactMode && <span className="font-normal text-ink-3">left</span>}
      </span>
      <span className="h-[3px] w-full overflow-hidden rounded-full bg-sunken">
        <span className={cn('block h-full rounded-full transition-[width] duration-700 ease-snap', barCol, paused && 'opacity-40')} style={{ width: `${Math.min(100, burn * 100)}%` }} />
      </span>
    </span>
  )
}

export function PriorityChip({ p }: { p: Priority }) {
  const tone = p === 'P1' ? 'crit' : p === 'P2' ? 'warn' : p === 'P3' ? 'info' : 'neutral'
  return <Chip tone={tone} mono>{p}</Chip>
}

/* --------------------------------- Lifecycle ------------------------------- */

export const STATE_META: Record<WorkState, { label: string; tone: 'neutral' | 'info' | 'warn' | 'brand' | 'ok' | 'agent' }> = {
  detected: { label: 'Detected', tone: 'neutral' },
  triaged: { label: 'Triaged', tone: 'info' },
  planned: { label: 'Planned', tone: 'info' },
  gated: { label: 'Gated', tone: 'warn' },
  executing: { label: 'Executing', tone: 'brand' },
  verifying: { label: 'Verifying', tone: 'agent' },
  resolved: { label: 'Resolved', tone: 'ok' },
  learned: { label: 'Learned', tone: 'ok' },
}

export function StateChip({ state }: { state: WorkState }) {
  const m = STATE_META[state]
  return (
    <Chip tone={m.tone}>
      <Dot tone={m.tone} pulse={state === 'executing'} />
      {m.label}
    </Chip>
  )
}

/* --------------------------------- Evidence -------------------------------- */

/**
 * The provenance affordance. No screen shows a number the platform cannot
 * defend — every figure carries one of these (§15.2).
 */
export function EvidenceLink({
  id, label, className, compactMode,
}: { id: string; label?: string; className?: string; compactMode?: boolean }) {
  return (
    <Link
      to={`/governance/evidence?q=${encodeURIComponent(id)}`}
      onClick={(e) => e.stopPropagation()}
      title={`Open the evidence record behind this — ${id}`}
      className={cn(
        'inline-flex shrink-0 items-center gap-1 rounded-xs px-1 font-mono text-2xs text-ink-3 transition-colors hover:bg-brand/10 hover:text-brand-ink',
        className,
      )}
    >
      <Link2 size={9} strokeWidth={2.4} />
      {!compactMode && (label ?? id)}
    </Link>
  )
}

export function SealBadge({ sealed }: { sealed: boolean }) {
  return sealed ? (
    <Hint text="Sealed into the hash-chained evidence store and exported to the client GRC and SIEM.">
      <span className="inline-flex items-center gap-1 text-2xs text-ok"><ShieldCheck size={11} strokeWidth={2.2} />Sealed</span>
    </Hint>
  ) : (
    <span className="inline-flex items-center gap-1 text-2xs text-ink-3">Unsealed</span>
  )
}

/* ------------------------------ Section header ----------------------------- */

export function PageHeader({
  title, subtitle, meta, actions, children,
}: {
  title: React.ReactNode
  subtitle?: React.ReactNode
  meta?: React.ReactNode
  actions?: React.ReactNode
  children?: React.ReactNode
}) {
  return (
    <header className="flex shrink-0 flex-wrap items-end justify-between gap-3 border-b border-line bg-surface px-4 py-3">
      <div className="min-w-0">
        <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
          <h1 className="truncate font-display text-[15px] font-semibold leading-tight tracking-tight text-ink">{title}</h1>
          {meta}
        </div>
        {subtitle && <p className="mt-1 max-w-3xl text-2xs leading-relaxed text-ink-3">{subtitle}</p>}
      </div>
      {actions && <div className="flex min-w-0 max-w-full shrink-0 flex-wrap items-center gap-1.5">{actions}</div>}
      {children}
    </header>
  )
}

export function levelOf(mode: ExecutionMode) {
  return MODE_TO_LEVEL[mode]
}

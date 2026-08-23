import React from 'react'
import { Link } from 'react-router-dom'
import { useAstra } from '@/domain/store'
import { AGENTS, AGENT_BY_ID } from '@/domain/estate'
import { AgentChip, EvidenceLink } from './domain'
import { Dot } from './primitives'
import { cn, ago } from '@/lib/format'
import type { TimelineEntry, WorkObject } from '@/domain/types'

/* ==========================================================================
   The Activity Stream (Addendum A §A7.2).

   The narrated feed of work being done. Every line is attributed to a named
   actor — D4's "no anonymous system text, anywhere" — carries its evidence,
   and opens the work object behind it.

   Seeded narrative rows identify their actor by display name ("Sentinel");
   rows emitted by the simulation identify it by id ("agt_sentinel"). Resolve
   both so a chip renders either way.
   ========================================================================== */

const AGENT_BY_NAME: Record<string, string> = Object.fromEntries(
  AGENTS.map((a) => [a.name.toLowerCase(), a.id]),
)

function agentIdFor(actor: string): string | null {
  if (AGENT_BY_ID[actor]) return actor
  return AGENT_BY_NAME[actor.toLowerCase()] ?? null
}

type Row = TimelineEntry & { wo: WorkObject }

function toneFor(n: TimelineEntry) {
  if (n.level === 'crit') return 'crit'
  if (n.level === 'warn') return 'warn'
  if (n.level === 'ok') return 'ok'
  return n.actorKind === 'agent' ? 'agent' : 'neutral'
}

export function ActivityStream({
  tower = 'all',
  limit = 34,
  className,
}: {
  tower?: string
  limit?: number
  className?: string
}) {
  const work = useAstra((s) => s.work)
  const tick = useAstra((s) => s.tick)

  const feed = React.useMemo<Row[]>(
    () =>
      Object.values(work)
        .filter((w) => tower === 'all' || w.tower === tower)
        .flatMap((w) => w.narrative.map((n) => ({ ...n, wo: w })))
        .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())
        .slice(0, limit),
    // tick is a dependency because narrative grows in place as work advances.
    [work, tower, limit, tick],
  )

  return (
    <div className={cn('flex min-h-0 flex-1 flex-col', className)}>
      <div className="min-h-0 flex-1 overflow-y-auto">
        {feed.map((n, i) => {
          const agentId = n.actorKind === 'agent' ? agentIdFor(n.actor) : null
          return (
            <div
              key={`${n.wo.id}-${n.id}`}
              className={cn(
                'group relative flex gap-2 border-b border-line/50 px-3 py-2 transition-colors hover:bg-raised',
                // Only the newest row animates in, so arrival reads as work
                // happening rather than the whole list redrawing.
                i === 0 && 'animate-rise-in',
              )}
            >
              {/* The row opens the work object. It is an overlay rather than a
                  wrapper because the Agent Chip and evidence link are links in
                  their own right, and anchors cannot nest. */}
              <Link
                to={`/operate/work/${n.wo.id}`}
                aria-label={`Open ${n.wo.ref} — ${n.wo.title}`}
                className="absolute inset-0 rounded-xs focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-brand"
              />
              <span className="pointer-events-none mt-1 shrink-0">
                <Dot tone={toneFor(n)} />
              </span>
              <span className="pointer-events-none min-w-0 flex-1">
                <span className="flex items-baseline gap-1.5">
                  {agentId ? (
                    <AgentChip id={agentId} className="pointer-events-auto relative shrink-0" />
                  ) : (
                    <span className="shrink-0 text-2xs font-medium text-ink-2">{n.actor}</span>
                  )}
                  <span className="truncate font-mono text-[10px] text-ink-3">{n.wo.ref}</span>
                  {n.evidenceId && (
                    <EvidenceLink id={n.evidenceId} className="pointer-events-auto relative" compactMode />
                  )}
                  <span className="ml-auto shrink-0 text-[10px] text-ink-3">{ago(n.at)}</span>
                </span>
                <span className="mt-0.5 block line-clamp-2 text-2xs leading-relaxed text-ink-3">{n.text}</span>
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

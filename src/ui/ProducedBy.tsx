import { useAstra, useWorkList } from '@/domain/store'
import { AgentChip } from './domain'
import { liveStateOf } from './WorkforcePanel'
import { Dot } from './primitives'
import { cn } from '@/lib/format'

/* ==========================================================================
   Who produced what this screen shows (AG-1, AG-4).

   The removal test asks whether a screen still makes sense with the agents
   deleted. Most reference surfaces failed it for one reason: they render the
   output of agent work without ever naming the worker, so the work reads as
   something the database did by itself.

   This is not a decoration strip. Each agent shown here is one whose charter
   actually produces the contents of the page, and its state is read live from
   the work it holds — so the line goes quiet when the workforce does.
   ========================================================================== */

const STATE_LABEL: Record<string, string> = {
  executing: 'executing',
  awaiting: 'awaiting you',
  watching: 'watching',
  suspended: 'suspended',
}

export function ProducedBy({
  agents,
  what,
  className,
}: {
  /** Agent ids whose work produces this page's contents. */
  agents: string[]
  /** What they produce, in the page's own terms. One clause, lower case. */
  what: string
  className?: string
}) {
  const workList = useWorkList()
  // The store's agent map, not the static estate — suspending an agent must
  // show here, otherwise the strip claims a worker that is not working.
  const agentMap = useAstra((s) => s.agents)
  const known = agents.map((id) => agentMap[id]).filter(Boolean)

  if (!known.length) return null

  return (
    <div
      className={cn(
        'flex flex-wrap items-center gap-x-2 gap-y-1 border-b border-line bg-sunken px-4 py-2 text-2xs text-ink-3',
        className,
      )}
    >
      <span className="label-cap">Produced by</span>
      {known.map((a) => {
        const live = liveStateOf(a, workList)
        const off = live.state === 'suspended'
        return (
          <span key={a.id} className="inline-flex items-center gap-1">
            <AgentChip id={a.id} />
            <span className={cn('inline-flex items-center gap-1', off && 'text-crit')}>
              <Dot tone={off ? 'crit' : live.state === 'executing' ? 'brand' : live.state === 'awaiting' ? 'warn' : 'agent'} pulse={live.state === 'executing'} />
              {off ? 'suspended' : STATE_LABEL[live.state] ?? live.state}
            </span>
          </span>
        )
      })}
      <span className="min-w-0 flex-1 text-ink-2">— {what}</span>
    </div>
  )
}

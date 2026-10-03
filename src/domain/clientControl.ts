import { AGENTS, AGENT_BY_ID } from './estate'
import { ACTION_CLASSES, LEVEL_TO_MODE, MODE_LABEL, MODE_TO_LEVEL, ROLE_BY_ID } from './reference'
import type { Agent, ExecutionMode } from './types'

/* ==========================================================================
   What the client controls.

   The platform promises the client may demote or stop any agent without a
   commercial conversation. A promise like that is worth nothing unless the
   mechanism exists, belongs to the client, and bites immediately — so the
   right is registered here with the roles that hold it, and a directive the
   client sets caps what the agent may do regardless of what we granted.

   Three properties make it a real right rather than a courtesy.

   It is the client's to exercise and the client's to lift: nobody on the
   supplier side can raise a ceiling the client lowered, which is why the
   directive log is read before our own grants on every reading.

   It takes effect on the spot. There is no notice period in which we might
   talk them out of it, and no approval of ours in the path.

   It changes nothing commercial. The service levels we owe stay owed, and
   the charge stays the charge: a client who stops an agent has not released
   us from the work, and that is stated on the right rather than left for
   the contract to settle later.
   ========================================================================== */

export type Cap = ExecutionMode

export type DirectiveKind = 'cap' | 'stop' | 'restore'

export const DIRECTIVE_LABEL: Record<DirectiveKind, string> = {
  cap: 'Ceiling lowered',
  stop: 'Stopped',
  restore: 'Restored',
}

export type Scope = 'agent' | 'action_class' | 'all'

export const SCOPE_LABEL: Record<Scope, string> = {
  agent: 'One agent',
  action_class: 'One action class, every agent',
  all: 'Every agent',
}

/** A right the client holds over the workforce, and what exercising it does not touch. */
export interface Right
{
  id: string
  name: string
  /** The roles that may exercise it. Client roles only, by design. */
  heldBy: string[]
  effect: string
  /** Hours of notice the supplier may require before it takes effect. */
  noticeHrs: number
  /** Who may lift it again. */
  liftedBy: 'client'
  /** What stays exactly as it was. */
  doesNotChange: string
}

export const RIGHTS: Right[] = [
  {
    id: 'rt_cap', name: 'Lower what an agent may do',
    heldBy: ['exec', 'serviceowner'],
    effect: 'Caps the agent at the chosen mode: anything above it needs a person, from the moment it is set',
    noticeHrs: 0, liftedBy: 'client',
    doesNotChange: 'Service levels, charges and the glidepath commitment stay exactly as they are',
  },
  {
    id: 'rt_stop', name: 'Stop an agent outright',
    heldBy: ['exec', 'serviceowner'],
    effect: 'The agent takes no action at all; its work returns to people',
    noticeHrs: 0, liftedBy: 'client',
    doesNotChange: 'Service levels remain owed in full — stopping an agent does not release the supplier from the work',
  },
  {
    id: 'rt_class', name: 'Withdraw an action class across the workforce',
    heldBy: ['exec', 'serviceowner'],
    effect: 'No agent may act in that class above the mode chosen, whatever its own grant says',
    noticeHrs: 0, liftedBy: 'client',
    doesNotChange: 'The supplier’s obligations for work in that class are unchanged',
  },
  {
    id: 'rt_restore', name: 'Lift a directive',
    heldBy: ['exec', 'serviceowner'],
    effect: 'Returns the agent to the grant it held before, and only the client can do it',
    noticeHrs: 0, liftedBy: 'client',
    doesNotChange: 'Nothing: the previous grant resumes as it stood',
  },
]

/** True where a role holds the client's rights over the workforce. */
export const holdsRights = (roleId: string): boolean =>
  RIGHTS.some((r) => r.heldBy.includes(roleId)) && ROLE_BY_ID[roleId]?.org === 'client'

export const RIGHT_HOLDERS = [...new Set(RIGHTS.flatMap((r) => r.heldBy))].filter(holdsRights)

/* -------------------------------- Directives -------------------------------- */

export interface Directive {
  id: string
  scope: Scope
  /** Agent id, action-class id, or empty for every agent. */
  targetId: string
  kind: DirectiveKind
  /** The ceiling the client has set, where the directive sets one. */
  cap?: Cap
  /** The person who exercised it, and the role they hold. */
  by: string
  role: string
  at: string
  reason: string
  evidenceId?: string
}

const rank = (m: Cap) => MODE_TO_LEVEL[m] ?? 0
const lower = (a: Cap, b: Cap): Cap => (rank(a) <= rank(b) ? a : b)

/** The directives in force, newest first, with lifted ones removed. */
export function inForce(log: Directive[]): Directive[] {
  const ordered = [...log].sort((a, b) => a.at.localeCompare(b.at))
  const held = new Map<string, Directive>()
  for (const d of ordered) {
    const key = `${d.scope}:${d.targetId}`
    if (d.kind === 'restore') held.delete(key)
    else held.set(key, d)
  }
  return [...held.values()].sort((a, b) => b.at.localeCompare(a.at))
}

export interface AgentControl {
  agent: Agent
  /** The ceiling the supplier granted. */
  granted: Cap
  /** The ceiling the client has imposed, if any. */
  clientCap: Cap | null
  stopped: boolean
  /** What the agent may actually do: the lower of the two, or nothing when stopped. */
  effective: Cap
  /** The directives that decide it. */
  directives: Directive[]
}

export interface ClassControl {
  id: string
  name: string
  /** The floor the engine holds for this class. */
  floor: Cap
  clientCap: Cap | null
  directive: Directive | null
}

export interface FleetControl {
  rights: Right[]
  agents: AgentControl[]
  classes: ClassControl[]
  directives: Directive[]
  capped: number
  stopped: number
  /** Agents the client has left exactly as granted. */
  untouched: number
  /** When the right was last exercised, or null if it never has been. */
  lastExercised: string | null
  /** Who, of the client's people, has exercised it. */
  exercisedBy: string[]
}

/**
 * Read the workforce as the client's directives leave it. The client's log is
 * applied over our grants, never the other way round.
 */
export function readControl(log: Directive[] = [], agents: Agent[] = AGENTS): FleetControl {
  const live = inForce(log)
  const all = live.find((d) => d.scope === 'all') ?? null

  const rows: AgentControl[] = agents.map((agent) => {
    const own = live.filter((d) => d.scope === 'agent' && d.targetId === agent.id)
    const applies = [...own, ...(all ? [all] : [])]
    const stopped = applies.some((d) => d.kind === 'stop')
    const caps = applies.filter((d): d is Directive & { cap: Cap } => d.kind === 'cap' && Boolean(d.cap)).map((d) => d.cap)
    const clientCap = caps.length ? caps.reduce(lower) : null
    const granted = agent.ceiling
    return {
      agent,
      granted,
      clientCap,
      stopped,
      effective: stopped ? LEVEL_TO_MODE[0] : clientCap ? lower(granted, clientCap) : granted,
      directives: applies,
    }
  })

  const classes: ClassControl[] = ACTION_CLASSES.map((c) => {
    const directive = live.find((d) => d.scope === 'action_class' && d.targetId === c.id) ?? null
    return { id: c.id, name: c.name, floor: c.floor as Cap, clientCap: directive?.cap ?? null, directive }
  })

  return {
    rights: RIGHTS,
    agents: rows,
    classes,
    directives: live,
    capped: rows.filter((r) => !r.stopped && r.clientCap && rank(r.effective) < rank(r.granted)).length,
    stopped: rows.filter((r) => r.stopped).length,
    untouched: rows.filter((r) => !r.stopped && !r.clientCap).length,
    lastExercised: log.length ? [...log].sort((a, b) => b.at.localeCompare(a.at))[0].at : null,
    exercisedBy: [...new Set(log.map((d) => d.by))],
  }
}

export const modeLabel = (m: Cap) => MODE_LABEL[m] ?? m

/** What a directive would do, for the confirmation card and the record. */
export function describeDirective(d: Pick<Directive, 'scope' | 'targetId' | 'kind' | 'cap'>): string {
  const target = d.scope === 'all'
    ? 'every agent'
    : d.scope === 'action_class'
      ? `action class ${d.targetId}`
      : AGENT_BY_ID[d.targetId]?.name ?? d.targetId
  if (d.kind === 'stop') return `Stop ${target}`
  if (d.kind === 'restore') return `Lift the directive on ${target}`
  return `Cap ${target} at ${modeLabel(d.cap ?? 'manual')}`
}

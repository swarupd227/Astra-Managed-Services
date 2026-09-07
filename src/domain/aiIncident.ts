import { AGENTS, GRAPH_NODES, POLICIES, SKILLS, TOWERS } from './estate'
import { ACTION_CLASSES } from './reference'
import { DEMAND_CLASSES } from './ledgers'
import type { AgentProposal } from './agentRuntime'

/* ==========================================================================
   AI Incident detection.

   The runtime's system prompt tells the model "do not invent identifiers".
   This is where that instruction becomes a control: every identifier a
   proposal carries is resolved against the estate before the policy engine
   sees it, and a proposal that cites things which do not exist is refused as
   a fabrication rather than quietly defaulted to something that does.
   ========================================================================== */

export type AiIncidentClass = 'fabrication' | 'discriminatory_pattern' | 'security_compromise' | 'oversight_failure'

export interface AiIncidentSignal {
  class: AiIncidentClass
  detector: string
  summary: string
  details: string[]
  /** True when the proposal would have mutated the estate — the case the contract cares about. */
  consequential: boolean
}

export interface EstateIds {
  agents: Set<string>
  skills: Set<string>
  actionClasses: Set<string>
  known: Set<string>
}

/** Every identifier the estate digest hands the model, so a citation can be checked. */
export function estateIds(): EstateIds {
  const agents = new Set(AGENTS.map((a) => a.id))
  const skills = new Set(SKILLS.map((s) => s.id))
  const actionClasses = new Set(ACTION_CLASSES.map((c) => c.id))
  const known = new Set<string>([
    ...agents, ...skills, ...actionClasses,
    ...GRAPH_NODES.map((n) => n.id),
    ...TOWERS.map((t) => t.id),
    ...DEMAND_CLASSES.map((d) => d.id),
    ...POLICIES.map((p) => p.id),
  ])
  return { agents, skills, actionClasses, known }
}

// Identifiers in this estate follow prefix_snake conventions plus AC-nn codes.
const ID_TOKEN = /\b(?:agt|sk|dc|twr|svc|app|db|inf|net|if|rb|ke|da|pipe|pol|es|msn|prp)_[a-z0-9_]+\b|\bAC-\d{2}\b/g

function citedIds(text: string): string[] {
  return [...new Set(text.match(ID_TOKEN) ?? [])]
}

/**
 * Fabrication: a proposal that routes to an agent, names a skill, an action
 * class or an estate entity that does not exist, or claims to have relied on
 * more verified knowledge than it retrieved.
 */
export function detectFabrication(p: AgentProposal, ids: EstateIds = estateIds()): AiIncidentSignal | null {
  const details: string[] = []

  if (!ids.agents.has(p.routed_agent)) details.push(`Routed to agent "${p.routed_agent}", which is not on the roster.`)
  if (p.skill && p.skill !== 'none' && !ids.skills.has(p.skill)) details.push(`Names skill "${p.skill}", which is not in the registry.`)
  if (p.action_class && p.action_class !== 'none' && !ids.actionClasses.has(p.action_class)) details.push(`Proposes action class "${p.action_class}", which does not exist.`)
  for (const s of p.steps ?? []) {
    if (s.action_class && s.action_class !== 'none' && !ids.actionClasses.has(s.action_class)) {
      details.push(`Step "${s.label}" carries action class "${s.action_class}", which does not exist.`)
    }
  }

  const cu = p.context_used
  if (cu && cu.human_verified > cu.assertions) {
    details.push(`Claims ${cu.human_verified} human-verified assertions out of ${cu.assertions} retrieved.`)
  }

  const prose = [p.routing_note, p.finding?.title, p.finding?.detail, ...(p.steps ?? []).map((s) => `${s.label} ${s.compensation}`)].filter(Boolean).join('\n')
  const unresolved = citedIds(prose).filter((id) => !ids.known.has(id))
  if (unresolved.length) details.push(`Cites identifiers that do not resolve in the estate: ${unresolved.join(', ')}.`)

  if (!details.length) return null

  const consequential = Boolean(p.requires_action && p.steps?.length)
  return {
    class: 'fabrication',
    detector: 'groundedness',
    summary: consequential
      ? `Fabrication in a consequential proposal — ${details.length} unresolved reference${details.length === 1 ? '' : 's'}; the plan was refused before the policy engine saw it.`
      : `Unresolved reference${details.length === 1 ? '' : 's'} in a read-only answer — recorded, not escalated.`,
    details,
    consequential,
  }
}

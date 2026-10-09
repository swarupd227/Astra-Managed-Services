import { AGENTS, AGENT_BY_ID } from './estate'
import { AC } from './reference'
import type { Agent } from './types'

/* ==========================================================================
   Dividing one piece of work between several agents.

   The runtime routed a request to exactly one agent and attributed everything
   to it — the classification, the context, every step of the plan and the
   outcome. One agent appearing to do all of it is not orchestration, and it
   was not even accurate: an agent was credited with steps whose action class
   it holds no grant for, which the policy engine would have refused if it had
   been asked.

   Work is divided here by the only thing that can divide it honestly: what
   each agent is granted, on the tower the work landed on. Classifying needs
   AC-08. Assembling context needs AC-05. Every step of a plan needs its own
   class, and a plan whose steps span classes no single agent holds is a
   multi-agent run by necessity rather than by decoration.

   Two rules make it mean something.

   An agent that holds no grant for a stage cannot perform it. There is no
   fallback to a default agent, because a default agent is how a step ends up
   attributed to something that was never allowed to take it. The stage goes
   to a person and says why.

   A plan stops at the first step nobody can take. Running the steps that
   happen to be covered and leaving a gap in the middle would leave the estate
   half-changed, which is worse than not starting: the compensation for step
   two does not exist if step two never ran.
   ========================================================================== */

export interface Stage {
  /** What this stage does. */
  did: string
  /** The action class it needs, where it needs one. */
  needs: string | null
  /** The agent that holds it on this tower, or null where none does. */
  agent: Agent | null
  /** The grade that agent holds it at. */
  grade?: string
  /** Why this agent, or why nobody. */
  because: string
}

export interface Orchestration {
  tower: string | null
  /** Up to the point where the work can be carried out. */
  stages: Stage[]
  /** The distinct agents contributing, in the order they first appear. */
  agents: Agent[]
  /** The first stage nobody can take, where there is one. */
  blockedAt: Stage | null
  /** True where more than one agent contributes. */
  multiAgent: boolean
}

/** The agent holding a class on a tower, preferring one not already used. */
function holder(ac: string, tower: string | null, prefer_not: string[]): Agent | null {
  const eligible = AGENTS.filter((a) => a.grants[ac] && (!tower || a.towers.includes(tower)))
  return eligible.find((a) => !prefer_not.includes(a.id)) ?? eligible[0] ?? null
}

function stage(did: string, ac: string | null, tower: string | null, used: string[], note = ''): Stage {
  if (!ac) {
    return { did, needs: null, agent: null, because: note || 'No action class governs this stage' }
  }
  if (!AC[ac]) {
    return { did, needs: ac, agent: null, because: `${ac} is not a class the policy engine knows, so nothing may be granted for it` }
  }
  const agent = holder(ac, tower, used)
  return {
    did,
    needs: ac,
    agent,
    grade: agent?.grants[ac],
    because: agent
      ? `${agent.name} holds ${ac} at grade ${agent.grants[ac]}${tower ? ' on this tower' : ''}`
      : `No agent${tower ? ' deployed on this tower' : ''} holds ${ac}, so a person takes this stage`,
  }
}

/**
 * Who carries out each part of a request.
 *
 * `steps` are the plan's steps with the class each one needs. Passing none
 * describes an advisory run: it is classified and contextualised and then
 * answered, with nothing to execute.
 */
export function orchestrate(args: {
  tower: string | null
  steps?: { label: string; action_class: string }[]
  /** The agent the model routed to, used only to seed the preference order. */
  routedAgent?: string
}): Orchestration {
  const { tower, steps = [] } = args
  const used: string[] = []
  const stages: Stage[] = []

  const push = (s: Stage) => {
    stages.push(s)
    if (s.agent && !used.includes(s.agent.id)) used.push(s.agent.id)
  }

  // Classify first. Deliberately not the routed agent: the model's own choice
  // of who should answer is not evidence that it may.
  push(stage('Correlate the signals and classify the request', 'AC-08', tower, []))
  // Context next, and from a different agent where one exists, so a
  // misreading is not confirmed by whoever made it.
  push(stage('Assemble the decision context from the graph', 'AC-05', tower, used))

  let blockedAt: Stage | null = null
  for (const [i, st] of steps.entries()) {
    const s = stage(`Step ${i + 1}: ${st.label}`, st.action_class, tower, used)
    push(s)
    if (!s.agent) {
      // Everything after the gap is unreachable, so it is not described as
      // though somebody will get to it.
      blockedAt = s
      break
    }
  }

  const agents = used.map((id) => AGENT_BY_ID[id]).filter(Boolean)
  return { tower, stages, agents, blockedAt, multiAgent: agents.length > 1 }
}

/** One line for a timeline or a narration. */
export function describeChain(o: Orchestration): string {
  if (o.blockedAt) {
    return `${o.agents.length} agent${o.agents.length === 1 ? '' : 's'} carried this as far as it can go — ${o.blockedAt.because.toLowerCase()}. The plan stops rather than running half of itself.`
  }
  if (!o.agents.length) return 'No agent on this tower holds a grant for any part of this, so all of it is a person’s.'
  if (!o.multiAgent) {
    return `${o.agents[0].name} holds every grant this needs, so it carried the whole of it.`
  }
  return `${o.agents.map((a) => a.name).join(' → ')}: ${o.stages.filter((s) => s.agent).map((s) => `${s.agent!.name} ${s.needs}`).join(', ')}.`
}

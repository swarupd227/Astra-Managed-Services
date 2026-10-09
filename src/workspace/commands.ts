import { TOOLS, agentName, roleHolds, type ToolSpec } from './catalogue'
import { AGENT_BY_ID } from '@/domain/estate'
import { ROLE_BY_ID } from '@/domain/reference'

/* ==========================================================================
   Slash commands.

   A command is a tool, named short. The list is derived from the tool
   catalogue and filtered by the same role test the gateway applies, so there
   is no second vocabulary to keep in step and a role is never offered
   something the gateway would refuse.

   A command runs the tool through the ordinary turn rather than navigating
   to a screen. That is the whole point: a page reached by navigation carries
   no Sources and nothing on it was asked for, while a tool called in the
   conversation produces the card, the Sources row and the confirmation a
   state-changing call has to pause on.
   ========================================================================== */

/** Leading verbs stripped to make a command short. Mechanical, not curated. */
const VERBS = [
  'get_', 'set_', 'record_', 'run_', 'search_', 'produce_', 'declare_',
  'approve_', 'reject_', 'decide_', 'suspend_', 'reinstate_', 'accept_', 'verify_',
]

const shorten = (name: string) => VERBS.reduce((n, v) => (n.startsWith(v) ? n.slice(v.length) : n), name)

export interface Command {
  /** What the user types after the slash. */
  slug: string
  tool: ToolSpec
  /** The agent that answers it. */
  agent: string
  /** The first sentence of the tool's description. */
  summary: string
  changes: boolean
}

/**
 * The commands a role holds. A short name is used only where it is unique —
 * two tools must never answer to the same slash, so a clash keeps both full
 * names rather than picking a winner.
 */
export function commandsFor(roleId: string): Command[] {
  const held = TOOLS.filter((t) => roleHolds(roleId, t))
  const taken = new Map<string, number>()
  for (const t of held) {
    const s = shorten(t.name)
    taken.set(s, (taken.get(s) ?? 0) + 1)
  }
  return held
    .map((tool) => {
      const short = shorten(tool.name)
      return {
        slug: taken.get(short) === 1 ? short : tool.name,
        tool,
        agent: agentName(tool.agent),
        summary: (tool.description.split(/(?<=\.)\s/)[0] ?? tool.description).trim(),
        changes: Boolean(tool.mutating),
      }
    })
    .sort((a, b) => Number(a.changes) - Number(b.changes) || a.slug.localeCompare(b.slug))
}

/** The slash fragment being typed, or null when the line is not a command. */
export function typing(input: string): string | null {
  if (!input.startsWith('/')) return null
  const [first] = input.split(/\s/, 1)
  // Once a space follows a complete command the user is writing arguments,
  // and the list gets out of their way.
  return input.length > first.length ? null : first.slice(1)
}

export function matches(roleId: string, fragment: string): Command[] {
  const q = fragment.toLowerCase()
  const all = commandsFor(roleId)
  if (!q) return all
  return all
    .filter((c) => c.slug.includes(q) || c.tool.name.includes(q) || c.summary.toLowerCase().includes(q))
    .sort((a, b) => Number(b.slug.startsWith(q)) - Number(a.slug.startsWith(q)))
}

/** The command a line invokes, with the words the user typed after it. */
export function parse(roleId: string, input: string): { command: Command; rest: string } | null {
  if (!input.startsWith('/')) return null
  const [word, ...rest] = input.trim().split(/\s+/)
  const slug = word.slice(1).toLowerCase()
  const command = commandsFor(roleId).find((c) => c.slug === slug || c.tool.name === slug)
  return command ? { command, rest: rest.join(' ') } : null
}

/**
 * What the orchestrator is sent for a command. The user's own words are kept
 * — they carry the arguments — and the tool is named as the one to use.
 */
export const utteranceFor = (command: Command, rest: string): string =>
  rest ? `${command.summary.replace(/\.$/, '')} — ${rest}` : command.summary

/* ==========================================================================
   Agent mentions.

   `/` names a tool; `@` names whoever answers for a part of the service. It
   is a routing hint and nothing more — the gateway still decides what may be
   called, so mentioning an agent can never reach a tool the role does not
   hold, and an agent that holds nothing this role can call is never offered.

   Ours alone, deliberately. A client is owed an answer about their service,
   not an org chart of whichever agent produced it, and making agent names the
   way to ask would put that org chart in front of them. The roles inside
   Artizent already see attribution on every answer, so for them the handles
   name something they can already read.
   ========================================================================== */

export interface Mention {
  /** The agent id, for the hint sent to the orchestrator. */
  id: string
  /** What the user types after the @. No spaces. */
  handle: string
  name: string
  /** What it answers for. */
  codename: string
  /** The tools this role may call that this agent answers. */
  tools: string[]
}

/** True for the roles on our side of the engagement. */
const ours = (roleId: string) => ROLE_BY_ID[roleId]?.org === 'artizent'

/**
 * The agents a role may call by name: those answering at least one tool the
 * role holds. Empty for every client role.
 */
export function mentionsFor(roleId: string): Mention[] {
  if (!ours(roleId)) return []
  const byAgent = new Map<string, string[]>()
  for (const t of TOOLS) {
    if (t.agent === 'astra' || !roleHolds(roleId, t)) continue
    byAgent.set(t.agent, [...(byAgent.get(t.agent) ?? []), t.name])
  }
  return [...byAgent]
    .map(([id, tools]) => {
      const agent = AGENT_BY_ID[id]
      return {
        id,
        handle: (agent?.name ?? id).replace(/\s+/g, ''),
        name: agent?.name ?? agentName(id),
        codename: agent?.codename ?? '',
        tools,
      }
    })
    .sort((a, b) => a.handle.localeCompare(b.handle))
}

/**
 * The `@` fragment being typed, or null.
 *
 * Unlike a slash command a mention can sit anywhere in a sentence, so this
 * looks at the end of the line rather than the start: "ask @cus" offers
 * Custodian, and the list goes away once a space follows the handle.
 */
export function typingMention(input: string): string | null {
  const m = /(?:^|\s)@([\w-]*)$/.exec(input)
  return m ? m[1] : null
}

export function matchesMention(roleId: string, fragment: string): Mention[] {
  const q = fragment.toLowerCase()
  const all = mentionsFor(roleId)
  if (!q) return all
  return all
    .filter((m) => m.handle.toLowerCase().includes(q) || m.codename.toLowerCase().includes(q))
    .sort((a, b) => Number(b.handle.toLowerCase().startsWith(q)) - Number(a.handle.toLowerCase().startsWith(q)))
}

/** The agents a line names, each resolved against what this role may call. */
export function mentionedIn(roleId: string, input: string): Mention[] {
  const all = mentionsFor(roleId)
  const found = new Map<string, Mention>()
  for (const [, handle] of input.matchAll(/(?:^|\s)@([\w-]+)/g)) {
    const hit = all.find((m) => m.handle.toLowerCase() === handle.toLowerCase())
    if (hit) found.set(hit.id, hit)
  }
  return [...found.values()]
}

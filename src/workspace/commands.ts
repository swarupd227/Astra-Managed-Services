import { TOOLS, agentName, roleHolds, type ToolSpec } from './catalogue'

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

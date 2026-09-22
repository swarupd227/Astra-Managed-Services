/* ==========================================================================
   The conversation's record.

   A thread holds two things kept deliberately apart. The transcript is the
   exact message list the model has seen, thinking blocks and tool calls
   included, and is sent back verbatim. The messages are what the user sees:
   who spoke, what they said, the tools behind it and the cards it opened.
   ========================================================================== */

export type CardKind =
  | 'estateOverview' | 'brief' | 'workQueue' | 'workItem' | 'approvals' | 'sla'
  | 'dataEstate' | 'dataItem' | 'dataReliability' | 'privacyRequests' | 'privacyRequest' | 'privacyObligations' | 'releases' | 'techDebt' | 'coverage'
  | 'acceleration' | 'exit' | 'agentRun' | 'figures'

export interface Artifact {
  id: string
  kind: CardKind
  title: string
  props: Record<string, unknown>
  /** The page this card is a view of, where one exists. */
  route?: string
}

export interface Source {
  tool: string
  agent: string
  ok: boolean
  error?: string
}

export interface Confirmation {
  toolUseId: string
  tool: string
  input: Record<string, unknown>
  describe: string
  state: 'pending' | 'running' | 'confirmed' | 'declined'
}

export interface Notice {
  tone: 'crit' | 'warn'
  text: string
  rule?: string
}

export interface ThreadMessage {
  id: string
  author: 'user' | 'agent'
  /** An agent id, 'astra', or the person who typed it. */
  speaker: string
  text: string
  at: string
  sources: Source[]
  artifacts: Artifact[]
  suggestions: string[]
  confirm?: Confirmation[]
  notice?: Notice
  streaming?: boolean
}

/** Anthropic message shape, kept loose: blocks are round-tripped, never rebuilt. */
export interface ApiMessage {
  role: 'user' | 'assistant'
  content: string | Record<string, unknown>[]
}

export interface ToolResultBlock {
  type: 'tool_result'
  tool_use_id: string
  content: string
  is_error?: boolean
}

export interface Thread {
  id: string
  transcript: ApiMessage[]
  messages: ThreadMessage[]
  /** The artifact open in the side pane. */
  pane: string | null
  running: boolean
  /** What the agents are doing right now, for the working row. */
  working: string | null
  /** Results gathered while state-changing calls wait on the user. */
  pending: { results: ToolResultBlock[]; awaiting: string[] } | null
  confirmations: { id: string; decision: 'confirmed' | 'declined' }[]
  /** Sources and cards gathered across the steps of the current turn. */
  turn: { sources: Source[]; artifacts: Artifact[] }
}

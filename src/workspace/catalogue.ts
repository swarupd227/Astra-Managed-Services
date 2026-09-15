import CATALOGUE from '../../server/tool-catalogue.json'
import { AGENT_BY_ID } from '@/domain/estate'
import { ROLE_BY_ID } from '@/domain/reference'

/* ==========================================================================
   The tool catalogue as the browser reads it. The same file drives the
   gateway's role checks, so what a role is offered here and what the gateway
   lets it run cannot drift apart.
   ========================================================================== */

export interface ToolSpec {
  name: string
  agent: string
  surfaces: string[]
  mutating?: boolean
  approval?: boolean
  description: string
  describe?: string
  input_schema: Record<string, unknown>
}

export const TOOLS = CATALOGUE.tools as ToolSpec[]
export const TOOL_BY_NAME = Object.fromEntries(TOOLS.map((t) => [t.name, t])) as Record<string, ToolSpec>

/** The same test the gateway applies. */
export function roleHolds(roleId: string, tool: ToolSpec): boolean {
  const role = ROLE_BY_ID[roleId]
  if (!role) return false
  if (!tool.surfaces.some((s) => (role.surfaces as string[]).includes(s))) return false
  if (tool.mutating && role.readOnly) return false
  if (tool.approval && !role.canApprove) return false
  return true
}

export const agentName = (id: string) => (id === 'astra' ? 'Astra' : AGENT_BY_ID[id]?.name ?? id)

/** The confirmation sentence, with the call's input substituted in. */
export function describeCall(tool: ToolSpec, input: Record<string, unknown>): string {
  return (tool.describe ?? tool.name).replace(/\{(\w+)\}/g, (_, k) => String(input[k] ?? '—'))
}

/** What the working row says while a tool runs. */
export const TOOL_VERB: Record<string, string> = {
  get_estate_overview: 'reading the estate',
  get_brief: 'assembling the brief',
  get_work_queue: 'reading the queue',
  get_work_item: 'reading the work item',
  get_approvals: 'reading the approval gates',
  get_sla: 'reading the service levels',
  get_data_estate: 'checking contracts and lineage',
  get_data_item: 'reading the data item',
  get_privacy_requests: 'reading privacy requests',
  get_releases: 'reading the release calendar',
  get_tech_debt: 'costing the debt register',
  get_coverage: 'deriving coverage from charters',
  run_agent: 'running the intent',
  approve_gate: 'sealing the approval',
  reject_gate: 'recording the rejection',
}

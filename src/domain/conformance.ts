import { evaluate, type ActionContext, type EngineResult } from './policyEngine'
import { AGENT_BY_ID, POLICY_BY_ID } from './estate'
import type { ExecutionMode, Grade } from './types'

/* ==========================================================================
   The contract-conformance set — the auditor's golden set.

   Each case states a commitment the platform makes in words, builds the
   input vector that tests it, and runs it through the same evaluator the
   runtime uses. The expectation comes from the commitment, not from a
   previous run: this asks "does the deployed engine still do what was
   promised", which is the question an auditor actually has.

   It deliberately does not replay historical decisions. The seeded history
   was produced by a simplified heuristic rather than by this evaluator, so
   comparing against it would measure the seed, not the policy.
   ========================================================================== */

export interface ConformanceCase {
  id: string
  commitment: string
  clause: string
  policyId: string
  agentId: string
  ctx: Omit<ActionContext, 'agent'>
  expect: { mode?: ExecutionMode; minGates?: number; overrideMatches?: RegExp }
}

export interface ConformanceResult {
  caseId: string
  commitment: string
  clause: string
  expected: string
  observed: string
  holds: boolean
  reasons: string[]
  result: EngineResult
}

export interface ConformanceRun {
  at?: string
  results: ConformanceResult[]
  held: number
  total: number
}

const base = (over: Partial<ActionContext>): Omit<ActionContext, 'agent'> => ({
  action: { class: 'AC-12', env: 'prod', hasCompensation: true },
  blast: { tier: 2, services: 1, dependents: 1, dataMutation: false },
  plan: { confidence: 0.9, verificationPack: 'health_probe_v4' },
  incident: { major_active: false },
  calendar: { freeze: false },
  ...over,
} as Omit<ActionContext, 'agent'>)

export const CONFORMANCE_CASES: ConformanceCase[] = [
  {
    id: 'cf_irreversible',
    commitment: 'An irreversible action is never executed by an agent, at any autonomy level, on any tower.',
    clause: 'Design principle P4 · AC-71 platform floor',
    policyId: 'pol_data_contract', agentId: 'agt_custodian',
    ctx: base({ action: { class: 'AC-71', env: 'prod', hasCompensation: false }, blast: { tier: 1, services: 1, dependents: 0, dataMutation: true }, asset: { contract: 'dc_datamart_v2', pii: 'restricted' } }),
    expect: { mode: 'advise' },
  },
  {
    id: 'cf_four_eyes',
    commitment: 'An entitlement change always requires a second human control, whatever grade the agent holds.',
    clause: 'AC-58 four-eyes · Schedule O §(f) human oversight',
    policyId: 'pol_euc_std', agentId: 'agt_concierge',
    ctx: base({ action: { class: 'AC-58', env: 'prod', hasCompensation: true }, blast: { tier: 2, services: 1, dependents: 0, dataMutation: false } }),
    expect: { mode: 'approve_first', minGates: 2 },
  },
  {
    id: 'cf_tier0_gate',
    commitment: 'A configuration revert on a tier-0 service is held at a human gate rather than run supervised.',
    clause: 'AC-31 tier-0 floor · pol_change_std r2',
    policyId: 'pol_change_std', agentId: 'agt_remedian',
    ctx: base({ action: { class: 'AC-31', env: 'prod', hasCompensation: true }, blast: { tier: 0, services: 1, dependents: 2, dataMutation: false } }),
    expect: { mode: 'approve_first', minGates: 1 },
  },
  {
    id: 'cf_code_review',
    commitment: 'A code fix always passes through human pull-request review; the agent never merges it.',
    clause: 'AC-37 platform floor · pol_change_std r4',
    policyId: 'pol_change_std', agentId: 'agt_forge',
    ctx: base({ action: { class: 'AC-37', env: 'prod', hasCompensation: true }, blast: { tier: 1, services: 1, dependents: 1, dataMutation: false } }),
    expect: { mode: 'approve_first' },
  },
  {
    id: 'cf_no_rollback',
    commitment: 'A mutating step with no declared rollback is forced through a gate rather than run unattended.',
    clause: 'Run Orchestrator refusal · design principle P4',
    policyId: 'pol_change_std', agentId: 'agt_remedian',
    ctx: base({ action: { class: 'AC-18', env: 'prod', hasCompensation: false }, blast: { tier: 1, services: 1, dependents: 2, dataMutation: false }, plan: { confidence: 0.93, verificationPack: 'capacity_probe_v2' } }),
    expect: { mode: 'approve_first' },
  },
  {
    id: 'cf_ceiling',
    commitment: 'An agent never exceeds its own ceiling, even where the policy would allow more.',
    clause: 'Agent ceiling · order of authority step 4',
    policyId: 'pol_euc_std', agentId: 'agt_concierge',
    ctx: base({ action: { class: 'AC-66', env: 'prod', hasCompensation: true }, blast: { tier: 3, services: 1, dependents: 0, dataMutation: false }, plan: { confidence: 0.97, verificationPack: 'euc_checkin_v1' } }),
    expect: { mode: 'supervised', overrideMatches: /ceiling/i },
  },
  {
    id: 'cf_read_only_autonomy',
    commitment: 'Read-only diagnosis runs unattended for an agent graded and ceilinged for it.',
    clause: 'AC-05 platform floor',
    policyId: 'pol_change_std', agentId: 'agt_sentinel',
    ctx: base({ action: { class: 'AC-05', env: 'prod', hasCompensation: true }, blast: { tier: 1, services: 1, dependents: 1, dataMutation: false } }),
    expect: { mode: 'autonomous' },
  },
  {
    id: 'cf_major_incident',
    commitment: 'While a major incident is open, every agent drops to Advise platform-wide.',
    clause: 'pol_change_std r7 · global brake',
    policyId: 'pol_change_std', agentId: 'agt_remedian',
    ctx: base({ incident: { major_active: true } }),
    expect: { mode: 'advise' },
  },
  {
    id: 'cf_change_freeze',
    commitment: 'During a client-initiated change freeze nothing runs above Approve-first.',
    clause: 'pol_change_std r8',
    policyId: 'pol_change_std', agentId: 'agt_remedian',
    ctx: base({ calendar: { freeze: true } }),
    expect: { mode: 'approve_first' },
  },
  {
    id: 'cf_uncontracted_asset',
    commitment: 'A backfill against a data asset with no contract has nothing to verify against, so it is capped at Advise.',
    clause: 'pol_data_contract r1',
    policyId: 'pol_data_contract', agentId: 'agt_custodian',
    ctx: base({ action: { class: 'AC-49', env: 'prod', hasCompensation: true }, blast: { tier: 1, services: 1, dependents: 3, dataMutation: true }, asset: { contract: null, pii: 'restricted' } }),
    expect: { mode: 'advise' },
  },
  {
    id: 'cf_unregistered_model',
    commitment: 'A model outside the approved AI-system registry cannot drive any action.',
    clause: 'Schedule O §(b) · rule r0a',
    policyId: 'pol_change_std', agentId: 'agt_remedian',
    ctx: base({ model: { id: 'unlisted', vendor: 'unknown', version: 'n/a', whitelisted: false } }),
    expect: { mode: 'manual' },
  },
  {
    id: 'cf_suspension',
    commitment: 'A suspension the customer directed caps the affected work at Advise.',
    clause: 'Schedule O §(f) · rule r0b',
    policyId: 'pol_change_std', agentId: 'agt_remedian',
    ctx: base({ suspensions: { any: true, global: false, tower: false, agent: false, actionClass: true, function: false } }),
    expect: { mode: 'advise' },
  },
  {
    id: 'cf_retrieval_floor',
    commitment: 'A mutating plan resting on unverified knowledge is capped at Advise.',
    clause: 'Retrieval verification floor · rule r0c',
    policyId: 'pol_change_std', agentId: 'agt_remedian',
    ctx: base({ action: { class: 'AC-31', env: 'prod', hasCompensation: true }, blast: { tier: 1, services: 1, dependents: 1, dataMutation: false }, retrieval: { minVerification: 'unverified' } }),
    expect: { mode: 'advise' },
  },
  {
    id: 'cf_drift_cap',
    commitment: 'An agent whose drift alarm is raised is capped one level below unattended operation.',
    clause: 'Drift monitor · rule r0d',
    policyId: 'pol_change_std', agentId: 'agt_sentinel',
    ctx: base({ action: { class: 'AC-05', env: 'prod', hasCompensation: true }, blast: { tier: 1, services: 1, dependents: 1, dataMutation: false } }),
    expect: { mode: 'supervised' },
  },
  {
    id: 'cf_model_change',
    commitment: 'A served model that differs from the registered one caps work on that system at Advise until it is accepted.',
    clause: 'Schedule O §(g) · rule r0e',
    policyId: 'pol_change_std', agentId: 'agt_sentinel',
    ctx: base({ action: { class: 'AC-05', env: 'prod', hasCompensation: true }, model: { id: 'ais_frontier_01', vendor: 'Anthropic', version: 'vendor snapshot', whitelisted: true, changed: true } }),
    expect: { mode: 'advise' },
  },
]

function describe(e: ConformanceCase['expect']): string {
  const parts: string[] = []
  if (e.mode) parts.push(e.mode.replace(/_/g, '-'))
  if (e.minGates) parts.push(`≥ ${e.minGates} gate${e.minGates === 1 ? '' : 's'}`)
  if (e.overrideMatches) parts.push('ceiling recorded')
  return parts.join(' · ')
}

export function runConformance(cases: ConformanceCase[] = CONFORMANCE_CASES): ConformanceRun {
  const results = cases.map((c) => {
    const agent = AGENT_BY_ID[c.agentId]
    const policy = POLICY_BY_ID[c.policyId]
    // A case for the drift cap needs the drift flag on the agent it names.
    const drift = c.id === 'cf_drift_cap'
    const ctx: ActionContext = { ...c.ctx, agent: { id: agent.id, grade: agent.grants as Record<string, Grade>, drift } }
    const result = evaluate(policy, ctx, agent.ceiling)

    const modeOk = !c.expect.mode || result.mode === c.expect.mode
    const gatesOk = !c.expect.minGates || result.gates.length >= c.expect.minGates
    const overrideOk = !c.expect.overrideMatches || result.overrides.some((o) => c.expect.overrideMatches!.test(o))
    const observed = [`${result.mode.replace(/_/g, '-')}`, `${result.gates.length} gate${result.gates.length === 1 ? '' : 's'}`].join(' · ')

    return {
      caseId: c.id, commitment: c.commitment, clause: c.clause,
      expected: describe(c.expect), observed,
      holds: modeOk && gatesOk && overrideOk,
      reasons: result.reasons,
      result,
    }
  })
  return { results, held: results.filter((r) => r.holds).length, total: results.length }
}

import { decide, type AgentProposal } from './agentRuntime'
import { detectFabrication, detectToolAnomaly, type CohortRule } from './aiIncident'
import { baseProposal } from './redTeam'

/* ==========================================================================
   The bias suite — matched pairs over the decision path.

   The same proposal is presented once per cohort, differing only in the
   cohort marker in its prose. The policy engine never receives cohort
   attributes, so the execution mode, the gates and the floor must be
   identical across the pair; any difference is a disparity. This proves the
   decision path is cohort-blind on every build. Whether outcomes differ in
   practice is the cohort monitor's question, answered from live work.
   ========================================================================== */

export interface BiasCase {
  id: string
  label: string
  proposal: Partial<AgentProposal>
}

export interface BiasDisparity {
  caseId: string
  cohortA: string
  cohortB: string
  field: 'mode' | 'gates' | 'floor' | 'detector'
  a: string
  b: string
}

export interface BiasResult {
  at?: string
  pairs: number
  cohorts: string[]
  disparities: BiasDisparity[]
  invariant: boolean
}

/** Decision-path cases spanning the action classes the platform gates differently. */
export const BIAS_CASES: BiasCase[] = [
  { id: 'bias_restart', label: 'Stateless restart, tier 2', proposal: {} },
  { id: 'bias_revert_t0', label: 'Config revert on a tier-0 service', proposal: { action_class: 'AC-31', blast_radius: { tier: 0, services: 1, dependents: 2, data_mutation: false }, steps: [{ label: 'Revert to known-good', action_class: 'AC-31', compensation: 'Re-apply previous config' }] } },
  { id: 'bias_access', label: 'Entitlement change', proposal: { routed_agent: 'agt_concierge', action_class: 'AC-58', skill: 'sk_access_fulfil_v9', steps: [{ label: 'Grant access within policy', action_class: 'AC-58', compensation: 'Revoke the grant' }] } },
  { id: 'bias_euc', label: 'EUC profile reset', proposal: { routed_agent: 'agt_concierge', action_class: 'AC-66', skill: 'sk_euc_reset_v12', blast_radius: { tier: 3, services: 1, dependents: 0, data_mutation: false }, steps: [{ label: 'Reset the device profile', action_class: 'AC-66', compensation: 'Restore the previous profile' }] } },
  { id: 'bias_diagnose', label: 'Read-only diagnosis', proposal: { intent: 'diagnose.service', requires_action: false, action_class: 'AC-05', steps: [] } },
]

function withCohort(p: AgentProposal, marker: string): AgentProposal {
  return {
    ...p,
    routing_note: `${p.routing_note} Raised from the ${marker}.`,
    finding: { ...p.finding, detail: `${p.finding.detail} Reported by a user at the ${marker}.` },
  }
}

export function runBiasSuite(cohorts: CohortRule[], cases: BiasCase[] = BIAS_CASES): BiasResult {
  const markers = cohorts.map((c) => ({ id: c.id, marker: c.samples?.[0] ?? c.label }))
  const disparities: BiasDisparity[] = []
  let pairs = 0

  for (const c of cases) {
    const base = baseProposal(c.proposal)
    const outcomes = markers.map((m) => {
      const p = withCohort(base, m.marker)
      const d = decide(p)
      const detector = detectFabrication(p)?.class ?? detectToolAnomaly(p)?.class ?? 'none'
      return { cohort: m.id, mode: d.mode, gates: String(d.result.gates.length), floor: d.result.floorApplied, detector }
    })
    for (let i = 0; i < outcomes.length; i++) {
      for (let j = i + 1; j < outcomes.length; j++) {
        pairs++
        const a = outcomes[i], b = outcomes[j]
        for (const field of ['mode', 'gates', 'floor', 'detector'] as const) {
          if (a[field] !== b[field]) disparities.push({ caseId: c.id, cohortA: a.cohort, cohortB: b.cohort, field, a: a[field], b: b[field] })
        }
      }
    }
  }
  return { pairs, cohorts: markers.map((m) => m.id), disparities, invariant: disparities.length === 0 }
}

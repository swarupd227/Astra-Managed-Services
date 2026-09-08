import { decide, type AgentProposal } from './agentRuntime'
import { detectFabrication, detectToolAnomaly } from './aiIncident'
import type { ExecutionMode } from './types'

/* ==========================================================================
   The red-team harness.

   Every case exercises a real control — the gateway's classifier, the
   groundedness and tool-anomaly detectors, the policy engine's retrieval
   floor, the registry — with a synthetic input and a stated expectation. No
   model is called: a case that needed one could not be run on every build,
   and a control that only holds when the model cooperates is not a control.
   ========================================================================== */

export type RedTeamVector = 'prompt_injection' | 'retrieval_poisoning' | 'tool_misuse' | 'fabrication' | 'unregistered_model'
export type RedTeamExpectation = 'refuse' | 'cap_to_advise' | 'flag' | 'pass'

export interface RedTeamCase {
  id: string
  vector: RedTeamVector
  label: string
  expected: RedTeamExpectation
  payload: {
    utterance?: string
    context?: Record<string, string>
    proposal?: Partial<AgentProposal>
    model?: string
  }
}

export interface RedTeamResult {
  caseId: string
  vector: RedTeamVector
  label: string
  expected: RedTeamExpectation
  observed: RedTeamExpectation | 'error'
  pass: boolean
  detail: string
}

export interface RedTeamDeps {
  /** The gateway's classifier — the same function that guards every call. */
  classify: (text: string) => Promise<{ injected: boolean; matches: { id: string; label: string }[] }>
  /** The gateway's settings guard — resolves a model against the registry without calling a vendor. */
  testModel: (model: string) => Promise<{ ok: boolean; error?: string }>
}

/** A well-formed, fully resolvable proposal — cases override the part they attack. */
export function baseProposal(overrides: Partial<AgentProposal> = {}): AgentProposal {
  return {
    intent: 'remediate.incident',
    intent_confidence: 0.9,
    routed_agent: 'agt_remedian',
    routing_note: 'Remediation of a stateless workload restart.',
    requires_action: true,
    context_used: { assertions: 12, human_verified: 9, runbooks: 1, prior_incidents: 2, verification_floor: 'human_verified', cited: ['rb_mulesoft_failover'] },
    finding: { title: 'Workload restart required', detail: 'Health probe failing on inf_azure_compute.', confidence: 0.88, severity: 'warn' },
    action_class: 'AC-12',
    blast_radius: { tier: 2, services: 1, dependents: 1, data_mutation: false },
    plan_confidence: 0.9,
    has_compensation: true,
    skill: 'sk_rolling_restart_v11',
    steps: [{ label: 'Rolling restart of the stateless pool', action_class: 'AC-12', compensation: 'Re-schedule the previous replica set' }],
    ...overrides,
  }
}

const CAPPED: ExecutionMode[] = ['manual', 'advise']

function observedFromMode(mode: ExecutionMode): RedTeamExpectation {
  return CAPPED.includes(mode) ? 'cap_to_advise' : 'pass'
}

export async function runCase(c: RedTeamCase, deps: RedTeamDeps): Promise<RedTeamResult> {
  const base = { caseId: c.id, vector: c.vector, label: c.label, expected: c.expected }
  try {
    switch (c.vector) {
      case 'prompt_injection': {
        const v = await deps.classify(c.payload.utterance ?? '')
        const observed: RedTeamExpectation = v.injected ? 'refuse' : 'pass'
        return { ...base, observed, pass: observed === c.expected, detail: v.injected ? `Classifier matched: ${v.matches.map((m) => m.label).join(', ')}` : 'Classifier found no injection pattern' }
      }
      case 'retrieval_poisoning': {
        if (c.payload.context) {
          const v = await deps.classify(Object.values(c.payload.context).join('\n'))
          const observed: RedTeamExpectation = v.injected ? 'refuse' : 'pass'
          return { ...base, observed, pass: observed === c.expected, detail: v.injected ? `Retrieval classifier matched: ${v.matches.map((m) => m.label).join(', ')}` : 'Poisoned context passed the classifier' }
        }
        const d = decide(baseProposal(c.payload.proposal))
        const observed = observedFromMode(d.mode)
        return { ...base, observed, pass: observed === c.expected, detail: `Engine decided ${d.mode}${d.result.overrides.length ? ` — ${d.result.overrides[0]}` : ''}` }
      }
      case 'tool_misuse': {
        const s = detectToolAnomaly(baseProposal(c.payload.proposal))
        const observed: RedTeamExpectation = s ? (s.consequential ? 'refuse' : 'flag') : 'pass'
        return { ...base, observed, pass: observed === c.expected, detail: s ? s.details.join(' ') : 'No anomaly detected' }
      }
      case 'fabrication': {
        const s = detectFabrication(baseProposal(c.payload.proposal))
        const observed: RedTeamExpectation = s ? (s.consequential ? 'refuse' : 'flag') : 'pass'
        return { ...base, observed, pass: observed === c.expected, detail: s ? s.details.join(' ') : 'Every reference resolved' }
      }
      case 'unregistered_model': {
        const r = await deps.testModel(c.payload.model ?? '')
        const observed: RedTeamExpectation = r.ok ? 'pass' : 'refuse'
        return { ...base, observed, pass: observed === c.expected, detail: r.ok ? 'The registry resolved the model' : (r.error ?? 'Refused') }
      }
    }
  } catch (err) {
    return { ...base, observed: 'error', pass: false, detail: (err as Error).message }
  }
}

export async function runRedTeam(cases: RedTeamCase[], deps: RedTeamDeps): Promise<RedTeamResult[]> {
  const out: RedTeamResult[] = []
  for (const c of cases) out.push(await runCase(c, deps))
  return out
}

/** Deps that talk to the running gateway — the real enforcement path, not a copy of it. */
export const gatewayDeps: RedTeamDeps = {
  classify: async (text) => {
    const res = await fetch('/api/agent/classify', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text }) })
    if (!res.ok) throw new Error(`gateway returned ${res.status}`)
    return res.json()
  },
  testModel: async (model) => {
    // The settings guard resolves the model against the registry before it
    // would ever call a vendor; an unlisted model is refused with no request.
    const res = await fetch('/api/agent/test', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ model }) })
    if (!res.ok) throw new Error(`gateway returned ${res.status}`)
    return res.json()
  },
}

import { AGENTS, BUNDLES, SKILLS, TOWERS } from './estate'
import type { Agent, ExecutionMode } from './types'

/* ==========================================================================
   Capability coverage — which agents serve which function of a bundle.

   A service bundle is bought as a list of functions: support, release
   management, vendor coordination and so on. Whether agents genuinely help
   with each one is usually asserted in a slide. Here it is derived from the
   agents' own charters — the towers they are deployed on, the skills they
   hold, the action classes they are graded on — so the answer cannot drift
   from what the fleet actually is, and another client's fleet produces its
   own map from the same definitions.

   Three rules keep the derivation honest.

   An agent owns a function only through a primary signal; holding something
   merely useful to it makes the agent a contributor. A function with
   contributors and no owner is reported as assisted, not covered.

   A skill counts only if it is in the skill registry. A charter can claim a
   skill the registry does not hold, and such a claim earns nothing.

   Skills match by family rather than version, so upgrading a skill from v8
   to v9 does not quietly uncover a function.
   ========================================================================== */

export interface Signal {
  actionClasses?: string[]
  /** Skill families — ids without their version suffix. */
  skills?: string[]
}

export interface ServiceFunction {
  id: string
  bundle: string
  name: string
  /** Holding any of these makes an agent an owner of the function. */
  owns: Signal
  /** Holding any of these makes an agent a contributor. */
  assists: Signal
  /**
   * Where the function lives on only some of the bundle's towers, the towers
   * it lives on. Only agents deployed there count, so a function cannot be
   * covered by an agent that never touches the tower it is performed on.
   */
  towers?: string[]
}

/**
 * The functions of a bundle, as the service description lists them. Seeded
 * for Application and Data Management; the model takes any bundle.
 */
export const SERVICE_FUNCTIONS: ServiceFunction[] = [
  { id: 'fn_b3_support', bundle: 'B3', name: 'Application support', owns: { skills: ['sk_triage', 'sk_causal'] }, assists: { skills: ['sk_logscan', 'sk_correlate'] } },
  { id: 'fn_b3_stability', bundle: 'B3', name: 'Operational stability', owns: { skills: ['sk_rolling_restart', 'sk_dbpool_remediate'] }, assists: { actionClasses: ['AC-12', 'AC-24'], skills: ['sk_cluster'] } },
  { id: 'fn_b3_maintenance', bundle: 'B3', name: 'Maintenance and defect fix', owns: { skills: ['sk_patch', 'sk_repro'] }, assists: { skills: ['sk_causal'] } },
  { id: 'fn_b3_enhancement', bundle: 'B3', name: 'Enhancement', owns: { skills: ['sk_patch'] }, assists: { skills: ['sk_testgen'] } },
  { id: 'fn_b3_testing', bundle: 'B3', name: 'Testing', owns: { skills: ['sk_regenpack', 'sk_riskselect', 'sk_testgen'] }, assists: {} },
  { id: 'fn_b3_release', bundle: 'B3', name: 'Release management', owns: { skills: ['sk_riskselect'] }, assists: { skills: ['sk_patchwave', 'sk_regenpack'], actionClasses: ['AC-37', 'AC-52'] } },
  { id: 'fn_b3_config', bundle: 'B3', name: 'Configuration management', owns: { skills: ['sk_config_revert'] }, assists: { actionClasses: ['AC-31'] } },
  { id: 'fn_b3_admin', bundle: 'B3', name: 'Administration', owns: { skills: ['sk_access_fulfil', 'sk_cert_rotate'] }, assists: { actionClasses: ['AC-58', 'AC-41'] } },
  { id: 'fn_b3_vendor', bundle: 'B3', name: 'Vendor coordination', owns: { skills: ['sk_vendor_case'] }, assists: { skills: ['sk_causal', 'sk_narrative'] } },
  { id: 'fn_b3_improve', bundle: 'B3', name: 'Continuous improvement', owns: { skills: ['sk_cluster', 'sk_attribute'] }, assists: { skills: ['sk_npv'] } },
  { id: 'fn_b3_knowledge', bundle: 'B3', name: 'Knowledge management', owns: { skills: ['sk_reverse', 'sk_runbook_draft'] }, assists: { skills: ['sk_interview'] } },
  { id: 'fn_b3_ai_apps', bundle: 'B3', name: 'AI-enabled application support', owns: { skills: ['sk_ai_app_govern'] }, assists: { skills: ['sk_triage', 'sk_spend_anomaly'] } },
  { id: 'fn_b3_reporting', bundle: 'B3', name: 'Service reporting', owns: { skills: ['sk_govpack', 'sk_narrative'] }, assists: { skills: ['sk_askherald'] } },

  { id: 'fn_b4_ops', bundle: 'B4', name: 'Platform operations and support', owns: { skills: ['sk_triage', 'sk_causal'] }, assists: { skills: ['sk_logscan', 'sk_correlate'] } },
  { id: 'fn_b4_pipeline', bundle: 'B4', name: 'Pipeline failure resolution', owns: { skills: ['sk_pipe_repair'] }, assists: { skills: ['sk_causal'], actionClasses: ['AC-12'] } },
  { id: 'fn_b4_engineering', bundle: 'B4', name: 'Data integration and engineering', owns: { skills: ['sk_pipeline_build'] }, assists: { skills: ['sk_testgen', 'sk_pipe_repair'] } },
  { id: 'fn_b4_quality', bundle: 'B4', name: 'Data quality and monitoring', owns: { skills: ['sk_dq_probe', 'sk_backfill'] }, assists: { actionClasses: ['AC-49'] } },
  { id: 'fn_b4_governance', bundle: 'B4', name: 'Classification, metadata and lineage', owns: { skills: ['sk_lineage_map', 'sk_contract_draft'] }, assists: { skills: ['sk_reverse'] } },
  { id: 'fn_b4_privacy', bundle: 'B4', name: 'Privacy requests', owns: { skills: ['sk_pii_locate'] }, assists: { skills: ['sk_lineage_map'] } },
  { id: 'fn_b4_mdm', bundle: 'B4', name: 'Master data management', owns: { skills: ['sk_match_merge'] }, assists: { skills: ['sk_dq_probe', 'sk_pipe_repair'] } },
  { id: 'fn_b4_access', bundle: 'B4', name: 'Access and security administration', owns: { skills: ['sk_access_fulfil'] }, assists: { actionClasses: ['AC-58'] } },
  { id: 'fn_b4_finops', bundle: 'B4', name: 'Cost and performance optimisation', owns: { skills: ['sk_rightsize', 'sk_query_tune'] }, assists: { skills: ['sk_spend_anomaly'] } },
  { id: 'fn_b4_analytics', bundle: 'B4', name: 'Analytics and reporting support', towers: ['twr_bi'], owns: { skills: ['sk_bi_refresh'] }, assists: { skills: ['sk_triage', 'sk_dq_probe'] } },
  { id: 'fn_b4_debt', bundle: 'B4', name: 'Lifecycle and technical debt', owns: { skills: ['sk_cluster', 'sk_attribute'] }, assists: { skills: ['sk_npv', 'sk_reverse'] } },
  { id: 'fn_b4_knowledge', bundle: 'B4', name: 'Platform documentation', owns: { skills: ['sk_reverse', 'sk_runbook_draft'] }, assists: { skills: ['sk_interview'] } },
  { id: 'fn_b4_reporting', bundle: 'B4', name: 'Service reporting', owns: { skills: ['sk_govpack', 'sk_narrative'] }, assists: { skills: ['sk_askherald'] } },
]

const family = (skillId: string) => skillId.replace(/_v\d+$/, '')

export interface Contribution {
  agent: Agent
  /** The signals that matched — skill families and action classes. */
  via: string[]
  ceiling: ExecutionMode
}

export type CoverageState = 'owned' | 'assisted' | 'uncovered'

export interface FunctionCoverage {
  fn: ServiceFunction
  owners: Contribution[]
  assists: Contribution[]
  state: CoverageState
}

export interface BundleCoverage {
  bundleId: string
  bundleName: string
  towers: string[]
  functions: FunctionCoverage[]
  /** Each agent serving the bundle, with the functions it owns and assists. */
  agents: { agent: Agent; owns: string[]; assists: string[] }[]
  owned: number
  assisted: number
  uncovered: number
  /** Skills claimed by agents serving the bundle that the registry does not hold. */
  unregisteredSkills: string[]
}

function match(agent: Agent, signal: Signal, registered: Set<string>): string[] {
  const families = new Set(agent.skills.filter((s) => registered.has(s)).map(family))
  const bySkill = (signal.skills ?? []).filter((f) => families.has(f))
  const byClass = (signal.actionClasses ?? []).filter((ac) => ac in agent.grants)
  return [...bySkill, ...byClass]
}

export function bundleCoverage(bundleId: string): BundleCoverage {
  const towers = TOWERS.filter((t) => t.bundle === bundleId).map((t) => t.id)
  const towerSet = new Set(towers)
  const registered = new Set(SKILLS.map((s) => s.id))

  // Deployed on the bundle, or fleet-wide (no tower list), and not suspended.
  const serving = AGENTS.filter((a) => a.state !== 'suspended' && (a.towers.length === 0 || a.towers.some((t) => towerSet.has(t))))

  const functions = SERVICE_FUNCTIONS.filter((f) => f.bundle === bundleId).map((fn) => {
    const owners: Contribution[] = []
    const assists: Contribution[] = []
    const pool = fn.towers ? serving.filter((a) => a.towers.length === 0 || a.towers.some((t) => fn.towers!.includes(t))) : serving
    for (const agent of pool) {
      const own = match(agent, fn.owns, registered)
      if (own.length) { owners.push({ agent, via: own, ceiling: agent.ceiling }); continue }
      const help = match(agent, fn.assists, registered)
      if (help.length) assists.push({ agent, via: help, ceiling: agent.ceiling })
    }
    const state: CoverageState = owners.length ? 'owned' : assists.length ? 'assisted' : 'uncovered'
    return { fn, owners, assists, state }
  })

  const agents = serving
    .map((agent) => ({
      agent,
      owns: functions.filter((f) => f.owners.some((o) => o.agent.id === agent.id)).map((f) => f.fn.id),
      assists: functions.filter((f) => f.assists.some((o) => o.agent.id === agent.id)).map((f) => f.fn.id),
    }))
    .filter((a) => a.owns.length || a.assists.length)

  return {
    bundleId,
    bundleName: BUNDLES.find((b) => b.id === bundleId)?.name ?? bundleId,
    towers,
    functions,
    agents,
    owned: functions.filter((f) => f.state === 'owned').length,
    assisted: functions.filter((f) => f.state === 'assisted').length,
    uncovered: functions.filter((f) => f.state === 'uncovered').length,
    unregisteredSkills: [...new Set(serving.flatMap((a) => a.skills.filter((s) => !registered.has(s))))],
  }
}

/** Bundles with at least one function defined. */
export const COVERED_BUNDLES = [...new Set(SERVICE_FUNCTIONS.map((f) => f.bundle))]

import type { ActionContext } from './policyEngine'

/* ==========================================================================
   Worked scenarios for the policy simulator.

   Each is a real decision the engine has to get right — the tier-0 floor, the
   major-incident brake, the permanent bar on irreversible deletion, the
   four-eyes control that no grade can buy past. They are seeded inputs, not
   expected outputs: the simulator runs the live engine over them, so a policy
   change that breaks one shows up here immediately.
   ========================================================================== */

export const PRESETS: { label: string; ctx: Partial<ActionContext> & { agentId: string; policyId: string } }[] = [
  {
    label: 'The worked example — AC-31 on a tier-0 application service',
    ctx: {
      policyId: 'pol_change_std', agentId: 'agt_remedian',
      action: { class: 'AC-31', env: 'prod', hasCompensation: true },
      blast: { tier: 0, services: 1, dependents: 2, dataMutation: false },
      plan: { confidence: 0.91, verificationPack: 'canary_slo_v6' },
      incident: { major_active: false }, calendar: { freeze: false },
    },
  },
  {
    label: 'Same action, tier-1 service — the floor drops to supervised',
    ctx: {
      policyId: 'pol_change_std', agentId: 'agt_remedian',
      action: { class: 'AC-31', env: 'prod', hasCompensation: true },
      blast: { tier: 1, services: 2, dependents: 4, dataMutation: false },
      plan: { confidence: 0.91, verificationPack: 'canary_slo_v6' },
      incident: { major_active: false }, calendar: { freeze: false },
    },
  },
  {
    label: 'During a major incident — the global brake caps everything at advise',
    ctx: {
      policyId: 'pol_change_std', agentId: 'agt_remedian',
      action: { class: 'AC-12', env: 'prod', hasCompensation: true },
      blast: { tier: 1, services: 1, dependents: 1, dataMutation: false },
      plan: { confidence: 0.96, verificationPack: 'health_probe_v4' },
      incident: { major_active: true }, calendar: { freeze: false },
    },
  },
  {
    label: 'Data deletion — irreversible, never agent-executed at any level',
    ctx: {
      policyId: 'pol_data_contract', agentId: 'agt_custodian',
      action: { class: 'AC-71', env: 'prod', hasCompensation: false },
      blast: { tier: 1, services: 1, dependents: 0, dataMutation: true },
      plan: { confidence: 0.99, verificationPack: null },
      incident: { major_active: false }, calendar: { freeze: false },
      asset: { contract: 'dc_datamart_v2', pii: 'restricted' },
    },
  },
  {
    label: 'Backfill on an asset with no data contract — codify before you automate',
    ctx: {
      policyId: 'pol_data_contract', agentId: 'agt_custodian',
      action: { class: 'AC-49', env: 'prod', hasCompensation: true },
      blast: { tier: 1, services: 1, dependents: 3, dataMutation: true },
      plan: { confidence: 0.88, verificationPack: 'dq_contract_v5' },
      incident: { major_active: false }, calendar: { freeze: false },
      asset: { contract: null, pii: 'restricted' },
    },
  },
  {
    label: 'EUC lockout reset — the proving ground class running unattended',
    ctx: {
      policyId: 'pol_euc_std', agentId: 'agt_concierge',
      action: { class: 'AC-66', env: 'prod', hasCompensation: true },
      blast: { tier: 3, services: 1, dependents: 0, dataMutation: false },
      plan: { confidence: 0.97, verificationPack: 'euc_checkin_v1' },
      incident: { major_active: false }, calendar: { freeze: false },
    },
  },
  {
    label: 'Entitlement change — four-eyes holds regardless of grade',
    ctx: {
      policyId: 'pol_euc_std', agentId: 'agt_concierge',
      action: { class: 'AC-58', env: 'prod', hasCompensation: true },
      blast: { tier: 2, services: 1, dependents: 0, dataMutation: false },
      plan: { confidence: 0.94, verificationPack: 'entitlement_diff_v3' },
      incident: { major_active: false }, calendar: { freeze: false },
    },
  },
  {
    label: 'A mutating step with no declared rollback — refused unattended',
    ctx: {
      policyId: 'pol_change_std', agentId: 'agt_remedian',
      action: { class: 'AC-18', env: 'prod', hasCompensation: false },
      blast: { tier: 1, services: 1, dependents: 2, dataMutation: false },
      plan: { confidence: 0.93, verificationPack: 'capacity_probe_v2' },
      incident: { major_active: false }, calendar: { freeze: false },
    },
  },
]

/* Evaluation suites and the regression set. Seeded records. */

export const SUITES = [
  { id: 'es_2027_02_11', name: 'Infrastructure remediation', cases: 1240, coverage: ['AC-12', 'AC-18', 'AC-24', 'AC-31'], lastRun: 7, pass: 0.931, regression: 0, owner: 'M. Okonkwo' },
  { id: 'es_2027_02_04', name: 'Triage & diagnosis', cases: 2480, coverage: ['AC-05', 'AC-08'], lastRun: 14, pass: 0.962, regression: 0, owner: 'R. Venkatesh' },
  { id: 'es_2027_01_28', name: 'Problem mining & FinOps', cases: 620, coverage: ['AC-05', 'AC-18', 'AC-80'], lastRun: 21, pass: 0.902, regression: 2, owner: 'C. Duval' },
  { id: 'es_cl_2027_02', name: 'Client agents — onboarding', cases: 320, coverage: ['AC-05', 'AC-58'], lastRun: 6, pass: 0.741, regression: 1, owner: 'L. Nakamura' },
]

export const REGRESSION = [
  { id: 'rg_1', from: 'sk_patch_v8.0.5', to: 'sk_patch_v8.0.6', metric: 'Fix correctness', before: 0.878, after: 0.884, verdict: 'improved' },
  { id: 'rg_2', from: 'sk_patch_v8.0.5', to: 'sk_patch_v8.0.6', metric: 'Test coverage of generated fix', before: 0.812, after: 0.847, verdict: 'improved' },
  { id: 'rg_3', from: 'sk_patch_v8.0.5', to: 'sk_patch_v8.0.6', metric: 'Reviewer-grade narrative', before: 0.901, after: 0.889, verdict: 'regressed' },
  { id: 'rg_4', from: 'router_2027_01', to: 'router_2027_02', metric: 'Causal reasoning (frontier held)', before: 0.948, after: 0.948, verdict: 'unchanged' },
  { id: 'rg_5', from: 'router_2027_01', to: 'router_2027_02', metric: 'Log extraction (mid tier)', before: 0.971, after: 0.962, verdict: 'within tolerance' },
]

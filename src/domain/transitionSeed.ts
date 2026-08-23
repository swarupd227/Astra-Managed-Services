/* Graph quality SLOs and the transition phase model — contracted definitions
   and exit criteria, not measurements. */

export const SLO_TARGETS = [
  { key: 'coverage', label: 'Coverage', definition: 'Managed entities with complete required attributes and ownership', target: '≥ 95% (100% tier-0/1)' },
  { key: 'currency', label: 'Verification currency', definition: 'Assertions relied on by L3/L4 actions that are within TTL', target: '≥ 99%' },
  { key: 'contradiction', label: 'Contradiction rate', definition: 'Telemetry-versus-graph contradictions per 1,000 assertions per month', target: '≤ 2, trending down' },
  { key: 'latency', label: 'Verification latency', definition: 'Unverified tier-0/1 assertion to human verdict', target: '≤ 5 business days' },
]

export const PHASES = [
  { id: 'discover', label: 'Discover', weeks: 'wks 1–2', exit: 'Graph coverage ≥ target per tower; top-20 demand classes identified with volumes', state: 'done' },
  { id: 'codify', label: 'Codify', weeks: 'wks 3–6', exit: '85% of historical volume covered by verified knowledge; all tier-0/1 human-verified', state: 'active' },
  { id: 'shadow', label: 'Shadow', weeks: 'wks 7–10', exit: 'Agreement ≥ threshold per action class; zero unexplained tier-0 disagreements', state: 'active' },
  { id: 'cutover', label: 'Cutover & steady state', weeks: 'wk 11 →', exit: 'Baseline countersigned; Autonomy Schedule v1 in force; hypercare exit metrics met', state: 'pending' },
]

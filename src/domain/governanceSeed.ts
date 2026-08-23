/* Governance forums and the risk register. Seeded records. */

export const FORUMS = [
  { name: 'Ops standup', cadence: 'Daily', chair: 'Shift lead', inputs: 'Ops Day Report, jeopardy list, gated-run queue', outputs: 'Assignments; escalations' },
  { name: 'Service review', cadence: 'Weekly', chair: 'SDM with client service owner', inputs: 'Service Performance and Autonomy reports', outputs: 'Actions with owners; pause and dispute triage' },
  { name: 'Service governance board', cadence: 'Monthly', chair: 'Client service owner', inputs: 'Governance Pack: service, economics, autonomy schedule changes, elimination and transform allocations, risks, obligations', outputs: 'Recorded decisions: promotions, credit allocations, policy changes' },
  { name: 'Joint innovation council', cadence: 'Monthly', chair: 'Joint chairs', inputs: 'Innovation funnel', outputs: 'Sponsorships; credit share allocation' },
  { name: 'Executive & commercial review', cadence: 'Quarterly', chair: 'Client CIO with Artizent executive sponsor', inputs: 'QBR Pack: outcome commitments, glidepath, value story, risk posture', outputs: 'Strategic decisions; commercial adjustments; escalation resolution' },
  { name: 'Annual strategy & contract review', cadence: 'Yearly', chair: 'Executives both sides', inputs: 'Year-in-evidence pack; re-baselining proposals; autonomy roadmap', outputs: 'Contract schedule updates; next-year targets' },
]

export const RISKS = [
  { id: 'rsk_04', title: 'Single-point knowledge on the mainframe adapter', link: 'Graph verification coverage on twr_core is 93.1% with 4 tier-1 services carrying a single verifier', state: 'amber', owner: 'S. Iyer', trend: 'improving' },
  { id: 'rsk_07', title: 'Resilience of the FINREP delivery path', link: 'Last DR test 2026-11-14 · scenario test due in 23 days (obl_003)', state: 'amber', owner: 'D. Kowalski', trend: 'flat' },
  { id: 'rsk_11', title: 'Client-side agent estate outrunning its governance', link: '2 client agents in production, 1 on probation after air_0019; EU AI Act register attestation overdue', state: 'red', owner: 'L. Nakamura', trend: 'worsening' },
  { id: 'rsk_02', title: 'Concentration on a single frontier model provider', link: 'Multi-provider routing live; failover exercised 2027-01-22 with graceful degradation to approve-first', state: 'green', owner: 'L. Nakamura', trend: 'improving' },
  { id: 'rsk_09', title: 'Data Platform consumer trust below XLA target', link: 'Trust score 68.2 vs 75 for two consecutive months; credit allocation frozen', state: 'red', owner: 'A. Sørensen', trend: 'flat' },
]

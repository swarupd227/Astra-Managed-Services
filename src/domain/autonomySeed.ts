/* Autonomy promotion history and the promotion pipeline. Seeded records —
   they predate the simulated window, so nothing derives them. */

export const PROMOTIONS = [
  { id: 'pr_88', at: 4, dir: 'up' as const, tower: 'twr_payments', ac: 'AC-31', from: 2, to: 3, why: 'Sustained supervised performance: 412 executions, zero verification failures, sampled-review agreement 98.4%. Client governance approved with an 8-week weekly-review condition.', evidence: 'ev_dd41a2' },
  { id: 'pr_86', at: 21, dir: 'up' as const, tower: 'twr_euc', ac: 'AC-66', from: 3, to: 4, why: 'EUC state resets: 9,840 runs at 99.8% success with cheap verification and self-healing reversibility. The proving ground class reaching L4 first, as designed.', evidence: 'ev_dd41b1' },
  { id: 'pr_84', at: 38, dir: 'up' as const, tower: 'twr_cloud', ac: 'AC-18', from: 3, to: 4, why: 'Scale-within-bounds on tier-2 workloads. Bounds are policy; the agent cannot scale outside them regardless of what it concludes.', evidence: 'ev_dd41b2' },
  { id: 'dm_09', at: 96, dir: 'down' as const, tower: 'twr_dataplat', ac: 'AC-49', from: 3, to: 2, why: 'Automatic demotion after a backfill emitted contract-violating nulls on txn_gold. Compensated in 4 minutes; grade B → C for 21 days. Client-visible from the moment it happened.', evidence: 'ev_dd41a8' },
  { id: 'pr_81', at: 112, dir: 'up' as const, tower: 'twr_payments', ac: 'AC-12', from: 3, to: 4, why: 'Restart of stateless workloads. Self-healing reversibility plus a cheap health probe made this the second class to reach L4.', evidence: 'ev_dd41b3' },
]

export const PIPELINE = [
  { stage: '1. Replay', gate: 'Score ≥ threshold on a golden dataset built from this client’s own historical work (n ≥ 200 per action class), scored on correctness, safety and narrative quality', evidence: 'Evaluation report attached to the record' },
  { stage: '2. Shadow', gate: 'Runs in parallel with humans on live work without acting; agreement rate and would-have-been outcomes measured over a defined window', evidence: 'Shadow scorecard, disagreement analysis' },
  { stage: '3. Assisted (L1–L2)', gate: 'Live success ≥ target with human approvals; approval-override rate below threshold', evidence: 'Live ledger, override analysis' },
  { stage: '4. Supervised (L3)', gate: 'Statistical confidence on incident-free execution for the class (≥ 300 executions, failure rate bound); SDM sign-off', evidence: 'Promotion record, human counter-signed' },
  { stage: '5. Autonomous (L4)', gate: 'Sustained L3 performance, sampled-review agreement ≥ target, and client governance approval for the class', evidence: 'Contract-level autonomy schedule update' },
]

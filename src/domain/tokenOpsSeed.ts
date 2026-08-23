/* Model budgets and observed cost anomalies. Seeded records. */

export const BUDGETS = [
  { scope: 'twr_payments', period: 'month', limit: 9800, spent: 6420, soft: 0.7, hard: 0.9, state: 'ok' },
  { scope: 'twr_cloud', period: 'month', limit: 7400, spent: 5180, soft: 0.7, hard: 0.9, state: 'ok' },
  { scope: 'twr_dataplat', period: 'month', limit: 5200, spent: 4810, soft: 0.7, hard: 0.9, state: 'soft' },
  { scope: 'twr_euc', period: 'month', limit: 3100, spent: 1490, soft: 0.7, hard: 0.9, state: 'ok' },
  { scope: 'twr_agentops', period: 'month', limit: 900, spent: 872, soft: 0.7, hard: 0.9, state: 'hard' },
]

export const ANOMALIES = [
  { id: 'anm_04', at: 3, title: 'Degenerate retry loop on sk_backfill_v4', detail: 'A malformed schema response triggered 41 identical retries in 90 seconds. Quarantined automatically; the skill now bounds retries by response fingerprint.', savedUsd: 118 },
  { id: 'anm_03', at: 11, title: 'Prompt bloat on sk_govpack_v10', detail: 'Context assembly stopped ranking and started concatenating after a graph schema change. Detected on cost per work object, not on quality — quality was fine, the price was not.', savedUsd: 264 },
  { id: 'anm_02', at: 26, title: 'Client agent budget breach — KYC Assist', detail: 'Hard threshold reached. Routing degraded to the mid tier automatically and a work object was raised against the agent owner.', savedUsd: 47 },
]

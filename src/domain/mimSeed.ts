/* Major-incident communication drafts, per audience. */

export const AUDIENCES = [
  {
    id: 'status',
    label: 'Status page',
    draft:
      'We are investigating elevated response times affecting card payments. Payments are being accepted; some customers may see slower confirmation. Our next update will be within 30 minutes.',
  },
  {
    id: 'exec',
    label: 'Executive',
    draft:
      'A configuration change applied on 16 February reduced the ledger database connection pool, causing latency to breach its objective under morning peak load. Customer impact is degraded confirmation times, not failed payments. The remediation plan is prepared with a tested rollback and is awaiting your service owner’s approval. Autonomy is capped at Advise across the platform while the major incident is open.',
  },
  {
    id: 'technical',
    label: 'Technical',
    draft:
      'chg_5511 set conn_pool.max on db_ledger_rw from 500 to 200. Pool saturation from 08:52 CET; p99 on svc_payments crossed 1,800 ms. Proposed: AC-31 config revert to known-good plus AC-12 rolling restart of app_ledger, canary-verified against canary_slo_v6. Rollback: reapply chg_5511, tested in non-prod 2027-02-16.',
  },
]

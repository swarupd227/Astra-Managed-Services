/* Major-incident communication drafts, per audience. */

export const AUDIENCES = [
  {
    id: 'status',
    label: 'Status page',
    draft:
      'We are investigating sync failures affecting OneDrive and PowerPoint for staff on the new Zero Trust network profile. No files have been lost; some users may see delayed sync or "file in use" conflicts. Our next update will be within 30 minutes.',
  },
  {
    id: 'exec',
    label: 'Executive',
    draft:
      'A Zero Trust (SASE) policy change rolled out on 16 February re-routed OneDrive and Teams traffic through full packet inspection, breaking token refresh for PowerPoint co-authoring — during a week several offices are heads-down on a client deliverable. Impact is delayed file sync and co-authoring conflicts, not data loss. The remediation plan is prepared with a tested rollback and is awaiting your service owner’s approval. Autonomy is capped at Advise across the platform while the major incident is open.',
  },
  {
    id: 'technical',
    label: 'Technical',
    draft:
      'chg_6104 tightened cisco-sase-global inspection policy to include M365 traffic. TLS re-inspection broke OneDrive/PowerPoint token refresh from 08:52 CST; co-authoring conflict rate on twr_euc crossed 12% of active sessions. Proposed: AC-31 config revert to known-good on if_zta plus AC-66 EUC profile reset for affected endpoints, canary-verified against canary_slo_v6. Rollback: reapply chg_6104 outside business hours, tested in non-prod 2027-02-16.',
  },
]

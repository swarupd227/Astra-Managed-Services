import { nextAttestationDue, type Attestation } from './dataHandling'

/**
 * The attestations on record, newest first — one at contract start and the
 * quarterly renewals since. Estate data: the platform only requires that one
 * exists and is inside its cadence.
 */
export const ATTESTATIONS: Attestation[] = [
  {
    id: 'att_003',
    at: '2026-12-15T10:00:00.000Z',
    by: 'V. Marchetti',
    vendorRef: 'Vendor DPA addendum, May 2026 — reconfirmed at the Q4 governance forum; no training, tuning, evaluation or improvement of any model on customer data',
    scope: 'Every approved AI system in Exhibit O-1; the client-hosted classifier is distilled on this tenant only and never listed for another',
    nextDueAt: nextAttestationDue('2026-12-15T10:00:00.000Z'),
  },
  {
    id: 'att_002',
    at: '2026-09-16T10:00:00.000Z',
    by: 'V. Marchetti',
    vendorRef: 'Vendor DPA addendum, May 2026 — reconfirmed at the Q3 governance forum',
    scope: 'Every approved AI system in Exhibit O-1',
    nextDueAt: nextAttestationDue('2026-09-16T10:00:00.000Z'),
  },
  {
    id: 'att_001',
    at: '2026-06-20T14:10:00.000Z',
    by: 'E. Whitfield',
    vendorRef: 'Vendor DPA addendum, May 2026 — no training, tuning, evaluation or improvement of any model on customer data',
    scope: 'Every approved AI system in Exhibit O-1; the client-hosted classifier is distilled on this tenant only and never listed for another',
    nextDueAt: nextAttestationDue('2026-06-20T14:10:00.000Z'),
  },
]

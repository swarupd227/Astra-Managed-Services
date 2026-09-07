import { digest } from './rng'
import type { Assertion, ISO, Run, WorkObject } from './types'

/* ==========================================================================
   Data handling — certified deletion and the training-exclusion attestation.

   Deletion is the one irreversible thing the platform does to a customer's
   data, so it runs the way AC-71 says everything irreversible must: never by
   an agent, with a second human control, and with a certificate that is
   itself a sealed record. The chain is not deleted — it holds hashes, not
   data — so the certificate can carry the chain's root at the moment of
   deletion and an auditor can prove nothing was touched afterwards.
   ========================================================================== */

export interface DeletionScope {
  kind: 'tower'
  target: string
  label: string
}

export interface DeletionManifest {
  workIds: string[]
  runIds: string[]
  assertionIds: string[]
}

export interface DeletionCertificate {
  id: string
  scope: DeletionScope
  requestedBy: string
  secondControl: string
  at: ISO
  counts: { workObjects: number; runs: number; assertions: number }
  /** Root hash of the evidence chain immediately before the deletion. */
  preRootHash: string
  /** Digest of the ordered manifest of ids deleted — what was removed, provably. */
  manifestHash: string
  reason: string
  evidenceIds: string[]
}

export interface Attestation {
  id: string
  at: ISO
  by: string
  /** The vendor document the attestation rests on. */
  vendorRef: string
  /** What the attestation covers, in words. */
  scope: string
  nextDueAt: ISO
  evidenceId?: string
}

export const ATTESTATION_CADENCE_DAYS = 90

export function nextAttestationDue(at: ISO): ISO {
  return new Date(new Date(at).getTime() + ATTESTATION_CADENCE_DAYS * 86400000).toISOString()
}

/**
 * What a tower-scoped deletion removes: closed work and its runs, and
 * assertions that have gone stale. Open work and live knowledge are never in
 * scope — a deletion is retention, not an incident response.
 */
export function deletionManifest(work: WorkObject[], runs: Run[], assertions: Assertion[], tower: string): DeletionManifest {
  const workIds = work.filter((w) => w.tower === tower && (w.state === 'resolved' || w.state === 'learned')).map((w) => w.id)
  const set = new Set(workIds)
  const runIds = runs.filter((r) => set.has(r.workObjectId)).map((r) => r.id)
  const assertionIds = assertions.filter((a) => a.tower === tower && a.verification === 'stale').map((a) => a.id)
  return { workIds: workIds.sort(), runIds: runIds.sort(), assertionIds: assertionIds.sort() }
}

export function manifestHash(m: DeletionManifest): string {
  return digest(JSON.stringify(m))
}

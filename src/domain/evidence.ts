import { digest } from './rng'
import type { EvidenceRecord } from './types'

/**
 * The Evidence Chain (spec §20.3).
 *
 * Records are append-only and hash-linked: each record's digest covers its own
 * content and its predecessor's digest, so any edit to history invalidates
 * every record after it. The Evidence Explorer recomputes the chain in the
 * browser — verification is arithmetic the auditor can watch, not an assurance.
 */

export const GENESIS = '0'.repeat(32)

export function contentOf(r: Omit<EvidenceRecord, 'hash' | 'prevHash' | 'tampered'>): string {
  return JSON.stringify({
    id: r.id,
    seq: r.seq,
    at: r.at,
    kind: r.kind,
    workObjectId: r.workObjectId ?? null,
    runId: r.runId ?? null,
    agentId: r.agentId ?? null,
    actionClass: r.actionClass ?? null,
    actor: r.actor,
    summary: r.summary,
    payload: r.payload,
    sealed: r.sealed,
  })
}

export function hashRecord(r: Omit<EvidenceRecord, 'hash' | 'tampered'>): string {
  return digest(`${r.prevHash}|${contentOf(r)}`)
}

/** Recomputes prevHash/hash across an ordered list. Used on append and on load. */
export function sealChain(records: Omit<EvidenceRecord, 'hash' | 'prevHash' | 'tampered'>[]): EvidenceRecord[] {
  let prev = GENESIS
  return records.map((r) => {
    const withPrev = { ...r, prevHash: prev }
    const hash = hashRecord(withPrev)
    prev = hash
    return { ...withPrev, hash }
  })
}

export interface ChainVerification {
  valid: boolean
  checked: number
  firstBreakSeq: number | null
  brokenIds: string[]
  rootHash: string
  anchoredAt: string
  durationMs: number
}

/**
 * Walks the chain, recomputing each digest from its predecessor. A record whose
 * stored hash differs from the recomputed one — or whose prevHash does not match
 * the previous record's hash — breaks the chain from that point forward.
 */
export function verifyChain(records: EvidenceRecord[]): ChainVerification {
  const t0 = performance.now()
  let prev = GENESIS
  let firstBreak: number | null = null
  const broken: string[] = []

  for (const r of records) {
    const expected = hashRecord({ ...r, prevHash: prev })
    const linkOk = r.prevHash === prev
    const hashOk = r.hash === expected
    if (!linkOk || !hashOk) {
      if (firstBreak === null) firstBreak = r.seq
      broken.push(r.id)
      prev = r.hash // continue walking so the operator sees the full extent
    } else {
      prev = r.hash
    }
  }

  return {
    valid: firstBreak === null,
    checked: records.length,
    firstBreakSeq: firstBreak,
    brokenIds: broken,
    rootHash: prev,
    anchoredAt: records.length ? records[records.length - 1].at : new Date().toISOString(),
    durationMs: Math.round((performance.now() - t0) * 100) / 100,
  }
}

export function appendRecord(
  chain: EvidenceRecord[],
  partial: Omit<EvidenceRecord, 'seq' | 'prevHash' | 'hash' | 'tampered'>,
): EvidenceRecord {
  const prev = chain.length ? chain[chain.length - 1].hash : GENESIS
  const seq = chain.length ? chain[chain.length - 1].seq + 1 : 1
  const withMeta = { ...partial, seq, prevHash: prev }
  return { ...withMeta, hash: hashRecord(withMeta) }
}

export const EVIDENCE_KIND_LABEL: Record<EvidenceRecord['kind'], string> = {
  observation: 'Observation',
  decision: 'Policy decision',
  approval: 'Human approval',
  action: 'Action executed',
  verification: 'Verification',
  economic: 'Economic entry',
  clock: 'SLA clock event',
  knowledge: 'Knowledge write',
}

import { query } from './db.mjs'

/* ==========================================================================
   The registers a person writes, read and appended.

   Append-only and union-merged: a browser sends everything it holds, the
   rows it already sent are left exactly as they were, and anything new is
   added. Two people recording at the same time therefore end up with both
   sets rather than whichever saved last. Nothing here can update or delete
   a record, because none of these registers has an operation that means
   either — a notice given is not un-given.
   ========================================================================== */

/** The registers, and what makes one of their rows unique. */
export const KINDS = {
  privacyLog: (r) => `${r.requestId}:${r.itemId}:${r.at}`,
  incidentNotices: (r) => r.incidentId,
  exitLog: (r) => `${r.holdingId}:${r.action}`,
  commitmentLog: (r) => `${r.commitmentId}:${r.kind}:${r.at}`,
  clientDirectives: (r) => r.id,
  packExports: (r) => r.id,
  areaLoads: (r) => `${r.engagementId}:${r.at}`,
  procedureReviews: (r) => `${r.procedureId}:${r.at}`,
  procedures: (r) => r.id,
  // One experiment per finding: the key is the finding so a second funding of
  // the same condition converges rather than doubling.
  experiments: (r) => r.findingId,
  evidenceTail: (r) => r.id,
}

export async function readRecords(engagementId) {
  const rows = await query(
    'select kind, payload, recorded_at from record where engagement_id = $1 order by recorded_at, key',
    [engagementId],
  )
  const out = Object.fromEntries(Object.keys(KINDS).map((k) => [k, []]))
  for (const row of rows) if (out[row.kind]) out[row.kind].push(row.payload)
  return out
}

/**
 * Writes anything the browser holds that the database does not. Returns what
 * was added, so a caller can tell the difference between a quiet success and
 * a write that silently did nothing.
 */
export async function appendRecords(engagementId, registers, by, role) {
  const added = {}
  for (const [kind, keyOf] of Object.entries(KINDS)) {
    const rows = Array.isArray(registers?.[kind]) ? registers[kind] : []
    if (!rows.length) continue
    let count = 0
    for (const payload of rows) {
      let key
      try {
        key = String(keyOf(payload) ?? '')
      } catch {
        continue
      }
      if (!key) continue
      const res = await query(
        `insert into record (engagement_id, kind, key, payload, recorded_by, recorded_role)
         values ($1, $2, $3, $4, $5, $6)
         on conflict (engagement_id, kind, key) do nothing
         returning key`,
        [engagementId, kind, key, JSON.stringify(payload), by, role],
      )
      if (res.length) count += 1
    }
    if (count) added[kind] = count
  }
  return added
}

/**
 * Forgets an engagement's records entirely.
 *
 * The only operation here that deletes, and it exists because the alternative
 * is worse: a reset that cleared the browser but left the database would hand
 * everything back on the next reload while reporting that it had gone.
 */
export async function clearRecords(engagementId) {
  const rows = await query('delete from record where engagement_id = $1 returning kind', [engagementId])
  return rows.length
}

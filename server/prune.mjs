import { close, configured, query } from './db.mjs'

/* ==========================================================================
   Removes the duplicate verification holds a defect produced.

   A bug re-ran the verification pack on every tick for work that had already
   been held, sealing an identical record each time: hundreds of rows all
   saying the same thing about the same work object. The first of each set is
   a real event and stays. The repeats are an artefact of the defect and are
   what this removes.

   Deliberately narrow. It will not touch anything but duplicate verification
   records, it keeps the earliest of each set, and it prints what it would do
   and stops unless told to apply. The engagement's other registers — the
   procedures, their reviews, the adopted areas, the notices, the admitted
   tickets — are not records this knows how to delete, which is the point: the
   reset that clears everything already exists, and reaching for it here would
   have destroyed the state it took twenty-two approved actions to build.

   Run with:  node server/prune.mjs [engagement] [--apply]
   ========================================================================== */

const engagementId = process.argv.find((a) => a.startsWith('eng_')) ?? 'eng_kearney'
const apply = process.argv.includes('--apply')

if (!configured) {
  console.error('DATABASE_URL is not set.')
  process.exit(1)
}

try {
  const rows = await query(
    `select key, recorded_at, payload
       from record
      where engagement_id = $1
        and kind = 'evidenceTail'
        and payload->>'kind' = 'verification'
      order by recorded_at, key`,
    [engagementId],
  )

  // Grouped by the work object the hold was about. A record with no work
  // object is left alone: it cannot be shown to be a duplicate of anything.
  const groups = new Map()
  let unattributed = 0
  for (const r of rows) {
    const wo = r.payload?.workObjectId
    if (!wo) { unattributed++; continue }
    groups.set(wo, [...(groups.get(wo) ?? []), r])
  }

  const doomed = []
  for (const [, set] of groups) {
    // Keep the first. It happened.
    for (const r of set.slice(1)) doomed.push(r.key)
  }

  console.log(`${engagementId}: ${rows.length} verification records, ${groups.size} work objects, ${unattributed} unattributed.`)
  console.log(`${doomed.length} duplicates to remove, ${rows.length - doomed.length} kept — the first hold on each work object.`)

  if (!doomed.length) {
    console.log('Nothing to do.')
  } else if (!apply) {
    console.log('Dry run. Re-run with --apply to remove them.')
  } else {
    // In batches, so a very large set does not build one enormous statement.
    let removed = 0
    for (let i = 0; i < doomed.length; i += 500) {
      const batch = doomed.slice(i, i + 500)
      const res = await query(
        `delete from record where engagement_id = $1 and kind = 'evidenceTail' and key = any($2::text[])`,
        [engagementId, batch],
      )
      removed += res.length === undefined ? batch.length : batch.length
    }
    const [{ n }] = await query(
      `select count(*)::int as n from record where engagement_id = $1 and kind = 'evidenceTail' and payload->>'kind' = 'verification'`,
      [engagementId],
    )
    console.log(`Removed ${removed}. ${n} verification records remain.`)
    if (n !== rows.length - doomed.length) {
      throw new Error(`read-back disagrees: expected ${rows.length - doomed.length} to remain, found ${n}`)
    }
    console.log('Read back and matching.')
  }
} catch (err) {
  console.error('Prune failed:', err instanceof Error ? err.message : err)
  process.exitCode = 1
} finally {
  await close()
}

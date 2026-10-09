import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { close, configured, query } from './db.mjs'

/* ==========================================================================
   Ingests a client's ticket history from the extract it was supplied in.

   The extract is derived from the workbook rather than typed: see the
   generator that produced data/ticket-history.json. This reads that file and
   writes it, which is what makes a new extract a command rather than a code
   change.

   An ingest replaces what it finds for that engagement rather than merging.
   A ticket history is a snapshot of a period, and half of last quarter's
   clusters mixed with half of this quarter's would describe nothing at all.

   Run with: npm run db:ingest
   ========================================================================== */

const HERE = path.dirname(fileURLToPath(import.meta.url))
const FILE = process.env.TICKET_HISTORY ?? path.join(HERE, '..', 'data', 'ticket-history.json')

if (!configured) {
  console.error('DATABASE_URL is not set.')
  process.exit(1)
}

const histories = JSON.parse(fs.readFileSync(FILE, 'utf8'))

try {
  for (const h of histories) {
    const [engagement] = await query('select id from engagement where id = $1', [h.engagementId])
    if (!engagement) {
      console.error(`Skipped ${h.engagementId}: no such engagement. Load the contract before its history.`)
      continue
    }

    // The period decides what the figures mean, so the previous one goes.
    for (const t of ['ticket_scope_line', 'ticket_theme', 'ticket_cluster', 'ticket_limitation']) {
      await query(`delete from ${t} where engagement_id = $1`, [h.engagementId])
    }

    const s = h.shape
    await query(
      `insert into ticket_history (
         engagement_id, source, period_from, period_to, period_months,
         incidents, requests, problems, catalogue_tasks,
         scope_rule, in_scope, in_scope_pct,
         sub_categories, top5_pct, top16_pct, singletons, out_of_hours_pct, weekend_pct,
         repeat_pct, clusters_over_ten, cluster_share_pct, human_raised_pct, still_open_pct,
         off_inventory_pct, off_inventory,
         problem_records, problems_open, without_problem_pct,
         growth_first_half, growth_second_half, growth_pct
       ) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27,$28,$29,$30,$31)
       on conflict (engagement_id) do update set
         source = excluded.source, period_from = excluded.period_from, period_to = excluded.period_to,
         period_months = excluded.period_months, incidents = excluded.incidents, requests = excluded.requests,
         problems = excluded.problems, catalogue_tasks = excluded.catalogue_tasks, scope_rule = excluded.scope_rule,
         in_scope = excluded.in_scope, in_scope_pct = excluded.in_scope_pct, sub_categories = excluded.sub_categories,
         top5_pct = excluded.top5_pct, top16_pct = excluded.top16_pct, singletons = excluded.singletons,
         out_of_hours_pct = excluded.out_of_hours_pct, weekend_pct = excluded.weekend_pct, repeat_pct = excluded.repeat_pct,
         clusters_over_ten = excluded.clusters_over_ten, cluster_share_pct = excluded.cluster_share_pct,
         human_raised_pct = excluded.human_raised_pct, still_open_pct = excluded.still_open_pct,
         off_inventory_pct = excluded.off_inventory_pct, off_inventory = excluded.off_inventory,
         problem_records = excluded.problem_records, problems_open = excluded.problems_open,
         without_problem_pct = excluded.without_problem_pct, growth_first_half = excluded.growth_first_half,
         growth_second_half = excluded.growth_second_half, growth_pct = excluded.growth_pct,
         ingested_at = now()`,
      [
        h.engagementId, h.source, h.period.from, h.period.to, h.period.months,
        h.volumes.incidents, h.volumes.requests, h.volumes.problems, h.volumes.catalogueTasks,
        h.scope.rule, h.scope.inScope, h.scope.inScopePct,
        s.subCategories, s.top5Pct, s.top16Pct, s.singletons, s.outOfHoursPct, s.weekendPct,
        s.repeatPct, s.clustersOverTen, s.clusterSharePct, s.humanRaisedPct, s.stillOpenPct,
        s.offInventoryPct, s.offInventory,
        h.problems.records, h.problems.open, h.problems.inScopeWithoutProblemPct,
        h.growth.firstHalf, h.growth.secondHalf, h.growth.pct,
      ],
    )

    for (const l of h.scope.byLine) {
      await query('insert into ticket_scope_line (engagement_id, id, name, incidents) values ($1,$2,$3,$4)',
        [h.engagementId, l.id, l.name, l.incidents])
    }
    for (const [i, t] of h.themes.entries()) {
      await query('insert into ticket_theme (engagement_id, id, name, incidents, pct_of_inscope, class_ids, position) values ($1,$2,$3,$4,$5,$6,$7)',
        [h.engagementId, t.id, t.name, t.incidents, t.pctOfInScope, t.classIds ?? [], i + 1])
    }
    for (const c of h.clusters) {
      await query('insert into ticket_cluster (engagement_id, id, example, sub_category, incidents, months, class_id) values ($1,$2,$3,$4,$5,$6,$7)',
        [h.engagementId, c.id, c.example, c.subCategory, c.incidents, c.months, c.classId ?? null])
    }
    for (const c of h.cannot ?? []) {
      await query('insert into ticket_limitation (engagement_id, what, because) values ($1,$2,$3)',
        [h.engagementId, c.what, c.because])
    }

    /* ------------------------------------------------------------------------
       Read back what landed, and refuse to call it an ingest if it does not
       match the extract.

       The limitations went missing exactly this way: an earlier extract had
       none, the load succeeded, and nothing afterwards noticed that the table
       the application reads was empty. The limitations are the rows that make
       the platform say what it cannot measure and why, so losing them silently
       turns a refusal into a gap.
       ------------------------------------------------------------------------ */
    const expected = {
      ticket_scope_line: h.scope.byLine.length,
      ticket_theme: h.themes.length,
      ticket_cluster: h.clusters.length,
      ticket_limitation: (h.cannot ?? []).length,
    }
    const wrong = []
    for (const [table, want] of Object.entries(expected)) {
      const [row] = await query(`select count(*)::int as n from ${table} where engagement_id = $1`, [h.engagementId])
      if (row.n !== want) wrong.push(`${table}: ${row.n} rows in the database against ${want} in the extract`)
    }
    if (wrong.length) {
      throw new Error(`${h.engagementId} did not load as supplied — ${wrong.join('; ')}`)
    }

    console.log(
      `${h.engagementId}: ${h.themes.length} themes, ${h.clusters.length} clusters, ` +
      `${h.scope.inScope} in scope, ${h.cannot.length} stated limitations — all read back and matching.`,
    )
    if (!h.cannot?.length) {
      console.warn(`  note: ${h.engagementId} states no limitations. Every measure will be scored as though the extract supports it.`)
    }
  }
} catch (err) {
  console.error('Ingest failed:', err instanceof Error ? err.message : err)
  process.exitCode = 1
} finally {
  await close()
}

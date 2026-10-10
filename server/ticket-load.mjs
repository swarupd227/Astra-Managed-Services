import { countSubCategories, mapRows, REQUIRED_FIELDS } from './ticket-feed.mjs'
import { query } from './db.mjs'

/* ==========================================================================
   Loading a dump under a confirmed configuration.

   One path, used by the command line and by the upload. Two paths would
   eventually disagree, and the one nobody runs during a demo is the one that
   would be wrong — so the check and the write live here and both callers are
   thin.

   The shape is deliberate: everything that can be refused is refused before
   anything is written, and what landed is read back and compared against what
   was mapped. A load that writes most of itself and stops is far harder to
   notice than one that writes nothing, and an ingest that reports success
   while having quietly dropped rows is the failure that hid a missing table
   for weeks.
   ========================================================================== */

/**
 * Everything that can be known about a dump without writing it.
 *
 * Returns faults rather than throwing, because the caller showing them to a
 * person needs all of them at once rather than the first one.
 */
export function checkDump(args) {
  const { rows, columnMap = {}, priorities = [], subCategoryClasses = [] } = args
  const faults = []

  const header = (rows[0] ?? []).map((h) => h.trim())
  for (const field of REQUIRED_FIELDS) {
    const column = columnMap[field]
    if (!column) faults.push(`nothing is mapped to ${field}, which the intake cannot do without`)
    else if (!header.includes(column)) faults.push(`${field} is read from "${column}", which this dump does not have`)
  }
  for (const [field, column] of Object.entries(columnMap)) {
    if (!header.includes(column)) faults.push(`${field} is mapped to "${column}", which is not a column in this dump`)
  }
  if (faults.length) return { faults }

  const priorityMap = Object.fromEntries(priorities.map((p) => [p.value, p.priority]).filter(([, v]) => v))
  const { tickets, unreadable } = mapRows(rows, columnMap, priorityMap)

  const seen = new Set()
  const duplicates = []
  for (const t of tickets) {
    if (seen.has(t.ref)) duplicates.push(t.ref)
    seen.add(t.ref)
  }
  if (duplicates.length) {
    faults.push(`the dump repeats ${duplicates.length} reference(s) — ${duplicates.slice(0, 5).join(', ')}`)
  }
  if (!tickets.length) faults.push('the dump maps to no tickets at all')

  const counted = countSubCategories(tickets)
  /* ------------------------------------------------------------------------
     A declaration may name a class, a component, or both.

     The first cut required a class, which made the two halves inseparable and
     threw away the half that is usually available. The client's dump has
     2,951 arrivals under Outlook, Teams, PowerPoint, Office ProPlus and
     Exchange: nobody can say which costed class those belong to, because the
     demand ledger was built from an extract that analysed only application
     and data management and prices none of them. But everybody can say which
     component they are about — Microsoft 365 — and that is the half that
     decides the tower, and therefore the policy, the service level and the
     knowledge pack.

     So the two are declarable apart. Naming the component without the class
     places a ticket correctly and leaves it classified no further than its
     theme, which is the honest outcome: we know what it is about and not
     what it is.
     ------------------------------------------------------------------------ */
  const declarations = new Map(
    subCategoryClasses.filter((d) => d.classId || (d.nodeIds ?? []).length).map((d) => [d.key, d]),
  )
  const orphans = [...declarations.keys()].filter((k) => !counted.rows.some((r) => r.key === k))
  if (orphans.length) {
    // A declaration against a sub-category that is not in the dump is either
    // a typo or a dump from the wrong period, and both are worth stopping for.
    faults.push(`a class is declared for ${orphans.join(', ')}, which this dump does not contain`)
  }

  // Not a fault: those tickets simply arrive with no priority, so they can be
  // given no resolution target. Worth naming, because a reader of any figure
  // cut by priority needs to know some arrivals are not in it.
  const untranslated = [...new Set(tickets.filter((t) => !t.priority && t.priorityRaw).map((t) => t.priorityRaw))]

  return { faults, tickets, unreadable, counted, declarations, untranslated }
}

/**
 * Writes a checked dump, and refuses to call it a load if what landed does
 * not match.
 *
 * A dump is a snapshot of a period, so the previous one goes rather than
 * merging: half of last quarter's arrivals mixed with half of this quarter's
 * describes nothing at all.
 */
export async function writeDump(config, prepared) {
  const { engagementId, system, source, columnMap, because = {}, confirmedBy, priorities = [], subCategoryClasses = [] } = config
  const { tickets, unreadable, counted, declarations } = prepared

  const [engagement] = await query('select id from engagement where id = $1', [engagementId])
  if (!engagement) throw new Error(`no such engagement ${engagementId} — load the contract before its tickets`)

  await query('delete from ticket where engagement_id = $1', [engagementId])
  await query('delete from ticket_feed_priority where engagement_id = $1', [engagementId])

  await query(
    `insert into ticket_feed (engagement_id, system, source, column_map, because, confirmed_by, rows_ingested, unreadable, folded_rows)
     values ($1,$2,$3,$4,$5,$6,$7,$8,$9)
     on conflict (engagement_id) do update set
       system = excluded.system, source = excluded.source, column_map = excluded.column_map,
       because = excluded.because, confirmed_by = excluded.confirmed_by, confirmed_at = now(),
       rows_ingested = excluded.rows_ingested, unreadable = excluded.unreadable, folded_rows = excluded.folded_rows`,
    [
      engagementId, system, source, JSON.stringify(columnMap), JSON.stringify(because),
      confirmedBy, tickets.length, unreadable.length, counted.foldedRows,
    ],
  )

  for (const p of priorities) {
    if (p.priority) {
      await query('insert into ticket_feed_priority (engagement_id, value, priority) values ($1,$2,$3)',
        [engagementId, p.value, p.priority])
    }
  }

  // Batched, because twenty-eight thousand single inserts is minutes of
  // round-trips to a database in another region.
  const COLUMNS = 11
  const BATCH = 300
  for (let i = 0; i < tickets.length; i += BATCH) {
    const slice = tickets.slice(i, i + BATCH)
    const values = []
    const params = []
    for (const [j, t] of slice.entries()) {
      const b = j * COLUMNS
      values.push(`(${Array.from({ length: COLUMNS }, (_, k) => `$${b + k + 1}`).join(',')})`)
      params.push(
        engagementId, t.ref, t.shortDescription, t.category, t.subCategory,
        t.state, t.priorityRaw, t.priority, t.assignmentGroup, t.reportedBy ?? '', t.openedAt,
      )
    }
    await query(
      `insert into ticket (engagement_id, ref, short_description, category, sub_category,
                           state, priority_raw, priority, assignment_group, reported_by, opened_at)
       values ${values.join(',')}`,
      params,
    )
  }

  /* ------------------------------------------------------------------------
     The volumes, recounted — and the declarations, left alone.

     `incidents` is counted from this dump and replaced every time. The class
     and the component are a person's decision about what a sub-category means
     and where it lands, which nothing here can derive and a recount must not
     silently discard. So the upsert sets the count and touches the
     declaration only where one is being stated.
     ------------------------------------------------------------------------ */
  for (const r of counted.rows) {
    const declared = declarations.get(r.key)
    await query(
      `insert into ticket_subcategory (engagement_id, key, category, sub_category, incidents, class_id, node_ids, declared_by)
       values ($1,$2,$3,$4,$5,$6,$7,$8)
       on conflict (engagement_id, key) do update set
         category = excluded.category, sub_category = excluded.sub_category, incidents = excluded.incidents,
         class_id = coalesce(excluded.class_id, ticket_subcategory.class_id),
         -- Set whenever this load states components, kept otherwise. Gated on
         -- the class before, which meant a component-only declaration was
         -- silently discarded.
         node_ids = case when cardinality(excluded.node_ids) > 0 then excluded.node_ids else ticket_subcategory.node_ids end,
         declared_by = coalesce(excluded.declared_by, ticket_subcategory.declared_by)`,
      [
        engagementId, r.key, r.category, r.subCategory, r.incidents,
        declared?.classId ?? null, declared?.nodeIds ?? [], declared ? confirmedBy : null,
      ],
    )
  }
  // A sub-category that has fallen out of the dump entirely should not keep
  // reporting last period's volume.
  await query(
    'delete from ticket_subcategory where engagement_id = $1 and key <> all($2::text[])',
    [engagementId, counted.rows.map((r) => r.key)],
  )

  await query(
    `insert into engagement_ingested (engagement_id, tickets) values ($1, true)
     on conflict (engagement_id) do update set tickets = true`,
    [engagementId],
  )

  /* ------------------------------- Read it back ---------------------------- */
  const [[{ n: landed }], [{ n: subs }], [{ n: classed }], [{ n: placed }], [span]] = await Promise.all([
    query('select count(*)::int as n from ticket where engagement_id = $1', [engagementId]),
    query('select count(*)::int as n from ticket_subcategory where engagement_id = $1', [engagementId]),
    query('select count(*)::int as n from ticket_subcategory where engagement_id = $1 and class_id is not null', [engagementId]),
    query('select count(*)::int as n from ticket_subcategory where engagement_id = $1 and cardinality(node_ids) > 0', [engagementId]),
    query('select min(opened_at) as a, max(opened_at) as b from ticket where engagement_id = $1', [engagementId]),
  ])

  // Counted apart, because the two halves of a declaration are now separable
  // and a read-back that checked only one would miss the other going missing.
  const wantClassed = [...declarations.values()].filter((d) => d.classId).length
  const wantPlaced = [...declarations.values()].filter((d) => (d.nodeIds ?? []).length).length

  const wrong = []
  if (landed !== tickets.length) wrong.push(`ticket: ${landed} rows in the database against ${tickets.length} mapped from the dump`)
  if (subs !== counted.rows.length) wrong.push(`ticket_subcategory: ${subs} rows against ${counted.rows.length} counted`)
  if (classed !== wantClassed) wrong.push(`declared classes: ${classed} rows against ${wantClassed} stated`)
  if (placed !== wantPlaced) wrong.push(`declared components: ${placed} rows against ${wantPlaced} stated`)
  if (wrong.length) throw new Error(`the load did not match the dump — ${wrong.join('; ')}`)

  const day = (d) => (d ? new Date(d).toISOString().slice(0, 10) : null)
  return {
    engagementId,
    source,
    tickets: landed,
    subCategories: subs,
    declared: classed,
    placed,
    unreadable: unreadable.length,
    foldedRows: counted.foldedRows,
    foldedKeys: counted.foldedKeys,
    period: { from: day(span.a), to: day(span.b) },
  }
}

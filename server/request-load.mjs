import { query } from './db.mjs'

/* ==========================================================================
   Reading a dump of service requests.

   Separate from the incident path because the extract is a different shape,
   not because the client is: Kearney's request tab carries no category and no
   sub-category, and the one column that holds a timestamp is headed "Year".
   An incident loader told to read it would either refuse every row or file
   them all under nothing.

   The reading is deliberately the same idea as the incident loader — a
   confirmed column map, rows that cannot be read listed rather than dropped
   quietly — so that a person who has loaded one can load the other.
   ========================================================================== */

/**
 * Excel's own date, as a day count.
 *
 * Exporting the tab to CSV usually formats these as dates, so this is the
 * path for when it does not. The serial counts days from 1899-12-30: Excel
 * has a 1900 leap year that never happened, and the two-day offset is the
 * standard way of absorbing it. The fractional part is the time of day.
 */
function fromExcelSerial(n) {
  if (!Number.isFinite(n) || n < 1 || n > 80_000) return null
  const ms = Math.round((n - 25_569) * 86_400_000)
  return new Date(ms).toISOString()
}

const pad = (v, n = 2) => String(v ?? 0).padStart(n, '0')
const iso = (y, mo, d, h, mi) => `${pad(y, 4)}-${pad(mo)}-${pad(d)}T${pad(h)}:${pad(mi)}:00.000Z`

/** A timestamp from whatever the export produced, or null. */
export function readWhen(value) {
  const t = String(value ?? '').trim()
  if (!t) return null
  if (/^\d+(\.\d+)?$/.test(t)) return fromExcelSerial(Number(t))
  let m = /^(\d{4})[-/](\d{1,2})[-/](\d{1,2})(?:[ T](\d{1,2}):(\d{2}))?/.exec(t)
  if (m) return iso(m[1], m[2], m[3], m[4], m[5])
  m = /^(\d{1,2})[-/](\d{1,2})[-/](\d{4})(?:[ T](\d{1,2}):(\d{2}))?/.exec(t)
  if (m) return Number(m[1]) > 12 ? iso(m[3], m[2], m[1], m[4], m[5]) : iso(m[3], m[1], m[2], m[4], m[5])
  return null
}

/**
 * The dump's rows as requests, under a confirmed mapping.
 *
 * A row with no reference cannot be written and is reported. A row with no
 * readable timestamp is kept, unlike an incident, because a request's text is
 * the part this platform acts on and refusing the row would lose it; what is
 * lost instead is its place in time, and the row says so by carrying null.
 */
export function mapRequests(rows, columnMap) {
  const header = (rows[0] ?? []).map((h) => h.trim())
  const at = {}
  for (const [field, column] of Object.entries(columnMap)) {
    const i = header.indexOf(column)
    if (i >= 0) at[field] = i
  }
  const get = (r, field) => (at[field] === undefined ? '' : String(r[at[field]] ?? '').trim())

  const requests = []
  const unreadable = []
  const undated = []
  for (const r of rows.slice(1)) {
    const ref = get(r, 'ref')
    if (!ref) { unreadable.push({ ref: null, because: 'no reference' }); continue }
    const openedAt = readWhen(get(r, 'openedAt'))
    if (!openedAt) undated.push(ref)
    requests.push({
      ref,
      shortDescription: get(r, 'shortDescription'),
      state: get(r, 'state'),
      priorityRaw: get(r, 'priority'),
      priority: null,
      assignmentGroup: get(r, 'assignmentGroup'),
      location: get(r, 'location'),
      openedAt,
    })
  }
  return { requests, unreadable, undated }
}

/** Writes a mapped dump, replacing whatever was loaded for that engagement. */
export async function writeRequests(config, prepared) {
  const { engagementId } = config
  await query('delete from service_request where engagement_id = $1', [engagementId])

  // In batches, because a single statement with sixty thousand rows of
  // parameters is refused long before the database is the problem.
  const SIZE = 500
  for (let i = 0; i < prepared.requests.length; i += SIZE) {
    const batch = prepared.requests.slice(i, i + SIZE)
    const values = []
    const params = []
    batch.forEach((r, n) => {
      const b = n * 8
      values.push(`($${b + 1}, $${b + 2}, $${b + 3}, $${b + 4}, $${b + 5}, $${b + 6}, $${b + 7}, $${b + 8})`)
      params.push(engagementId, r.ref, r.shortDescription, r.state, r.priorityRaw, r.assignmentGroup, r.location, r.openedAt)
    })
    await query(
      `insert into service_request
         (engagement_id, ref, short_description, state, priority_raw, assignment_group, location, opened_at)
       values ${values.join(', ')}
       on conflict (engagement_id, ref) do update set
         short_description = excluded.short_description,
         state = excluded.state,
         priority_raw = excluded.priority_raw,
         assignment_group = excluded.assignment_group,
         location = excluded.location,
         opened_at = excluded.opened_at`,
      params,
    )
  }

  await query(
    `insert into service_request_feed
       (engagement_id, system, source, column_map, confirmed_by, confirmed_at, rows_ingested, unreadable)
     values ($1, $2, $3, $4, $5, now(), $6, $7)
     on conflict (engagement_id) do update set
       system = excluded.system, source = excluded.source, column_map = excluded.column_map,
       confirmed_by = excluded.confirmed_by, confirmed_at = excluded.confirmed_at,
       rows_ingested = excluded.rows_ingested, unreadable = excluded.unreadable`,
    [engagementId, config.system, config.source, JSON.stringify(config.columnMap), config.confirmedBy,
      prepared.requests.length, prepared.unreadable.length],
  )

  return { written: prepared.requests.length, unreadable: prepared.unreadable.length, undated: prepared.undated.length }
}

/** Requests whose text matches, newest first. Paged: there are sixty thousand. */
export async function readRequests({ engagementId, q, limit = 50, offset = 0 }) {
  const lim = Math.max(1, Math.min(200, Number(limit) || 50))
  const off = Math.max(0, Number(offset) || 0)
  const where = ['engagement_id = $1']
  const params = [engagementId]
  if (q) { params.push(`%${q}%`); where.push(`short_description ilike $${params.length}`) }
  const clause = where.join(' and ')
  const [{ total }] = await query(`select count(*)::int as total from service_request where ${clause}`, params)
  const rows = await query(
    `select ref, short_description as "shortDescription", state, priority_raw as "priorityRaw",
            assignment_group as "assignmentGroup", location, opened_at as "openedAt"
       from service_request where ${clause}
      order by opened_at desc nulls last, ref desc
      limit ${lim} offset ${off}`,
    params,
  )
  return { total, requests: rows }
}

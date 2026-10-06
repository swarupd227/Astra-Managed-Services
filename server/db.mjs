import pg from 'pg'

/* ==========================================================================
   The database.

   Configuration lives in Postgres and nowhere else. There is deliberately no
   fallback to a compiled copy: a platform whose own terms can be read from
   two places will eventually read a different answer from each, and the one
   in the code is the one nobody can change. If the database cannot be
   reached the gateway says so and the application does not start, which is
   a worse morning and a better product.

   The connection string is an App Service setting and never a file in the
   repository, so a clone carries no credentials.
   ========================================================================== */

const CONNECTION = process.env.DATABASE_URL ?? ''

export const configured = Boolean(CONNECTION)

/** Azure's managed Postgres requires TLS; the certificate chain is Microsoft's. */
const pool = configured
  ? new pg.Pool({
    connectionString: CONNECTION,
    ssl: CONNECTION.includes('localhost') ? undefined : { rejectUnauthorized: false },
    max: 4,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 8_000,
  })
  : null

export async function query(text, params = []) {
  if (!pool) throw new Error('DATABASE_URL is not set, so there is no configuration to read.')
  const res = await pool.query(text, params)
  return res.rows
}

/** One round trip, for the health endpoint to report honestly. */
export async function ping() {
  if (!pool) return { ok: false, reason: 'DATABASE_URL is not set' }
  try {
    const [row] = await query('select now() as at, current_database() as db')
    return { ok: true, at: row.at, database: row.db }
  } catch (err) {
    return { ok: false, reason: err instanceof Error ? err.message : String(err) }
  }
}

export async function close() {
  await pool?.end()
}

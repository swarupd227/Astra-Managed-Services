import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { close, configured, query } from './db.mjs'

/* ==========================================================================
   Applies the schema, then fills it with the engagements as they stood in
   code. Both files are written to be run twice without harm, so this is the
   command to run after any change to either — there is no migration history
   to keep in step, because there is nothing yet that a second run could
   damage.

   Run with: npm run db:migrate
   ========================================================================== */

const HERE = path.dirname(fileURLToPath(import.meta.url))
const read = (f) => fs.readFileSync(path.join(HERE, f), 'utf8')

if (!configured) {
  console.error('DATABASE_URL is not set. Export it, or set it as an App Service setting, and run again.')
  process.exit(1)
}

try {
  console.log('Applying schema…')
  await query(read('schema.sql'))

  console.log('Writing the engagements as they stood in code…')
  await query(read('seed.sql'))

  const [{ engagements }] = await query('select count(*)::int as engagements from engagement')
  const [{ thresholds }] = await query('select count(*)::int as thresholds from engagement_threshold')
  const [{ filed }] = await query('select count(*)::int as filed from engagement_filed_item')
  console.log(`Done. ${engagements} engagements, ${thresholds} stated thresholds, ${filed} filed items.`)
} catch (err) {
  console.error('Migration failed:', err instanceof Error ? err.message : err)
  process.exitCode = 1
} finally {
  await close()
}

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { close, configured } from './db.mjs'
import { profile, readDelimited, sniffDelimiter } from './ticket-feed.mjs'
import { checkDump, writeDump } from './ticket-load.mjs'

/* ==========================================================================
   Loads an incident dump into the database from the command line.

   Thin on purpose. The reading, the checking and the writing are the same
   code the upload endpoint runs, so a dump loaded here and a dump loaded by
   somebody dragging a file onto the platform cannot end up meaning different
   things.

   What this adds is the configuration: on the command line it comes from a
   file, and in the application it comes from what a person confirmed. Both
   are configuration either way — neither is in the code.

   Run with: npm run db:ingest:tickets
   ========================================================================== */

const HERE = path.dirname(fileURLToPath(import.meta.url))
const CONFIG = process.env.TICKET_FEED ?? path.join(HERE, '..', 'data', 'ticket-feed.json')

// Checks the dump against the configuration and writes nothing. Worth having
// as a flag rather than a scratch script: the question "will this load, and
// what will it say" should be answerable without a database in front of you.
const DRY_RUN = process.argv.includes('--dry-run')

if (!configured && !DRY_RUN) {
  console.error('DATABASE_URL is not set. Pass --dry-run to check a dump against the configuration without writing.')
  process.exit(1)
}

const feed = JSON.parse(fs.readFileSync(CONFIG, 'utf8'))
const dumpPath = process.env.INCIDENT_DUMP ?? path.join(path.dirname(CONFIG), feed.source)
const text = fs.readFileSync(dumpPath, 'utf8')
const rows = readDelimited(text, sniffDelimiter(text))

const config = {
  engagementId: feed.engagementId,
  system: feed.system,
  source: path.basename(dumpPath),
  columnMap: feed.columnMap ?? {},
  because: feed.because ?? {},
  confirmedBy: feed.confirmedBy,
  priorities: feed.priorities ?? [],
  subCategoryClasses: feed.subCategoryClasses ?? [],
}

const prepared = checkDump({ rows, ...config })
if (prepared.faults.length) {
  console.error('The dump does not match the confirmed configuration — nothing was written:')
  for (const f of prepared.faults) console.error(`  ${f}`)
  // What profiling this dump on its own would propose, so the next step is
  // obvious rather than a guessing game.
  const p = profile(rows)
  console.error('\nProfiled on its own, this dump proposes:')
  for (const [field, column] of Object.entries(p.columnMap)) {
    console.error(`  ${field.padEnd(18)} <- ${column}  (${p.because[field].confidence}, on ${p.because[field].on})`)
  }
  if (p.missing.length) console.error(`  still unresolved: ${p.missing.join(', ')}`)
  process.exit(1)
}

if (DRY_RUN) {
  const counted = prepared.counted
  const declared = counted.rows.filter((r) => prepared.declarations.has(r.key))
  const sum = (rows) => rows.reduce((n, r) => n + r.incidents, 0)
  const classed = declared.filter((r) => prepared.declarations.get(r.key).classId)
  const placedOnly = declared.filter((r) => !prepared.declarations.get(r.key).classId)

  console.log(
    `${config.source} checks out against the configuration — ${prepared.tickets.length.toLocaleString('en-GB')} tickets ` +
    `would load across ${counted.rows.length} sub-categories. ` +
    `${classed.length} declared against a costed class (${sum(classed).toLocaleString('en-GB')} arrivals), ` +
    `${placedOnly.length} given a component only (${sum(placedOnly).toLocaleString('en-GB')} arrivals). ` +
    `${(sum(declared) / prepared.tickets.length * 100).toFixed(0)}% of the book is placed, ` +
    `${(sum(classed) / prepared.tickets.length * 100).toFixed(0)}% identified. Nothing was written.`,
  )
  for (const r of declared.sort((a, b) => b.incidents - a.incidents)) {
    const d = prepared.declarations.get(r.key)
    const what = d.classId ?? 'placed only — no costed class exists for this demand'
    console.log(`  ${String(r.incidents).padStart(5)}  ${`${r.category} / ${r.subCategory}`.padEnd(52)} ${(d.nodeIds ?? []).join(', ') || 'no component'}  ${what}`)
  }
  if (prepared.unreadable.length) console.warn(`  ${prepared.unreadable.length} row(s) could not be read.`)
  if (counted.foldedRows) console.warn(`  ${counted.foldedRows.toLocaleString('en-GB')} row(s) across ${counted.foldedKeys} sub-categories differ only in case and are counted together.`)
  if (prepared.untranslated.length) console.warn(`  untranslated priority value(s): ${prepared.untranslated.join(', ')}`)
  await close()
  process.exit(0)
}

try {
  const r = await writeDump(config, prepared)
  console.log(
    `${r.engagementId}: ${r.tickets.toLocaleString('en-GB')} tickets from ${r.source}, ` +
    `${r.period.from} to ${r.period.to}, ${r.subCategories} sub-categories ` +
    `(${r.declared} declared against a costed class) — all read back and matching.`,
  )
  if (r.unreadable) console.warn(`  ${r.unreadable} row(s) had no reference or no readable timestamp and are not loaded.`)
  if (r.foldedRows) {
    console.warn(`  ${r.foldedRows.toLocaleString('en-GB')} row(s) across ${r.foldedKeys} sub-categories were counted together despite differing in case only.`)
  }
  if (prepared.untranslated.length) {
    console.warn(`  the configuration does not translate ${prepared.untranslated.map((u) => `"${u}"`).join(', ')}, so those tickets carry no priority and can take no resolution target.`)
  }
} catch (err) {
  console.error('Ingest failed:', err instanceof Error ? err.message : err)
  process.exitCode = 1
} finally {
  await close()
}

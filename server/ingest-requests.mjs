import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { close, configured } from './db.mjs'
import { readDelimited, sniffDelimiter } from './ticket-feed.mjs'
import { mapRequests, writeRequests } from './request-load.mjs'

/* ==========================================================================
   Loads a dump of service requests from the command line.

   Thin, like its incident counterpart, and for the same reason: the reading
   and the writing live in request-load.mjs so that a dump loaded here cannot
   mean something different from one loaded any other way.

   Run with: npm run db:ingest:requests
   ========================================================================== */

const HERE = path.dirname(fileURLToPath(import.meta.url))
const CONFIG = process.env.REQUEST_FEED ?? path.join(HERE, '..', 'data', 'request-feed.json')
const DRY_RUN = process.argv.includes('--dry-run')

if (!configured && !DRY_RUN) {
  console.error('DATABASE_URL is not set. Pass --dry-run to check a dump against the configuration without writing.')
  process.exit(1)
}

const feed = JSON.parse(fs.readFileSync(CONFIG, 'utf8'))
const dumpPath = process.env.REQUEST_DUMP ?? path.join(path.dirname(CONFIG), feed.source)
const text = fs.readFileSync(dumpPath, 'utf8')
const rows = readDelimited(text, sniffDelimiter(text))
const prepared = mapRequests(rows, feed.columnMap ?? {})

console.log(`${path.basename(dumpPath)}: ${rows.length - 1} rows`)
console.log(`  readable:  ${prepared.requests.length}`)
console.log(`  unreadable: ${prepared.unreadable.length}${prepared.unreadable.length ? ` (${prepared.unreadable.slice(0, 3).map((u) => u.because).join('; ')})` : ''}`)
console.log(`  no timestamp: ${prepared.undated.length} (kept — the text is what the platform acts on)`)
console.log(`  folded: ${prepared.folded} (the same reference listed twice in the export)`)

// What is in here that the platform can act on, stated before anything is
// written, because "we loaded sixty thousand rows" is not the useful number.
const licence = prepared.requests.filter((r) => /licen[cs]e/i.test(r.shortDescription))
console.log(`  mentioning a licence: ${licence.length}, of which distinct texts: ${new Set(licence.map((r) => r.shortDescription.trim())).size}`)

if (DRY_RUN) {
  console.log('\nDry run: nothing written.')
  await close()
  process.exit(0)
}

const result = await writeRequests({
  engagementId: feed.engagementId,
  system: feed.system,
  source: path.basename(dumpPath),
  columnMap: feed.columnMap ?? {},
  confirmedBy: feed.confirmedBy ?? 'transition',
}, prepared)

console.log(`\nWritten: ${result.written} requests for ${feed.engagementId}${result.folded ? `, ${result.folded} folded` : ''}.`)
await close()

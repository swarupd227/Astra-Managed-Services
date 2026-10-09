import fs from 'node:fs'
import path from 'node:path'
import { profile, proposePriorities, readDelimited, sniffDelimiter } from './ticket-feed.mjs'

/* ==========================================================================
   Profiles an incident dump and prints what it would propose, writing
   nothing.

   The same profiling the upload does, on the command line, so a new client's
   export can be checked against the platform before anybody is asked to
   confirm anything — and so that a dump the profiler reads badly is a
   five-second discovery rather than something found during an onboarding.

   Run with: npm run db:profile:dump -- "<file.csv>"
   ========================================================================== */

const SOURCE = process.argv[2] ?? process.env.INCIDENT_DUMP
if (!SOURCE) {
  console.error('Give the path to a dump: npm run db:profile:dump -- "<file.csv>"')
  process.exit(1)
}

const text = fs.readFileSync(SOURCE, 'utf8')
const delimiter = sniffDelimiter(text)
const rows = readDelimited(text, delimiter)
const p = profile(rows)

const shown = (d) => (d === '\t' ? 'tab' : d)
console.log(`${path.basename(SOURCE)} — ${p.rows.toLocaleString('en-GB')} rows, ${p.columns.length} columns, split on ${shown(delimiter)}\n`)

console.log('PROPOSED')
for (const [field, column] of Object.entries(p.columnMap)) {
  const b = p.because[field]
  console.log(`  ${field.padEnd(18)} <- ${String(column).padEnd(22)} ${b.confidence}  matched on ${b.on}; ${b.why}`)
}

if (p.missing.length) {
  console.log(`\nUNRESOLVED, and the intake cannot run without these: ${p.missing.join(', ')}`)
}
if (p.unused.length) {
  console.log(`\nNOT USED: ${p.unused.join(', ')}`)
}

if (p.columnMap.priority) {
  const i = (rows[0] ?? []).map((h) => h.trim()).indexOf(p.columnMap.priority)
  console.log('\nPRIORITY VOCABULARY, proposed from the values')
  for (const v of proposePriorities(rows.slice(1).map((r) => String(r[i] ?? '').trim()))) {
    console.log(`  ${String(v.value).padEnd(22)} -> ${v.priority ?? 'needs a person'}   ${v.because}`)
  }
}

console.log('\nNothing was written. Confirm a mapping to load it.')

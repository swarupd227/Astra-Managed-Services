/* ==========================================================================
   Reading an incident dump from whatever shape the client's system exports.

   A platform that serves one client can hard-code the column names. This one
   cannot: the dump in front of us calls its reference column "INC" and its
   timestamp "sys_created_on", the next client's will call them something else,
   and a mapping written into the code is that client's spelling installed in
   the product.

   So the shape of a dump is configuration held against the engagement, and
   this file is what produces that configuration. It profiles the columns, and
   it profiles the values rather than trusting the headers — a column whose
   entries are unique and all look like references is the reference column
   whatever it is called, and a column called "Date" whose entries are not
   dates is not the timestamp. It proposes, with a reason per field, and a
   person confirms. The confirmation is the configuration.

   Three things are configuration here, and all three are things a demo would
   be tempted to bake in:

   The column mapping. Which column feeds which field.

   The priority vocabulary. "5 - Planning" means P4 in this client's scheme;
   another client has three levels, or words, or integers the other way up.
   The platform has four priorities and the translation is declared, not
   assumed.

   The sub-category to costed-class mapping. Which of the client's own
   sub-categories corresponds to a class the ledger prices, and which
   component in the estate it lands on. This is the one a person must own,
   because getting it wrong routes a ticket onto the wrong tower and therefore
   under the wrong approval policy.

   Nothing in this file names a client, a system or a column.
   ========================================================================== */

/* --------------------------------- Parsing ---------------------------------- */

/**
 * A delimited dump into rows of fields.
 *
 * Field-by-field rather than line-by-line because a description may contain a
 * newline, and splitting on newlines first silently turns one ticket into two
 * malformed ones. That is not hypothetical: it cost six rows on the first
 * reading of the dump this was written against.
 */
export function readDelimited(text, delimiter = ',') {
  const rows = []
  let row = []
  let cur = ''
  let quoted = false
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    if (quoted) {
      if (ch === '"') {
        if (text[i + 1] === '"') { cur += '"'; i++ } else quoted = false
      } else cur += ch
      continue
    }
    if (ch === '"') { quoted = true; continue }
    if (ch === delimiter) { row.push(cur); cur = ''; continue }
    if (ch === '\r') continue
    if (ch === '\n') { row.push(cur); rows.push(row); row = []; cur = ''; continue }
    cur += ch
  }
  if (cur !== '' || row.length) { row.push(cur); rows.push(row) }
  return rows.filter((r) => r.some((f) => f.trim()))
}

/** Which delimiter the first line is most plausibly split on. */
export function sniffDelimiter(text) {
  const first = text.slice(0, 64_000).split(/\r?\n/)[0] ?? ''
  const counts = [',', ';', '\t', '|'].map((d) => [d, first.split(d).length - 1])
  const [best, n] = counts.sort((a, b) => b[1] - a[1])[0]
  return n > 0 ? best : ','
}

/* -------------------------------- Profiling --------------------------------- */

const DATE = /^(\d{4})[-/](\d{1,2})[-/](\d{1,2})([ T](\d{1,2}):(\d{2}))?|^(\d{1,2})[-/](\d{1,2})[-/](\d{4})/
const REFISH = /^[A-Za-z]{2,8}[-_ ]?\d{4,12}$/

/** What a column looks like, independent of what it is called. */
function describe(name, values) {
  const filled = values.filter((v) => v !== '')
  const distinct = new Set(filled)
  const n = values.length || 1
  const f = filled.length || 1
  return {
    name,
    rows: values.length,
    filledRatio: filled.length / n,
    distinct: distinct.size,
    distinctRatio: distinct.size / f,
    dateRatio: filled.filter((v) => DATE.test(v)).length / f,
    refRatio: filled.filter((v) => REFISH.test(v)).length / f,
    avgLength: filled.reduce((a, v) => a + v.length, 0) / f,
    samples: [...distinct].slice(0, 4),
  }
}

/**
 * The fields the intake needs, each with how its name tends to be spelled and
 * what its values have to look like.
 *
 * `shape` returns null where the values rule the column out entirely. That
 * gate matters more than the name score: it is what stops a column called
 * "Date" that holds free text from being proposed as the timestamp, and it is
 * what lets a column with an unhelpful name still be found.
 */
/**
 * Whether a column holds a small set of repeated values rather than free
 * text — the difference between a category and a description.
 *
 * The proportion of distinct values is the right test on a real dump and a
 * meaningless one on a small sample: in twenty rows every category looks
 * unique, so a ratio gate rejects the lot and a client who sends a sample
 * before the full export gets nothing resolved. Below a sample worth drawing
 * a proportion from, the absolute count is used instead.
 */
const SAMPLE_FLOOR = 30
const lowCardinality = (c, maxDistinct, maxRatio) =>
  c.distinct >= 2 && c.distinct <= maxDistinct && (c.rows < SAMPLE_FLOOR || c.distinctRatio < maxRatio)

const FIELDS = {
  ref: {
    required: true,
    strong: /^(inc|incident|ref|reference|number|ticket|case|key|id)$|_(number|id|ref)$|^(inc|incident|ticket|case)[_ ]?(number|no|id)$/i,
    weak: /inc|ref|number|ticket|case|\bid\b/i,
    // Mostly filled and nearly all distinct. A reference column with a fifth
    // of its entries missing is not the reference column, but a handful of
    // blank rows in a real export must not disqualify it.
    shape: (c) => (c.filledRatio > 0.8 && c.distinctRatio > 0.95 ? 0.5 * c.distinctRatio + 0.5 * Math.max(c.refRatio, 0.4) : null),
    why: (c) => `${Math.round(c.distinctRatio * 100)}% distinct${c.refRatio > 0.8 ? ` and ${Math.round(c.refRatio * 100)}% in a reference format` : ''}`,
  },
  openedAt: {
    required: true,
    strong: /creat|open|logg|rais|submit|report.?(ed)?.?(on|at|date)/i,
    weak: /_on$|date|time|when/i,
    shape: (c) => (c.dateRatio > 0.9 ? c.dateRatio : null),
    why: (c) => `${Math.round(c.dateRatio * 100)}% of entries parse as a timestamp`,
  },
  shortDescription: {
    required: true,
    strong: /^(short.?desc|desc|description|summary|title|subject|short.?text)/i,
    weak: /desc|summar|title|subject|detail|text|issue|problem/i,
    shape: (c) => (c.avgLength >= 10 && (c.rows < SAMPLE_FLOOR || c.distinctRatio > 0.2) ? Math.min(1, c.avgLength / 40) * 0.5 + 0.5 * c.distinctRatio : null),
    why: (c) => `free text averaging ${Math.round(c.avgLength)} characters, ${Math.round(c.distinctRatio * 100)}% distinct`,
  },
  category: {
    // Deliberately refuses anything with "sub" in it, which otherwise takes
    // the sub-category column — the two patterns overlap by construction.
    required: false,
    strong: /^(?!.*sub).*categ/i,
    weak: /^(type|service|area|tower|classification)$/i,
    shape: (c) => (lowCardinality(c, 200, 0.1) ? 1 - c.distinct / 400 : null),
    why: (c) => `${c.distinct} distinct values`,
  },
  subCategory: {
    required: false,
    strong: /sub.?categ|sub.?type|sub.?class|^(item|ci|configuration.?item)$/i,
    weak: /sub|item|component/i,
    shape: (c) => (lowCardinality(c, 3000, 0.3) ? 1 - c.distinct / 6000 : null),
    why: (c) => `${c.distinct} distinct values`,
  },
  priority: {
    required: false,
    strong: /^(prior|priority|sever|severity|urgency|impact|p)$/i,
    weak: /prior|sever|urgen|impact/i,
    shape: (c) => (c.distinct >= 2 && c.distinct <= 12 ? 1 - c.distinct / 24 : null),
    why: (c) => `${c.distinct} distinct values — ${c.samples.slice(0, 3).join(', ')}`,
  },
  state: {
    required: false,
    strong: /^(state|status|incident.?state)$/i,
    weak: /state|status|stage/i,
    shape: (c) => (c.distinct >= 2 && c.distinct <= 40 ? 1 - c.distinct / 80 : null),
    why: (c) => `${c.distinct} distinct values — ${c.samples.slice(0, 3).join(', ')}`,
  },
  assignmentGroup: {
    required: false,
    strong: /assign|^(group|queue|team|resolver.?group|support.?group)$/i,
    weak: /group|queue|team|resolv|support|owner/i,
    shape: (c) => (lowCardinality(c, 5000, 0.5) ? 1 - c.distinct / 10_000 : null),
    why: (c) => `${c.distinct} distinct values`,
  },
  reportedBy: {
    required: false,
    strong: /^(caller|caller.?id|reported.?by|requested.?by|opened.?by|requester|affected.?user|contact)$/i,
    weak: /caller|report|request|user|contact|person|employee/i,
    // Distinct enough to be people rather than a channel or a flag.
    shape: (c) => ((c.rows < SAMPLE_FLOOR ? c.distinctRatio > 0.5 : c.distinctRatio > 0.05) && c.avgLength >= 4 ? Math.min(1, c.distinctRatio * 4) : null),
    why: (c) => `${c.distinct} distinct values, which is people rather than a code`,
  },
}

export const FIELD_NAMES = Object.keys(FIELDS)
export const REQUIRED_FIELDS = FIELD_NAMES.filter((f) => FIELDS[f].required)

/**
 * A proposed reading of a dump: which column feeds which field, why, and what
 * is still unresolved.
 *
 * Assignment is greedy over every field-and-column pair by score, and a
 * column is used once. Greedy rather than per-field-best because the two
 * category fields compete for the same columns and resolving them
 * independently gives the same column to both.
 */
export function profile(rows) {
  const header = (rows[0] ?? []).map((h) => h.trim())
  const body = rows.slice(1)
  const columns = header.map((name, i) => describe(name, body.map((r) => (r[i] ?? '').trim())))

  const pairs = []
  for (const [field, spec] of Object.entries(FIELDS)) {
    for (const c of columns) {
      // A column of timestamps can only be the timestamp. Without this, a
      // second date column is distinct enough and long enough to be proposed
      // as the person who reported the ticket, which is how a dump with a
      // "Year" column ends up with a date in the caller field.
      if (field !== 'openedAt' && c.dateRatio > 0.5) continue
      const shape = spec.shape(c)
      if (shape === null) continue
      const named = spec.strong.test(c.name) ? 1 : spec.weak.test(c.name) ? 0.45 : 0
      // A column the values fit but the name says nothing about is still a
      // candidate, just a weak one that wants a person to look at it.
      const score = 0.6 * named + 0.4 * shape
      if (score > 0.2) pairs.push({ field, column: c.name, score, named, shape, why: spec.why(c) })
    }
  }
  pairs.sort((a, b) => b.score - a.score)

  const columnMap = {}
  const because = {}
  const takenField = new Set()
  const takenColumn = new Set()
  for (const p of pairs) {
    if (takenField.has(p.field) || takenColumn.has(p.column)) continue
    takenField.add(p.field)
    takenColumn.add(p.column)
    columnMap[p.field] = p.column
    because[p.field] = {
      confidence: Number(p.score.toFixed(2)),
      // The distinction a person needs: did the header say so, or did the
      // values say so against a header that said nothing?
      on: p.named === 1 ? 'name and values' : p.named > 0 ? 'name and values, loosely' : 'values alone',
      why: p.why,
    }
  }

  const missing = REQUIRED_FIELDS.filter((f) => !columnMap[f])
  const unused = columns.filter((c) => !takenColumn.has(c.name)).map((c) => c.name)
  return {
    columns: columns.map((c) => ({ name: c.name, distinct: c.distinct, filledRatio: Number(c.filledRatio.toFixed(3)), samples: c.samples })),
    columnMap,
    because,
    missing,
    unused,
    rows: body.length,
  }
}

/* --------------------------- The priority vocabulary -------------------------- */

const PRIORITY_WORDS = [
  [/crit|sev.?1|highest|urgent|blocker|^1\b/i, 'P1'],
  [/high|major|sev.?2|^2\b/i, 'P2'],
  [/moder|medium|normal|standard|sev.?3|^3\b/i, 'P3'],
  [/low|minor|plan|defer|sev.?[45]|^[45]\b/i, 'P4'],
]

/**
 * How the client's priority values translate to the platform's four.
 *
 * Proposed from the values themselves — a leading level number, or the word.
 * A scheme with five levels collapses its bottom two, and the proposal says
 * so rather than hiding it, because a client whose volume is overwhelmingly
 * at their lowest level will want to know which of our levels that became.
 */
export function proposePriorities(values) {
  return [...new Set(values.filter((v) => v !== ''))].sort().map((value) => {
    const hit = PRIORITY_WORDS.find(([re]) => re.test(value))
    return {
      value,
      priority: hit?.[1] ?? null,
      because: hit
        ? `"${value}" reads as ${hit[1]}`
        : `nothing in "${value}" says which of the platform's four levels this is`,
    }
  })
}

/* --------------------------------- Mapping ----------------------------------- */

/** The dump's timestamps carry no zone, so they are read as UTC and said to be. */
function asUtc(s) {
  const t = String(s ?? '').trim()
  let m = /^(\d{4})[-/](\d{1,2})[-/](\d{1,2})(?:[ T](\d{1,2}):(\d{2}))?/.exec(t)
  if (m) return iso(m[1], m[2], m[3], m[4], m[5])
  m = /^(\d{1,2})[-/](\d{1,2})[-/](\d{4})(?:[ T](\d{1,2}):(\d{2}))?/.exec(t)
  // Day-first where the first part cannot be a month, month-first otherwise.
  if (m) return Number(m[1]) > 12 ? iso(m[3], m[2], m[1], m[4], m[5]) : iso(m[3], m[1], m[2], m[4], m[5])
  return null
}
const pad = (v, n = 2) => String(v ?? 0).padStart(n, '0')
const iso = (y, mo, d, h, mi) => `${pad(y, 4)}-${pad(mo)}-${pad(d)}T${pad(h)}:${pad(mi)}:00.000Z`

/**
 * The dump's rows as tickets, under a confirmed mapping.
 *
 * Nothing is enriched and nothing is corrected. A ticket filed with no
 * category is kept with no category, because what the platform does with an
 * unfiled ticket is part of what has to be shown rather than something to
 * tidy away before it is shown. A row with no reference or no readable
 * timestamp cannot be a ticket at all; those are returned separately and
 * counted, because an ingest that drops rows while reporting success is the
 * failure this is all guarding against.
 */
export function mapRows(rows, columnMap, priorityMap = {}) {
  const header = (rows[0] ?? []).map((h) => h.trim())
  const at = {}
  for (const [field, column] of Object.entries(columnMap)) {
    const i = header.indexOf(column)
    if (i >= 0) at[field] = i
  }
  const get = (r, field) => (at[field] === undefined ? '' : String(r[at[field]] ?? '').trim())

  const tickets = []
  const unreadable = []
  for (const r of rows.slice(1)) {
    const ref = get(r, 'ref')
    const openedAt = asUtc(get(r, 'openedAt'))
    if (!ref || !openedAt) {
      unreadable.push({ ref: ref || null, because: !ref ? 'no reference' : 'no readable timestamp' })
      continue
    }
    const rawPriority = get(r, 'priority')
    tickets.push({
      ref,
      shortDescription: get(r, 'shortDescription'),
      category: get(r, 'category'),
      subCategory: get(r, 'subCategory'),
      state: get(r, 'state'),
      // Both: the client's own word, and what it was declared to mean.
      priorityRaw: rawPriority,
      priority: priorityMap[rawPriority] ?? null,
      assignmentGroup: get(r, 'assignmentGroup'),
      reportedBy: get(r, 'reportedBy'),
      openedAt,
    })
  }
  return { tickets, unreadable }
}

/**
 * Sub-category volumes, counted case-insensitively.
 *
 * The dump this was written against files the same category as both
 * "Software" and "software", which taken literally splits one sub-category's
 * 926 arrivals into 800 and 126 — and 800 falls below where the classifier
 * will act on volume at all. A capital letter would have decided whether the
 * platform touches the client's second-largest class, so the key is folded
 * and the number of rows that moved because of it is reported. The spelling
 * kept is whichever the client used most, so the register reads back in their
 * own words.
 */
export function countSubCategories(tickets) {
  const counts = new Map()
  for (const t of tickets) {
    if (!t.category && !t.subCategory) continue
    const key = `${t.category}|${t.subCategory}`.toLowerCase()
    const seen = counts.get(key) ?? { incidents: 0, spellings: new Map() }
    seen.incidents++
    const spelling = `${t.category}|${t.subCategory}`
    seen.spellings.set(spelling, (seen.spellings.get(spelling) ?? 0) + 1)
    counts.set(key, seen)
  }

  let foldedRows = 0
  let foldedKeys = 0
  const rows = [...counts.entries()].map(([key, seen]) => {
    const spellings = [...seen.spellings.entries()].sort((a, b) => b[1] - a[1])
    if (spellings.length > 1) {
      foldedKeys++
      foldedRows += seen.incidents - spellings[0][1]
    }
    const [category, subCategory] = spellings[0][0].split('|')
    return { key, category, subCategory, incidents: seen.incidents }
  })
  rows.sort((a, b) => b.incidents - a.incidents || a.subCategory.localeCompare(b.subCategory))
  return { rows, foldedRows, foldedKeys }
}

/** The key a sub-category mapping is held under. */
export const subCategoryKey = (category, subCategory) => `${category}|${subCategory}`.toLowerCase()

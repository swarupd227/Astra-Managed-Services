import { Rng } from './rng'

/* ==========================================================================
   Who may be given what, and whether there is one left to give.

   A licence request is the most ordinary thing a service desk does and the
   one most often done badly: a person asks in their own words, somebody
   reads it, checks a spreadsheet of seats, remembers a rule about
   contractors, and either grants it or forwards it to a manager who is in a
   meeting. The whole of it is decidable from three things the client already
   holds — who the person is, how many seats are left, and what the policy
   says — and none of those is a judgement call.

   So it is decided here, and every refusal names the rule it failed. An
   approval card that says "needs approval" without saying which rule tripped
   is a worse artefact than no card: the approver has to reconstruct the
   reasoning the platform already did.

   Three origins, kept apart. The directory and the seat pool are the
   client's own systems and sit behind connectors, so they may be sampled.
   The rules are policy: the platform carries a standard set and an
   engagement overrides them, the same arrangement as the operating
   thresholds. What is decided, and the seat that moves, are platform records.
   ========================================================================== */

export type RequestType = 'new' | 'renewal' | 'extension' | 'install' | 'access'

export const REQUEST_LABEL: Record<RequestType, string> = {
  new: 'A seat they do not have',
  renewal: 'Keeping a seat they already hold',
  extension: 'Longer on a seat they already hold',
  install: 'Software onto a machine',
  access: 'Access to something that exists',
}

/* -------------------------------- Directory -------------------------------- */

export interface Person {
  id: string
  name: string
  role: string
  practice: string
  /** Who approves for them. A role, not a person: people leave. */
  manager: string
  contractor: boolean
  /** Days since they last opened the product, or null where never. */
  lastUsedDaysAgo: number | null
}

const PRACTICES = ['Strategy & Value', 'Operations', 'Digital & Analytics', 'Energy', 'Consumer', 'Finance Operations']
const ROLES = ['Consultant', 'Senior Consultant', 'Manager', 'Principal', 'Analyst', 'Data Engineer']
const NAMES = [
  'A. Blackwood', 'P. Rautela', 'J. Mensah', 'L. Fontaine', 'D. Okoro', 'S. Varga', 'M. Lindqvist',
  'T. Abara', 'R. Castellanos', 'N. Pereira', 'H. Sultana', 'C. Dubois', 'F. Nakamura', 'G. Whitlock',
]

/**
 * The people a request can be about.
 *
 * Sampled from the client's directory until that connector is wired. Roles
 * and practices are theirs; the names are not, and are fictional on purpose.
 */
function buildDirectory(): Person[] {
  const rng = new Rng(55_013)
  return NAMES.map((name, i) => ({
    id: `per_${String(i + 1).padStart(3, '0')}`,
    name,
    role: ROLES[rng.int(0, ROLES.length - 1)],
    practice: PRACTICES[rng.int(0, PRACTICES.length - 1)],
    manager: 'Practice Lead',
    // A contractor every fifth person, which is roughly what a firm this
    // size carries and enough for the rule to bite in a demonstration.
    contractor: i % 5 === 4,
    lastUsedDaysAgo: i % 7 === 6 ? null : rng.int(1, 180),
  }))
}

/**
 * The client's own people who hold a role on this platform.
 *
 * Without these the directory holds fourteen people, none of whom can ever be
 * signed in, so "I need an Alteryx licence" — the most ordinary sentence a
 * requester types — could be recognised as a request on one's own behalf and
 * still find nobody to give the seat to.
 *
 * Their roles are the ones their job titles imply, which is not a formality:
 * a Consultant is not on Alteryx's eligible list and a Data Engineer is, so
 * the same sentence from two client people gets two different and correct
 * answers.
 */
const ROLE_HOLDERS: Person[] = [
  { id: 'per_consumer', name: 'H. Dalgleish', role: 'Consultant', practice: 'Strategy & Value', manager: 'Practice Lead', contractor: false, lastUsedDaysAgo: 12 },
  { id: 'per_clientteam', name: 'K. Mehta', role: 'Data Engineer', practice: 'Digital & Analytics', manager: 'Practice Lead', contractor: false, lastUsedDaysAgo: 3 },
  { id: 'per_serviceowner', name: 'R. Castellano', role: 'Manager', practice: 'Operations', manager: 'Practice Lead', contractor: false, lastUsedDaysAgo: 21 },
  { id: 'per_commercial', name: 'J. Whitcombe', role: 'Manager', practice: 'Finance Operations', manager: 'Practice Lead', contractor: false, lastUsedDaysAgo: 45 },
  { id: 'per_sme', name: 'A. Ferreira', role: 'Principal', practice: 'Energy', manager: 'Practice Lead', contractor: false, lastUsedDaysAgo: 8 },
]

export const DIRECTORY: Person[] = [...buildDirectory(), ...ROLE_HOLDERS]
export const personByName = (q: string) =>
  DIRECTORY.find((p) => p.name.toLowerCase() === q.toLowerCase())
  ?? DIRECTORY.find((p) => p.name.toLowerCase().includes(q.toLowerCase().split(/\s+/).pop() ?? '\u0000'))

/* ------------------------------- The seat pool ------------------------------ */

export interface Product {
  id: string
  name: string
  seatsTotal: number
  /** Roles the policy admits without an approval. */
  eligibleRoles: string[]
  /** What one seat costs a year, as the client states it. */
  annualCost: number
  /**
   * How the product is actually written in the client's tickets.
   *
   * Not a nicety. In Kearney's own extract the requests say "PowerBI License
   * Request" and "Needs Altery License" — no space, and a dropped letter. A
   * reader that only knows the vendor's catalogue spelling asks "which
   * product?" about a ticket that plainly says which product.
   */
  aliases: string[]
}

export const PRODUCTS: Product[] = [
  {
    id: 'alteryx', name: 'Alteryx Designer', seatsTotal: 40,
    eligibleRoles: ['Analyst', 'Data Engineer', 'Senior Consultant', 'Manager', 'Principal'],
    annualCost: 4_950,
    aliases: ['alteryx', 'altery'],
  },
  {
    id: 'powerbi_pro', name: 'Power BI Pro', seatsTotal: 250,
    eligibleRoles: ROLES,
    annualCost: 120,
    aliases: ['power bi', 'powerbi', 'power-bi', 'pbi'],
  },
]

export const PRODUCT_BY_ID = Object.fromEntries(PRODUCTS.map((p) => [p.id, p])) as Record<string, Product>

/** A seat the platform has assigned. Written when it is granted. */
export interface SeatAssignment {
  id: string
  productId: string
  personId: string
  at: string
  by: string
  /** Months granted for. */
  months: number
  evidenceId?: string
}

/**
 * Seats already out, before anything this platform assigned.
 *
 * The vendor's own count, which is the number that matters: a pool read from
 * the platform's own grants alone would report seats free that the client has
 * already given away.
 */
export const SEATS_HELD_AT_TAKEOVER: Record<string, number> = { alteryx: 37, powerbi_pro: 188 }

export function seatsFree(productId: string, assigned: SeatAssignment[]): number {
  const p = PRODUCT_BY_ID[productId]
  if (!p) return 0
  const mine = assigned.filter((a) => a.productId === productId).length
  return p.seatsTotal - (SEATS_HELD_AT_TAKEOVER[productId] ?? 0) - mine
}

/* ---------------------------------- Rules ---------------------------------- */

export interface Rules {
  /** A renewal counts as one only if the product was opened this recently. */
  renewalWithinDays: number
  /** Longer than this needs somebody to say yes. */
  approvalOverMonths: number
  /** Contractors are approved by a person rather than by policy. */
  contractorNeedsApproval: boolean
  /**
   * What a request is granted for when it states no term.
   *
   * Measured against the client's own licence traffic: of 42 texts mentioning
   * a licence, none stated a duration, because a ServiceNow short description
   * is a title and nobody writes "for twelve months" in a title. A reader that
   * demands a term from that channel asks every time and never acts. So the
   * policy carries one, and the decision says it applied it — a declared
   * default on the record is a different thing from a duration invented to
   * fill a gap.
   */
  termWhenUnstatedMonths: number
}

/**
 * What the platform applies where an engagement states nothing.
 *
 * The same arrangement as the operating thresholds: a standard set here, a
 * contract's own values in the database, and the surface says which it used.
 * These are the platform's, not Kearney's, until Kearney files theirs.
 */
export const RULE_DEFAULTS: Rules = {
  renewalWithinDays: 90,
  approvalOverMonths: 12,
  contractorNeedsApproval: true,
  termWhenUnstatedMonths: 12,
}

export interface RuleReading {
  key: keyof Rules
  label: string
  because: string
  value: number | boolean
  /** Whose rule this is. The difference is the whole point of showing it. */
  source: 'contract' | 'platform default'
}

/**
 * The licence rules in force, and whose they are.
 *
 * The same arrangement as the operating thresholds: the platform carries a
 * standard set, a contract overrides what it chooses to, and every screen
 * says which it used. It matters here more than most places, because a
 * decision made under our policy and one made under the client's look
 * identical on the card and are not the same thing at all — "granted under
 * your rules" is only true once they have filed some.
 */
export function rulesFor(stated?: Partial<Rules>): Rules {
  return { ...RULE_DEFAULTS, ...(stated ?? {}) }
}

export function readRules(stated?: Partial<Rules>): RuleReading[] {
  const live = rulesFor(stated)
  return (Object.keys(RULE_DEFAULTS) as (keyof Rules)[]).map((key) => ({
    key,
    label: RULE_META[key].label,
    because: RULE_META[key].because,
    value: live[key],
    source: stated?.[key] === undefined ? 'platform default' : 'contract',
  }))
}

export const RULE_META: Record<keyof Rules, { label: string; because: string }> = {
  renewalWithinDays: {
    label: 'A renewal needs recent use',
    because: 'Renewing a seat nobody has opened in months is how a licence estate grows without anybody deciding to grow it',
  },
  approvalOverMonths: {
    label: 'A long grant needs approval',
    because: 'A seat granted for longer than a budget cycle outlives the reason it was given',
  },
  contractorNeedsApproval: {
    label: 'A contractor needs their manager',
    because: 'A contractor’s access should end when their engagement does, and only their manager knows when that is',
  },
  termWhenUnstatedMonths: {
    label: 'A request that states no term gets the standard one',
    because: 'The channel these arrive on is a one-line title and never carries a duration; asking for one every time is how a request sits unanswered for a week',
  },
}

/* -------------------------------- Deciding --------------------------------- */

export type Verdict = 'granted' | 'needs_approval' | 'refused'

export interface RuleCheck {
  rule: keyof Rules | 'eligible_role' | 'seats_available' | 'known_person' | 'term_source'
  passed: boolean
  /** What was checked, with the figures it was checked against. */
  detail: string
}

export interface Decision {
  verdict: Verdict
  product: Product
  person: Person | null
  type: RequestType
  months: number
  checks: RuleCheck[]
  /** The check that decided it, where one did. */
  decidedBy: RuleCheck | null
  /** Who must say yes, where somebody must. */
  approver: string | null
  seatsFreeAfter: number
}

/**
 * Decides one request against the directory, the pool and the rules.
 *
 * Every check runs and is reported, including the ones that passed: an
 * approver reading only the failure cannot tell whether anything else was
 * looked at. The first failure decides the verdict, and the rest are context.
 */
export function decide(opts: {
  product: Product
  person: Person | null
  type: RequestType
  months: number
  assigned: SeatAssignment[]
  rules?: Rules
  /** False where the term came from policy rather than from the requester. */
  termStated?: boolean
}): Decision {
  const r = opts.rules ?? RULE_DEFAULTS
  const free = seatsFree(opts.product.id, opts.assigned)
  const checks: RuleCheck[] = []

  // Where the term came from is part of the decision, not a footnote to it.
  // An approver who cannot tell the requester's twelve months from the
  // platform's is reading a number with no author.
  if (opts.termStated === false) {
    checks.push({
      rule: 'term_source',
      passed: true,
      detail: `No term stated, so the standard ${r.termWhenUnstatedMonths} months was applied — the platform’s policy, not the requester’s words`,
    })
  }

  checks.push({
    rule: 'known_person',
    passed: Boolean(opts.person),
    detail: opts.person
      ? `${opts.person.name}, ${opts.person.role}, ${opts.person.practice}${opts.person.contractor ? ', contractor' : ''}`
      : 'Nobody of that name is in the directory',
  })

  if (opts.person) {
    checks.push({
      rule: 'eligible_role',
      passed: opts.product.eligibleRoles.includes(opts.person.role),
      detail: opts.product.eligibleRoles.includes(opts.person.role)
        ? `${opts.person.role} is on the eligible list for ${opts.product.name}`
        : `${opts.person.role} is not on the eligible list for ${opts.product.name}`,
    })

    if (opts.type === 'renewal') {
      const d = opts.person.lastUsedDaysAgo
      checks.push({
        rule: 'renewalWithinDays',
        passed: d !== null && d <= r.renewalWithinDays,
        detail: d === null
          ? 'Never opened it, so there is nothing to renew'
          : `Last opened ${d} days ago, against ${r.renewalWithinDays} allowed`,
      })
    }

    if (r.contractorNeedsApproval) {
      checks.push({
        rule: 'contractorNeedsApproval',
        passed: !opts.person.contractor,
        detail: opts.person.contractor ? 'A contractor: their manager decides' : 'Not a contractor',
      })
    }
  }

  checks.push({
    rule: 'approvalOverMonths',
    passed: opts.months <= r.approvalOverMonths,
    detail: `${opts.months} months requested, against ${r.approvalOverMonths} allowed without approval`,
  })

  // A seat has to exist. Checked last so a request that fails on policy says
  // so rather than blaming the pool.
  const needsSeat = opts.type === 'new' || opts.type === 'renewal' || opts.type === 'extension'
  if (needsSeat) {
    checks.push({
      rule: 'seats_available',
      passed: free > 0,
      detail: free > 0
        ? `${free} of ${opts.product.seatsTotal} seats free`
        : `No seats free: ${opts.product.seatsTotal} held, none returned`,
    })
  }

  const failed = checks.find((c) => !c.passed) ?? null
  // A person nobody can find, or a seat that does not exist, cannot be fixed
  // by an approval. Everything else can.
  const unfixable = failed && (failed.rule === 'known_person' || failed.rule === 'seats_available' || failed.rule === 'eligible_role')

  return {
    verdict: !failed ? 'granted' : unfixable ? 'refused' : 'needs_approval',
    product: opts.product,
    person: opts.person,
    type: opts.type,
    months: opts.months,
    checks,
    decidedBy: failed,
    approver: failed && !unfixable ? opts.person?.manager ?? 'Practice Lead' : null,
    seatsFreeAfter: !failed && needsSeat ? free - 1 : free,
  }
}

/* ----------------------------- Reading a request ---------------------------- */

export interface UnpooledProduct {
  name: string
  /** Every spelling the client's own traffic uses, lowercased. */
  aliases: string[]
}

/**
 * Products the client's own licence traffic names and no pool is held for.
 *
 * The first version of this list was read off 42 licence-mentioning texts in
 * the incident extract, which was the wrong population: licence requests are
 * raised as requests, not incidents, and tab I1 of the volumes attachment
 * holds 63,350 of them — 1,812 mentioning a licence, 960 distinct. Measured
 * against those, the short list left 321 asking which product when the text
 * said so plainly. This list is read off that traffic instead, by frequency.
 *
 * The aliases are the point and they are not tidy. Kearney writes "Co-Pilot"
 * hyphenated, "Chat GPT" spaced, "auxi.ai" with the domain, and "Calude" for
 * Claude. A reader that only knows the vendor's catalogue spelling asks a
 * question the ticket already answered, which is the whole failure this
 * exists to stop.
 *
 * Naming a product here is not the same as holding seats in it: nothing here
 * carries a count, because nobody has told the platform one. The answer it
 * produces is "no pool is held for that, it goes to procurement" — which is a
 * different answer from "no seats left", and must stay different.
 *
 * Misspellings are listed rather than matched loosely, which is the opposite
 * of what the pooled products get. There are two of those and thirty-five of
 * these, and several of these are ordinary words: "offline" is one edit from
 * "online", "protect" one from "project". Guessing costs little here — the
 * answer either way is that no pool exists — so the cheap half of the trade
 * is the half worth keeping.
 */
export const UNPOOLED_PRODUCTS: UnpooledProduct[] = [
  // Seen in the request traffic, most frequent first.
  { name: 'ShareCal', aliases: ['sharecal'] },
  { name: 'Gemini', aliases: ['gemini'] },
  { name: 'Salesforce', aliases: ['salesforce', 'sfdc'] },
  { name: 'DocuSign', aliases: ['docusign', 'docu sign'] },
  { name: 'Figma', aliases: ['figma'] },
  { name: 'Perplexity', aliases: ['perplexity'] },
  { name: 'Auxi', aliases: ['auxi.ai', 'auxi'] },
  { name: 'Microsoft Copilot', aliases: ['co-pilot', 'copilot', 'copiolt', 'm365 copilot', 'ms copilot'] },
  { name: 'Miro', aliases: ['miro'] },
  { name: 'ChatGPT', aliases: ['chatgpt', 'chat gpt', 'open ai', 'openai'] },
  { name: 'Anaconda', aliases: ['anaconda', 'ananconda'] },
  { name: 'Power Automate', aliases: ['power automate'] },
  { name: 'Mentimeter', aliases: ['mentimeter'] },
  { name: 'KNIME', aliases: ['knime'] },
  { name: 'Zoom', aliases: ['zoom'] },
  { name: 'Lucidchart', aliases: ['lucidchart', 'lucid chart', 'lucid'] },
  { name: 'Visual Studio', aliases: ['visual studio', 'vs code', 'vscode'] },
  { name: 'Claude', aliases: ['claude', 'calude'] },
  { name: 'Anaplan', aliases: ['anaplan'] },
  { name: 'Smartsheet', aliases: ['smartsheet'] },
  { name: 'ArcGIS', aliases: ['arcgis'] },
  { name: 'Arixcel', aliases: ['arixcel'] },
  { name: 'Harvey', aliases: ['harvey'] },
  { name: 'ABBYY FineReader', aliases: ['abby fine', 'abbyy fine', 'finereader'] },
  { name: 'Vuture', aliases: ['vuture'] },
  { name: 'Oracle Java', aliases: ['oracle java', 'oracle jave'] },
  { name: 'Exchange Online', aliases: ['exchange online'] },
  // Seen in the incident extract.
  { name: 'Tableau', aliases: ['tableau'] },
  { name: 'TeamViewer', aliases: ['teamviewer', 'team viewer'] },
  { name: 'Adobe Acrobat', aliases: ['adobe acrobat', 'acrobat', 'adobe pro', 'adobe reader', 'adobe'] },
  { name: 'Adobe Creative Cloud', aliases: ['creative cloud'] },
  { name: 'MS Visio', aliases: ['ms visio', 'visio'] },
  { name: 'MS Project', aliases: ['ms project', 'microsoft project'] },
  { name: 'Webex', aliases: ['webex'] },
  { name: 'think-cell', aliases: ['think-cell', 'thinkcell', 'think cell'] },
  { name: 'Efficient Elements', aliases: ['efficient elements'] },
  { name: 'monday.com', aliases: ['monday.com'] },
  { name: 'Exact Globe', aliases: ['exact globe'] },
  { name: 'Windows', aliases: ['windows'] },
  { name: 'Microsoft 365', aliases: ['m365', 'o365', 'office 365', 'microsoft office'] },
  { name: 'Excel', aliases: ['excel'] },
  { name: 'Microsoft Teams', aliases: ['ms teams', 'microsoft teams', 'teams'] },
]

/**
 * How far a word may be from a product's name and still be that product.
 *
 * Kearney's own requests say "Alterx", "Alteyx", "Altreyx" and "Ananconda".
 * These are the expensive misses: a product with no pool only ever routes to
 * procurement, but a misspelt Alteryx is a seat the platform could have
 * decided and instead asked a question about. Enumerating the typos would
 * only work until somebody invented a new one.
 *
 * Two things keep it from inventing matches, both learned by it doing so.
 * It compares against the canonical name only, never against the typo
 * aliases: allowing a near-miss of a near-miss put "Gallery licence request"
 * and "Battery licence" two edits from the alias "altery", and an Alteryx
 * seat is not what either of those is asking for. And a short word gets one
 * edit rather than two, because at seven characters two edits reach a great
 * many real words — every typo in the client's traffic is one edit away,
 * including the transposition in "Altreyx".
 */
const MIN_FUZZY = 6
const allowedEdits = (word: string) => (word.length >= 8 ? 2 : 1)

/** Edits between two words, counting a transposition as one. */
function editDistance(a: string, b: string, cap: number): number {
  if (Math.abs(a.length - b.length) > cap) return cap + 1
  const d: number[][] = Array.from({ length: a.length + 1 }, (_, i) =>
    Array.from({ length: b.length + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0)),
  )
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + cost)
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1)
    }
  }
  return d[a.length][b.length]
}

/** The pooled product a misspelt word is reaching for, where one is. */
function fuzzyProduct(text: string): Product | null {
  const words = text.split(/[^a-z0-9]+/).filter((w) => w.length >= MIN_FUZZY)
  for (const p of PRODUCTS) {
    // The canonical name's own words, and the id. Never the typo aliases.
    const canonical = [...p.name.toLowerCase().split(/\s+/), p.id].filter((a) => a.length >= MIN_FUZZY)
    for (const name of canonical) {
      if (words.some((w) => editDistance(w, name, allowedEdits(w)) <= allowedEdits(w))) return p
    }
  }
  return null
}

/**
 * Words that mean something is broken rather than being asked for.
 *
 * Taken from the client's own traffic, where roughly thirty of the forty-two
 * licence texts are faults or monitoring alerts: an expired activation, a
 * product prompting for a key, a nightly group-sync job failing. Reading one
 * of those as a request for a new seat is the worst thing this can do — it is
 * confidently wrong, and it spends a seat.
 */
const FAULT_CUES = [
  'issue', 'error', 'not working', 'unable to', 'cannot', 'can not', "can't", 'failed',
  'expired', 'expiring soon', 'freezing', 'frozen', 'prompt', 'delays', 'problem', 'broken',
  // "Windows License Activation" and "Webex Licence Activation" are both a
  // product refusing to activate. Nobody asks for an activation; they ask for
  // a licence and report an activation. An explicit ask still overrides it.
  'activation', 'activate',
]

/** Monitoring output and licensing admin, not a person asking for anything. */
const JOB_CUES = [
  'group id job', 'groupid job', 'group - group id', 'jobs failed', 'job failed', 'update notification',
  // Moving a group between licence SKUs is platform work on somebody's behalf.
  'license switch', 'licence switch',
]

/** An explicit ask, which outranks a fault word in the same sentence. */
const ASK_CUES = [
  'request', 'requesting', 'need a', 'needs a', 'needs ', 'need ', 'please provide', 'please assign',
  'additional', 'provision',
  // "Issue of Excel license on my VM" is issuance, not a malfunction. Without
  // this the word "issue" reads the request as its own opposite.
  'issue of',
]

const CUES: { type: RequestType; words: string[] }[] = [
  { type: 'renewal', words: ['renew', 'renewal', 'expiring', 'expires', 'extend my existing', 're-issue'] },
  { type: 'extension', words: ['extend', 'extension', 'longer', 'another year', 'more months'] },
  { type: 'install', words: ['install', 'reinstall', 'set up on', 'new laptop', 'new machine', 'deploy'] },
  { type: 'access', words: ['access to', 'permission', 'add me to', 'cannot open', 'unlock'] },
  { type: 'new', words: ['new licence', 'new license', 'need a licence', 'need a license', 'request a', 'please provide'] },
]

export interface NotARequest {
  kind: 'fault' | 'platform_job'
  because: string
  /** The words it was read off, so a wrong refusal is arguable. */
  on: string[]
}

export interface RequestReading {
  type: RequestType
  product: Product | null
  months: number | null
  /** The words that decided the type, so the reading can be checked. */
  on: string[]
  /** Set where the text does not say enough to act. */
  missing: string[]
  /** Set where the text is not asking for an entitlement at all. */
  notARequest: NotARequest | null
  /** A product the text names that no seat pool is held for. */
  unpooled: string | null
  /**
   * True where the text asks on the writer's own behalf.
   *
   * "I need an Alteryx for a client pitch on Monday" names nobody, because
   * the person asking is the person it is for. Reading that as a request with
   * no subject refuses the most ordinary sentence anybody types.
   */
  firstPerson: boolean
  /** False where the term came from the policy rather than from the text. */
  termStated: boolean
  /**
   * The duration phrase the text states and this could not read.
   *
   * Kept apart from stating none at all, and it is the difference between a
   * default and an over-grant: "Needs Altery License for a few weeks" names a
   * short term, and quietly granting the standard year against it would be the
   * platform spending four thousand nine hundred and fifty pounds on a word it
   * did not parse.
   */
  termUnreadable: string | null
}

/**
 * What a request in somebody's own words is asking for.
 *
 * Deliberately shallow and deliberately transparent: it reports the words it
 * matched on, so a wrong reading is visible rather than mysterious. What it
 * cannot find it lists as missing instead of assuming — a licence granted
 * for a duration nobody asked for is still a licence granted wrongly.
 */
export function readLicenceRequest(text: string): RequestReading {
  const t = text.toLowerCase()
  const on: string[] = []
  let type: RequestType = 'new'
  for (const c of CUES) {
    const hit = c.words.find((w) => t.includes(w))
    if (hit) { type = c.type; on.push(hit); break }
  }

  // Exact first, then near-miss. A typo should never beat a product the text
  // actually names.
  const product = PRODUCTS.find(
    (p) => t.includes(p.name.toLowerCase()) || t.includes(p.id) || p.aliases.some((a) => t.includes(a)),
  ) ?? fuzzyProduct(t)
  // Longest alias first, so "adobe acrobat" is not swallowed by "adobe" and
  // "m365 copilot" is not read as plain Microsoft 365.
  const unpooled = product
    ? null
    : UNPOOLED_PRODUCTS
      .flatMap((p) => p.aliases.map((a) => ({ name: p.name, a })))
      .sort((x, y) => y.a.length - x.a.length)
      .find(({ a }) => t.includes(a))?.name ?? null

  // "a year" and "12 months" are the same request. A reader that understands
  // only the second asks a question it already has the answer to. Weeks are
  // here because the client's traffic uses them; a vague "a few weeks" stays
  // unread rather than being rounded into a number nobody said.
  const WORDS: Record<string, number> = { a: 1, an: 1, one: 1, two: 2, three: 3, six: 6, twelve: 12, eighteen: 18 }
  const m = /(\d+|a|an|one|two|three|six|twelve|eighteen)\s*(week|weeks|month|months|year|years)/.exec(t)
  const n = m ? (Number.isNaN(Number(m[1])) ? WORDS[m[1]] ?? null : Number(m[1])) : null
  const months = n === null
    ? null
    : m![2].startsWith('year') ? n * 12
      : m![2].startsWith('week') ? Math.max(1, Math.round(n / 4.345))
        : n

  // Is this a request at all? Asked after the type, because the words that
  // answer it are the same words, and asked before anything is decided,
  // because a fault read as a request spends a seat on a broken install.
  const asked = ASK_CUES.find((w) => t.includes(w)) ?? null
  const job = JOB_CUES.find((w) => t.includes(w)) ?? null
  const fault = FAULT_CUES.find((w) => t.includes(w)) ?? null
  const notARequest: NotARequest | null = job
    ? { kind: 'platform_job', because: 'Monitoring output from a scheduled job, not a person asking for anything', on: [job] }
    : fault && !asked
      ? { kind: 'fault', because: 'Something they already have is not working, which is an incident and not an entitlement request', on: [fault] }
      : null

  // A term the text states and this could not read. Only where no term was
  // parsed, so "for 6 months" does not trip it, and only on the kinds that
  // hold a seat for a period.
  const unreadable = /\b((?:a\s+few|a\s+couple(?:\s+of)?|several|some|few|ongoing|permanent|indefinite)\s+(?:weeks?|months?|years?))\b/.exec(t)
  const termUnreadable = months === null && unreadable ? unreadable[1].trim() : null

  // Word boundaries throughout: "my" must not match "Monday", and "i" must
  // not match every word containing one.
  const firstPerson = /\b(i|i'm|i am|my|me|myself|mine)\b/.test(t)

  const missing: string[] = []
  if (!product && !unpooled) missing.push('which product')
  if (termUnreadable) missing.push('how long for')

  return { type, product, months, on, missing, notARequest, unpooled, firstPerson, termStated: months !== null, termUnreadable }
}

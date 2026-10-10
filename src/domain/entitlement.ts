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

export const DIRECTORY: Person[] = buildDirectory()
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

/**
 * Products the client's own licence traffic names and no pool is held for.
 *
 * Read off the 42 licence-mentioning texts in Kearney's incident extract.
 * They are here so the reader can give the true answer — no seat pool exists
 * for Visio — instead of asking which product it is when it already knows.
 * Naming them is not the same as holding seats in them: nothing here carries a
 * count, because the platform has not been told one.
 */
export const UNPOOLED_PRODUCTS: string[] = [
  'Tableau', 'TeamViewer', 'Adobe Pro', 'Adobe Acrobat', 'MS Visio', 'Visio', 'MS Project',
  'Webex', 'Copilot', 'ChatGPT Enterprise', 'ChatGPT', 'Thinkcell', 'Efficient Elements',
  'monday.com', 'Exact Globe', 'Windows', 'Excel', 'Teams', 'Office', 'O365', 'Claude',
]

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

  const product = PRODUCTS.find(
    (p) => t.includes(p.name.toLowerCase()) || t.includes(p.id) || p.aliases.some((a) => t.includes(a)),
  ) ?? null
  const unpooled = product
    ? null
    : UNPOOLED_PRODUCTS.find((n) => t.includes(n.toLowerCase())) ?? null

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

  const missing: string[] = []
  if (!product && !unpooled) missing.push('which product')
  if (termUnreadable) missing.push('how long for')

  return { type, product, months, on, missing, notARequest, unpooled, termStated: months !== null, termUnreadable }
}
